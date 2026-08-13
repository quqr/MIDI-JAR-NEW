// ─── N-S 求解器核心调度器：curl → vorticity → divergence → pressure → gradient → advection → splat ───
// 重构后仅负责物理步骤编排；资源管理下沉 FluidResources，渲染管线下沉 FluidRenderer，
// 诊断数据下沉 PerformanceTracker，纯数学工具下沉 FluidMath。
// 参考 WebGL-Fluid-Simulation by PavelDoGreat (MIT)

import type { GLExtensions } from "./GLContext";
import type { FBO, DoubleFBO } from "./FramebufferManager";
import type { FluidSimulationConfig } from "./FluidConfig";
import type { SolverStepTimings, TextureSample, RGBColor } from "./types";
import { FluidResources } from "./FluidResources";
import { FluidRenderer } from "./FluidRenderer";
import type { ShaderLibrary } from "./ShaderLibrary";
import {
  PerformanceTracker,
  fluidPerformanceTracker,
  sampleDyeCenter,
} from "./FluidDiagnostics";
import { generateColor, correctRadius } from "./FluidMath";

export type { RGBColor } from "./types";

export class FluidSolver {
  private gl: WebGLRenderingContext;
  private ext: GLExtensions;
  private config: FluidSimulationConfig;
  private shaders: ShaderLibrary;
  private resources: FluidResources;
  private renderer: FluidRenderer;
  private tracker: PerformanceTracker;

  constructor(
    gl: WebGLRenderingContext,
    ext: GLExtensions,
    blit: (target: FBO | null, clear?: boolean) => void,
    shaders: ShaderLibrary,
    config: FluidSimulationConfig,
  ) {
    this.gl = gl;
    this.ext = ext;
    this.config = config;
    this.shaders = shaders;
    this.resources = new FluidResources(gl, ext, blit, shaders.copy, config);
    this.renderer = new FluidRenderer(blit);
    this.tracker = fluidPerformanceTracker;
  }

  initFramebuffers() {
    this.resources.allocate();
  }

  resize() {
    this.resources.resize();
  }

  destroy() {
    this.resources.release();
  }

  updateConfig(config: FluidSimulationConfig) {
    this.config = config;
    this.resources.updateConfig(config);
  }

  getDyeDouble(): DoubleFBO | null {
    return this.resources.dye;
  }

  /** 获取上一次 step() 各子步骤耗时 */
  getLastStepTimings(): SolverStepTimings {
    return this.tracker.getTimings();
  }

  /** 采样 dye 纹理中心像素（用于诊断；非主流程，静默失败） */
  sampleDyeCenter(): TextureSample {
    return sampleDyeCenter(this.gl, this.resources.dye);
  }

  /** N-S 求解一步：所有 shader pass 串行执行 */
  step(dt: number) {
    if (!this.resources.ready()) return;

    this.gl.disable(this.gl.BLEND);
    this.tracker.resetStep();

    this.computeCurl();
    this.applyVorticity(dt);
    this.computeDivergence();
    this.clearPressure();
    this.solvePressure();
    this.subtractGradient();
    this.advectVelocity(dt);
    this.advectDye();

    this.tracker.finishStep();
  }

  // ─── step 子步骤：每个语义化方法对应一个物理阶段 ───
  // 注：所有子方法由 step() 在 resources.ready() 通过后调用，
  // 字段非空由该前置条件保证，故以非空断言访问。

  private computeCurl(): void {
    const curl = this.resources.curl!;
    const velocity = this.resources.velocity!;
    const ms = this.renderer.executePass(this.shaders.curl, curl, (u) => {
      this.gl.uniform2f(u.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      this.gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    });
    this.tracker.record("curl", ms);
  }

  private applyVorticity(dt: number): void {
    const velocity = this.resources.velocity!;
    const curl = this.resources.curl!;
    const ms = this.renderer.executePass(
      this.shaders.vorticity,
      velocity.write,
      (u) => {
        this.gl.uniform2f(
          u.texelSize,
          velocity.texelSizeX,
          velocity.texelSizeY,
        );
        this.gl.uniform1i(u.uVelocity, velocity.read.attach(0));
        this.gl.uniform1i(u.uCurl, curl.attach(1));
        this.gl.uniform1f(u.curl, this.config.CURL);
        this.gl.uniform1f(u.dt, dt);
      },
    );
    velocity.swap();
    this.tracker.record("vorticity", ms);
  }

  private computeDivergence(): void {
    const divergence = this.resources.divergence!;
    const velocity = this.resources.velocity!;
    const ms = this.renderer.executePass(
      this.shaders.divergence,
      divergence,
      (u) => {
        this.gl.uniform2f(
          u.texelSize,
          velocity.texelSizeX,
          velocity.texelSizeY,
        );
        this.gl.uniform1i(u.uVelocity, velocity.read.attach(0));
      },
    );
    this.tracker.record("divergence", ms);
  }

  private clearPressure(): void {
    const pressure = this.resources.pressure!;
    const ms = this.renderer.executePass(
      this.shaders.clear,
      pressure.write,
      (u) => {
        this.gl.uniform1i(u.uTexture, pressure.read.attach(0));
        this.gl.uniform1f(u.value, this.config.PRESSURE);
      },
    );
    pressure.swap();
    this.tracker.record("clearPressure", ms);
  }

  /** pressure Jacobi 迭代：bind 一次 + N 次 blit+swap，不走 executePass */
  private solvePressure(): void {
    const pressure = this.resources.pressure!;
    const divergence = this.resources.divergence!;
    const velocity = this.resources.velocity!;
    const t0 = performance.now();
    this.renderer.bind(this.shaders.pressure);
    this.gl.uniform2f(
      this.shaders.pressure.uniforms.texelSize,
      velocity.texelSizeX,
      velocity.texelSizeY,
    );
    this.gl.uniform1i(
      this.shaders.pressure.uniforms.uDivergence,
      divergence.attach(0),
    );
    for (let i = 0; i < this.config.PRESSURE_ITERATIONS; i++) {
      this.gl.uniform1i(
        this.shaders.pressure.uniforms.uPressure,
        pressure.read.attach(1),
      );
      this.renderer.drawTo(pressure.write);
      pressure.swap();
    }
    this.tracker.record("pressure", performance.now() - t0);
  }

  private subtractGradient(): void {
    const velocity = this.resources.velocity!;
    const pressure = this.resources.pressure!;
    const ms = this.renderer.executePass(
      this.shaders.gradientSubtract,
      velocity.write,
      (u) => {
        this.gl.uniform2f(
          u.texelSize,
          velocity.texelSizeX,
          velocity.texelSizeY,
        );
        this.gl.uniform1i(u.uPressure, pressure.read.attach(0));
        this.gl.uniform1i(u.uVelocity, velocity.read.attach(1));
      },
    );
    velocity.swap();
    this.tracker.record("gradientSubtract", ms);
  }

  private advectVelocity(dt: number): void {
    const velocity = this.resources.velocity!;
    const ms = this.renderer.executePass(
      this.shaders.advection,
      velocity.write,
      (u) => {
        this.gl.uniform2f(
          u.texelSize,
          velocity.texelSizeX,
          velocity.texelSizeY,
        );
        if (!this.ext.supportLinearFiltering) {
          this.gl.uniform2f(
            u.dyeTexelSize,
            velocity.texelSizeX,
            velocity.texelSizeY,
          );
        }
        const velocityId = velocity.read.attach(0);
        this.gl.uniform1i(u.uVelocity, velocityId);
        this.gl.uniform1i(u.uSource, velocityId);
        this.gl.uniform1f(u.dt, dt);
        this.gl.uniform1f(u.dissipation, this.config.VELOCITY_DISSIPATION);
      },
    );
    velocity.swap();
    this.tracker.record("advectVelocity", ms);
  }

  /**
   * advection program 的 dt uniform 由 advectVelocity 设置，
   * WebGL program 状态在 useProgram 间持久，此处无需重复设置 dt。
   */
  private advectDye(): void {
    const velocity = this.resources.velocity!;
    const dye = this.resources.dye!;
    const ms = this.renderer.executePass(
      this.shaders.advection,
      dye.write,
      (u) => {
        if (!this.ext.supportLinearFiltering) {
          this.gl.uniform2f(u.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
        }
        this.gl.uniform1i(u.uVelocity, velocity.read.attach(0));
        this.gl.uniform1i(u.uSource, dye.read.attach(1));
        this.gl.uniform1f(u.dissipation, this.config.DENSITY_DISSIPATION);
      },
    );
    dye.swap();
    this.tracker.record("advectDye", ms);
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
    const { velocity, dye } = this.resources;
    if (!dye || !velocity) return;

    // 将输入坐标限制在 [0, 1] 范围内，防止越界
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));

    // 获取画布宽高比，校正 splat 半径（避免非正方形画布上的形变）
    const aspectRatio =
      this.gl.drawingBufferWidth / this.gl.drawingBufferHeight;
    const radius = Math.max(
      10e-6,
      correctRadius(this.config.SPLAT_RADIUS, aspectRatio),
    );

    // ========== 第一步：向速度场注入动量 ==========
    this.renderer.executePass(this.shaders.splat, velocity.write, (u) => {
      this.gl.uniform1i(u.uTarget, velocity.read.attach(0));
      this.gl.uniform1f(u.aspectRatio, aspectRatio);
      this.gl.uniform2f(u.point, x, y);
      this.gl.uniform3f(u.color, dx, dy, 0.0);
      this.gl.uniform1f(u.radius, radius);
    });
    velocity.swap();

    // ========== 第二步：向染料场注入颜色 ==========
    this.renderer.executePass(this.shaders.splat, dye.write, (u) => {
      this.gl.uniform1i(u.uTarget, dye.read.attach(0));
      this.gl.uniform3f(u.color, color.r, color.g, color.b);
    });
    dye.swap();
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
}
