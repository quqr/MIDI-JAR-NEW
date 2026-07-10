// ─── Sunrays 后处理 pass：mask（亮度→alpha）→ radial light rays 迭代 → 双向模糊 ───
// 参考 WebGL-Fluid-Simulation by PavelDoGreat (MIT)

import type { GLExtensions } from "./GLContext";
import { Program } from "./GLUtils";
import {
  type FBO,
  createFBO,
  getResolution,
} from "./FramebufferManager";
import type { FluidSimulationConfig } from "./FluidConfig";

export class SunraysPass {
  private gl: WebGLRenderingContext;
  private ext: GLExtensions;
  private blit: (target: FBO | null, clear?: boolean) => void;
  private config: FluidSimulationConfig;

  private sunraysMaskProgram: Program;
  private sunraysProgram: Program;
  private blurProgram: Program;

  private sunrays: FBO | null = null;
  private sunraysTemp: FBO | null = null;

  constructor(
    gl: WebGLRenderingContext,
    ext: GLExtensions,
    blit: (target: FBO | null, clear?: boolean) => void,
    sunraysMaskProgram: Program,
    sunraysProgram: Program,
    blurProgram: Program,
    config: FluidSimulationConfig,
  ) {
    this.gl = gl;
    this.ext = ext;
    this.blit = blit;
    this.sunraysMaskProgram = sunraysMaskProgram;
    this.sunraysProgram = sunraysProgram;
    this.blurProgram = blurProgram;
    this.config = config;
  }

  initFramebuffers() {
    const gl = this.gl;
    const ext = this.ext;
    const res = getResolution(gl, this.config.SUNRAYS_RESOLUTION);

    const texType = ext.halfFloatTexType;
    const r = ext.formatR;
    const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
    if (!r) {
      throw new Error("Required WebGL R format not supported for Sunrays");
    }

    this.sunrays = createFBO(
      gl,
      ext,
      res.width,
      res.height,
      r.internalFormat,
      r.format,
      texType,
      filtering,
    );
    this.sunraysTemp = createFBO(
      gl,
      ext,
      res.width,
      res.height,
      r.internalFormat,
      r.format,
      texType,
      filtering,
    );
  }

  /** mask: source → mask；rays: mask → destination；调用方需保证 destination 是 dye.write */
  apply(source: FBO, mask: FBO, destination: FBO) {
    const gl = this.gl;
    const config = this.config;

    gl.disable(gl.BLEND);
    this.sunraysMaskProgram.bind();
    gl.uniform1i(this.sunraysMaskProgram.uniforms.uTexture, source.attach(0));
    this.blit(mask);

    this.sunraysProgram.bind();
    gl.uniform1f(this.sunraysProgram.uniforms.weight, config.SUNRAYS_WEIGHT);
    gl.uniform1i(this.sunraysProgram.uniforms.uTexture, mask.attach(0));
    this.blit(destination);
  }

  /** 双向模糊：水平 → 垂直，迭代 iterations 次 */
  blur(target: FBO, temp: FBO, iterations: number) {
    const gl = this.gl;
    this.blurProgram.bind();
    for (let i = 0; i < iterations; i++) {
      // 水平
      gl.uniform2f(this.blurProgram.uniforms.texelSize, target.texelSizeX, 0.0);
      gl.uniform1i(this.blurProgram.uniforms.uTexture, target.attach(0));
      this.blit(temp);
      // 垂直
      gl.uniform2f(this.blurProgram.uniforms.texelSize, 0.0, target.texelSizeY);
      gl.uniform1i(this.blurProgram.uniforms.uTexture, temp.attach(0));
      this.blit(target);
    }
  }

  getSunrays(): FBO | null {
    return this.sunrays;
  }

  getSunraysTemp(): FBO | null {
    return this.sunraysTemp;
  }

  resize() {
    this.initFramebuffers();
  }

  updateConfig(config: FluidSimulationConfig) {
    const needsRebuild =
      config.SUNRAYS_RESOLUTION !== this.config.SUNRAYS_RESOLUTION;
    this.config = config;
    if (needsRebuild) {
      this.initFramebuffers();
    }
  }

  destroy() {
    this.sunrays = null;
    this.sunraysTemp = null;
  }
}
