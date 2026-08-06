// ─── 流体仿真 FBO 资源管理：dye/velocity/divergence/curl/pressure 生命周期 ───
// 从 FluidSolver.initFramebuffers/destroy/updateConfig 提取，隐藏纹理格式底层细节

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

export class FluidResources {
  // 仿真场（双缓冲 ping-pong + 单缓冲辅助场）
  dye: DoubleFBO | null = null;
  velocity: DoubleFBO | null = null;
  divergence: FBO | null = null;
  curl: FBO | null = null;
  pressure: DoubleFBO | null = null;

  private gl: WebGLRenderingContext;
  private ext: GLExtensions;
  private blit: (target: FBO | null, clear?: boolean) => void;
  private copyProgram: Program;
  private config: FluidSimulationConfig;

  constructor(
    gl: WebGLRenderingContext,
    ext: GLExtensions,
    blit: (target: FBO | null, clear?: boolean) => void,
    copyProgram: Program,
    config: FluidSimulationConfig,
  ) {
    this.gl = gl;
    this.ext = ext;
    this.blit = blit;
    this.copyProgram = copyProgram;
    this.config = config;
  }

  /**
   * 创建或调整 FBO 尺寸。
   * 首次分配走 createDoubleFBO；后续调用走 resizeDoubleFBO（保留旧纹理内容）。
   */
  allocate(): void {
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

  /** 释放引用（纹理/帧缓冲随 WebGL context 丢失自动回收） */
  release(): void {
    this.dye = null;
    this.velocity = null;
    this.divergence = null;
    this.curl = null;
    this.pressure = null;
  }

  /** 调整尺寸：等价于重新 allocate（resizeDoubleFBO 内部判断尺寸是否变化） */
  resize(): void {
    this.allocate();
  }

  updateConfig(config: FluidSimulationConfig): void {
    const needsRebuild =
      config.SIM_RESOLUTION !== this.config.SIM_RESOLUTION ||
      config.DYE_RESOLUTION !== this.config.DYE_RESOLUTION;
    this.config = config;
    if (needsRebuild) {
      this.allocate();
    }
  }

  /** 所有 FBO 就绪，可执行 step() */
  ready(): boolean {
    return !!(
      this.dye &&
      this.velocity &&
      this.divergence &&
      this.curl &&
      this.pressure
    );
  }
}
