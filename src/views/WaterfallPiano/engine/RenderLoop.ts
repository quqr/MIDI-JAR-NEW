import { PerformanceMonitor } from "./PerformanceMonitor";

/** 各渲染阶段耗时（毫秒） */
export interface PhaseTimings {
  playback: number;
  background: number;
  noteBlockUpdate: number;
  noteBlockRender: number;
  keyboard: number;
  fluid: number;
}

/** 渲染循环各阶段回调 */
export interface RenderLoopCallbacks {
  /** 推进播放器时间 */
  advancePlayback: () => void;
  /** 渲染背景 */
  renderBackground: (now: number) => void;
  /** 更新音符方块逻辑 */
  updateNoteBlocks: (dtSec: number) => void;
  /** 渲染音符方块 */
  renderNoteBlocks: () => void;
  /** 渲染键盘 */
  renderKeyboard: () => void;
  /** 显示 FPS 叠加层 */
  displayFPS: (fps: number) => void;
  /** 判断当前帧是否应更新流体（由调用方检查 fluid 实例与暂停状态） */
  shouldUpdateFluid: () => boolean;
  /** 流体模拟更新 + 持续 splat 应用 */
  updateFluidAndSplats: () => void;
  /** 性能日志输出 */
  logPerformance: (
    now: number,
    totalMs: number,
    timings: PhaseTimings,
    fps: number,
  ) => void;
}

/**
 * 独立的渲染循环，管理 requestAnimationFrame 生命周期与帧调度。
 * 每帧按固定顺序调用各阶段回调，并内置流体降帧与性能采样逻辑。
 */
export class RenderLoop {
  private rafId: number | null = null;
  private lastTime = 0;
  private fluidFrameCount = 0;
  private lastPerfLog = 0;
  private readonly FLUID_SKIP_FRAMES = 1; // 每隔1帧更新流体，即30fps
  private perfMonitor: PerformanceMonitor;
  private callbacks: RenderLoopCallbacks;

  constructor(
    callbacks: RenderLoopCallbacks,
    perfMonitor: PerformanceMonitor,
  ) {
    this.callbacks = callbacks;
    this.perfMonitor = perfMonitor;
  }

  get isRunning(): boolean {
    return this.rafId !== null;
  }

  start(): void {
    this.lastTime = performance.now();
    this.fluidFrameCount = 0;
    this.lastPerfLog = 0;

    const loop = (now: number) => {
      const dt = now - this.lastTime;
      this.lastTime = now;
      this.perfMonitor.recordFrame(dt);

      const t0 = performance.now();

      // 1. 推进播放
      this.callbacks.advancePlayback();
      const tPlayback = performance.now();

      // 2. 渲染背景
      this.callbacks.renderBackground(now);
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

      // 8. 性能日志（每秒一次）
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

      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
