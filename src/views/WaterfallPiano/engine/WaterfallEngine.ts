import type { WaterfallPianoSettings } from "../types";
import { Application, Container, Renderer } from "pixi.js";
import { KeyboardRenderer } from "./KeyboardRenderer";
import { NoteBlockSystem, type NoteBlockMode } from "./NoteBlockSystem";
import { BackgroundRenderer } from "./BackgroundRenderer";
import { PerformanceMonitor } from "./PerformanceMonitor";
import { RenderLoop, type PhaseTimings } from "./RenderLoop";
import { FluidSplatManager } from "./FluidSplatManager";
import type { ISoundEngine } from "../audio/ISoundEngine";
import {
  resolveConfig,
  type FluidSimulationConfig,
} from "@/engine/fluid";
import { PixiFluidSimulation, type IFluidSimulation } from "@/engine/fluid-pixi";
import { createLogger } from "@/utils/logger";
import { waterfallPianoEvents } from "../events";

const logger = createLogger("WaterfallEngine");

export interface WaterfallLayers {
  background: Container;
  fluid: Container;
  waterfall: Container;
  keyboard: Container;
}

const DEFAULT_VELOCITY = 90;

/**
 * 瀑布钢琴主引擎，协调键盘渲染、音符方块系统、背景渲染、流体模拟与音频输出
 */
export class WaterfallEngine {
  private app: Application | null = null;
  private renderer: Renderer | null = null;
  private layers: WaterfallLayers | null = null;
  private settings: WaterfallPianoSettings | null = null;
  private keyboardRenderer = new KeyboardRenderer();
  private noteBlockSystem = new NoteBlockSystem();
  private backgroundRenderer = new BackgroundRenderer();
  private perfMonitor = new PerformanceMonitor();
  private fluid: IFluidSimulation | null = null;
  private soundEngine: ISoundEngine | null = null;
  private renderLoop: RenderLoop | null = null;
  private splatManager = new FluidSplatManager({
    keyboardRenderer: this.keyboardRenderer,
    noteBlockSystem: this.noteBlockSystem,
    getParticleConfig: () => this.settings ? this.settings.particles : null,
    getBackgroundConfig: () => this.settings ? this.settings.background : null,
    getLayout: () => ({
      width: this.width,
      height: this.height,
      keyboardHeight: this.keyboardHeight,
    }),
    hasCanvases: () => !!this.layers && !!this.app,
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
  public showFPS = true;
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
      this.renderer = app.renderer;
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
      this.noteBlockSystem.onNoteTrigger.add((args) => this.onSynthesiaTrigger(args.midi, args.velocity));
      this.noteBlockSystem.onNoteEnd.add((args) => this.onSynthesiaEnd(args.midi));
      this.maybeInitFluid(fluidCanvas);
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
          renderFrame: () => this.renderFrame(),
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
    if (settings.background.fluidEnabled && !oldFluidEnabled) {
      this.maybeInitFluid();
      // 流体开启后需要重新布局确保尺寸正确
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
   * 重新计算布局：根据键盘高度比例分配各层容器位置，并通知各子系统与流体
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
    // 通过 Container 定位各层（PixiJS 统一管理布局，无需手动 CSS）
    if (this.layers) {
      this.layers.keyboard.y = waterfallHeight;
    }
    if (this.fluid) {
      this.fluid.resize();
    }
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
   * 在设置启用流体且尚未创建实例时，初始化 PixiFluidSimulation 并启动
   */
  private maybeInitFluid(_fluidCanvas?: HTMLCanvasElement): void {
    if (!this.settings) return;
    if (!this.settings.background.fluidEnabled) return;
    const config = this.buildFluidConfig();
    if (this.fluid || (config.SIM_RESOLUTION ?? 0) <= 0) return;
    if (!this.app || !this.layers) return;
    try {
      this.fluid = new PixiFluidSimulation(this.app, this.layers.fluid, config);
      this.fluid.start();
    } catch {
      this.fluid = null;
    }
  }

  private bindPointerEvents(): void {
    if (!this.app) return;
    const canvas = this.app.canvas;
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("pointerleave", this.onPointerUp);
  }

  private unbindPointerEvents(): void {
    if (!this.app) return;
    const canvas = this.app.canvas;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerUp);
    canvas.removeEventListener("pointerleave", this.onPointerUp);
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
    if (this.fluid) {
      this.splatManager.fluidSplat(this.fluid, midi, velocity);
      if (this.settings?.background.fluidParams.hitExplosion) {
        this.splatManager.hitExplosionSplat(this.fluid, midi, velocity);
      }
    }
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

  /** FPS 叠加层渲染（委托给 NoteBlockSystem） */
  private renderFPSOverlay(fps: number): void {
    if (!this.showFPS) return;
    this.noteBlockSystem.renderFPS(fps);
  }

  /** 将场景图提交到 GPU 进行渲染 */
  private renderFrame(): void {
    if (!this.app) return;
    this.app.renderer.render({ container: this.app.stage });
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

    // 释放 PixiJS 引用
    this.app = null;
    this.renderer = null;
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
