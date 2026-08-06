import { PerformanceMonitor } from "./PerformanceMonitor";
import { Ticker, UPDATE_PRIORITY } from "pixi.js";

/** 各渲染阶段耗时（毫秒） */
export interface PhaseTimings {
  playback: number;
  background: number;
  noteBlockUpdate: number;
  noteBlockRender: number;
  keyboard: number;
  fluid: number;
}

/** 渲染管线接口 — 主引擎实现此接口以驱动 RenderLoop */
export interface IRenderPipeline {
  /** 推进播放器时间 */
  advancePlayback(): void;
  /** 渲染背景 */
  renderBackground(now: number): void;
  /** 更新音符方块逻辑 */
  updateNoteBlocks(dtSec: number): void;
  /** 渲染音符方块 */
  renderNoteBlocks(): void;
  /** 渲染键盘 */
  renderKeyboard(): void;
  /** 显示 FPS 叠加层 */
  displayFPS(fps: number): void;
  /** 判断当前帧是否应更新流体（由调用方检查 fluid 实例与暂停状态） */
  shouldUpdateFluid(): boolean;
  /** 流体模拟更新 + 持续 splat 应用 */
  updateFluidAndSplats(): void;
  /** 将场景图提交到 GPU（调用 app.renderer.render） */
  renderFrame(): void;
  /** 性能日志输出 */
  logPerformance(
    now: number,
    totalMs: number,
    timings: PhaseTimings,
    fps: number,
  ): void;
}

/** @deprecated 使用 IRenderPipeline */
export type RenderLoopCallbacks = IRenderPipeline;

/**
 * 基于 PixiJS Ticker 的渲染循环，管理帧调度与优先级。
 * 逻辑更新使用 HIGH 优先级，渲染使用 LOW 优先级。
 * 内置流体降帧与性能采样逻辑。
 */
export class RenderLoop {
  private ticker: Ticker;
  private fluidFrameCount = 0;
  private lastPerfLog = 0;
  private readonly FLUID_SKIP_FRAMES = 1; // 每隔1帧更新流体，即30fps
  private perfMonitor: PerformanceMonitor;
  private callbacks: IRenderPipeline;

  constructor(callbacks: IRenderPipeline, perfMonitor: PerformanceMonitor) {
    this.callbacks = callbacks;
    this.perfMonitor = perfMonitor;

    this.ticker = new Ticker();
    this.ticker.autoStart = false;
    this.ticker.maxFPS = 0;

    // 逻辑更新（HIGH 优先级）
    this.ticker.add(
      (ticker) => {
        const dt = ticker.deltaMS;
        this.perfMonitor.recordFrame(dt);

        const t0 = performance.now();

        // 1. 推进播放
        this.callbacks.advancePlayback();
        const tPlayback = performance.now();

        // 2. 渲染背景
        this.callbacks.renderBackground(performance.now());
        const tBg = performance.now();

        // 3. 更新音符方块
        this.callbacks.updateNoteBlocks(dt / 1000);
        const tNbUpdate = performance.now();

        // 4. 渲染音符方块
        this.callbacks.renderNoteBlocks();
        const tNbRender = performance.now();

        // 5. 渲染键盘
        this.callbacks.renderKeyboard();
        const tKb = performance.now();

        // 6. FPS 显示
        this.callbacks.displayFPS(this.perfMonitor.getFps());

        // 7. 流体模拟（降帧运行）
        this.fluidFrameCount++;
        let tFluid = 0;
        if (
          this.callbacks.shouldUpdateFluid() &&
          this.fluidFrameCount > this.FLUID_SKIP_FRAMES
        ) {
          const tf0 = performance.now();
          this.callbacks.updateFluidAndSplats();
          tFluid = performance.now() - tf0;
          this.fluidFrameCount = 0;
        }

        // 8. 提交场景图到 GPU
        this.callbacks.renderFrame();

        // 9. 性能日志（每秒一次）
        const now = performance.now();
        if (now - this.lastPerfLog > 1000) {
          this.lastPerfLog = now;
          const total = performance.now() - t0;
          this.callbacks.logPerformance(
            now,
            total,
            {
              playback: tPlayback - t0,
              background: tBg - tPlayback,
              noteBlockUpdate: tNbUpdate - tBg,
              noteBlockRender: tNbRender - tNbUpdate,
              keyboard: tKb - tNbRender,
              fluid: tFluid,
            },
            this.perfMonitor.getFps(),
          );
        }
      },
      null,
      UPDATE_PRIORITY.HIGH,
    );
  }

  get isRunning(): boolean {
    return this.ticker.started;
  }

  start(): void {
    this.fluidFrameCount = 0;
    this.lastPerfLog = 0;
    this.ticker.start();
  }

  stop(): void {
    this.ticker.stop();
  }

  /** 销毁时清理 */
  destroy(): void {
    this.ticker.stop();
    this.ticker.destroy();
  }
}
