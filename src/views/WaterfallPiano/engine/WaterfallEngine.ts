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
  callbacks: EngineCallbacks = {};

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
    const prevFluidEnabled = this.settings?.background.fluidEnabled;
    this.settings = settings;
    this.keyboardRenderer.resize(this.width, this.keyboardHeight, this.dpr);
    this.noteBlockSystem.setSettings(settings);
    this.backgroundRenderer.setSettings(settings);
    if (settings.background.fluidEnabled && !prevFluidEnabled) {
      this.maybeInitFluid();
    } else if (!settings.background.fluidEnabled && prevFluidEnabled && this.fluid) {
      this.fluid.destroy();
      this.fluid = null;
    } else if (this.fluid && settings.background.fluidEnabled) {
      this.fluid.updateConfig(this.buildFluidConfig());
    }
  }

  setMode(mode: NoteBlockMode): void {
    this.noteBlockSystem.setMode(mode);
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
    this.fluidSplat(midi);
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
    this.fluidSplat(midi);
  }

  private onSynthesiaEnd(midi: number): void {
    this.soundEngine?.noteOff(midi);
    this.keyboardRenderer.clearHighlight(midi);
  }

  private fluidSplat(midi: number): void {
    if (!this.fluid || !this.canvases) return;
    const x = this.keyboardRenderer.midiToX(midi) / Math.max(1, this.width);
    const y = 1 - this.keyboardHeight / Math.max(1, this.height);
    const colorHex = noteToColor(midi, this.settings?.particles.colorScheme ?? "pitch", undefined, this.settings?.particles.customColors);
    const rgb = hexToRgbNorm(colorHex);
    this.fluid.splat(x, y, 0, -200, rgb);
  }

  private startLoop(): void {
    this.lastTime = performance.now();
    const loop = (now: number) => {
      const dt = now - this.lastTime;
      this.lastTime = now;
      this.perfMonitor.recordFrame(dt);
      this.backgroundRenderer.render(now);
      this.noteBlockSystem.update(dt / 1000);
      this.noteBlockSystem.render();
      this.keyboardRenderer.render();
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
