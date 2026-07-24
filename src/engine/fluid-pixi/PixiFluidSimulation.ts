// ─── PixiJS 流体模拟入口类：管理所有子系统、主渲染循环、splat 注入 ───
// 将原生 WebGL FluidSimulation 迁移为 PixiJS 渲染管线
// 不再使用独立 canvas + WebGL context，而是复用 PixiJS Application 的 renderer

import { Application, Container, Sprite } from "pixi.js";
import type { Renderer } from "pixi.js";
import type { FluidDiagnostics, SplatTrace, PassStatus } from "@/views/FluidCompare/diagnostics";
import { EMPTY_SAMPLE } from "@/views/FluidCompare/diagnostics";
import { PixiFluidContext } from "./PixiFluidContext";
import { PixiFluidSolver, type RGBColor } from "./PixiFluidSolver";
import { PixiBloomPass } from "./PixiBloomPass";
import { PixiSunraysPass } from "./PixiSunraysPass";
import { PixiDisplayPass } from "./PixiDisplayPass";
import {
  DEFAULT_CONFIG,
  type FluidSimulationConfig,
} from "../fluid/FluidConfig";
import type { IFluidSimulation } from "./IFluidSimulation";

/**
 * PixiJS 流体模拟入口类
 *
 * 职责：
 * 1. 管理 PixiFluidContext（渲染上下文）
 * 2. 协调 Solver + BloomPass + SunraysPass + DisplayPass
 * 3. 管理输出 Sprite（将流体结果渲染到场景中）
 * 4. 提供与旧 FluidSimulation 兼容的 API（splat, update, resize 等）
 *
 * 与旧版本的区别：
 * - 不再创建独立 canvas 和 WebGL context，复用 PixiJS Application
 * - 渲染到 RenderTexture 后通过 Sprite 显示，而非直接渲染到 canvas
 * - 分辨率固定，通过 Sprite.scale 拉伸到屏幕大小
 */
export class PixiFluidSimulation implements IFluidSimulation {
  private ctx: PixiFluidContext;
  private config: FluidSimulationConfig;

  private solver: PixiFluidSolver;
  private bloomPass: PixiBloomPass;
  private sunraysPass: PixiSunraysPass;
  private displayPass: PixiDisplayPass;

  /** 输出 Sprite：将流体结果渲染到场景中 */
  private outputSprite: Sprite;

  private lastUpdateTime = 0;
  private paused = false;
  private destroyed = false;
  private initialized = false;

  // ─── 诊断插桩 ───
  private lastSplatTrace: SplatTrace | null = null;
  private diagnosticsFrameCounter = 0;
  private cachedDyeSample = { ...EMPTY_SAMPLE };

  constructor(
    app: Application,
    container: Container,
    config?: Partial<FluidSimulationConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 创建 PixiJS 流体上下文
    this.ctx = new PixiFluidContext(app);

    // 创建各子系统
    this.solver = new PixiFluidSolver(this.ctx, config);
    this.bloomPass = new PixiBloomPass(this.ctx, this.config);
    this.sunraysPass = new PixiSunraysPass(this.ctx, this.config);
    this.displayPass = new PixiDisplayPass(this.ctx, this.config);

    // 创建输出 Sprite，添加到指定 container
    this.outputSprite = new Sprite();
    this.outputSprite.label = "fluid-output";
    container.addChild(this.outputSprite);
  }

  /** 初始化所有子系统 RenderTexture */
  start(): void {
    if (this.initialized) return;

    this.solver.initFramebuffers();
    this.bloomPass.initFramebuffers();
    this.sunraysPass.initFramebuffers();
    this.displayPass.initFramebuffers();

    // 设置初始 Sprite scale，避免首帧渲染前 scale 为 1 导致画面尺寸错误
    const screen = this.ctx.application.screen;
    if (this.solver.dyeW > 0 && this.solver.dyeH > 0) {
      this.outputSprite.scale.set(
        screen.width / this.solver.dyeW,
        screen.height / this.solver.dyeH,
      );
    }

    this.initialized = true;
    this.lastUpdateTime = Date.now();
  }

  /** 外部驱动的更新方法（由 RenderLoop/Ticker 调用） */
  update(): void {
    if (this.destroyed || !this.initialized) return;
    const dt = this.calcDeltaTime();
    if (!this.paused) this.solver.step(dt);
    this.render();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private calcDeltaTime(): number {
    const now = Date.now();
    let dt = (now - this.lastUpdateTime) / 1000;
    dt = Math.min(dt, 0.016666);
    this.lastUpdateTime = now;
    return dt;
  }

  /** 渲染管线：solver → bloom → sunrays → display → outputSprite */
  private render(): void {
    const dyeTex = this.solver.dyeTexture;
    if (!dyeTex) return;

    // Bloom 后处理
    if (this.config.BLOOM) {
      const bloomRT = this.bloomPass.getBloom();
      if (bloomRT) this.bloomPass.apply(dyeTex, bloomRT);
    }

    // Sunrays 后处理
    if (this.config.SUNRAYS) {
      const sunrays = this.sunraysPass.getSunrays();
      const sunraysTemp = this.sunraysPass.getSunraysTemp();
      const dyeDouble = this.solver.dyeDouble;
      if (sunrays && sunraysTemp && dyeDouble) {
        // 用 dye.write 作为 mask 临时缓冲
        this.sunraysPass.apply(dyeTex, dyeDouble.write, sunrays);
        this.sunraysPass.blur(sunrays, sunraysTemp, 1);
      }
    }

    // 最终合成
    const bloomTex = this.config.BLOOM ? this.bloomPass.getBloom() : null;
    const sunraysTex = this.config.SUNRAYS
      ? this.sunraysPass.getSunrays()
      : null;
    const outputTex = this.displayPass.apply(dyeTex, bloomTex, sunraysTex);

    // 将输出纹理赋给 Sprite
    if (outputTex) {
      this.outputSprite.texture = outputTex;
    }
  }

  /**
   * 注入一个流体 splat（公共 API，调用方使用 Y向上约定）
   *
   * 调用方约定（Y向上）：y=0 在底部，y=1 在顶部，正 dy = 向上。
   * 求解器内部约定（Y向下，PixiJS 原生）：y=0 在顶部，y=1 在底部，正 dy = 向下。
   * 此处做一次性边界转换，见 ADR-0001。
   *
   * @param x - 0-1 水平归一化坐标
   * @param y - 0-1 垂直归一化坐标（Y向上：0=底部，1=顶部）
   * @param dx - x 方向力
   * @param dy - y 方向力（Y向上：正=向上）
   * @param color - 染料颜色 {r, g, b}
   */
  splat(x: number, y: number, dx: number, dy: number, color: RGBColor): void {
    // 记录 splat 链路追踪
    const converted = { x, y: 1 - y, dx, dy: -dy };
    this.lastSplatTrace = {
      input: { x, y, dx, dy },
      converted,
      color: { r: color.r, g: color.g, b: color.b },
    };
    // Y向上 → Y向下：翻转 y 坐标和 y 方向力
    this.solver.splat(converted.x, converted.y, converted.dx, converted.dy, color);
  }

  /** 注入随机 splats */
  multipleSplats(amount: number): void {
    this.solver.multipleSplats(amount);
  }

  /** 更新配置（设置面板调用） */
  updateConfig(config: Partial<FluidSimulationConfig>): void {
    const prevSimRes = this.config.SIM_RESOLUTION;
    const prevDyeRes = this.config.DYE_RESOLUTION;
    const prevBloomRes = this.config.BLOOM_RESOLUTION;
    const prevSunraysRes = this.config.SUNRAYS_RESOLUTION;
    const prevBloomIter = this.config.BLOOM_ITERATIONS;
    const prevBloom = this.config.BLOOM;

    Object.assign(this.config, config);

    this.solver.updateConfig(this.config);
    this.bloomPass.updateConfig(this.config);
    this.sunraysPass.updateConfig(this.config);
    this.displayPass.updateConfig(this.config);

    if (
      this.config.SIM_RESOLUTION !== prevSimRes ||
      this.config.DYE_RESOLUTION !== prevDyeRes
    ) {
      this.solver.resize();
    }
    if (
      this.config.BLOOM_RESOLUTION !== prevBloomRes ||
      this.config.BLOOM_ITERATIONS !== prevBloomIter
    ) {
      this.bloomPass.resize();
    }
    if (this.config.BLOOM && !prevBloom) {
      this.bloomPass.resize();
    }
    if (this.config.SUNRAYS_RESOLUTION !== prevSunraysRes) {
      this.sunraysPass.resize();
    }
  }

  getConfig(): FluidSimulationConfig {
    return this.config;
  }

  /** 获取诊断数据（采样节流：每 30 帧 readPixels 一次） */
  getDiagnostics(renderer: Renderer): FluidDiagnostics {
    this.diagnosticsFrameCounter++;
    if (this.diagnosticsFrameCounter >= 30) {
      this.diagnosticsFrameCounter = 0;
      this.cachedDyeSample = this.solver.sampleDyeCenter(renderer);
    }
    const passes: PassStatus = {
      bloom: {
        enabled: this.config.BLOOM,
        iterations: this.config.BLOOM_ITERATIONS,
      },
      sunrays: {
        enabled: this.config.SUNRAYS,
        weight: this.config.SUNRAYS_WEIGHT,
      },
      display: { outputFormat: "rgba16float" },
    };
    return {
      stepTimings: this.solver.getLastStepTimings(),
      dyeSample: this.cachedDyeSample,
      passes,
      lastSplat: this.lastSplatTrace ?? undefined,
    };
  }

  /**
   * 适配屏幕尺寸：更新 Sprite.scale
   * 流体 RenderTexture 使用固定低分辨率，不随窗口 resize 重建
   * @param screenWidth - 屏幕宽度（可选，默认从 app.screen 获取）
   * @param screenHeight - 屏幕高度（可选，默认从 app.screen 获取）
   */
  resize(screenWidth?: number, screenHeight?: number): void {
    const w = screenWidth ?? this.ctx.application.screen.width;
    const h = screenHeight ?? this.ctx.application.screen.height;
    // 先 resize 子系统（更新 dye 尺寸），再基于新尺寸设置 sprite scale
    this.solver.resize();
    this.bloomPass.resize();
    this.sunraysPass.resize();
    this.displayPass.resize();
    if (this.solver.dyeW > 0 && this.solver.dyeH > 0) {
      this.outputSprite.scale.set(w / this.solver.dyeW, h / this.solver.dyeH);
    }
  }

  /** 暂停/恢复 */
  setPaused(paused: boolean): void {
    this.paused = paused;
    this.config.PAUSED = paused;
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** 获取输出 Sprite（用于外部添加到场景） */
  getOutputSprite(): Sprite {
    return this.outputSprite;
  }

  /** 销毁所有 GPU 资源 */
  destroy(): void {
    this.destroyed = true;
    this.solver.destroy();
    this.bloomPass.destroy();
    this.sunraysPass.destroy();
    this.displayPass.destroy();
    this.ctx.destroy();
    this.outputSprite.destroy();
  }
}
