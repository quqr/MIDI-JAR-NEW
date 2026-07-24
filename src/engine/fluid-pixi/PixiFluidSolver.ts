// ─── PixiJS 流体 N-S 求解器：curl → vorticity → divergence → clear → pressure → gradient → advection → splat ───
// 将原生 WebGL FluidSolver 迁移为 PixiJS Filter + RenderTexture 管线

import { Filter, UniformGroup, RenderTexture, Texture } from "pixi.js";
import type { TEXTURE_FORMATS } from "pixi.js";
import type { SolverStepTimings, TextureSample } from "@/views/FluidCompare/diagnostics";
import { EMPTY_TIMINGS, EMPTY_SAMPLE } from "@/views/FluidCompare/diagnostics";
import type { Renderer } from "pixi.js";
import { PixiFluidContext, type DoubleRT } from "./PixiFluidContext";
import {
  defaultFilterVertex,
  splatShader,
  advectionShader,
  curlShader,
  vorticityShader,
  divergenceShader,
  clearShader,
  pressureShader,
  gradientSubtractShader,
} from "./shaders";
import {
  DEFAULT_CONFIG,
  type FluidSimulationConfig,
} from "../fluid/FluidConfig";
import { generateColor } from "../fluid/FluidSolver";

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

/**
 * 根据短边分辨率和画布宽高比，计算实际纹理尺寸
 */
function getResolution(
  canvasWidth: number,
  canvasHeight: number,
  resolution: number,
): { width: number; height: number } {
  let aspectRatio = canvasWidth / canvasHeight;
  if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;

  const min = Math.round(resolution);
  const max = Math.round(resolution * aspectRatio);

  if (canvasWidth > canvasHeight) return { width: max, height: min };
  return { width: min, height: max };
}

/**
 * 修正 splat 半径：宽屏时水平半径需要乘以宽高比
 */
function correctRadius(radius: number, aspectRatio: number): number {
  if (aspectRatio > 1) radius *= aspectRatio;
  return radius;
}

/**
 * PixiJS 流体 N-S 求解器
 *
 * 职责：
 * 1. 管理仿真场 RenderTexture（dye, velocity, curl, divergence, pressure）
 * 2. 管理各步骤的 Filter 实例（一次性创建，每帧复用）
 * 3. 执行 N-S 求解步骤的 Filter Pass 序列
 * 4. 处理 splat 注入（速度场 + 染料场）
 *
 * 核心优化：
 * - 持久化 Sprite：整个生命周期只创建一次 quadSprite，零 GC 抖动
 * - 持久化 Filter：每个 pass 的 Filter 只创建一次，每帧仅更新 uniform
 * - 固定分辨率：流体 RenderTexture 使用固定低分辨率，不随窗口 resize 重建
 */
export class PixiFluidSolver {
  private ctx: PixiFluidContext;
  private config: FluidSimulationConfig;

  // ─── 各步骤的 Filter（初始化时创建一次，每帧复用） ───
  private curlFilter: Filter;
  private vorticityFilter: Filter;
  private divergenceFilter: Filter;
  private clearFilter: Filter;
  private pressureFilter: Filter;
  private gradientSubtractFilter: Filter;
  private advectionFilter: Filter;
  private splatFilter: Filter;

  // ─── 仿真场 RenderTexture ───
  private dye: DoubleRT | null = null;
  private velocity: DoubleRT | null = null;
  private curlRT: RenderTexture | null = null;
  private divergenceRT: RenderTexture | null = null;
  private pressure: DoubleRT | null = null;

  // ─── 缓存尺寸信息，避免每帧重新计算 ───
  private simWidth = 0;
  private simHeight = 0;
  private dyeWidth = 0;
  private dyeHeight = 0;

  // ─── 诊断插桩 ───
  private lastStepTimings: SolverStepTimings = { ...EMPTY_TIMINGS };

  constructor(ctx: PixiFluidContext, config?: Partial<FluidSimulationConfig>) {
    this.ctx = ctx;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 创建各步骤 Filter（一次性，生命周期与 solver 相同）
    this.curlFilter = this.createCurlFilter();
    this.vorticityFilter = this.createVorticityFilter();
    this.divergenceFilter = this.createDivergenceFilter();
    this.clearFilter = this.createClearFilter();
    this.pressureFilter = this.createPressureFilter();
    this.gradientSubtractFilter = this.createGradientSubtractFilter();
    this.advectionFilter = this.createAdvectionFilter();
    this.splatFilter = this.createSplatFilter();
  }

  // ─── Filter 工厂方法 ───

  /** curl Filter：计算速度场的旋度（涡量） */
  private createCurlFilter(): Filter {
    return Filter.from({
      gl: { vertex: defaultFilterVertex, fragment: curlShader },
      resources: {
        solverUniforms: new UniformGroup({
          texelSize: { value: new Float32Array([0, 0]), type: "vec2<f32>" },
        }),
      },
    });
  }

  /** vorticity Filter：涡量约束，增强涡旋效果 */
  private createVorticityFilter(): Filter {
    return Filter.from({
      gl: { vertex: defaultFilterVertex, fragment: vorticityShader },
      resources: {
        solverUniforms: new UniformGroup({
          texelSize: { value: new Float32Array([0, 0]), type: "vec2<f32>" },
          curl: { value: 30.0, type: "f32" },
          dt: { value: 0.016, type: "f32" },
        }),
        uCurl: Texture.WHITE.source,
        uCurlStyle: Texture.WHITE.source.style,
      },
    });
  }

  /** divergence Filter：计算速度场的散度 */
  private createDivergenceFilter(): Filter {
    return Filter.from({
      gl: { vertex: defaultFilterVertex, fragment: divergenceShader },
      resources: {
        solverUniforms: new UniformGroup({
          texelSize: { value: new Float32Array([0, 0]), type: "vec2<f32>" },
        }),
      },
    });
  }

  /** clear Filter：压力场衰减 */
  private createClearFilter(): Filter {
    return Filter.from({
      gl: { vertex: defaultFilterVertex, fragment: clearShader },
      resources: {
        solverUniforms: new UniformGroup({
          value: { value: 0.8, type: "f32" },
        }),
      },
    });
  }

  /** pressure Filter：Jacobi 迭代求解压力泊松方程 */
  private createPressureFilter(): Filter {
    return Filter.from({
      gl: { vertex: defaultFilterVertex, fragment: pressureShader },
      resources: {
        solverUniforms: new UniformGroup({
          texelSize: { value: new Float32Array([0, 0]), type: "vec2<f32>" },
        }),
        uDivergence: Texture.WHITE.source,
        uDivergenceStyle: Texture.WHITE.source.style,
      },
    });
  }

  /** gradientSubtract Filter：从速度场减去压力梯度 */
  private createGradientSubtractFilter(): Filter {
    return Filter.from({
      gl: { vertex: defaultFilterVertex, fragment: gradientSubtractShader },
      resources: {
        solverUniforms: new UniformGroup({
          texelSize: { value: new Float32Array([0, 0]), type: "vec2<f32>" },
        }),
        uPressure: Texture.WHITE.source,
        uPressureStyle: Texture.WHITE.source.style,
      },
    });
  }

  /** advection Filter：沿速度场推动量场 */
  private createAdvectionFilter(): Filter {
    return Filter.from({
      gl: { vertex: defaultFilterVertex, fragment: advectionShader },
      resources: {
        solverUniforms: new UniformGroup({
          texelSize: { value: new Float32Array([0, 0]), type: "vec2<f32>" },
          dyeTexelSize: { value: new Float32Array([0, 0]), type: "vec2<f32>" },
          dt: { value: 0.016, type: "f32" },
          dissipation: { value: 1.0, type: "f32" },
        }),
        uVelocity: Texture.WHITE.source,
        uVelocityStyle: Texture.WHITE.source.style,
      },
    });
  }

  /** splat Filter：高斯衰减叠加到目标场 */
  private createSplatFilter(): Filter {
    return Filter.from({
      gl: { vertex: defaultFilterVertex, fragment: splatShader },
      resources: {
        solverUniforms: new UniformGroup({
          aspectRatio: { value: 1.0, type: "f32" },
          color: { value: new Float32Array([0, 0, 0]), type: "vec3<f32>" },
          point: { value: new Float32Array([0, 0]), type: "vec2<f32>" },
          radius: { value: 0.005, type: "f32" },
        }),
      },
    });
  }

  // ─── Framebuffer 初始化 ───

  /**
   * 初始化仿真场 RenderTexture
   * 模拟场使用浮点格式，染料场使用 rgba16float，速度场使用 rg16float，压力/散度/旋度使用 r16float
   */
  initFramebuffers(): void {
    const app = this.ctx.application;
    const canvasWidth = app.screen.width;
    const canvasHeight = app.screen.height;

    const simRes = getResolution(
      canvasWidth,
      canvasHeight,
      this.config.SIM_RESOLUTION,
    );
    const dyeRes = getResolution(
      canvasWidth,
      canvasHeight,
      this.config.DYE_RESOLUTION,
    );

    this.simWidth = simRes.width;
    this.simHeight = simRes.height;
    this.dyeWidth = dyeRes.width;
    this.dyeHeight = dyeRes.height;

    // 销毁旧资源
    this.destroyFramebuffers();

    // 染料场：RGBA16F（颜色数据），线性插值
    this.dye = this.ctx.createDoubleRT(
      dyeRes.width,
      dyeRes.height,
      "rgba16float" as TEXTURE_FORMATS,
      "linear",
    );

    // 速度场：RG16F（2D 速度向量），线性插值
    this.velocity = this.ctx.createDoubleRT(
      simRes.width,
      simRes.height,
      "rg16float" as TEXTURE_FORMATS,
      "linear",
    );

    // 散度场：R16F，最近邻采样
    this.divergenceRT = this.ctx.createRT(
      simRes.width,
      simRes.height,
      "r16float" as TEXTURE_FORMATS,
      "nearest",
    );

    // 旋度场：R16F，最近邻采样
    this.curlRT = this.ctx.createRT(
      simRes.width,
      simRes.height,
      "r16float" as TEXTURE_FORMATS,
      "nearest",
    );

    // 压力场：R16F 双缓冲，最近邻采样
    this.pressure = this.ctx.createDoubleRT(
      simRes.width,
      simRes.height,
      "r16float" as TEXTURE_FORMATS,
      "nearest",
    );
  }

  // ─── N-S 求解步骤 ───

  /**
   * 执行一步 N-S 求解：所有 Filter Pass 串行执行
   * @param dt - 时间步长（秒）
   */
  step(dt: number): void {
    if (
      !this.dye ||
      !this.velocity ||
      !this.divergenceRT ||
      !this.curlRT ||
      !this.pressure
    ) {
      return;
    }

    const config = this.config;
    const velTexelX = 1.0 / this.simWidth;
    const velTexelY = 1.0 / this.simHeight;

    const stepStart = performance.now();
    let t0 = performance.now();

    // 1. curl → 输出到 curlRT
    const curlU = this.curlFilter.resources.solverUniforms.uniforms;
    curlU.texelSize = [velTexelX, velTexelY];
    this.ctx.applyPass(this.curlFilter, this.velocity.read, this.curlRT);
    this.lastStepTimings.curl = performance.now() - t0;

    // 2. vorticity confinement → 输出到 velocity.write，swap
    t0 = performance.now();
    const vortU = this.vorticityFilter.resources.solverUniforms.uniforms;
    vortU.texelSize = [velTexelX, velTexelY];
    vortU.curl = config.CURL;
    vortU.dt = dt;
    // 设置额外纹理：uCurl（旋度场）
    this.vorticityFilter.resources.uCurl = this.curlRT.source;
    this.vorticityFilter.resources.uCurlStyle = this.curlRT.source.style;
    this.ctx.applyPass(
      this.vorticityFilter,
      this.velocity.read,
      this.velocity.write,
    );
    this.velocity.swap();
    this.lastStepTimings.vorticity = performance.now() - t0;

    // 3. divergence → 输出到 divergenceRT
    t0 = performance.now();
    const divU = this.divergenceFilter.resources.solverUniforms.uniforms;
    divU.texelSize = [velTexelX, velTexelY];
    this.ctx.applyPass(
      this.divergenceFilter,
      this.velocity.read,
      this.divergenceRT,
    );
    this.lastStepTimings.divergence = performance.now() - t0;

    // 4. clear pressure（衰减）
    t0 = performance.now();
    const clearU = this.clearFilter.resources.solverUniforms.uniforms;
    clearU.value = config.PRESSURE;
    this.ctx.applyPass(
      this.clearFilter,
      this.pressure.read,
      this.pressure.write,
    );
    this.pressure.swap();
    this.lastStepTimings.clearPressure = performance.now() - t0;

    // 5. pressure Jacobi 迭代
    t0 = performance.now();
    const presU = this.pressureFilter.resources.solverUniforms.uniforms;
    presU.texelSize = [velTexelX, velTexelY];
    // 设置额外纹理：uDivergence
    this.pressureFilter.resources.uDivergence = this.divergenceRT.source;
    this.pressureFilter.resources.uDivergenceStyle =
      this.divergenceRT.source.style;
    for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
      this.ctx.applyPass(
        this.pressureFilter,
        this.pressure.read,
        this.pressure.write,
      );
      this.pressure.swap();
    }
    this.lastStepTimings.pressure = performance.now() - t0;

    // 6. gradient subtract → 输出到 velocity.write，swap
    t0 = performance.now();
    const gradU = this.gradientSubtractFilter.resources.solverUniforms.uniforms;
    gradU.texelSize = [velTexelX, velTexelY];
    // 设置额外纹理：uPressure
    this.gradientSubtractFilter.resources.uPressure = this.pressure.read.source;
    this.gradientSubtractFilter.resources.uPressureStyle =
      this.pressure.read.source.style;
    this.ctx.applyPass(
      this.gradientSubtractFilter,
      this.velocity.read,
      this.velocity.write,
    );
    this.velocity.swap();
    this.lastStepTimings.gradientSubtract = performance.now() - t0;

    // 7. advection (velocity)：uTexture（主输入）= velocity.read，uVelocity = velocity.read
    t0 = performance.now();
    const advU = this.advectionFilter.resources.solverUniforms.uniforms;
    advU.texelSize = [velTexelX, velTexelY];
    advU.dyeTexelSize = [velTexelX, velTexelY];
    advU.dt = dt;
    advU.dissipation = config.VELOCITY_DISSIPATION;
    // velocity 平流时 uVelocity == uTexture，无需额外资源
    this.advectionFilter.resources.uVelocity = this.velocity.read.source;
    this.advectionFilter.resources.uVelocityStyle =
      this.velocity.read.source.style;
    this.ctx.applyPass(
      this.advectionFilter,
      this.velocity.read,
      this.velocity.write,
    );
    this.velocity.swap();
    this.lastStepTimings.advectVelocity = performance.now() - t0;

    // 8. advection (dye)：uTexture = dye.read，uVelocity = velocity.read
    t0 = performance.now();
    const dyeTexelX = 1.0 / this.dyeWidth;
    const dyeTexelY = 1.0 / this.dyeHeight;
    advU.texelSize = [velTexelX, velTexelY];
    advU.dyeTexelSize = [dyeTexelX, dyeTexelY];
    advU.dissipation = config.DENSITY_DISSIPATION;
    // dye 平流时 uVelocity != uTexture，需要额外绑定 velocity
    this.advectionFilter.resources.uVelocity = this.velocity.read.source;
    this.advectionFilter.resources.uVelocityStyle =
      this.velocity.read.source.style;
    this.ctx.applyPass(this.advectionFilter, this.dye.read, this.dye.write);
    this.dye.swap();
    this.lastStepTimings.advectDye = performance.now() - t0;

    this.lastStepTimings.total = performance.now() - stepStart;
  }

  /**
   * 注入一个 splat：在 (x, y) 处用力 (dx, dy) 扰动速度场，并用 color 染色染料场
   * @param x - 0-1 水平归一化坐标
   * @param y - 0-1 垂直归一化坐标
   * @param dx - x 方向力
   * @param dy - y 方向力
   * @param color - 染料颜色
   */
  splat(x: number, y: number, dx: number, dy: number, color: RGBColor): void {
    if (!this.dye || !this.velocity) return;

    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));

    const aspectRatio = this.simWidth / this.simHeight;
    const radius = Math.max(
      10e-6,
      correctRadius(this.config.SPLAT_RADIUS, aspectRatio),
    );

    const splatU = this.splatFilter.resources.solverUniforms.uniforms;

    // 第一步：向速度场注入动量
    splatU.aspectRatio = aspectRatio;
    splatU.point = [x, y];
    splatU.color = [dx, dy, 0];
    splatU.radius = radius;
    this.ctx.applyPass(
      this.splatFilter,
      this.velocity.read,
      this.velocity.write,
    );
    this.velocity.swap();

    // 第二步：向染料场注入颜色
    splatU.color = [color.r, color.g, color.b];
    this.ctx.applyPass(this.splatFilter, this.dye.read, this.dye.write);
    this.dye.swap();
  }

  /** 随机注入多个 splat（启动时或调试时使用） */
  multipleSplats(amount: number): void {
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

  // ─── 访问器 ───

  /** 获取当前染料场纹理（用于显示和后处理） */
  get dyeTexture(): RenderTexture | null {
    return this.dye?.read ?? null;
  }

  /** 获取双缓冲染料场（sunrays 需要用 dye.write 作临时缓冲） */
  get dyeDouble(): DoubleRT | null {
    return this.dye;
  }

  /** 获取模拟宽度 */
  get width(): number {
    return this.simWidth;
  }

  /** 获取模拟高度 */
  get height(): number {
    return this.simHeight;
  }

  /** 获取染料场宽度 */
  get dyeW(): number {
    return this.dyeWidth;
  }

  /** 获取染料场高度 */
  get dyeH(): number {
    return this.dyeHeight;
  }

  // ─── 配置更新 ───

  /** 更新配置（设置面板调用） */
  updateConfig(config: Partial<FluidSimulationConfig>): void {
    const prevSimRes = this.config.SIM_RESOLUTION;
    const prevDyeRes = this.config.DYE_RESOLUTION;
    Object.assign(this.config, config);

    if (
      config.SIM_RESOLUTION !== prevSimRes ||
      config.DYE_RESOLUTION !== prevDyeRes
    ) {
      this.initFramebuffers();
    }
  }

  /** 获取当前配置 */
  getConfig(): FluidSimulationConfig {
    return this.config;
  }

  // ─── 诊断插桩 ───

  /** 获取上一次 step() 各子步骤耗时 */
  getLastStepTimings(): SolverStepTimings {
    return this.lastStepTimings;
  }

  /** 采样 dye 纹理中心像素 */
  sampleDyeCenter(renderer: Renderer): TextureSample {
    if (!this.dye || !this.dye.read) return { ...EMPTY_SAMPLE };
    const cx = Math.floor(this.dyeWidth / 2);
    const cy = Math.floor(this.dyeHeight / 2);
    try {
      // PixiJS v8 公开 API：通过 extract.pixels 读取纹理像素
      const result = renderer.extract.pixels(this.dye.read);
      const idx = (cy * result.width + cx) * 4;
      return {
        r: result.pixels[idx] / 255,
        g: result.pixels[idx + 1] / 255,
        b: result.pixels[idx + 2] / 255,
        a: result.pixels[idx + 3] / 255,
      };
    } catch {
      return { ...EMPTY_SAMPLE };
    }
  }

  /** resize：重新初始化 RenderTexture */
  resize(): void {
    this.initFramebuffers();
  }

  // ─── 资源销毁 ───

  /** 销毁仿真场 RenderTexture（保留 Filter 和 context） */
  private destroyFramebuffers(): void {
    if (this.dye) {
      this.ctx.destroyDoubleRT(this.dye);
      this.dye = null;
    }
    if (this.velocity) {
      this.ctx.destroyDoubleRT(this.velocity);
      this.velocity = null;
    }
    if (this.divergenceRT) {
      this.ctx.destroyRT(this.divergenceRT);
      this.divergenceRT = null;
    }
    if (this.curlRT) {
      this.ctx.destroyRT(this.curlRT);
      this.curlRT = null;
    }
    if (this.pressure) {
      this.ctx.destroyDoubleRT(this.pressure);
      this.pressure = null;
    }
  }

  /** 销毁所有资源 */
  destroy(): void {
    this.destroyFramebuffers();
    // 断开纹理资源引用，防止 Filter 持有已销毁的 RenderTexture
    this.vorticityFilter.resources.uCurl = Texture.WHITE.source;
    this.vorticityFilter.resources.uCurlStyle = Texture.WHITE.source.style;
    this.pressureFilter.resources.uDivergence = Texture.WHITE.source;
    this.pressureFilter.resources.uDivergenceStyle = Texture.WHITE.source.style;
    this.gradientSubtractFilter.resources.uPressure = Texture.WHITE.source;
    this.gradientSubtractFilter.resources.uPressureStyle =
      Texture.WHITE.source.style;
    this.advectionFilter.resources.uVelocity = Texture.WHITE.source;
    this.advectionFilter.resources.uVelocityStyle = Texture.WHITE.source.style;
    // 销毁所有 Filter（释放 GPU 着色器程序和 uniform 缓冲区）
    this.curlFilter.destroy();
    this.vorticityFilter.destroy();
    this.divergenceFilter.destroy();
    this.clearFilter.destroy();
    this.pressureFilter.destroy();
    this.gradientSubtractFilter.destroy();
    this.advectionFilter.destroy();
    this.splatFilter.destroy();
  }
}
