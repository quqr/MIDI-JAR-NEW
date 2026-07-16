// ─── Bloom 后处理 pass：prefilter → 多级下采样模糊 → 上采样合成 → final ───
// 参考 WebGL-Fluid-Simulation by PavelDoGreat (MIT)

import type { GLExtensions } from "./GLContext";
import { Program } from "./GLUtils";
import { type FBO, createFBO, getResolution } from "./FramebufferManager";
import type { FluidSimulationConfig } from "./FluidConfig";

export class BloomPass {
  private gl: WebGLRenderingContext;
  private ext: GLExtensions;
  private blit: (target: FBO | null, clear?: boolean) => void;
  private config: FluidSimulationConfig;

  private bloomPrefilterProgram: Program;
  private bloomBlurProgram: Program;
  private bloomFinalProgram: Program;

  private bloom: FBO | null = null;
  private bloomFramebuffers: FBO[] = [];

  constructor(
    gl: WebGLRenderingContext,
    ext: GLExtensions,
    blit: (target: FBO | null, clear?: boolean) => void,
    bloomPrefilterProgram: Program,
    bloomBlurProgram: Program,
    bloomFinalProgram: Program,
    config: FluidSimulationConfig,
  ) {
    this.gl = gl;
    this.ext = ext;
    this.blit = blit;
    this.bloomPrefilterProgram = bloomPrefilterProgram;
    this.bloomBlurProgram = bloomBlurProgram;
    this.bloomFinalProgram = bloomFinalProgram;
    this.config = config;
  }

  initFramebuffers() {
    const gl = this.gl;
    const ext = this.ext;
    const res = getResolution(gl, this.config.BLOOM_RESOLUTION);

    const texType = ext.halfFloatTexType;
    const rgba = ext.formatRGBA;
    const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
    if (!rgba) {
      throw new Error("Required WebGL RGBA format not supported for Bloom");
    }

    this.bloom = createFBO(
      gl,
      ext,
      res.width,
      res.height,
      rgba.internalFormat,
      rgba.format,
      texType,
      filtering,
    );

    this.bloomFramebuffers = [];
    for (let i = 0; i < this.config.BLOOM_ITERATIONS; i++) {
      const width = res.width >> (i + 1);
      const height = res.height >> (i + 1);
      if (width < 2 || height < 2) break;
      const fbo = createFBO(
        gl,
        ext,
        width,
        height,
        rgba.internalFormat,
        rgba.format,
        texType,
        filtering,
      );
      this.bloomFramebuffers.push(fbo);
    }
  }

  apply(source: FBO, destination: FBO) {
    const gl = this.gl;
    const config = this.config;
    if (this.bloomFramebuffers.length < 2 || !this.bloom) return;

    let last: FBO = destination;

    gl.disable(gl.BLEND);
    this.bloomPrefilterProgram.bind();
    const knee = config.BLOOM_THRESHOLD * config.BLOOM_SOFT_KNEE + 0.0001;
    const curve0 = config.BLOOM_THRESHOLD - knee;
    const curve1 = knee * 2;
    const curve2 = 0.25 / knee;
    gl.uniform3f(
      this.bloomPrefilterProgram.uniforms.curve,
      curve0,
      curve1,
      curve2,
    );
    gl.uniform1f(
      this.bloomPrefilterProgram.uniforms.threshold,
      config.BLOOM_THRESHOLD,
    );
    gl.uniform1i(
      this.bloomPrefilterProgram.uniforms.uTexture,
      source.attach(0),
    );
    this.blit(last);

    this.bloomBlurProgram.bind();
    // 下采样：destination → 各级 bloomFramebuffers
    for (let i = 0; i < this.bloomFramebuffers.length; i++) {
      const dest = this.bloomFramebuffers[i];
      gl.uniform2f(
        this.bloomBlurProgram.uniforms.texelSize,
        last.texelSizeX,
        last.texelSizeY,
      );
      gl.uniform1i(this.bloomBlurProgram.uniforms.uTexture, last.attach(0));
      this.blit(dest);
      last = dest;
    }

    gl.blendFunc(gl.ONE, gl.ONE);
    gl.enable(gl.BLEND);

    // 上采样：从最小级别反向回写到大级别
    for (let i = this.bloomFramebuffers.length - 2; i >= 0; i--) {
      const baseTex = this.bloomFramebuffers[i];
      gl.uniform2f(
        this.bloomBlurProgram.uniforms.texelSize,
        last.texelSizeX,
        last.texelSizeY,
      );
      gl.uniform1i(this.bloomBlurProgram.uniforms.uTexture, last.attach(0));
      gl.viewport(0, 0, baseTex.width, baseTex.height);
      this.blit(baseTex);
      last = baseTex;
    }

    gl.disable(gl.BLEND);
    this.bloomFinalProgram.bind();
    gl.uniform2f(
      this.bloomFinalProgram.uniforms.texelSize,
      last.texelSizeX,
      last.texelSizeY,
    );
    gl.uniform1i(this.bloomFinalProgram.uniforms.uTexture, last.attach(0));
    gl.uniform1f(
      this.bloomFinalProgram.uniforms.intensity,
      config.BLOOM_INTENSITY,
    );
    this.blit(destination);
  }

  getBloom(): FBO | null {
    return this.bloom;
  }

  resize() {
    this.initFramebuffers();
  }

  updateConfig(config: FluidSimulationConfig) {
    const needsRebuild =
      config.BLOOM_RESOLUTION !== this.config.BLOOM_RESOLUTION ||
      config.BLOOM_ITERATIONS !== this.config.BLOOM_ITERATIONS;
    this.config = config;
    if (needsRebuild) {
      this.initFramebuffers();
    }
  }

  destroy() {
    this.bloom = null;
    this.bloomFramebuffers = [];
  }
}
