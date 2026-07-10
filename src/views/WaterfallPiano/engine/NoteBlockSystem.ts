import type { WaterfallPianoSettings, ScheduledNote } from "../types";
import { noteToColor, type CustomColors } from "./NoteColorMapper";
import type { KeyboardRenderer } from "./KeyboardRenderer";

export type NoteBlockMode = "realtime" | "synthesia";

interface NoteBlock {
  midi: number;
  velocity: number;
  hand: "left" | "right" | "unknown";
  trackIndex: number;
  startTime: number;
  duration: number;
  y: number;
  height: number;
  triggered: boolean;
  ended: boolean;
  releasing: boolean;
  fadeTime: number;
  active: boolean;
}

interface NoteBlockCallbacks {
  onNoteTrigger?: (midi: number, velocity: number, hand: "left" | "right" | "unknown") => void;
  onNoteEnd?: (midi: number) => void;
}

const FADE_DURATION = 0.5;
const POOL_MAX = 512;

export class NoteBlockSystem {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private settings: WaterfallPianoSettings | null = null;
  private keyboardRenderer: KeyboardRenderer | null = null;
  private width = 0;
  private height = 0;
  private mode: NoteBlockMode = "realtime";
  private pool: NoteBlock[] = [];
  private active: NoteBlock[] = [];
  private realtimeHeld = new Map<number, NoteBlock>();
  private synthesiaNotes: ScheduledNote[] = [];
  private transportTime = 0;
  private transportPlaying = false;
  private triggeredSet = new Set<number>();
  callbacks: NoteBlockCallbacks = {};

  init(canvas: HTMLCanvasElement, settings: WaterfallPianoSettings): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.settings = settings;
  }

  resize(width: number, height: number, dpr: number, keyboardRenderer: KeyboardRenderer): void {
    this.width = width;
    this.height = height;
    this.keyboardRenderer = keyboardRenderer;
    if (this.canvas) {
      this.canvas.width = Math.max(1, Math.floor(width * dpr));
      this.canvas.height = Math.max(1, Math.floor(height * dpr));
    }
    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  setMode(mode: NoteBlockMode): void {
    this.mode = mode;
    this.clearNoteBlocks();
  }

  getMode(): NoteBlockMode {
    return this.mode;
  }

  clearNoteBlocks(): void {
    for (const b of this.active) this.release(b);
    this.active = [];
    this.realtimeHeld.clear();
    this.triggeredSet.clear();
    this.synthesiaNotes = [];
  }

  setSettings(settings: WaterfallPianoSettings): void {
    this.settings = settings;
  }

  scheduleSynthesiaNotes(notes: ScheduledNote[]): void {
    this.synthesiaNotes = notes;
    this.triggeredSet.clear();
  }

  setTransportTime(t: number): void {
    this.transportTime = t;
  }

  setTransportPlaying(playing: boolean): void {
    this.transportPlaying = playing;
  }

  triggerSynthesiaNote(midi: number, _velocity: number): void {
    this.triggeredSet.add(midi);
  }

  releaseSynthesiaNote(midi: number): void {
    this.triggeredSet.delete(midi);
  }

  playRealtimeNote(midi: number, velocity: number): void {
    if (this.realtimeHeld.has(midi)) return;
    const block = this.acquire();
    block.midi = midi;
    block.velocity = velocity;
    block.hand = "unknown";
    block.trackIndex = -1;
    block.startTime = 0;
    block.duration = 0;
    block.y = this.height;
    block.height = 0;
    block.triggered = true;
    block.ended = false;
    block.releasing = false;
    block.fadeTime = 0;
    block.active = true;
    this.active.push(block);
    this.realtimeHeld.set(midi, block);
  }

  releaseRealtimeNote(midi: number): void {
    const block = this.realtimeHeld.get(midi);
    if (!block) return;
    block.releasing = true;
    block.fadeTime = 0;
    this.realtimeHeld.delete(midi);
  }

  private acquire(): NoteBlock {
    const pooled = this.pool.pop();
    if (pooled) {
      pooled.active = true;
      return pooled;
    }
    return {
      midi: 0,
      velocity: 0,
      hand: "unknown",
      trackIndex: -1,
      startTime: 0,
      duration: 0,
      y: 0,
      height: 0,
      triggered: false,
      ended: false,
      releasing: false,
      fadeTime: 0,
      active: false,
    };
  }

  private release(b: NoteBlock): void {
    b.active = false;
    if (this.pool.length < POOL_MAX) {
      this.pool.push(b);
    }
  }

  update(deltaTime: number): void {
    if (!this.settings) return;
    const pps = this.pixelsPerSecond();
    const dt = Math.min(deltaTime, 0.1);

    if (this.mode === "synthesia" && this.transportPlaying) {
      this.updateSynthesia(pps);
    }

    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i];
      if (this.mode === "realtime") {
        if (b.releasing) {
          b.y -= pps * dt;
          b.fadeTime += dt;
        } else {
          b.height += pps * dt;
        }
        if (b.releasing && (b.y + b.height < 0 || b.fadeTime > FADE_DURATION)) {
          this.active.splice(i, 1);
          this.release(b);
        }
      }
    }
  }

  private updateSynthesia(pps: number): void {
    const t = this.transportTime;
    const lookAhead = this.settings ? this.settings.particles.lookAhead : 3;
    for (const note of this.synthesiaNotes) {
      const timeUntilHit = note.time - t;
      if (timeUntilHit > lookAhead) continue;
      const endOffset = t - (note.time + note.duration);
      if (endOffset > 1) continue;

      let block = this.findSynthesiaBlock(note);
      if (!block) {
        if (timeUntilHit > lookAhead) continue;
        block = this.acquire();
        block.midi = note.midi;
        block.velocity = note.velocity;
        block.hand = note.hand;
        block.trackIndex = note.trackIndex;
        block.startTime = note.time;
        block.duration = note.duration;
        block.triggered = false;
        block.ended = false;
        block.releasing = false;
        block.fadeTime = 0;
        block.active = true;
        this.active.push(block);
      }
      block.y = this.height - timeUntilHit * pps;
      block.height = note.duration * pps;

      if (!block.triggered && timeUntilHit <= 0) {
        block.triggered = true;
        this.triggeredSet.add(note.midi);
        this.callbacks.onNoteTrigger?.(note.midi, note.velocity, note.hand);
      }
      if (!block.ended && t >= note.time + note.duration) {
        block.ended = true;
        this.callbacks.onNoteEnd?.(note.midi);
      }
    }

    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i];
      if (b.trackIndex < 0) continue;
      const endOffset = t - (b.startTime + b.duration);
      if (endOffset > 1) {
        this.active.splice(i, 1);
        this.release(b);
      }
    }
  }

  private findSynthesiaBlock(note: ScheduledNote): NoteBlock | null {
    for (const b of this.active) {
      if (b.trackIndex === note.trackIndex && b.midi === note.midi && b.startTime === note.time) {
        return b;
      }
    }
    return null;
  }

  private pixelsPerSecond(): number {
    if (!this.settings) return 200;
    return this.settings.particles.speed * 100;
  }

  render(): void {
    if (!this.ctx || !this.settings || !this.keyboardRenderer) return;
    const ctx = this.ctx;
    const p = this.settings.particles;
    ctx.clearRect(0, 0, this.width, this.height);

    if (p.hitLine.visible) {
      ctx.strokeStyle = p.hitLine.color;
      ctx.lineWidth = p.hitLine.thickness;
      ctx.beginPath();
      ctx.moveTo(0, this.height - p.hitLine.thickness / 2);
      ctx.lineTo(this.width, this.height - p.hitLine.thickness / 2);
      ctx.stroke();
    }

    const whiteKeyWidth = this.keyboardRenderer.getWhiteKeyWidth();
    const blockWidth = whiteKeyWidth * 0.85;
    const customColors: CustomColors = p.customColors;
    const isHighlighted = (midi: number) => this.triggeredSet.has(midi);

    for (const b of this.active) {
      const x = this.keyboardRenderer!.midiToX(b.midi) - blockWidth / 2;
      let y = b.y;
      let h = b.height;
      if (h <= 0) h = blockWidth;
      if (this.mode === "synthesia") {
        y = b.y - b.height;
      }
      let alpha = p.opacity;
      if (b.releasing) {
        alpha *= Math.max(0, 1 - b.fadeTime / FADE_DURATION);
      }
      const color = noteToColor(b.midi, p.colorScheme, b.hand, customColors);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      if (p.cornerRadius > 0) {
        this.roundRect(ctx, x, y, blockWidth, h, p.cornerRadius);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, blockWidth, h);
      }
      if (isHighlighted(b.midi)) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, blockWidth, h);
      }
      ctx.globalAlpha = 1;
    }
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    const radius = Math.min(r, w / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  getActiveBlockCount(): number {
    return this.active.length;
  }

  getPoolSize(): number {
    return this.pool.length;
  }

  dispose(): void {
    this.clearNoteBlocks();
    this.pool = [];
  }
}
