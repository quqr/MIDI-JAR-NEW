import * as PIXI from "pixi.js";
import { KeyboardRenderer } from "./KeyboardRenderer";
import { NoteBlockSystem } from "./NoteBlockSystem";
import type { NoteBlockCallbacks } from "./NoteBlockSystem";
import { BackgroundRenderer } from "./BackgroundRenderer";
import { PostProcessingRenderer } from "./PostProcessingRenderer";
import { AudioEngine } from "../audio/AudioEngine";
import type { WaterfallPianoSettings, ScheduledNote } from "../types";

export class WaterfallEngine {
  app: PIXI.Application | null = null;
  keyboardRenderer: KeyboardRenderer | null = null;
  noteBlockSystem: NoteBlockSystem | null = null;
  backgroundRenderer: BackgroundRenderer | null = null;
  postProcessingRenderer: PostProcessingRenderer | null = null;
  audioEngine: AudioEngine;

  private sceneContainer: PIXI.Container | null = null;
  private backgroundContainer: PIXI.Container | null = null;
  private noteBlockContainer: PIXI.Container | null = null;
  private keyboardContainer: PIXI.Container | null = null;
  private settings: WaterfallPianoSettings | null = null;
  private tickHandler: ((ticker: PIXI.Ticker) => void) | null = null;

  // 模式
  private mode: "realtime" | "synthesia" = "realtime";

  // 多指追踪
  private pointerToMidi = new Map<number, number>();

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

    this.backgroundContainer = new PIXI.Container();
    this.noteBlockContainer = new PIXI.Container();
    this.keyboardContainer = new PIXI.Container();
    this.sceneContainer = new PIXI.Container();

    this.sceneContainer.addChild(this.backgroundContainer);
    this.sceneContainer.addChild(this.noteBlockContainer);
    this.sceneContainer.addChild(this.keyboardContainer);
    this.app.stage.addChild(this.sceneContainer);

    this.keyboardRenderer = new KeyboardRenderer(this.keyboardContainer);
    this.noteBlockSystem = new NoteBlockSystem(this.noteBlockContainer);
    this.backgroundRenderer = new BackgroundRenderer(this.backgroundContainer);
    this.postProcessingRenderer = new PostProcessingRenderer(this.app, this.sceneContainer);

    await this.audioEngine.init();

    // 设置音符块回调（Synthesia 模式触发音频）
    this.noteBlockSystem.setCallbacks({
      onNoteTrigger: (midi, velocity, _hand) => {
        this.audioEngine.noteOn(midi, velocity);
        this.keyboardRenderer?.highlightNote(midi);
      },
      onNoteEnd: (midi) => {
        this.audioEngine.noteOff(midi);
        this.keyboardRenderer?.clearHighlight(midi);
      },
    } as NoteBlockCallbacks);

    this.applySettings(settings);
    this.setupKeyboardInteraction();
    this.startGameLoop();
  }

  // ─── 多指 + 滑奏交互 ───
  private setupKeyboardInteraction() {
    if (!this.app || !this.keyboardRenderer) return;

    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;

    this.app.stage.on("pointerdown", (e: PIXI.FederatedPointerEvent) => {
      const point = e.global;
      const midi = this.keyboardRenderer!.getNoteAtPoint(point.x, point.y);
      if (midi !== null) {
        this.pointerToMidi.set(e.pointerId, midi);
        this.playRealtimeNote(midi, 100);
      }
    });

    this.app.stage.on("pointermove", (e: PIXI.FederatedPointerEvent) => {
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
    });

    const handlePointerUp = (e: PIXI.FederatedPointerEvent) => {
      const midi = this.pointerToMidi.get(e.pointerId);
      if (midi !== undefined) {
        this.releaseRealtimeNote(midi);
        this.pointerToMidi.delete(e.pointerId);
      }
    };

    this.app.stage.on("pointerup", handlePointerUp);
    this.app.stage.on("pointerupoutside", handlePointerUp);
  }

  private startGameLoop() {
    if (!this.app) return;

    this.tickHandler = (ticker: PIXI.Ticker) => {
      const deltaSeconds = ticker.deltaMS / 1000;
      this.noteBlockSystem?.update(ticker.deltaTime, deltaSeconds);
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
      this.noteBlockSystem.setTrailParticleConfig(settings.particles.trailParticle);
      this.noteBlockSystem.setHitParticleConfig(settings.particles.hitParticle);
      this.noteBlockSystem.setPhysicsConfig(settings.particles.physics);
      this.noteBlockSystem.setNoteTextureConfig(settings.noteTexture);
      this.noteBlockSystem.setNoteBlockParticleConfig(settings.noteBlockParticles);
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
    const keyboardHeight = keyboardVisible ? h * this.settings.keyboard.heightRatio : 0;
    // 键盘始终在底部
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
    // 键盘始终在底部
    const keyboardY = h - keyboardHeight;

    this.keyboardContainer!.y = keyboardY;
    this.keyboardRenderer.containerOffsetY = keyboardY;
    this.keyboardRenderer.draw(w, keyboardHeight);
    this.updateNoteBlockLayout();
  }

  // ─── 模式切换 ───
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

  // ─── 实时模式：音符控制 ───
  playRealtimeNote(midi: number, velocity = 100) {
    if (this.mode !== "realtime") return;
    this.audioEngine.noteOn(midi, velocity);
    this.keyboardRenderer?.highlightNote(midi);

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
    this.noteBlockSystem?.endRealtimeNote(midi);
  }

  // ─── Synthesia 模式：调度音符 ───
  scheduleSynthesiaNotes(notes: ScheduledNote[]) {
    if (!this.noteBlockSystem || !this.keyboardRenderer) return;
    this.noteBlockSystem.scheduleNotes(notes, (midi) => {
      return this.keyboardRenderer!.getNoteX(midi);
    });
  }

  // ─── Synthesia 模式：时间更新 ───
  setTransportTime(time: number) {
    this.noteBlockSystem?.setTransportTime(time);
  }

  setTransportPlaying(playing: boolean) {
    this.noteBlockSystem?.setTransportPlaying(playing);
  }

  // ─── Synthesia 模式：手动触发音符（用于回调） ───
  triggerSynthesiaNote(midi: number, velocity: number) {
    this.audioEngine.noteOn(midi, velocity);
    this.keyboardRenderer?.highlightNote(midi);
  }

  releaseSynthesiaNote(midi: number) {
    this.audioEngine.noteOff(midi);
    this.keyboardRenderer?.clearHighlight(midi);
  }

  // ─── 清理 ───
  clearNoteBlocks() {
    this.noteBlockSystem?.clear();
  }

  resize() {
    if (!this.app) return;
    const parent = (this.app.canvas as HTMLCanvasElement).parentElement;
    if (parent) {
      this.app.renderer.resize(parent.clientWidth, parent.clientHeight);
      this.drawKeyboard();
      this.backgroundRenderer?.resize(parent.clientWidth, parent.clientHeight);
      this.postProcessingRenderer?.resize(parent.clientWidth, parent.clientHeight);
    }
  }

  getNoteBlockContainer(): PIXI.Container | null {
    return this.noteBlockContainer;
  }

  destroy() {
    if (this.tickHandler && this.app) {
      this.app.ticker.remove(this.tickHandler);
    }
    this.audioEngine.dispose();
    this.noteBlockSystem?.clear();
    this.postProcessingRenderer?.destroy();
    if (this.app) {
      this.app.destroy(true);
      this.app = null;
    }
    this.keyboardRenderer = null;
    this.noteBlockSystem = null;
    this.backgroundRenderer = null;
    this.postProcessingRenderer = null;
    this.sceneContainer = null;
    this.backgroundContainer = null;
    this.noteBlockContainer = null;
    this.keyboardContainer = null;
  }
}
