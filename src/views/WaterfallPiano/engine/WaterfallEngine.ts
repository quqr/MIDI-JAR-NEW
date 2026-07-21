import type { WaterfallPianoSettings } from "../types";
import { KeyboardRenderer } from "./KeyboardRenderer";
import { NoteBlockSystem, type NoteBlockMode } from "./NoteBlockSystem";
import { BackgroundRenderer } from "./BackgroundRenderer";
import { PerformanceMonitor } from "./PerformanceMonitor";
import { RenderLoop, type PhaseTimings } from "./RenderLoop";
import { FluidSplatManager } from "./FluidSplatManager";
import type { ISoundEngine } from "../audio/ISoundEngine";
import {
  FluidSimulation,
  resolveConfig,
  type FluidSimulationConfig,
} from "@/engine/fluid";
import { createLogger } from "@/utils/logger";

const logger = createLogger("WaterfallEngine");

export interface WaterfallCanvases {
  background: HTMLCanvasElement;
  fluid: HTMLCanvasElement;
  waterfall: HTMLCanvasElement;
  keyboard: HTMLCanvasElement;
}

interface EngineCallbacks {
  onNoteOn?: (midi: number, velocity: number) => void;
  onNoteOff?: (midi: number) => void;
}

const DEFAULT_VELOCITY = 90;

/**
 * 瀑布钢琴主引擎，协调键盘渲染、音符方块系统、背景渲染、流体模拟与音频输出
 */
export class WaterfallEngine {
  private canvases: WaterfallCanvases | null = null;
  private settings: WaterfallPianoSettings | null = null;
  private keyboardRenderer = new KeyboardRenderer();
  private noteBlockSystem = new NoteBlockSystem();
  private backgroundRenderer = new BackgroundRenderer();
  private perfMonitor = new PerformanceMonitor();
  private fluid: FluidSimulation | null = null;
  private soundEngine: ISoundEngine | null = null;
  private renderLoop: RenderLoop | null = null;
  private splatManager = new FluidSplatManager({
    keyboardRenderer: this.keyboardRenderer,
    noteBlockSystem: this.noteBlockSystem,
    getSettings: () => this.settings,
    getLayout: () => ({
      width: this.width,
      height: this.height,
      keyboardHeight: this.keyboardHeight,
    }),
    hasCanvases: () => !!this.canvases,
  });
  private width = 0;
  private height = 0;
  private keyboardHeight = 0;
  private dpr = 1;
  private pointerDown = false;
  private activePointerMidi: number | null = null;
  /** 保存旧值的数值副本，用于检测设置变更（避免 deep watch 引用问题） */
  private prevKeyboardHeightRatio: number | null = null;
  private prevFluidEnabled: boolean | null = null;
  /** 缓存的 waterfall 2D 上下文引用，避免每帧 getContext 调用 */
  private _waterfallCtx: CanvasRenderingContext2D | null = null;
  public showFPS = true;
  callbacks: EngineCallbacks = {};
  /** 每帧回调，在 noteBlockSystem.update() 之前调用，用于推进播放器时间 */
  frameCallback: (() => void) | null = null;
  /** 资源清理任务注册表（增强型 RAII 模式） */
  private cleanupTasks: Map<string, () => void | Promise<void>> = new Map();
  private disposed = false;
  /** MIDI 模式暂停标志：为 true 时渲染循环跳过 fluid.update() 和所有 splat 调用 */
  private fluidPaused = false;

  /**
   * 注册资源清理任务
   * @param name - 资源名称（用于日志和调试）
   * @param task - 清理函数（支持异步）
   */
  registerCleanup(name: string, task: () => void | Promise<void>): void {
    this.cleanupTasks.set(name, task);
  }

  /**
   * 初始化引擎：绑定画布、初始化各子系统、启动流体模拟与主循环
   * 初始化失败时自动执行完整清理（dispose），避免半初始化状态
   * @param canvases - 四层画布（背景、流体、瀑布、键盘）
   * @param settings - 瀑布钢琴配置
   */
  init(canvases: WaterfallCanvases, settings: WaterfallPianoSettings): void {
    try {
      this.canvases = canvases;
      this.settings = settings;
      this._waterfallCtx = canvases.waterfall.getContext("2d");
      this.keyboardRenderer.init(canvases.keyboard, settings);
      this.noteBlockSystem.init(canvases.waterfall, settings);
      this.backgroundRenderer.init(canvases.background, settings);
      this.noteBlockSystem.callbacks = {
        onNoteTrigger: (midi, vel) => this.onSynthesiaTrigger(midi, vel),
        onNoteEnd: (midi) => this.onSynthesiaEnd(midi),
      };
      this.maybeInitFluid();
      this.prevKeyboardHeightRatio = settings.keyboard.heightRatio;
      this.prevFluidEnabled = settings.background.fluidEnabled;
      this.bindPointerEvents();
      this.renderLoop = new RenderLoop(
        {
          advancePlayback: () => this.frameCallback?.(),
          renderBackground: (now) => this.backgroundRenderer.render(now),
          updateNoteBlocks: (dtSec) => this.noteBlockSystem.update(dtSec),
          renderNoteBlocks: () => this.noteBlockSystem.render(),
          renderKeyboard: () => this.keyboardRenderer.render(),
          displayFPS: (fps) => this.renderFPSOverlay(fps),
          shouldUpdateFluid: () => !!this.fluid && !this.fluidPaused,
          updateFluidAndSplats: () => this.updateFluidAndSplats(),
          logPerformance: (now, total, timings, fps) =>
            this.logFramePerf(now, total, timings, fps),
        },
        this.perfMonitor,
      );
      this.renderLoop.start();

      // 注册清理任务
      this.registerCleanup("pointerEvents", () => this.unbindPointerEvents());
      this.registerCleanup("noteBlockSystem", () =>
        this.noteBlockSystem.dispose(),
      );
      this.registerCleanup("backgroundRenderer", () =>
        this.backgroundRenderer.dispose(),
      );
      this.registerCleanup("fluid", () => {
        this.fluid?.destroy();
        this.fluid = null;
      });
      this.registerCleanup("keyboardHighlights", () =>
        this.keyboardRenderer.clearAllHighlights(),
      );
    } catch (error) {
      logger.error({ err: error }, "Initialization failed");
      this.dispose();
      throw error;
    }
  }

  setSoundEngine(engine: ISoundEngine): void {
    this.soundEngine = engine;
  }

  setSustain(enabled: boolean): void {
    this.soundEngine?.setSustain(enabled);
  }

  /**
   * 响应配置变更：更新各子系统，并在键盘高度比例或流体开关变化时重新布局
   * @param settings - 新的瀑布钢琴配置
   */
  applySettings(settings: WaterfallPianoSettings): void {
    // 用保存的数值副本检测变更（不依赖 watch 传递旧值，避免引用问题）
    const oldHeightRatio =
      this.prevKeyboardHeightRatio ?? settings.keyboard.heightRatio;
    const oldFluidEnabled =
      this.prevFluidEnabled ?? settings.background.fluidEnabled;
    this.settings = settings;
    // 保存数值副本供下次比较
    this.prevKeyboardHeightRatio = settings.keyboard.heightRatio;
    this.prevFluidEnabled = settings.background.fluidEnabled;
    // 键盘高度比例变化时需要重新布局所有 canvas
    if (
      settings.keyboard.heightRatio !== oldHeightRatio &&
      this.width > 0 &&
      this.height > 0
    ) {
      this.resize(this.width, this.height);
    }
    this.keyboardRenderer.resize(this.width, this.keyboardHeight, this.dpr);
    this.noteBlockSystem.setSettings(settings);
    this.backgroundRenderer.setSettings(settings);
    if (settings.background.fluidEnabled && !oldFluidEnabled) {
      this.maybeInitFluid();
      // 流体开启后需要重新布局确保 canvas 尺寸正确
      if (this.width > 0 && this.height > 0) {
        this.resize(this.width, this.height);
      }
    } else if (
      !settings.background.fluidEnabled &&
      oldFluidEnabled &&
      this.fluid
    ) {
      this.fluid.destroy();
      this.fluid = null;
    } else if (this.fluid && settings.background.fluidEnabled) {
      this.fluid.updateConfig(this.buildFluidConfig());
    }
  }

  /**
   * 切换音符方块模式；模式变化时清空已有音符方块
   * @param mode - 音符方块模式（realtime / synthesia）
   */
  setMode(mode: NoteBlockMode): void {
    if (this.noteBlockSystem.getMode() !== mode) {
      this.noteBlockSystem.clearVisualBlocks();
    }
    this.noteBlockSystem.setMode(mode);
  }

  getFPS(): number {
    return this.perfMonitor.getFps();
  }

  /**
   * 重新计算布局：根据键盘高度比例分配画布尺寸，并通知各子系统与流体
   * @param width - 画布总宽度（CSS 像素）
   * @param height - 画布总高度（CSS 像素）
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const kbRatio = this.settings?.keyboard.heightRatio ?? 0.3;
    this.keyboardHeight = Math.max(80, Math.floor(height * kbRatio));
    const waterfallHeight = height - this.keyboardHeight;
    this.keyboardRenderer.resize(width, this.keyboardHeight, this.dpr);
    this.noteBlockSystem.resize(
      width,
      waterfallHeight,
      this.dpr,
      this.keyboardRenderer,
    );
    this.backgroundRenderer.resize(width, height, this.dpr);
    this.layoutCanvases(waterfallHeight);
    if (this.fluid) {
      this.fluid.resize();
    }
  }

  /**
   * 设置四层画布的 CSS 定位：背景/流体全屏，瀑布区占顶部，键盘区占底部
   * @param waterfallHeight - 瀑布区域高度（像素）
   */
  private layoutCanvases(waterfallHeight: number): void {
    if (!this.canvases) return;
    const setBox = (c: HTMLCanvasElement, top: number, h: number) => {
      c.style.position = "absolute";
      c.style.top = `${top}px`;
      c.style.left = "0";
      c.style.width = `${this.width}px`;
      c.style.height = `${h}px`;
    };
    setBox(this.canvases.background, 0, this.height);
    setBox(this.canvases.fluid, 0, this.height);
    setBox(this.canvases.waterfall, 0, waterfallHeight);
    setBox(this.canvases.keyboard, waterfallHeight, this.keyboardHeight);
  }

  /**
   * 根据当前设置构建流体模拟配置
   * @returns 流体模拟的部分配置对象
   */
  private buildFluidConfig(): Partial<FluidSimulationConfig> {
    if (!this.settings) return {};
    const bg = this.settings.background;
    return resolveConfig(
      bg.fluidQuality,
      bg.fluidStyle,
      bg.fluidAdvanced,
      bg.fluidParams,
    );
  }

  /**
   * 在设置启用流体且尚未创建实例时，初始化 FluidSimulation 并启动
   */
  private maybeInitFluid(): void {
    if (!this.canvases || !this.settings) return;
    if (!this.settings.background.fluidEnabled) return;
    const config = this.buildFluidConfig();
    if (this.fluid || (config.SIM_RESOLUTION ?? 0) <= 0) return;
    try {
      this.fluid = new FluidSimulation(this.canvases.fluid, config);
      this.fluid.start();
    } catch {
      this.fluid = null;
    }
  }

  private bindPointerEvents(): void {
    if (!this.canvases) return;
    const kb = this.canvases.keyboard;
    kb.style.touchAction = "none";
    kb.addEventListener("pointerdown", this.onPointerDown);
    kb.addEventListener("pointermove", this.onPointerMove);
    kb.addEventListener("pointerup", this.onPointerUp);
    kb.addEventListener("pointercancel", this.onPointerUp);
    kb.addEventListener("pointerleave", this.onPointerUp);
  }

  private unbindPointerEvents(): void {
    if (!this.canvases) return;
    const kb = this.canvases.keyboard;
    kb.removeEventListener("pointerdown", this.onPointerDown);
    kb.removeEventListener("pointermove", this.onPointerMove);
    kb.removeEventListener("pointerup", this.onPointerUp);
    kb.removeEventListener("pointercancel", this.onPointerUp);
    kb.removeEventListener("pointerleave", this.onPointerUp);
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.pointerDown = true;
    const midi = this.keyboardRenderer.xToMidi(e.offsetX);
    if (midi !== null) {
      this.activePointerMidi = midi;
      this.triggerNoteOn(midi, DEFAULT_VELOCITY);
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.pointerDown) return;
    const midi = this.keyboardRenderer.xToMidi(e.offsetX);
    if (midi !== null && midi !== this.activePointerMidi) {
      if (this.activePointerMidi !== null) {
        this.triggerNoteOff(this.activePointerMidi);
      }
      this.activePointerMidi = midi;
      this.triggerNoteOn(midi, DEFAULT_VELOCITY);
    }
  };

  private onPointerUp = (): void => {
    this.pointerDown = false;
    if (this.activePointerMidi !== null) {
      this.triggerNoteOff(this.activePointerMidi);
      this.activePointerMidi = null;
    }
  };

  /**
   * 触发音符发声：驱动音频、实时音符方块、键盘高亮、流体喷射及命中爆炸效果
   * @param midi - MIDI 音符编号（0-127）
   * @param velocity - 力度（0-127）
   */
  triggerNoteOn(midi: number, velocity: number): void {
    if (!this.settings) return;
    this.soundEngine?.noteOn(midi, velocity);
    if (this.noteBlockSystem.getMode() === "realtime") {
      this.noteBlockSystem.playRealtimeNote(midi, velocity);
    }
    this.keyboardRenderer.highlightNote(midi);
    if (this.fluid) {
      this.splatManager.fluidSplat(this.fluid, midi, velocity);
      if (this.settings.background.fluidParams.hitExplosion) {
        this.splatManager.hitExplosionSplat(this.fluid, midi, velocity);
      }
    }
    this.callbacks.onNoteOn?.(midi, velocity);
  }

  triggerNoteOff(midi: number): void {
    this.soundEngine?.noteOff(midi);
    if (this.noteBlockSystem.getMode() === "realtime") {
      this.noteBlockSystem.releaseRealtimeNote(midi);
    }
    this.keyboardRenderer.clearHighlight(midi);
    this.callbacks.onNoteOff?.(midi);
  }

  /**
   * Synthesia 模式下音符触发回调：驱动音频、键盘高亮与流体效果（不产生实时方块）
   * @param midi - MIDI 音符编号
   * @param velocity - 力度
   */
  private onSynthesiaTrigger(midi: number, velocity: number): void {
    this.soundEngine?.noteOn(midi, velocity);
    if (this.noteBlockSystem.getMode() === "realtime") {
      this.noteBlockSystem.playRealtimeNoteFromMidi(midi, velocity);
    }
    this.keyboardRenderer.highlightNote(midi);
    if (this.fluid) {
      this.splatManager.fluidSplat(this.fluid, midi, velocity);
      if (this.settings?.background.fluidParams.hitExplosion) {
        this.splatManager.hitExplosionSplat(this.fluid, midi, velocity);
      }
    }
  }

  /**
   * Synthesia 模式下音符结束回调：停止音频并清除键盘高亮
   * @param midi - MIDI 音符编号
   */
  private onSynthesiaEnd(midi: number): void {
    this.soundEngine?.noteOff(midi);
    if (this.noteBlockSystem.getMode() === "realtime") {
      this.noteBlockSystem.releaseRealtimeNoteFromMidi(midi);
    }
    this.keyboardRenderer.clearHighlight(midi);
  }

  /** FPS 叠加层渲染 */
  private renderFPSOverlay(fps: number): void {
    if (!this.showFPS) return;
    const ctx = this._waterfallCtx;
    if (ctx) {
      ctx.save();
      ctx.font = "bold 12px monospace";
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 4;
      ctx.fillText(`FPS: ${Math.round(fps)}`, 10, 20);
      ctx.restore();
    }
  }

  /** 流体模拟更新 + 持续 splat（委托给 FluidSplatManager） */
  private updateFluidAndSplats(): void {
    if (!this.fluid) return;
    this.splatManager.updateAndSplat(this.fluid);
  }

  /** 性能日志输出（每秒由 RenderLoop 调用一次） */
  private logFramePerf(
    _now: number,
    totalMs: number,
    timings: PhaseTimings,
    fps: number,
  ): void {
    logger.info(
      `[DEBUG-perf] total=${totalMs.toFixed(1)}ms frame=${timings.playback > 0 ? timings.playback.toFixed(1) : "0"}ms bg=${timings.background.toFixed(1)}ms nbUpd=${timings.noteBlockUpdate.toFixed(1)}ms nbRdr=${timings.noteBlockRender.toFixed(1)}ms kb=${timings.keyboard.toFixed(1)}ms fluid=${timings.fluid.toFixed(1)}ms fps=${Math.round(fps)}`,
    );
  }

  get keyboardRendererRef(): KeyboardRenderer {
    return this.keyboardRenderer;
  }

  get noteBlockSystemRef(): NoteBlockSystem {
    return this.noteBlockSystem;
  }

  get backgroundRendererRef(): BackgroundRenderer {
    return this.backgroundRenderer;
  }

  /**
   * 停止播放时的清理：清除所有键盘高亮、停止所有音频、释放实时方块
   */
  stopAllSounds(): void {
    this.keyboardRenderer.clearAllHighlights();
    this.soundEngine?.allNotesOff();
    if (this.noteBlockSystem.getMode() === "realtime") {
      this.noteBlockSystem.clearNoteBlocks();
    }
  }

  /**
   * MIDI 模式专用：暂停/恢复流体模拟。
   * 设置 fluidPaused 标志后，渲染循环完全跳过 fluid.update()（solver.step + render + splat），
   * 从根源上消除暂停时的 GPU 开销和帧率下降。
   */
  setFluidPaused(paused: boolean): void {
    this.fluidPaused = paused;
  }

  /**
   * MIDI 模式专用：清空流体模拟中的所有粒子和染料。
   * 销毁当前实例并重建，重建后保持暂停状态（fluidPaused = true），
   * 直到下次播放时 setFluidPaused(false) 才开始更新。
   */
  clearFluid(): void {
    if (this.fluid) {
      this.fluid.destroy();
      this.fluid = null;
      this.maybeInitFluid();
      this.fluidPaused = true;
    }
  }

  getPerformanceFps(): number {
    return this.perfMonitor.getFps();
  }

  /**
   * 增强型 dispose：执行所有注册的清理任务，支持异步等待完成
   * 初始化失败时直接调用 dispose 即可，无需 partialCleanup
   */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;

    // 停止渲染循环
    this.renderLoop?.stop();
    this.renderLoop = null;

    // 执行所有注册的清理任务
    const results = await Promise.allSettled(
      Array.from(this.cleanupTasks.entries()).map(async ([name, task]) => {
        try {
          await task();
          logger.debug(`Cleaned up ${name}`);
        } catch (e) {
          logger.error({ err: e }, `Cleanup ${name} failed`);
          throw e;
        }
      }),
    );

    this.cleanupTasks.clear();

    // 报告失败的清理
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      logger.warn(`${failed.length} cleanup tasks failed`);
    }
  }

  /** 检查引擎是否已被销毁 */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * 强制重绘：清空所有 canvas 并重新渲染当前帧
   * 用于窗口最小化恢复后消除残留显示问题
   */
  forceRedraw(): void {
    if (this.disposed) return;
    this.backgroundRenderer.render(performance.now());
    this.noteBlockSystem.render();
    this.keyboardRenderer.render();
    logger.debug("Force redraw completed");
  }
}
