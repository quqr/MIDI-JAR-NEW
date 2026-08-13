import type { WaterfallPianoSettings } from "../types";
import { Application, Container } from "pixi.js";
import { KeyboardRenderer } from "./KeyboardRenderer";
import { NoteBlockSystem, type NoteBlockMode } from "./NoteBlockSystem";
import { BackgroundRenderer } from "./BackgroundRenderer";
import { PerformanceMonitor } from "./PerformanceMonitor";
import {
  RenderLoop,
  type PhaseTimings,
  type IRenderPipeline,
} from "./RenderLoop";
import { InteractionController } from "./InteractionController";
import { VisualEffectsManager } from "./VisualEffectsManager";
import { calculateLayout } from "./LayoutCalculator";
import type { ISoundEngine } from "../audio/ISoundEngine";
import { createLogger } from "@/utils/logger";
import { waterfallPianoEvents } from "../events";

const logger = createLogger("WaterfallEngine");

export interface WaterfallLayers {
  background: Container;
  fluid: Container;
  waterfall: Container;
  keyboard: Container;
}

/**
 * 瀑布钢琴主引擎，协调键盘渲染、音符方块系统、背景渲染、流体模拟与音频输出
 *
 * 实现 IRenderPipeline 接口以驱动 RenderLoop，渲染回调由 RenderLoop 通过接口调用。
 */
export class WaterfallEngine implements IRenderPipeline {
  private app: Application | null = null;
  private layers: WaterfallLayers | null = null;
  private settings: WaterfallPianoSettings | null = null;
  private keyboardRenderer = new KeyboardRenderer();
  private noteBlockSystem = new NoteBlockSystem();
  private backgroundRenderer = new BackgroundRenderer();
  private perfMonitor = new PerformanceMonitor();
  private soundEngine: ISoundEngine | null = null;
  private renderLoop: RenderLoop | null = null;
  private interaction: InteractionController | null = null;
  private visualEffects: VisualEffectsManager | null = null;
  private width = 0;
  private height = 0;
  private keyboardHeight = 0;
  private dpr = 1;
  /** 保存旧值的数值副本，用于检测设置变更（避免 deep watch 引用问题） */
  private prevKeyboardHeightRatio: number | null = null;
  public showFPS = true;
  /** 每帧回调，在 noteBlockSystem.update() 之前调用，用于推进播放器时间 */
  frameCallback: (() => void) | null = null;
  /** 资源清理任务注册表（增强型 RAII 模式） */
  private cleanupTasks: Map<string, () => void | Promise<void>> = new Map();
  private disposed = false;

  /**
   * 注册资源清理任务
   * @param name - 资源名称（用于日志和调试）
   * @param task - 清理函数（支持异步）
   */
  registerCleanup(name: string, task: () => void | Promise<void>): void {
    this.cleanupTasks.set(name, task);
  }

  /**
   * 初始化引擎：绑定 PixiJS Application 与各层容器、初始化各子系统、启动流体模拟与主循环
   * 初始化失败时自动执行完整清理（dispose），避免半初始化状态
   * @param app - PixiJS Application 实例
   * @param layers - 四层 PixiJS Container（背景、流体、瀑布、键盘）
   * @param settings - 瀑布钢琴配置
   * @param fluidCanvas - 可选的流体模拟画布（临时兼容，后续将迁移至 PixiJS Filter 管线）
   */
  init(
    app: Application,
    layers: WaterfallLayers,
    settings: WaterfallPianoSettings,
    fluidCanvas?: HTMLCanvasElement,
  ): void {
    try {
      this.app = app;
      this.layers = layers;
      this.settings = settings;
      this.keyboardRenderer.init(
        layers.keyboard,
        app.renderer,
        settings.keyboard,
      );
      this.noteBlockSystem.init(
        layers.waterfall,
        settings.particles,
        settings.aura,
      );
      this.backgroundRenderer.init(layers.background, settings.background);
      this.noteBlockSystem.onNoteTrigger.add((args) =>
        this.onSynthesiaTrigger(args.midi, args.velocity),
      );
      this.noteBlockSystem.onNoteEnd.add((args) =>
        this.onSynthesiaEnd(args.midi),
      );
      this.visualEffects = new VisualEffectsManager({
        keyboardRenderer: this.keyboardRenderer,
        noteBlockSystem: this.noteBlockSystem,
        getLayout: () => ({
          width: this.width,
          height: this.height,
          keyboardHeight: this.keyboardHeight,
        }),
        onFluidActiveChange: (active) =>
          this.backgroundRenderer.setFluidActive(active),
      });
      this.visualEffects.init(settings, fluidCanvas ?? null, layers);
      this.prevKeyboardHeightRatio = settings.keyboard.heightRatio;
      this.interaction = new InteractionController({
        xToMidi: (x, y) => this.keyboardRenderer.xToMidi(x, y),
        onNoteOn: (midi, velocity) => this.triggerNoteOn(midi, velocity),
        onNoteOff: (midi) => this.triggerNoteOff(midi),
      });
      this.interaction.enable(app.canvas);
      this.renderLoop = new RenderLoop(this, this.perfMonitor);
      this.renderLoop.start();

      // 注册清理任务
      this.registerCleanup("noteBlockSystem", () =>
        this.noteBlockSystem.dispose(),
      );
      this.registerCleanup("backgroundRenderer", () =>
        this.backgroundRenderer.dispose(),
      );
      this.registerCleanup("visualEffects", () =>
        this.visualEffects?.dispose(),
      );
      this.registerCleanup("keyboardHighlights", () =>
        this.keyboardRenderer.clearAllHighlights(),
      );
      this.registerCleanup("keyboardRenderer", () =>
        this.keyboardRenderer.dispose(),
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

  /**
   * 更新流体模拟专用 canvas 引用
   * 用于运行时流体 canvas 挂载/卸载后，让管理器拿到最新的 canvas 引用
   */
  setFluidCanvas(canvas: HTMLCanvasElement | null): void {
    this.visualEffects?.setFluidCanvas(canvas);
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
    this.settings = settings;
    // 传播键盘配置（圆角、黑键高度比、主题、颜色等）到渲染器
    this.keyboardRenderer.setKeyboardConfig(settings.keyboard);
    // 保存数值副本供下次比较
    this.prevKeyboardHeightRatio = settings.keyboard.heightRatio;
    // 键盘高度比例变化时需要重新布局
    if (
      settings.keyboard.heightRatio !== oldHeightRatio &&
      this.width > 0 &&
      this.height > 0
    ) {
      this.resize(this.width, this.height);
    }
    this.keyboardRenderer.resize(this.width, this.keyboardHeight, this.dpr);
    this.noteBlockSystem.setParticleConfig(settings.particles);
    this.noteBlockSystem.setAuraConfig(settings.aura);
    this.backgroundRenderer.setBackgroundConfig(settings.background);
    // 视觉特效（流体开关、滤镜参数、splat 配置）统一由 VisualEffectsManager 处理
    this.visualEffects?.updateConfig(settings);
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
   * 重新计算布局：根据键盘高度比例分配各层容器位置，并通知各子系统与流体
   * @param width - 画布总宽度（CSS 像素）
   * @param height - 画布总高度（CSS 像素）
   */
  resize(width: number, height: number): void {
    const layout = calculateLayout(this.settings, width, height);
    this.width = layout.width;
    this.height = layout.height;
    this.keyboardHeight = layout.keyboardHeight;
    this.dpr = layout.dpr;
    logger.debug(
      `[DEBUG-kbbug] engine.resize in=${width}x${height} → layout w=${layout.width} h=${layout.height} kbH=${layout.keyboardHeight} wfH=${layout.waterfallHeight} dpr=${layout.dpr}`,
    );
    this.keyboardRenderer.resize(
      layout.width,
      layout.keyboardHeight,
      layout.dpr,
    );
    this.noteBlockSystem.resize(
      layout.width,
      layout.waterfallHeight,
      layout.dpr,
      this.keyboardRenderer,
    );
    this.backgroundRenderer.resize(layout.width, layout.height, layout.dpr);
    // 通过 Container 定位各层（PixiJS 统一管理布局，无需手动 CSS）
    if (this.layers) {
      this.layers.keyboard.y = layout.waterfallHeight;
    }
    this.visualEffects?.resize();
  }

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
    this.visualEffects?.triggerNoteSplat(midi, velocity);
    waterfallPianoEvents.onNoteOn.internalInvoke({ midi, velocity });
  }

  triggerNoteOff(midi: number): void {
    this.soundEngine?.noteOff(midi);
    if (this.noteBlockSystem.getMode() === "realtime") {
      this.noteBlockSystem.releaseRealtimeNote(midi);
    }
    this.keyboardRenderer.clearHighlight(midi);
    waterfallPianoEvents.onNoteOff.internalInvoke({ midi });
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
    this.visualEffects?.triggerNoteSplat(midi, velocity);
    waterfallPianoEvents.onNoteOn.internalInvoke({ midi, velocity });
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
    waterfallPianoEvents.onNoteOff.internalInvoke({ midi });
  }

  // ── IRenderPipeline 实现（由 RenderLoop 通过接口调用） ──

  /** 推进播放器时间（委托给 frameCallback） */
  advancePlayback(): void {
    this.frameCallback?.();
  }

  /** 渲染背景 */
  renderBackground(now: number): void {
    this.backgroundRenderer.render(now);
  }

  /** 更新音符方块逻辑 */
  updateNoteBlocks(dtSec: number): void {
    this.noteBlockSystem.update(dtSec);
  }

  /** 渲染音符方块 */
  renderNoteBlocks(): void {
    this.noteBlockSystem.render();
  }

  /** 渲染键盘 */
  renderKeyboard(): void {
    this.keyboardRenderer.render();
  }

  /** FPS 叠加层渲染（委托给 NoteBlockSystem） */
  displayFPS(fps: number): void {
    if (!this.showFPS) return;
    this.noteBlockSystem.renderFPS(fps);
  }

  /** 判断当前帧是否应更新流体 */
  shouldUpdateFluid(): boolean {
    return this.visualEffects?.isFluidActive() ?? false;
  }

  /** 流体模拟更新 + 持续 splat */
  updateFluidAndSplats(): void {
    this.visualEffects?.update();
  }

  /** 将场景图提交到 GPU 进行渲染 */
  renderFrame(): void {
    if (!this.app) return;
    this.app.renderer.render({ container: this.app.stage });
  }

  /** 性能日志输出（每秒由 RenderLoop 调用一次） */
  logPerformance(
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
    this.visualEffects?.setPaused(paused);
  }

  /**
   * MIDI 模式专用：清空流体模拟中的所有粒子和染料。
   * 销毁当前实例并重建，重建后保持暂停状态（fluidPaused = true），
   * 直到下次播放时 setFluidPaused(false) 才开始更新。
   */
  clearFluid(): void {
    this.visualEffects?.clear();
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

    // 停止并销毁渲染循环（detach ticker 回调）
    this.renderLoop?.destroy();
    this.renderLoop = null;

    // 销毁交互控制器（解绑 Pointer 事件，清理已按住的音符）
    this.interaction?.dispose();
    this.interaction = null;

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

    // 释放 PixiJS 引用
    this.app = null;
    this.layers = null;

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
   * 强制重绘：重新渲染当前帧
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
