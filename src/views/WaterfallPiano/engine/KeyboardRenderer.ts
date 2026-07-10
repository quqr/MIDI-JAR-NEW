import type { WaterfallPianoSettings } from "../types";
import {
  midiToNoteName,
  midiToPitchClass,
  noteNameToMidi,
  NARROW_BREAKPOINT,
  KEYBOARD_RANGES,
  NARROW_RANGE,
} from "../constants";

const BLACK_KEY_CLASSES = new Set([1, 3, 6, 8, 10]);
const BLACK_KEY_WIDTH_RATIO = 0.6;
const BLACK_KEY_HEIGHT_RATIO = 0.62;

function isBlackKey(midi: number): boolean {
  return BLACK_KEY_CLASSES.has(((midi % 12) + 12) % 12);
}

function isWhiteKey(midi: number): boolean {
  return !isBlackKey(midi);
}

export interface KeyboardLayout {
  whiteKeys: number[];
  whiteKeyWidth: number;
  blackKeyWidth: number;
  height: number;
  blackKeyHeight: number;
  from: number;
  to: number;
}

export class KeyboardRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private settings: WaterfallPianoSettings | null = null;
  private width = 0;
  private height = 0;
  private from = 21;
  private to = 108;
  private highlights = new Set<number>();
  private activeNotes = new Set<number>();

  init(canvas: HTMLCanvasElement, settings: WaterfallPianoSettings): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.settings = settings;
    this.applyRangeFromSettings();
  }

  private applyRangeFromSettings(): void {
    if (!this.settings) return;
    const range = this.settings.keyboard.range;
    if (range === "custom") {
      const fromName = this.settings.keyboard.customFrom || "A0";
      const toName = this.settings.keyboard.customTo || "C8";
      this.from = noteNameToMidi(fromName);
      this.to = noteNameToMidi(toName);
    } else {
      const r = KEYBOARD_RANGES[range];
      this.from = r.from;
      this.to = r.to;
    }
  }

  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    if (this.canvas) {
      this.canvas.width = Math.max(1, Math.floor(width * dpr));
      this.canvas.height = Math.max(1, Math.floor(height * dpr));
    }
    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (this.settings && width < NARROW_BREAKPOINT) {
      this.from = NARROW_RANGE.from;
      this.to = NARROW_RANGE.to;
    } else {
      this.applyRangeFromSettings();
    }
  }

  setRange(from: number, to: number): void {
    this.from = from;
    this.to = to;
  }

  getVisibleRange(): { from: number; to: number } {
    return { from: this.from, to: this.to };
  }

  private getLayout(): KeyboardLayout {
    const whiteKeys: number[] = [];
    for (let m = this.from; m <= this.to; m++) {
      if (isWhiteKey(m)) whiteKeys.push(m);
    }
    const count = Math.max(1, whiteKeys.length);
    const whiteKeyWidth = this.width / count;
    const blackKeyWidth = whiteKeyWidth * BLACK_KEY_WIDTH_RATIO;
    const blackKeyHeight = this.height * BLACK_KEY_HEIGHT_RATIO;
    return {
      whiteKeys,
      whiteKeyWidth,
      blackKeyWidth,
      height: this.height,
      blackKeyHeight,
      from: this.from,
      to: this.to,
    };
  }

  midiToX(midi: number): number {
    const layout = this.getLayout();
    if (isWhiteKey(midi)) {
      const idx = layout.whiteKeys.indexOf(midi);
      if (idx < 0) return 0;
      return (idx + 0.5) * layout.whiteKeyWidth;
    }
    const aboveWhite = midi + 1;
    const idx = layout.whiteKeys.indexOf(aboveWhite);
    if (idx <= 0) return 0;
    return idx * layout.whiteKeyWidth;
  }

  xToMidi(x: number): number | null {
    const layout = this.getLayout();
    if (layout.whiteKeys.length === 0) return null;
    const wkw = layout.whiteKeyWidth;
    let wi = Math.floor(x / wkw);
    wi = Math.max(0, Math.min(layout.whiteKeys.length - 1, wi));
    const whiteMidi = layout.whiteKeys[wi];
    const halfBlack = layout.blackKeyWidth / 2;
    const rightBoundary = (wi + 1) * wkw;
    if (
      isBlackKey(whiteMidi + 1) &&
      whiteMidi + 1 <= this.to &&
      Math.abs(x - rightBoundary) <= halfBlack
    ) {
      return whiteMidi + 1;
    }
    const leftBoundary = wi * wkw;
    if (
      isBlackKey(whiteMidi - 1) &&
      whiteMidi - 1 >= this.from &&
      Math.abs(x - leftBoundary) <= halfBlack
    ) {
      return whiteMidi - 1;
    }
    return whiteMidi;
  }

  highlightNote(midi: number): void {
    this.highlights.add(midi);
    this.activeNotes.add(midi);
  }

  clearHighlight(midi: number): void {
    this.activeNotes.delete(midi);
  }

  clearAllHighlights(): void {
    this.highlights.clear();
    this.activeNotes.clear();
  }

  getRangeText(): string {
    return `${midiToNoteName(this.from)} - ${midiToNoteName(this.to)}`;
  }

  render(): void {
    if (!this.ctx || !this.settings) return;
    const ctx = this.ctx;
    const layout = this.getLayout();
    const kb = this.settings.keyboard;
    ctx.clearRect(0, 0, this.width, this.height);

    for (let i = 0; i < layout.whiteKeys.length; i++) {
      const midi = layout.whiteKeys[i];
      const x = i * layout.whiteKeyWidth;
      const w = layout.whiteKeyWidth;
      const isActive = this.activeNotes.has(midi);
      ctx.fillStyle = isActive ? kb.pressedKeyColor : kb.whiteKeyColor;
      ctx.fillRect(x, 0, w, this.height);
      if (kb.keyBorderWidth > 0) {
        ctx.strokeStyle = kb.keyBorderColor;
        ctx.lineWidth = kb.keyBorderWidth;
        ctx.strokeRect(x, 0, w, this.height);
      }
    }

    if (kb.separatorEnabled && kb.separatorThickness > 0) {
      ctx.strokeStyle = kb.separatorColor;
      ctx.lineWidth = kb.separatorThickness;
      ctx.beginPath();
      ctx.moveTo(0, this.height - kb.separatorThickness / 2);
      ctx.lineTo(this.width, this.height - kb.separatorThickness / 2);
      ctx.stroke();
    }

    ctx.fillStyle = kb.blackKeyColor;
    for (let m = this.from; m <= this.to; m++) {
      if (!isBlackKey(m)) continue;
      const x = this.midiToX(m);
      const isActive = this.activeNotes.has(m);
      ctx.fillStyle = isActive ? kb.pressedKeyColor : kb.blackKeyColor;
      const bx = x - layout.blackKeyWidth / 2;
      const by = 0;
      const bw = layout.blackKeyWidth;
      const bh = layout.blackKeyHeight;
      if (kb.keyCornerRadius > 0) {
        roundRect(ctx, bx, by, bw, bh, kb.keyCornerRadius);
        ctx.fill();
      } else {
        ctx.fillRect(bx, by, bw, bh);
      }
    }

    if (kb.keyLabel !== "none") {
      ctx.fillStyle = "#666";
      ctx.font = `${Math.max(8, layout.whiteKeyWidth * 0.3)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      for (let i = 0; i < layout.whiteKeys.length; i++) {
        const midi = layout.whiteKeys[i];
        const label = this.labelFor(midi, kb.keyLabel);
        if (!label) continue;
        const x = (i + 0.5) * layout.whiteKeyWidth;
        ctx.fillText(label, x, this.height - 4);
      }
    }
  }

  private labelFor(
    midi: number,
    mode: WaterfallPianoSettings["keyboard"]["keyLabel"],
  ): string | null {
    if (mode === "none") return null;
    if (mode === "note") return midiToNoteName(midi);
    if (mode === "pitchClass") return midiToPitchClass(midi);
    if (mode === "octave") {
      return midi % 12 === 0 ? midiToNoteName(midi) : null;
    }
    return null;
  }

  getKeyboardHeight(): number {
    return this.height;
  }

  getWhiteKeyWidth(): number {
    return this.getLayout().whiteKeyWidth;
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
