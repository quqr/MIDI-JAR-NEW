// Canvas 2D 瀑布流引擎（从 PixiJS 重写）

import { KeyboardRenderer } from "./KeyboardRenderer";
import { NoteBlockSystem, type NoteBlockCallbacks } from "./NoteBlockSystem";
import { AudioEngine } from "../audio/AudioEngine";
import { PhysicalPianoEngine } from "../audio/PhysicalPianoEngine";
import { OutputChain } from "../audio/OutputChain";
import type { SoundEngine } from "../audio/SoundEngine";
import * as Tone from "tone";
import type { FluidSimulation } from "./fluid";
import type { WaterfallPianoSettings, ScheduledNote, FlowDirection, AudioPreset } from "../types";

export class WaterfallEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  keyboardRenderer: KeyboardRenderer | null = null;
  noteBlockSystem: NoteBlockSystem | null = null;

  private settings: WaterfallPianoSettings | null = null;
  private animationId: number | null = null;
  private isDestroyed = false;
  private lastTime = 0;

  // 流体模拟（独立 WebGL canvas，由 WaterfallCanvas 注入）
  private fluidSimulation: FluidSimulation | null = null;

  private mode: "realtime" | "synthesia" = "realtime";
  private pointerToMidi = new Map<number, number>();

  private audioEngine: AudioEngine;
  private outputChain: OutputChain;
  private engine!: SoundEngine;

  // 布局参数
  private canvasWidth = 0;
  private canvasHeight = 0;
  private keyboardHeight = 0;
  private keyboardY = 0;

  constructor() {
    this.outputChain = new OutputChain();
    this.audioEngine = new AudioEngine(this.outputChain);
    this.engine = this.audioEngine;
  }

  async init(canvas: HTMLCanvasElement, settings: WaterfallPianoSettings) {
    this.settings = settings;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    if (!this.ctx) {
      throw new Error("Failed to get 2D context");
    }

    // 初始化渲染器
    this.keyboardRenderer = new KeyboardRenderer();
    this.noteBlockSystem = new NoteBlockSystem();

    // 设置回调
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

    await Tone.start();
    await this.outputChain.init();
    await this.audioEngine.init();

    if (this.isDestroyed) return;

    this.applySettings(settings);
    this.setupKeyboardInteraction();
    this.startGameLoop();
  }

  private setupKeyboardInteraction() {
    if (!this.canvas || !this.keyboardRenderer) return;

    const handlePointerDown = (e: PointerEvent) => {
      const rect = this.canvas!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const midi = this.keyboardRenderer!.getNoteAtPoint(x, y);
      if (midi !== null) {
        this.pointerToMidi.set(e.pointerId, midi);
        this.playRealtimeNote(midi, 100);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!this.pointerToMidi.has(e.pointerId)) return;
      const rect = this.canvas!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newMidi = this.keyboardRenderer!.getNoteAtPoint(x, y);
      const oldMidi = this.pointerToMidi.get(e.pointerId);

      if (newMidi !== null && newMidi !== oldMidi) {
        if (oldMidi !== undefined) {
          this.releaseRealtimeNote(oldMidi);
        }
        this.pointerToMidi.set(e.pointerId, newMidi);
        this.playRealtimeNote(newMidi, 100);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const midi = this.pointerToMidi.get(e.pointerId);
      if (midi !== undefined) {
        this.releaseRealtimeNote(midi);
        this.pointerToMidi.delete(e.pointerId);
      }
    };

    this.canvas.addEventListener("pointerdown", handlePointerDown);
    this.canvas.addEventListener("pointermove", handlePointerMove);
    this.canvas.addEventListener("pointerup", handlePointerUp);
    this.canvas.addEventListener("pointerleave", handlePointerUp);
  }

  private startGameLoop() {
    this.lastTime = performance.now();

    const loop = (time: number) => {
      if (this.isDestroyed) return;

      const delta = time - this.lastTime;
      this.lastTime = time;
      const deltaSeconds = delta / 1000;

      this.update(delta, deltaSeconds);
      this.render();

      this.animationId = requestAnimationFrame(loop);
    };

    this.animationId = requestAnimationFrame(loop);
  }

  private update(delta: number, deltaSeconds: number) {
    this.noteBlockSystem?.update(delta, deltaSeconds);
    this.emitBlockCoverage();
  }

  private render() {
    if (!this.ctx || !this.canvas) return;

    // 清空画布
    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    // 绘制音符块
    this.noteBlockSystem?.render(this.ctx);

    // 绘制键盘
    if (this.settings?.keyboard.visible) {
      this.keyboardRenderer?.render(this.ctx, this.keyboardY);
    }
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
    }

    if (this.noteBlockSystem) {
      this.noteBlockSystem.setRealtimeSpeed(settings.particles.speed);
      this.noteBlockSystem.setLookAhead(settings.particles.lookAhead);
      this.noteBlockSystem.setColorScheme(settings.particles.colorScheme);
      this.noteBlockSystem.setOpacity(settings.particles.opacity);
      this.noteBlockSystem.setCornerRadius(settings.particles.cornerRadius);
      this.noteBlockSystem.setFlowDirection(settings.keyboard.synthesiaFlowDirection);
      this.noteBlockSystem.setHitLineConfig({
        visible: settings.particles.hitLine.visible,
        color: settings.particles.hitLine.color,
        thickness: settings.particles.hitLine.thickness,
      });
    }

    // 引擎切换
    const targetPreset = settings.audio.preset;
    const currentEngineIsPhysical = this.engine instanceof PhysicalPianoEngine;
    const needPhysical = targetPreset === "physical-piano";

    if (needPhysical !== currentEngineIsPhysical) {
      this.switchEngine(targetPreset);
    } else if (needPhysical) {
      // 物理引擎：更新配置
      this.engine.setConfig(settings.physicalPiano);
    } else {
      // Tone 引擎：切换预设
      this.engine.applyPreset(targetPreset);
    }

    // 音量 / 混响延用 outputChain
    const volumeDb = (settings.audio.volume / 100) * 30 - 30;
    this.outputChain.setVolume(volumeDb);
    this.outputChain.setReverbWet(settings.audio.reverbAmount / 100);

    if (this.engine !== this.audioEngine) {
      this.engine.setVolume(volumeDb);
      this.engine.setReverbWet(settings.audio.reverbAmount / 100);
    }

    this.engine.setSustain(settings.audio.sustain);

    this.resize();
  }

  private switchEngine(preset: AudioPreset) {
    // 销毁旧引擎
    this.engine.disconnect();
    this.engine.dispose();

    if (preset === "physical-piano") {
      const physical = new PhysicalPianoEngine(this.outputChain);
      this.engine = physical;
    } else {
      this.audioEngine.applyPreset(preset);
      this.engine = this.audioEngine;
    }

    this.engine.init().then(() => {
      this.engine.connect(this.outputChain.rawInput!);
      if (this.settings) {
        this.engine.setSustain(this.settings.audio.sustain);
        if (preset === "physical-piano") {
          this.engine.setConfig(this.settings.physicalPiano);
        }
      }
    });
  }

  resize() {
    if (!this.canvas || !this.settings) return;

    const parent = this.canvas.parentElement;
    if (!parent) return;

    this.canvasWidth = parent.clientWidth;
    this.canvasHeight = parent.clientHeight;
    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;

    const keyboardVisible = this.settings.keyboard.visible;
    this.keyboardHeight = keyboardVisible ? this.canvasHeight * this.settings.keyboard.heightRatio : 0;
    this.keyboardY = this.canvasHeight - this.keyboardHeight;

    // 更新渲染器布局
    if (this.noteBlockSystem) {
      this.noteBlockSystem.setCanvasSize(this.canvasWidth, this.canvasHeight);
      this.noteBlockSystem.setKeyboardY(this.keyboardY);
    }

    if (this.keyboardRenderer) {
      this.keyboardRenderer.containerOffsetY = this.keyboardY;
      this.keyboardRenderer.computeKeyPositions(this.canvasWidth, this.keyboardHeight);
    }

    // 更新键宽
    this.updateNoteBlockLayout();
  }

  private updateNoteBlockLayout() {
    if (!this.keyboardRenderer || !this.noteBlockSystem || !this.settings) return;

    const keyW = this.keyboardRenderer.getKeyWidth();
    if (keyW > 0) {
      this.noteBlockSystem.setKeyWidth(keyW);
    }
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

  // 注入流体模拟实例
  setFluidSimulation(fluid: FluidSimulation | null) {
    this.fluidSimulation = fluid;
  }

  // 命中爆炸：命中线位置爆发一团
  private triggerHitExplosion(midi: number, velocity: number) {
    if (!this.fluidSimulation || !this.settings) return;

    const fluidParams = this.settings.background?.fluidParams;
    if (!fluidParams?.HIT_EXPLOSION) return;

    const x = (midi - 21) / (108 - 21);
    const keyboardY = this.noteBlockSystem?.getKeyboardY() ?? this.keyboardY;
    const y = this.canvasHeight > 0 ? keyboardY / this.canvasHeight : 0.95;

    const force = (velocity / 127) * 8000;
    const dx = (Math.random() - 0.5) * 1000;
    const dy = force;

    const brightness = 1.5;
    const hue = this.resolveSplatHue(midi);
    const c = this.hsvToRgb(hue, 1.0, 1.0);

    this.fluidSimulation.splat(
      Math.max(0, Math.min(1, x)),
      Math.max(0, Math.min(1, y)),
      dx,
      dy,
      { r: c.r * brightness, g: c.g * brightness, b: c.b * brightness }
    );
  }

  // 块体覆盖：每帧遍历块渗流体，限流 K=8
  private emitBlockCoverage() {
    if (!this.fluidSimulation || !this.settings) return;
    const fluidParams = this.settings.background?.fluidParams;
    if (!fluidParams?.BLOCK_COVERAGE) return;
    if (!this.noteBlockSystem || this.canvasHeight === 0) return;

    const blocks = this.noteBlockSystem.getBlocks();
    if (blocks.length === 0) return;

    const MAX_PER_FRAME = 8;
    let count = 0;
    // 轮流采样：从随机起点开始遍历，避免总偏向前面的块
    const start = Math.floor(Math.random() * blocks.length);
    for (let i = 0; i < blocks.length && count < MAX_PER_FRAME; i++) {
      const block = blocks[(start + i) % blocks.length];
      this.emitBlockSplat(block);
      count++;
    }
  }

  private emitBlockSplat(block: {
    midi: number; x: number; y: number; width: number; height: number;
    active: boolean; hasEnded: boolean; velocity: number;
  }) {
    if (!this.fluidSimulation || this.canvasWidth === 0 || this.canvasHeight === 0) return;

    // 块中心 + 小随机扰动
    const cx = block.x + block.width * 0.5 + (Math.random() - 0.5) * block.width * 0.4;
    const cy = block.y + block.height * 0.5 + (Math.random() - 0.5) * block.height * 0.4;
    const nx = Math.max(0, Math.min(1, cx / this.canvasWidth));
    const ny = Math.max(0, Math.min(1, cy / this.canvasHeight));

    // active 强、释放后减弱
    const intensity = block.active ? 1.0 : 0.3;
    const baseForce = (block.velocity / 127) * 1500;
    const dx = (Math.random() - 0.5) * 600;
    const dy = -baseForce * intensity;

    const hue = this.resolveSplatHue(block.midi);
    const c = this.hsvToRgb(hue, 1.0, 1.0);
    const brightness = 1.0 * intensity;

    this.fluidSimulation.splat(nx, ny, dx, dy, {
      r: c.r * brightness,
      g: c.g * brightness,
      b: c.b * brightness,
    });
  }

  private resolveSplatHue(midi: number): number {
    const fluidParams = this.settings?.background?.fluidParams;
    const customHue = fluidParams?.SPLAT_COLOR_HUE;
    return customHue !== undefined && customHue >= 0 ? customHue : (midi - 21) / 87;
  }

  private hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    let r = 0, g = 0, b = 0;
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }
    return { r, g, b };
  }

  playRealtimeNote(midi: number, velocity = 100) {
    if (this.mode !== "realtime") return;
    this.engine.noteOn(midi, velocity);
    this.keyboardRenderer?.highlightNote(midi);
    this.triggerHitExplosion(midi, velocity);

    if (this.noteBlockSystem && this.keyboardRenderer) {
      const x = this.keyboardRenderer.getNoteX(midi);
      if (x >= 0) {
        this.noteBlockSystem.startRealtimeNote(midi, x, velocity);
      }
    }
  }

  releaseRealtimeNote(midi: number) {
    if (this.mode !== "realtime") return;
    this.engine.noteOff(midi);
    this.keyboardRenderer?.clearHighlight(midi);
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
    this.engine.noteOn(midi, velocity);
    this.keyboardRenderer?.highlightNote(midi);
    this.triggerHitExplosion(midi, velocity);
  }

  releaseSynthesiaNote(midi: number) {
    this.engine.noteOff(midi);
    this.keyboardRenderer?.clearHighlight(midi);
  }

  clearNoteBlocks() {
    this.noteBlockSystem?.clear();
  }

  setFlowDirection(direction: FlowDirection) {
    this.noteBlockSystem?.setFlowDirection(direction);
  }

  destroy() {
    this.isDestroyed = true;

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this.engine.dispose();
    this.outputChain.dispose();

    this.noteBlockSystem?.destroy();
    this.keyboardRenderer?.destroy();

    this.noteBlockSystem = null;
    this.keyboardRenderer = null;
    this.fluidSimulation = null;
    this.canvas = null;
    this.ctx = null;
    this.pointerToMidi.clear();
  }
}