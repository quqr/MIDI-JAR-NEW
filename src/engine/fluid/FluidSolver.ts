// ─── N-S 求解器核心：curl → vorticity → divergence → pressure → gradient → advection → splat ───
// 参考 WebGL-Fluid-Simulation by PavelDoGreat (MIT)

import type { GLExtensions } from "./GLContext";
import { Program } from "./GLUtils";
import {
  type FBO,
  type DoubleFBO,
  createFBO,
  createDoubleFBO,
  resizeDoubleFBO,
  getResolution,
} from "./FramebufferManager";
import type { FluidSimulationConfig } from "./FluidConfig";

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export class FluidSolver {
  private gl: WebGLRenderingContext;
  private ext: GLExtensions;
  private blit: (target: FBO | null, clear?: boolean) => void;
  private config: FluidSimulationConfig;

  private copyProgram: Program;
  private clearProgram: Program;
  private splatProgram: Program;
  private advectionProgram: Program;
  private divergenceProgram: Program;
  private curlProgram: Program;
  private vorticityProgram: Program;
  private pressureProgram: Program;
  private gradientSubtractProgram: Program;

  // 仿真场（双缓冲 ping-pong）
  private dye: DoubleFBO | null = null;
  private velocity: DoubleFBO | null = null;
  private divergence: FBO | null = null;
  private curl: FBO | null = null;
  private pressure: DoubleFBO | null = null;

  constructor(
    gl: WebGLRenderingContext,
    ext: GLExtensions,
    blit: (target: FBO | null, clear?: boolean) => void,
    copyProgram: Program,
    clearProgram: Program,
    splatProgram: Program,
    advectionProgram: Program,
    divergenceProgram: Program,
    curlProgram: Program,
    vorticityProgram: Program,
    pressureProgram: Program,
    gradientSubtractProgram: Program,
    config: FluidSimulationConfig,
  ) {
    this.gl = gl;
    this.ext = ext;
    this.blit = blit;
    this.config = config;
    this.copyProgram = copyProgram;
    this.clearProgram = clearProgram;
    this.splatProgram = splatProgram;
    this.advectionProgram = advectionProgram;
    this.divergenceProgram = divergenceProgram;
    this.curlProgram = curlProgram;
    this.vorticityProgram = vorticityProgram;
    this.pressureProgram = pressureProgram;
    this.gradientSubtractProgram = gradientSubtractProgram;
  }

  initFramebuffers() {
    const gl = this.gl;
    const ext = this.ext;
    const config = this.config;

    const simRes = getResolution(gl, config.SIM_RESOLUTION);
    const dyeRes = getResolution(gl, config.DYE_RESOLUTION);

    const texType = ext.halfFloatTexType;
    const rgba = ext.formatRGBA;
    const rg = ext.formatRG;
    const r = ext.formatR;
    const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

    if (!rgba || !rg || !r) {
      throw new Error("Required WebGL texture formats not supported");
    }

    gl.disable(gl.BLEND);

    if (this.dye == null) {
      this.dye = createDoubleFBO(
        gl,
        ext,
        dyeRes.width,
        dyeRes.height,
        rgba.internalFormat,
        rgba.format,
        texType,
        filtering,
      );
    } else {
      this.dye = resizeDoubleFBO(
        gl,
        ext,
        this.dye,
        dyeRes.width,
        dyeRes.height,
        rgba.internalFormat,
        rgba.format,
        texType,
        filtering,
        this.copyProgram,
        this.blit,
      );
    }

    if (this.velocity == null) {
      this.velocity = createDoubleFBO(
        gl,
        ext,
        simRes.width,
        simRes.height,
        rg.internalFormat,
        rg.format,
        texType,
        filtering,
      );
    } else {
      this.velocity = resizeDoubleFBO(
        gl,
        ext,
        this.velocity,
        simRes.width,
        simRes.height,
        rg.internalFormat,
        rg.format,
        texType,
        filtering,
        this.copyProgram,
        this.blit,
      );
    }

    this.divergence = createFBO(
      gl,
      ext,
      simRes.width,
      simRes.height,
      r.internalFormat,
      r.format,
      texType,
      gl.NEAREST,
    );
    this.curl = createFBO(
      gl,
      ext,
      simRes.width,
      simRes.height,
      r.internalFormat,
      r.format,
      texType,
      gl.NEAREST,
    );
    this.pressure = createDoubleFBO(
      gl,
      ext,
      simRes.width,
      simRes.height,
      r.internalFormat,
      r.format,
      texType,
      gl.NEAREST,
    );
  }

  /** N-S 求解一步：所有 shader pass 串行执行 */
  step(dt: number) {
    const gl = this.gl;
    const config = this.config;
    if (!this.dye || !this.velocity || !this.divergence || !this.curl || !this.pressure) {
      return;
    }

    gl.disable(gl.BLEND);

    // 1. curl
    this.curlProgram.bind();
    gl.uniform2f(
      this.curlProgram.uniforms.texelSize,
      this.velocity.texelSizeX,
      this.velocity.texelSizeY,
    );
    gl.uniform1i(this.curlProgram.uniforms.uVelocity, this.velocity.read.attach(0));
    this.blit(this.curl);

    // 2. vorticity confinement
    this.vorticityProgram.bind();
    gl.uniform2f(
      this.vorticityProgram.uniforms.texelSize,
      this.velocity.texelSizeX,
      this.velocity.texelSizeY,
    );
    gl.uniform1i(this.vorticityProgram.uniforms.uVelocity, this.velocity.read.attach(0));
    gl.uniform1i(this.vorticityProgram.uniforms.uCurl, this.curl.attach(1));
    gl.uniform1f(this.vorticityProgram.uniforms.curl, config.CURL);
    gl.uniform1f(this.vorticityProgram.uniforms.dt, dt);
    this.blit(this.velocity.write);
    this.velocity.swap();

    // 3. divergence
    this.divergenceProgram.bind();
    gl.uniform2f(
      this.divergenceProgram.uniforms.texelSize,
      this.velocity.texelSizeX,
      this.velocity.texelSizeY,
    );
    gl.uniform1i(this.divergenceProgram.uniforms.uVelocity, this.velocity.read.attach(0));
    this.blit(this.divergence);

    // 4. clear pressure (衰减)
    this.clearProgram.bind();
    gl.uniform1i(this.clearProgram.uniforms.uTexture, this.pressure.read.attach(0));
    gl.uniform1f(this.clearProgram.uniforms.value, config.PRESSURE);
    this.blit(this.pressure.write);
    this.pressure.swap();

    // 5. pressure Jacobi 迭代
    this.pressureProgram.bind();
    gl.uniform2f(
      this.pressureProgram.uniforms.texelSize,
      this.velocity.texelSizeX,
      this.velocity.texelSizeY,
    );
    gl.uniform1i(this.pressureProgram.uniforms.uDivergence, this.divergence.attach(0));
    for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(this.pressureProgram.uniforms.uPressure, this.pressure.read.attach(1));
      this.blit(this.pressure.write);
      this.pressure.swap();
    }

    // 6. gradient subtract
    this.gradientSubtractProgram.bind();
    gl.uniform2f(
      this.gradientSubtractProgram.uniforms.texelSize,
      this.velocity.texelSizeX,
      this.velocity.texelSizeY,
    );
    gl.uniform1i(this.gradientSubtractProgram.uniforms.uPressure, this.pressure.read.attach(0));
    gl.uniform1i(this.gradientSubtractProgram.uniforms.uVelocity, this.velocity.read.attach(1));
    this.blit(this.velocity.write);
    this.velocity.swap();

    // 7. advection (velocity)
    this.advectionProgram.bind();
    gl.uniform2f(
      this.advectionProgram.uniforms.texelSize,
      this.velocity.texelSizeX,
      this.velocity.texelSizeY,
    );
    if (!this.ext.supportLinearFiltering) {
      gl.uniform2f(
        this.advectionProgram.uniforms.dyeTexelSize,
        this.velocity.texelSizeX,
        this.velocity.texelSizeY,
      );
    }
    const velocityId = this.velocity.read.attach(0);
    gl.uniform1i(this.advectionProgram.uniforms.uVelocity, velocityId);
    gl.uniform1i(this.advectionProgram.uniforms.uSource, velocityId);
    gl.uniform1f(this.advectionProgram.uniforms.dt, dt);
    gl.uniform1f(this.advectionProgram.uniforms.dissipation, config.VELOCITY_DISSIPATION);
    this.blit(this.velocity.write);
    this.velocity.swap();

    // 8. advection (dye)
    if (!this.ext.supportLinearFiltering) {
      gl.uniform2f(
        this.advectionProgram.uniforms.dyeTexelSize,
        this.dye.texelSizeX,
        this.dye.texelSizeY,
      );
    }
    gl.uniform1i(this.advectionProgram.uniforms.uVelocity, this.velocity.read.attach(0));
    gl.uniform1i(this.advectionProgram.uniforms.uSource, this.dye.read.attach(1));
    gl.uniform1f(this.advectionProgram.uniforms.dissipation, config.DENSITY_DISSIPATION);
    this.blit(this.dye.write);
    this.dye.swap();
  }

  /**
   * 注入一个 splat：在 (x, y) 处用力 (dx, dy) 扰动速度场，并用 color 染色染料场
   * @param x 0-1 水平归一化坐标
   * @param y 0-1 垂直归一化坐标（注意原项目使用底部为 0）
   * @param dx x 方向力
   * @param dy y 方向力
   * @param color 染料颜色
   */
  splat(x: number, y: number, dx: number, dy: number, color: RGBColor) {
    const gl = this.gl;
    const config = this.config;
    if (!this.dye || !this.velocity) return;

    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));

    const aspectRatio = this.getCanvasAspectRatio();
    const radius = Math.max(0.000001, correctRadius(config.SPLAT_RADIUS, aspectRatio));

    this.splatProgram.bind();
    gl.uniform1i(this.splatProgram.uniforms.uTarget, this.velocity.read.attach(0));
    gl.uniform1f(this.splatProgram.uniforms.aspectRatio, aspectRatio);
    gl.uniform2f(this.splatProgram.uniforms.point, x, y);
    gl.uniform3f(this.splatProgram.uniforms.color, dx, dy, 0.0);
    gl.uniform1f(this.splatProgram.uniforms.radius, radius);
    this.blit(this.velocity.write);
    this.velocity.swap();

    gl.uniform1i(this.splatProgram.uniforms.uTarget, this.dye.read.attach(0));
    gl.uniform3f(this.splatProgram.uniforms.color, color.r, color.g, color.b);
    this.blit(this.dye.write);
    this.dye.swap();
  }

  /** 随机注入多个 splat（启动时或调试时使用） */
  multipleSplats(amount: number) {
    for (let i = 0; i < amount; i++) {
      const color = generateColor();
      color.r *= 10.0;
      color.g *= 10.0;
      color.b *= 10.0;
      const x = Math.random();
      const y = Math.random();
      const dx = 1000 * (Math.random() - 0.5);
      const dy = 1000 * (Math.random() - 0.5);
      this.splat(x, y, dx, dy, color);
    }
  }

  resize() {
    this.initFramebuffers();
  }

  destroy() {
    // 各 FBO 的纹理与帧缓冲通过 WebGL context 丢失自动释放，这里仅断引用
    this.dye = null;
    this.velocity = null;
    this.divergence = null;
    this.curl = null;
    this.pressure = null;
  }

  updateConfig(config: FluidSimulationConfig) {
    const needsRebuild =
      config.SIM_RESOLUTION !== this.config.SIM_RESOLUTION ||
      config.DYE_RESOLUTION !== this.config.DYE_RESOLUTION;
    this.config = config;
    if (needsRebuild) {
      this.initFramebuffers();
    }
  }

  getDye(): FBO | null {
    return this.dye?.read ?? null;
  }

  getDyeDouble(): DoubleFBO | null {
    return this.dye;
  }

  getVelocity(): DoubleFBO | null {
    return this.velocity;
  }

  private getCanvasAspectRatio(): number {
    return this.gl.drawingBufferWidth / this.gl.drawingBufferHeight;
  }
}

function correctRadius(radius: number, aspectRatio: number): number {
  if (aspectRatio > 1) radius *= aspectRatio;
  return radius;
}

/** 随机 HSV → RGB 颜色（参考原项目 generateColor） */
export function generateColor(): RGBColor {
  const c = HSVtoRGB(Math.random(), 1.0, 1.0);
  c.r *= 0.15;
  c.g *= 0.15;
  c.b *= 0.15;
  return c;
}

export function HSVtoRGB(h: number, s: number, v: number): RGBColor {
  let r = 0;
  let g = 0;
  let b = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      r = v; g = t; b = p;
      break;
    case 1:
      r = q; g = v; b = p;
      break;
    case 2:
      r = p; g = v; b = t;
      break;
    case 3:
      r = p; g = q; b = v;
      break;
    case 4:
      r = t; g = p; b = v;
      break;
    case 5:
      r = v; g = p; b = q;
      break;
  }
  return { r, g, b };
}
