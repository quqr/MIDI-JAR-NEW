import type { WaterfallPianoSettings } from "../types";
import { KeyboardRenderer } from "./KeyboardRenderer";
import { NoteBlockSystem, type NoteBlockMode } from "./NoteBlockSystem";
import { BackgroundRenderer } from "./BackgroundRenderer";
import { PerformanceMonitor } from "./PerformanceMonitor";
import { noteToColor } from "./NoteColorMapper";
import type { SoundEngine } from "../audio/SoundEngine";
import {
  FluidSimulation,
  resolveConfig,
  type FluidSimulationConfig,
} from "@/engine/fluid";

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

export class WaterfallEngine {
  private canvases: WaterfallCanvases | null = null;
  private settings: WaterfallPianoSettings | null = null;
  private keyboardRenderer = new KeyboardRenderer();
  private noteBlockSystem = new NoteBlockSystem();
  private backgroundRenderer = new BackgroundRenderer();
  private perfMonitor = new PerformanceMonitor();
  private fluid: FluidSimulation | null = null;
  private soundEngine: SoundEngine | null = null;
  private rafId: number | null = null;
  private lastTime = 0;
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
  callbacks: EngineCallbacks = {};
  /** 每帧回调，在 noteBlockSystem.update() 之前调用，用于推进播放器时间 */
  frameCallback: (() => void) | null = null;

  init(canvases: WaterfallCanvases, settings: WaterfallPianoSettings): void {
    this.canvases = canvases;
    this.settings = settings;
    this.keyboardRenderer.init(canvases.keyboard, settings);
    this.noteBlockSystem.init(canvases.waterfall, settings);
    this.backgroundRenderer.init(canvases.background, settings);
    this.noteBlockSystem.callbacks = {
      onNoteTrigger: (midi, vel) => this.onSynthesiaTrigger(midi, vel),
      onNoteEnd: (midi) => this.onSynthesiaEnd(midi),
    };
    this.maybeInitFluid();
    this.bindPointerEvents();
    this.startLoop();
  }

  setSoundEngine(engine: SoundEngine): void {
    this.soundEngine = engine;
  }

  setSustain(enabled: boolean): void {
    this.soundEngine?.setSustain(enabled);
  }

  applySettings(settings: WaterfallPianoSettings): void {
    // 用保存的数值副本检测变更（不依赖 watch 传递旧值，避免引用问题）
    const oldHeightRatio = this.prevKeyboardHeightRatio ?? settings.keyboard.heightRatio;
    const oldFluidEnabled = this.prevFluidEnabled ?? settings.background.fluidEnabled;
    this.settings = settings;
    // 保存数值副本供下次比较
    this.prevKeyboardHeightRatio = settings.keyboard.heightRatio;
    this.prevFluidEnabled = settings.background.fluidEnabled;
    // 键盘高度比例变化时需要重新布局所有 canvas
    if (settings.keyboard.heightRatio !== oldHeightRatio && this.width > 0 && this.height > 0) {
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
    } else if (!settings.background.fluidEnabled && oldFluidEnabled && this.fluid) {
      this.fluid.destroy();
      this.fluid = null;
    } else if (this.fluid && settings.background.fluidEnabled) {
      this.fluid.updateConfig(this.buildFluidConfig());
    }
  }

  setMode(mode: NoteBlockMode): void {
    if (this.noteBlockSystem.getMode() !== mode) {
      this.noteBlockSystem.clearNoteBlocks();
    }
    this.noteBlockSystem.setMode(mode);
  }

  getFPS(): number {
    return this.perfMonitor.getFps();
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const kbRatio = this.settings?.keyboard.heightRatio ?? 0.3;
    this.keyboardHeight = Math.max(80, Math.floor(height * kbRatio));
    const waterfallHeight = height - this.keyboardHeight;
    this.keyboardRenderer.resize(width, this.keyboardHeight, this.dpr);
    this.noteBlockSystem.resize(width, waterfallHeight, this.dpr, this.keyboardRenderer);
    this.backgroundRenderer.resize(width, height, this.dpr);
    this.layoutCanvases(waterfallHeight);
    if (this.fluid) {
      this.fluid.resize();
    }
  }

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

  private buildFluidConfig(): Partial<FluidSimulationConfig> {
    if (!this.settings) return {};
    const bg = this.settings.background;
    return resolveConfig(bg.fluidQuality, bg.fluidStyle, bg.fluidAdvanced, bg.fluidParams);
  }

  private maybeInitFluid(): void {
    if (!this.canvases || !this.settings) return;
    if (!this.settings.background.fluidEnabled) return;
    if (this.fluid) return;
    try {
      this.fluid = new FluidSimulation(this.canvases.fluid, this.buildFluidConfig());
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

  triggerNoteOn(midi: number, velocity: number): void {
    if (!this.settings) return;
    this.soundEngine?.noteOn(midi, velocity);
    if (this.noteBlockSystem.getMode() === "realtime") {
      this.noteBlockSystem.playRealtimeNote(midi, velocity);
    }
    this.keyboardRenderer.highlightNote(midi);
    this.fluidSplat(midi, velocity);
    // hitExplosion: 在音符X + 命中线Y位置触发爆发式 splat
    if (this.settings.background.fluidParams.hitExplosion && this.fluid) {
      this.hitExplosionSplat(midi, velocity);
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

  private onSynthesiaTrigger(midi: number, velocity: number): void {
    this.soundEngine?.noteOn(midi, velocity);
    this.keyboardRenderer.highlightNote(midi);
    this.fluidSplat(midi, velocity);
    // hitExplosion: 在音符X + 命中线Y位置触发爆发式 splat
    if (this.settings?.background.fluidParams.hitExplosion && this.fluid) {
      this.hitExplosionSplat(midi, velocity);
    }
  }

  private onSynthesiaEnd(midi: number): void {
    this.soundEngine?.noteOff(midi);
    this.keyboardRenderer.clearHighlight(midi);
  }

  private fluidSplat(midi: number, velocity = DEFAULT_VELOCITY): void {
    if (!this.fluid || !this.canvases) return;
    const x = this.keyboardRenderer.midiToX(midi) / Math.max(1, this.width);
    const y = this.keyboardHeight / Math.max(1, this.height);

    let rgb: { r: number; g: number; b: number };
    const hue = this.settings?.background.fluidParams.splatColorHue;
    if (hue !== undefined && hue > 0) {
      // splatColorHue 完全覆盖模式：单一色相 + 亮度随力度变化
      const lightness = 0.4 + (velocity / 127) * 0.3;
      rgb = hslToRgbNorm(hue, 0.8, lightness);
    } else {
      const colorHex = noteToColor(midi, this.settings?.particles.colorScheme ?? "pitch", undefined, this.settings?.particles.customColors);
      rgb = hexToRgbNorm(colorHex);
    }
    this.fluid.splat(x, y, 0, 200, rgb);
  }

  /** hitExplosion: 在命中线位置（音符X + 命中线Y）触发集中爆发 */
  private hitExplosionSplat(midi: number, _velocity: number): void {
    if (!this.fluid || !this.settings) return;
    const x = this.keyboardRenderer.midiToX(midi) / Math.max(1, this.width);
    // 命中线Y = 瀑布区域底部（键盘顶部）
    const hitLineY = (this.height - this.keyboardHeight) / Math.max(1, this.height);
    let rgb: { r: number; g: number; b: number };
    const hue = this.settings.background.fluidParams.splatColorHue;
    if (hue !== undefined && hue > 0) {
      rgb = hslToRgbNorm(hue, 0.9, 0.6);
    } else {
      const colorHex = noteToColor(midi, this.settings.particles.colorScheme, undefined, this.settings.particles.customColors);
      rgb = hexToRgbNorm(colorHex);
    }
    // 力度与 hitExplosionRadius 缩放联动
    const spread = this.settings.particles.hitExplosionRadius ?? 0.03;
    const force = spread * 5000;
    this.fluid.splat(x - spread, hitLineY, -force * 0.6, force, { r: rgb.r * 0.7, g: rgb.g * 0.7, b: rgb.b * 0.7 });
    this.fluid.splat(x + spread, hitLineY, force * 0.6, force, { r: rgb.r * 0.7, g: rgb.g * 0.7, b: rgb.b * 0.7 });
  }

  private startLoop(): void {
    this.lastTime = performance.now();
    let fluidFrameCount = 0;
    const FLUID_SKIP_FRAMES = 1; // 每隔1帧更新流体，即30fps

    const loop = (now: number) => {
      const dt = now - this.lastTime;
      this.lastTime = now;
      this.perfMonitor.recordFrame(dt);
      // 先推进播放器时间（通过 tick → onProgress → setTransportTime），
      // 再更新音符方块系统，确保 updateSynthesia 使用最新的 transportTime
      this.frameCallback?.();
      this.backgroundRenderer.render(now);
      this.noteBlockSystem.update(dt / 1000);
      this.noteBlockSystem.render();
      this.keyboardRenderer.render();

      // FPS 显示：在所有渲染完成后绘制（避免被 clearRect 清掉）
      if (this.showFPS && this.canvases) {
        const ctx = this.canvases.waterfall.getContext("2d");
        if (ctx) {
          ctx.save();
          ctx.font = "bold 12px monospace";
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
          ctx.shadowBlur = 4;
          ctx.fillText(`FPS: ${Math.round(this.perfMonitor.getFps())}`, 10, 20);
          ctx.restore();
        }
      }

      // 流体模拟由主循环驱动，但降帧运行
      fluidFrameCount++;
      if (this.fluid && fluidFrameCount > FLUID_SKIP_FRAMES) {
        this.fluid.update();
        fluidFrameCount = 0;

        // 长按持续触发：对键盘上持续按住的音符发射弱 splat
        if (this.fluid && this.settings?.background.fluidEnabled) {
          for (const midi of this.keyboardRenderer.getActiveNotes()) {
            const x = this.keyboardRenderer.midiToX(midi) / Math.max(1, this.width);
            const y = this.keyboardHeight / Math.max(1, this.height);
            const hue = this.settings.background.fluidParams.splatColorHue;
            let rgb: { r: number; g: number; b: number };
            if (hue !== undefined && hue > 0) {
              rgb = hslToRgbNorm(hue, 0.8, 0.4);
            } else {
              const colorHex = noteToColor(midi, this.settings.particles.colorScheme, undefined, this.settings.particles.customColors);
              rgb = hexToRgbNorm(colorHex);
            }
            this.fluid.splat(x, y, 0, 60, { r: rgb.r * 0.4, g: rgb.g * 0.4, b: rgb.b * 0.4 });
          }
        }

        // blockCoverage: 对每个活跃音符块持续发射尾焰式 splat
        if (this.settings?.background.fluidParams.blockCoverage && this.fluid) {
          const blockPositions = this.noteBlockSystem.getActiveBlockPositions(
            this.keyboardRenderer,
            this.height // 整个 canvas 高度
          );
          for (const pos of blockPositions) {
            const hue = this.settings.background.fluidParams.splatColorHue;
            let rgb: { r: number; g: number; b: number };
            if (hue !== undefined && hue > 0) {
              rgb = hslToRgbNorm(hue, 0.8, 0.5);
            } else {
              const colorHex = noteToColor(pos.midi, this.settings.particles.colorScheme, undefined, this.settings.particles.customColors);
              rgb = hexToRgbNorm(colorHex);
            }
            // 尾焰：从方块中心向下喷射小 splat（dy > 0 表示向下）
            this.fluid.splat(pos.normX, pos.normY, 0, 25, { r: rgb.r * 0.3, g: rgb.g * 0.3, b: rgb.b * 0.3 });
          }
        }
      }

      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
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

  getPerformanceFps(): number {
    return this.perfMonitor.getFps();
  }

  dispose(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.unbindPointerEvents();
    this.fluid?.destroy();
    this.fluid = null;
    this.noteBlockSystem.dispose();
    this.backgroundRenderer.dispose();
    this.keyboardRenderer.clearAllHighlights();
  }
}

function hexToRgbNorm(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "").padEnd(6, "0");
  return {
    r: (parseInt(normalized.slice(0, 2), 16) || 0) / 255,
    g: (parseInt(normalized.slice(2, 4), 16) || 0) / 255,
    b: (parseInt(normalized.slice(4, 6), 16) || 0) / 255,
  };
}

/** HSL (0-1 范围) → 归一化 RGB (0-1) */
function hslToRgbNorm(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return { r: f(0), g: f(8), b: f(4) };
}
