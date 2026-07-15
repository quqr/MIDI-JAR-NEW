import type { WaterfallPianoSettings, ScheduledNote } from "../types";
import { noteToColor, type CustomColors } from "./NoteColorMapper";
import type { KeyboardRenderer } from "./KeyboardRenderer";

export type NoteBlockMode = "realtime" | "synthesia";

const BLACK_KEY_CLASSES = new Set([1, 3, 6, 8, 10]);
const BLACK_KEY_WIDTH_RATIO = 0.6;

function isBlackKey(midi: number): boolean {
  return BLACK_KEY_CLASSES.has(((midi % 12) + 12) % 12);
}

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

const FADE_DURATION = 3;
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
  private synthesiaCursor = 0;
  private synthesiaBlockMap = new Map<string, NoteBlock>();
  private transportTime = 0;
  private transportPlaying = false;
  private triggeredSet = new Set<number>();
  private lastTransportTime = 0;
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
    if (this.mode === mode) return;
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
    this.synthesiaCursor = 0;
    this.synthesiaBlockMap.clear();
    this.lastTransportTime = 0;
  }

  setSettings(settings: WaterfallPianoSettings): void {
    this.settings = settings;
  }

  scheduleSynthesiaNotes(notes: ScheduledNote[]): void {
    this.synthesiaNotes = notes;
    this.synthesiaCursor = 0;
    this.synthesiaBlockMap.clear();
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
    const pps = this.pixelsPerSecond();
    const block = this.acquire();
    block.midi = midi;
    block.velocity = velocity;
    block.hand = "unknown";
    block.trackIndex = -1;
    block.startTime = 0;
    block.duration = 0;
    block.y = this.height;
    block.height = Math.max(pps * 0.05, 4); // 立即显示一个小块
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
        // 方块底部离开屏幕顶部时移除
        if (b.releasing && b.y < 0) {
          this.active.splice(i, 1);
          this.release(b);
        }
      }
    }
  }

  private noteKey(note: { trackIndex: number; midi: number; time: number }): string {
    return `${note.trackIndex}-${note.midi}-${note.time}`;
  }

  private updateSynthesia(pps: number): void {
    const t = this.transportTime;
    const lookAhead = this.settings ? this.settings.particles.lookAhead : 3;
    const notes = this.synthesiaNotes;
    const len = notes.length;

    // 检测向后跳转或循环：transport 时间回退超过 0.1 秒
    if (t < this.lastTransportTime - 0.1) {
      this.synthesiaCursor = 0;
      this.synthesiaBlockMap.clear();
      this.triggeredSet.clear();
      // 释放所有 synthesia 方块（trackIndex >= 0），保留 realtime 方块
      for (let i = this.active.length - 1; i >= 0; i--) {
        const b = this.active[i];
        if (b.trackIndex >= 0) {
          this.active.splice(i, 1);
          this.release(b);
        }
      }
    }
    this.lastTransportTime = t;

    // Reset cursor if transport went backwards (seek)
    if (this.synthesiaCursor > 0 && this.synthesiaCursor < len && notes[this.synthesiaCursor].time > t + lookAhead) {
      this.synthesiaCursor = 0;
    }

    // Advance cursor past notes that are too far in the past to matter
    while (this.synthesiaCursor < len && t - (notes[this.synthesiaCursor].time + notes[this.synthesiaCursor].duration) > lookAhead + notes[this.synthesiaCursor].duration + 1) {
      this.synthesiaCursor++;
    }

    const startIdx = this.synthesiaCursor;
    for (let ni = startIdx; ni < len; ni++) {
      const note = notes[ni];
      const timeUntilHit = note.time - t;
      if (timeUntilHit > lookAhead) break; // sorted by time, no need to scan further

      const maxEndOffset = lookAhead + note.duration + 1;
      const endOffset = t - (note.time + note.duration);
      if (endOffset > maxEndOffset) continue;

      const key = this.noteKey(note);
      let block = this.synthesiaBlockMap.get(key);
      if (!block || !block.active) {
        // 方块不存在或已回收到池中，需要重新创建
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
        this.synthesiaBlockMap.set(key, block);
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
      // Block slides off screen: remove only when the top of the block is below the canvas bottom
      const blockTop = b.y - b.height;
      if (blockTop > this.height) {
        this.active.splice(i, 1);
        // 使用 startTime 而非 time（NoteBlock 没有 time 属性）
        this.synthesiaBlockMap.delete(`${b.trackIndex}-${b.midi}-${b.startTime}`);
        this.release(b);
      }
    }
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
    const blackKeyWidth = whiteKeyWidth * BLACK_KEY_WIDTH_RATIO;
    const customColors: CustomColors = p.customColors;
    const isHighlighted = (midi: number) => this.triggeredSet.has(midi);

    for (const b of this.active) {
      const isBlack = isBlackKey(b.midi);
      const blockWidth = isBlack ? blackKeyWidth * 0.9 : whiteKeyWidth * 0.85;
      const x = this.keyboardRenderer!.midiToX(b.midi) - blockWidth / 2;
      const h = b.height <= 0 ? blockWidth : b.height;
      // b.y 是方块底部，绘制时需要从底部减去高度，使方块向上生长
      const y = b.y - h;
      let alpha = p.opacity;
      if (b.releasing) {
        alpha *= Math.max(0, 1 - b.fadeTime / FADE_DURATION);
      }
      const baseColor = noteToColor(b.midi, p.colorScheme, b.hand, customColors);
      const isTriggered = isHighlighted(b.midi);
      // Brighten color when triggered (Synthesia-style glow)
      const color = isTriggered ? brightenColor(baseColor, 0.4) : baseColor;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      if (p.cornerRadius > 0) {
        this.roundRect(ctx, x, y, blockWidth, h, p.cornerRadius);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, blockWidth, h);
      }
      if (isTriggered) {
        // Outer glow
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
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

/** Mix a hex color toward white by a given ratio (0-1) */
function brightenColor(hex: string, ratio: number): string {
  const h = hex.replace("#", "").padEnd(6, "0");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  const br = Math.round(r + (255 - r) * ratio);
  const bg = Math.round(g + (255 - g) * ratio);
  const bb = Math.round(b + (255 - b) * ratio);
  return `#${br.toString(16).padStart(2, "0")}${bg.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`;
}
