import * as PIXI from "pixi.js";
import { KeyboardRenderer } from "./KeyboardRenderer";
import { NoteBlockSystem } from "./NoteBlockSystem";
import type { NoteBlockCallbacks } from "./NoteBlockSystem";
import { BackgroundRenderer } from "./BackgroundRenderer";
import { PostProcessingRenderer } from "./PostProcessingRenderer";
import { StaffRenderer } from "./StaffRenderer";
import { PerformanceMonitor } from "./PerformanceMonitor";
import { AudioEngine } from "../audio/AudioEngine";
import { clearGlowTextureCache } from "./GlowTexture";
import type {
  WaterfallPianoSettings,
  ScheduledNote,
  FlowDirection,
} from "../types";

export class WaterfallEngine {
  app: PIXI.Application | null = null;
  keyboardRenderer: KeyboardRenderer | null = null;
  noteBlockSystem: NoteBlockSystem | null = null;
  backgroundRenderer: BackgroundRenderer | null = null;
  postProcessingRenderer: PostProcessingRenderer | null = null;
  staffRenderer: StaffRenderer | null = null;
  performanceMonitor: PerformanceMonitor | null = null;
  audioEngine: AudioEngine;

  // 分层容器
  private backgroundContainer: PIXI.Container | null = null;
  private sceneContainer: PIXI.Container | null = null;
  private noteBlockContainer: PIXI.Container | null = null;
  private hitLineContainer: PIXI.Container | null = null;
  private keyboardContainer: PIXI.Container | null = null;
  private uiContainer: PIXI.Container | null = null;

  private settings: WaterfallPianoSettings | null = null;
  private tickHandler: ((ticker: PIXI.Ticker) => void) | null = null;
  private isDestroyed = false;

  private mode: "realtime" | "synthesia" = "realtime";
  private pointerToMidi = new Map<number, number>();

  // 保存 PIXI 事件处理函数引用，以便 destroy 时移除
  private stagePointerDownHandler:
    | ((e: PIXI.FederatedPointerEvent) => void)
    | null = null;
  private stagePointerMoveHandler:
    | ((e: PIXI.FederatedPointerEvent) => void)
    | null = null;
  private stagePointerUpHandler:
    | ((e: PIXI.FederatedPointerEvent) => void)
    | null = null;

  constructor() {
    this.audioEngine = new AudioEngine();
  }

  async init(canvas: HTMLCanvasElement, settings: WaterfallPianoSettings) {
    this.settings = settings;

    this.app = new PIXI.Application();
    await this.app.init({
      canvas,
      background: "#1a1a2e",
      resizeTo: canvas.parentElement || canvas,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    // ─── 分层架构：背景层 → 场景层（音符块/命中线/键盘）→ UI 层 ───
    this.backgroundContainer = new PIXI.Container();
    this.sceneContainer = new PIXI.Container();
    this.noteBlockContainer = new PIXI.Container();
    this.hitLineContainer = new PIXI.Container();
    this.keyboardContainer = new PIXI.Container();
    this.uiContainer = new PIXI.Container();

    this.sceneContainer.addChild(this.noteBlockContainer);
    this.sceneContainer.addChild(this.hitLineContainer);
    this.sceneContainer.addChild(this.keyboardContainer);

    this.app.stage.addChild(this.backgroundContainer);
    this.app.stage.addChild(this.sceneContainer);
    this.app.stage.addChild(this.uiContainer);

    this.keyboardRenderer = new KeyboardRenderer(this.keyboardContainer);
    this.noteBlockSystem = new NoteBlockSystem(
      this.noteBlockContainer,
      this.hitLineContainer,
    );
    this.backgroundRenderer = new BackgroundRenderer(this.backgroundContainer);
    this.backgroundRenderer.setApp(this.app);
    this.postProcessingRenderer = new PostProcessingRenderer(
      this.app,
      this.sceneContainer,
      this.noteBlockContainer,
      this.hitLineContainer,
    );
    this.staffRenderer = new StaffRenderer(this.uiContainer);
    this.performanceMonitor = new PerformanceMonitor(
      settings.performance.minFps,
      settings.performance.targetFps,
    );

    // setCallbacks 在 await 之前调用，避免 async 竞态条件
    // （若 await 期间 destroy() 被调用，noteBlockSystem 会变为 null）
    this.noteBlockSystem.setCallbacks({
      onNoteTrigger: (midi, velocity, _hand) => {
        this.audioEngine.noteOn(midi, velocity);
        this.keyboardRenderer?.highlightNote(midi);
        this.staffRenderer?.onNoteOn(midi);
      },
      onNoteEnd: (midi) => {
        this.audioEngine.noteOff(midi);
        this.keyboardRenderer?.clearHighlight(midi);
        this.staffRenderer?.onNoteOff(midi);
      },
    } as NoteBlockCallbacks);

    await this.audioEngine.init();

    // 守卫：若 await 期间组件被卸载（HMR/路由切换），停止后续初始化
    if (this.isDestroyed) return;

    this.applySettings(settings);
    this.setupKeyboardInteraction();
    this.startGameLoop();
  }

  private setupKeyboardInteraction() {
    if (!this.app || !this.keyboardRenderer) return;

    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;

    this.stagePointerDownHandler = (e: PIXI.FederatedPointerEvent) => {
      const point = e.global;
      const midi = this.keyboardRenderer!.getNoteAtPoint(point.x, point.y);
      if (midi !== null) {
        this.pointerToMidi.set(e.pointerId, midi);
        this.playRealtimeNote(midi, 100);
      }
    };
    this.app.stage.on("pointerdown", this.stagePointerDownHandler);

    this.stagePointerMoveHandler = (e: PIXI.FederatedPointerEvent) => {
      if (!this.pointerToMidi.has(e.pointerId)) return;
      const point = e.global;
      const newMidi = this.keyboardRenderer!.getNoteAtPoint(point.x, point.y);
      const oldMidi = this.pointerToMidi.get(e.pointerId);

      if (newMidi !== null && newMidi !== oldMidi) {
        if (oldMidi !== undefined) {
          this.releaseRealtimeNote(oldMidi);
        }
        this.pointerToMidi.set(e.pointerId, newMidi);
        this.playRealtimeNote(newMidi, 100);
      }
    };
    this.app.stage.on("pointermove", this.stagePointerMoveHandler);

    this.stagePointerUpHandler = (e: PIXI.FederatedPointerEvent) => {
      const midi = this.pointerToMidi.get(e.pointerId);
      if (midi !== undefined) {
        this.releaseRealtimeNote(midi);
        this.pointerToMidi.delete(e.pointerId);
      }
    };
    this.app.stage.on("pointerup", this.stagePointerUpHandler);
    this.app.stage.on("pointerupoutside", this.stagePointerUpHandler);
  }

  private startGameLoop() {
    if (!this.app) return;

    this.tickHandler = (ticker: PIXI.Ticker) => {
      const deltaSeconds = ticker.deltaMS / 1000;
      const activeNoteCount = this.noteBlockSystem?.getActiveBlockCount() ?? 0;
      const fps = ticker.FPS;

      this.noteBlockSystem?.update(ticker.deltaTime, deltaSeconds);
      this.backgroundRenderer?.update(deltaSeconds, activeNoteCount, fps);
      this.staffRenderer?.update(deltaSeconds);

      // 自动降级
      if (this.performanceMonitor && this.settings?.performance.autoDegrade) {
        const action = this.performanceMonitor.update(fps);
        if (action === "degrade") {
          this.applyAutoDegrade();
        } else if (action === "recover") {
          this.applyAutoRecover();
        }
      }
    };
    this.app.ticker.add(this.tickHandler);
  }

  applySettings(settings: WaterfallPianoSettings) {
    this.settings = settings;

    if (this.keyboardRenderer) {
      this.keyboardRenderer.setRange(settings.keyboard.range);
      this.keyboardRenderer.setConfig({
        showLabels: settings.keyboard.keyLabel !== "none",
        whiteKeyColor: settings.keyboard.whiteKeyColor,
        blackKeyColor: settings.keyboard.blackKeyColor,
        pressedKeyColor: settings.keyboard.pressedKeyColor,
        keyCornerRadius: settings.keyboard.keyCornerRadius,
        keyBorderWidth: settings.keyboard.keyBorderWidth,
        keyBorderColor: settings.keyboard.keyBorderColor,
        separatorEnabled: settings.keyboard.separatorEnabled,
        separatorColor: settings.keyboard.separatorColor,
        separatorThickness: settings.keyboard.separatorThickness,
      });

      if (settings.keyboard.visible) {
        this.drawKeyboard();
      } else {
        this.keyboardContainer?.removeChildren();
        this.updateNoteBlockLayout();
      }
    }

    if (this.noteBlockSystem) {
      this.noteBlockSystem.setRealtimeSpeed(settings.particles.speed);
      this.noteBlockSystem.setLookAhead(settings.particles.lookAhead);
      this.noteBlockSystem.setStyle(settings.particles.style);
      this.noteBlockSystem.setColorScheme(settings.particles.colorScheme);
      this.noteBlockSystem.setOpacity(settings.particles.opacity);
      this.noteBlockSystem.setCornerRadius(settings.particles.cornerRadius);
      this.noteBlockSystem.setParticleShape(settings.particles.shape);
      this.noteBlockSystem.setParticleSize(settings.particles.size);
      this.noteBlockSystem.setTrailEnabled(settings.particles.trail);
      this.noteBlockSystem.setDensity(settings.particles.density);
      this.noteBlockSystem.setHitLineConfig(settings.particles.hitLine);
      this.noteBlockSystem.setNoteBlockConfig(settings.particles.noteBlock);
      this.noteBlockSystem.setTrailParticleConfig(
        settings.particles.trailParticle,
      );
      this.noteBlockSystem.setHitParticleConfig(settings.particles.hitParticle);
      this.noteBlockSystem.setPhysicsConfig(settings.particles.physics);
      this.noteBlockSystem.setNoteTextureConfig(settings.noteTexture);
      this.noteBlockSystem.setNoteBlockParticleConfig(
        settings.noteBlockParticles,
      );
      this.noteBlockSystem.setShowNoteNames(
        settings.keyboard.showNoteNames || settings.midiFile.showNoteNames,
      );
      this.noteBlockSystem.setFlowDirection(
        settings.keyboard.synthesiaFlowDirection,
      );
      this.noteBlockSystem.setParticleHardLimit(
        settings.performance.particleHardLimit,
      );
      this.noteBlockSystem.setLifecycleCurve(settings.particles.lifecycleCurve);
      this.updateNoteBlockLayout();
    }

    if (this.backgroundRenderer && this.app) {
      this.backgroundRenderer.applyConfig(
        settings.background,
        this.app.screen.width,
        this.app.screen.height,
      );
    }

    if (this.postProcessingRenderer && this.app) {
      this.postProcessingRenderer.applyConfig(
        settings.postProcessing,
        this.app.screen.width,
        this.app.screen.height,
      );
    }

    if (this.staffRenderer) {
      this.staffRenderer.setVisible(settings.keyboard.staffVisible);
      if (this.app) {
        this.staffRenderer.resize(
          this.app.screen.width,
          this.app.screen.height,
        );
      }
    }

    if (this.performanceMonitor) {
      this.performanceMonitor.setThresholds(
        settings.performance.minFps,
        settings.performance.targetFps,
      );
    }

    this.audioEngine.applyPreset(settings.audio.preset);
    const volumeDb = (settings.audio.volume / 100) * 30 - 30;
    this.audioEngine.setVolume(volumeDb);
    this.audioEngine.setReverbWet(settings.audio.reverbAmount / 100);
    this.audioEngine.setSustain(settings.audio.sustain);
  }

  private updateNoteBlockLayout() {
    if (!this.app || !this.noteBlockSystem || !this.settings) return;

    const h = this.app.screen.height;
    const w = this.app.screen.width;
    const keyboardVisible = this.settings.keyboard.visible;
    const keyboardHeight = keyboardVisible
      ? h * this.settings.keyboard.heightRatio
      : 0;
    const keyboardY = h - keyboardHeight;

    this.noteBlockSystem.setCanvasSize(w, h);
    this.noteBlockSystem.setKeyboardY(keyboardY);

    if (this.keyboardRenderer) {
      const keyW = this.keyboardRenderer.getKeyWidth();
      if (keyW > 0) {
        this.noteBlockSystem.setKeyWidth(keyW);
      }
    }

    const range = this.settings.keyboard.range;
    const keyCount =
      range === "88" ? 88 : range === "61" ? 61 : range === "49" ? 49 : 88;
    const whiteKeyCount = Math.ceil((keyCount * 7) / 12);
    this.noteBlockSystem.setKeyWidth(w / whiteKeyCount);
  }

  drawKeyboard() {
    if (!this.app || !this.keyboardRenderer || !this.settings) return;

    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const keyboardHeight = h * this.settings.keyboard.heightRatio;
    const keyboardY = h - keyboardHeight;

    this.keyboardContainer!.y = keyboardY;
    this.keyboardRenderer.containerOffsetY = keyboardY;
    this.keyboardRenderer.draw(w, keyboardHeight);
    this.updateNoteBlockLayout();
  }

  setMode(mode: "realtime" | "synthesia") {
    this.mode = mode;
    this.noteBlockSystem?.setMode(mode);
    if (mode === "synthesia") {
      this.noteBlockSystem?.clearBlocksOnly();
    }
  }

  getMode(): "realtime" | "synthesia" {
    return this.mode;
  }

  playRealtimeNote(midi: number, velocity = 100) {
    if (this.mode !== "realtime") return;
    this.audioEngine.noteOn(midi, velocity);
    this.keyboardRenderer?.highlightNote(midi);
    this.staffRenderer?.onNoteOn(midi);

    if (this.noteBlockSystem && this.keyboardRenderer) {
      const x = this.keyboardRenderer.getNoteX(midi);
      if (x >= 0) {
        this.noteBlockSystem.startRealtimeNote(midi, x, velocity);
      }
    }
  }

  releaseRealtimeNote(midi: number) {
    if (this.mode !== "realtime") return;
    this.audioEngine.noteOff(midi);
    this.keyboardRenderer?.clearHighlight(midi);
    this.staffRenderer?.onNoteOff(midi);
    this.noteBlockSystem?.endRealtimeNote(midi);
  }

  scheduleSynthesiaNotes(notes: ScheduledNote[]) {
    if (!this.noteBlockSystem || !this.keyboardRenderer) return;
    this.noteBlockSystem.scheduleNotes(notes, (midi) => {
      return this.keyboardRenderer!.getNoteX(midi);
    });
  }

  setTransportTime(time: number) {
    this.noteBlockSystem?.setTransportTime(time);
  }

  setTransportPlaying(playing: boolean) {
    this.noteBlockSystem?.setTransportPlaying(playing);
  }

  triggerSynthesiaNote(midi: number, velocity: number) {
    this.audioEngine.noteOn(midi, velocity);
    this.keyboardRenderer?.highlightNote(midi);
    this.staffRenderer?.onNoteOn(midi);
  }

  releaseSynthesiaNote(midi: number) {
    this.audioEngine.noteOff(midi);
    this.keyboardRenderer?.clearHighlight(midi);
    this.staffRenderer?.onNoteOff(midi);
  }

  clearNoteBlocks() {
    this.noteBlockSystem?.clear();
  }

  setFlowDirection(direction: FlowDirection) {
    this.noteBlockSystem?.setFlowDirection(direction);
  }

  resize() {
    if (!this.app) return;
    const parent = (this.app.canvas as HTMLCanvasElement).parentElement;
    if (parent) {
      this.app.renderer.resize(parent.clientWidth, parent.clientHeight);
      this.drawKeyboard();
      this.backgroundRenderer?.resize(parent.clientWidth, parent.clientHeight);
      this.postProcessingRenderer?.resize(
        parent.clientWidth,
        parent.clientHeight,
      );
      this.staffRenderer?.resize(parent.clientWidth, parent.clientHeight);
    }
  }

  getNoteBlockContainer(): PIXI.Container | null {
    return this.noteBlockContainer;
  }

  getHitLineContainer(): PIXI.Container | null {
    return this.hitLineContainer;
  }

  // ─── 自动降级 ───
  private degraded = false;
  private applyAutoDegrade() {
    if (this.degraded) return;
    this.degraded = true;
    this.noteBlockSystem?.setDegradeMode(true);
    this.backgroundRenderer?.setDegradeMode(true);
    this.postProcessingRenderer?.setDegradeMode(true);
  }

  private applyAutoRecover() {
    if (!this.degraded) return;
    this.degraded = false;
    this.noteBlockSystem?.setDegradeMode(false);
    this.backgroundRenderer?.setDegradeMode(false);
    this.postProcessingRenderer?.setDegradeMode(false);
  }

  destroy() {
    this.isDestroyed = true;

    // 移除 PIXI stage 事件监听器（防止闭包泄漏阻止 GC）
    if (this.app) {
      if (this.stagePointerDownHandler)
        this.app.stage.off("pointerdown", this.stagePointerDownHandler);
      if (this.stagePointerMoveHandler)
        this.app.stage.off("pointermove", this.stagePointerMoveHandler);
      if (this.stagePointerUpHandler) {
        this.app.stage.off("pointerup", this.stagePointerUpHandler);
        this.app.stage.off("pointerupoutside", this.stagePointerUpHandler);
      }
    }
    this.stagePointerDownHandler = null;
    this.stagePointerMoveHandler = null;
    this.stagePointerUpHandler = null;

    // 移除 ticker
    if (this.tickHandler && this.app) {
      this.app.ticker.remove(this.tickHandler);
    }
    this.tickHandler = null;

    // 销毁音频引擎
    this.audioEngine.dispose();

    // 按依赖顺序销毁各渲染器
    this.noteBlockSystem?.destroy();
    this.postProcessingRenderer?.destroy();
    this.staffRenderer?.destroy();
    this.backgroundRenderer?.destroy();
    this.keyboardRenderer?.destroy();

    // 清理模块级纹理缓存（防止 HMR/路由切换时 GPU 纹理泄漏）
    clearGlowTextureCache();

    // 销毁 PIXI Application（true = 同时销毁所有 stage 子元素）
    if (this.app) {
      this.app.destroy(true);
      this.app = null;
    }

    // 释放所有引用
    this.keyboardRenderer = null;
    this.noteBlockSystem = null;
    this.backgroundRenderer = null;
    this.postProcessingRenderer = null;
    this.staffRenderer = null;
    this.performanceMonitor = null;
    this.sceneContainer = null;
    this.backgroundContainer = null;
    this.noteBlockContainer = null;
    this.hitLineContainer = null;
    this.keyboardContainer = null;
    this.uiContainer = null;
    this.pointerToMidi.clear();
  }
}
