// Canvas 2D 键盘渲染器（从 PixiJS 重写）

const KEYBOARD_RANGES: Record<string, { from: number; to: number }> = {
  "88": { from: 21, to: 108 },
  "61": { from: 36, to: 96 },
  "49": { from: 36, to: 84 },
};

const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

export function isBlackKey(midi: number): boolean {
  const note = midi % 12;
  return [1, 3, 6, 8, 10].includes(note);
}

export function noteToName(midi: number): string {
  return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
}

export interface KeyboardConfig {
  from: number;
  to: number;
  showLabels: boolean;
  whiteKeyColor: string;
  blackKeyColor: string;
  pressedKeyColor: string;
  keyCornerRadius: number;
  keyBorderWidth: number;
  keyBorderColor: string;
  separatorEnabled: boolean;
  separatorColor: string;
  separatorThickness: number;
}

// 键位置缓存（用于快速查找）
interface KeyPosition {
  midi: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isBlack: boolean;
}

export class KeyboardRenderer {
  private config: KeyboardConfig;
  private keyWidth = 0;
  private keyHeight = 0;
  private whiteKeyCount = 0;
  containerOffsetY = 0;

  // 键位置缓存
  private whiteKeyPositions: Map<number, KeyPosition> = new Map();
  private blackKeyPositions: Map<number, KeyPosition> = new Map();
  private pressedKeys = new Set<number>();

  // 绘制参数缓存
  private width = 0;

  constructor() {
    this.config = {
      from: 21,
      to: 108,
      showLabels: false,
      whiteKeyColor: "#f0f0f0",
      blackKeyColor: "#1a1a1a",
      pressedKeyColor: "#6366f1",
      keyCornerRadius: 0,
      keyBorderWidth: 0,
      keyBorderColor: "#333333",
      separatorEnabled: true,
      separatorColor: "#ffffff",
      separatorThickness: 2,
    };
  }

  setConfig(config: Partial<KeyboardConfig>) {
    this.config = { ...this.config, ...config };
  }

  setRange(range: string) {
    const r = KEYBOARD_RANGES[range] || KEYBOARD_RANGES["88"];
    this.config.from = r.from;
    this.config.to = r.to;
  }

  // 预计算键位置（在初始化或 resize 时调用）
  computeKeyPositions(width: number, height: number) {
    this.width = width;
    this.keyHeight = height;
    this.whiteKeyCount = 0;
    this.whiteKeyPositions.clear();
    this.blackKeyPositions.clear();

    for (let midi = this.config.from; midi <= this.config.to; midi++) {
      if (!isBlackKey(midi)) this.whiteKeyCount++;
    }

    this.keyWidth = width / this.whiteKeyCount;
    const blackKeyWidth = this.keyWidth * 0.6;
    const blackKeyHeight = this.keyHeight * 0.6;

    // 先计算白键位置
    let x = 0;
    for (let midi = this.config.from; midi <= this.config.to; midi++) {
      if (isBlackKey(midi)) continue;

      this.whiteKeyPositions.set(midi, {
        midi,
        x,
        y: 0,
        width: this.keyWidth - 1,
        height: this.keyHeight,
        isBlack: false,
      });
      x += this.keyWidth;
    }

    // 再计算黑键位置
    let prevWhiteX = 0;
    for (let midi = this.config.from; midi <= this.config.to; midi++) {
      if (!isBlackKey(midi)) {
        prevWhiteX = this.getWhiteKeyX(midi);
        continue;
      }

      this.blackKeyPositions.set(midi, {
        midi,
        x: prevWhiteX + this.keyWidth - blackKeyWidth / 2,
        y: 0,
        width: blackKeyWidth,
        height: blackKeyHeight,
        isBlack: true,
      });
    }
  }

  // 渲染到 Canvas
  render(ctx: CanvasRenderingContext2D, offsetY: number) {
    ctx.save();
    ctx.translate(0, offsetY);

    // 绘制分隔线
    if (this.config.separatorEnabled && this.config.separatorThickness > 0) {
      ctx.fillStyle = this.config.separatorColor;
      ctx.fillRect(0, -this.config.separatorThickness, this.width, this.config.separatorThickness);
    }

    // 先绘制白键
    for (const [midi, pos] of this.whiteKeyPositions) {
      this.drawKey(ctx, pos, midi);
    }

    // 再绘制黑键（在上层）
    for (const [midi, pos] of this.blackKeyPositions) {
      this.drawKey(ctx, pos, midi);
    }

    ctx.restore();
  }

  private drawKey(ctx: CanvasRenderingContext2D, pos: KeyPosition, midi: number) {
    const isPressed = this.pressedKeys.has(midi);
    const fillColor = isPressed ? this.config.pressedKeyColor :
      (pos.isBlack ? this.config.blackKeyColor : this.config.whiteKeyColor);

    ctx.fillStyle = fillColor;

    // 圆角矩形
    const r = Math.min(this.config.keyCornerRadius, pos.width / 2, pos.height / 2);
    if (r > 0) {
      ctx.beginPath();
      ctx.roundRect(pos.x, pos.y, pos.width, pos.height, r);
      ctx.fill();
    } else {
      ctx.fillRect(pos.x, pos.y, pos.width, pos.height);
    }

    // 边框
    if (this.config.keyBorderWidth > 0 || !pos.isBlack) {
      ctx.strokeStyle = this.config.keyBorderWidth > 0 ?
        this.config.keyBorderColor : "#ccc";
      ctx.lineWidth = this.config.keyBorderWidth > 0 ?
        this.config.keyBorderWidth : 1;
      ctx.stroke();
    }

    // 标签
    if (this.config.showLabels && !pos.isBlack) {
      ctx.fillStyle = "#666";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(noteToName(midi), pos.x + pos.width / 2, pos.y + pos.height - 5);
    }
  }

  private getWhiteKeyX(midi: number): number {
    const pos = this.whiteKeyPositions.get(midi);
    return pos ? pos.x : 0;
  }

  highlightNote(midi: number) {
    this.pressedKeys.add(midi);
  }

  clearHighlight(midi: number) {
    this.pressedKeys.delete(midi);
  }

  clearAllHighlights() {
    this.pressedKeys.clear();
  }

  getNoteX(midi: number): number {
    if (midi < this.config.from || midi > this.config.to) return -1;

    if (isBlackKey(midi)) {
      const pos = this.blackKeyPositions.get(midi);
      return pos ? pos.x + pos.width / 2 : -1;
    }
    const pos = this.whiteKeyPositions.get(midi);
    return pos ? pos.x + pos.width / 2 : -1;
  }

  getNoteAtPoint(x: number, y: number): number | null {
    const localY = y - this.containerOffsetY;

    // 先检查黑键（在上层）
    if (localY >= 0 && localY <= this.keyHeight * 0.6) {
      for (const [midi, pos] of this.blackKeyPositions) {
        if (x >= pos.x && x <= pos.x + pos.width) {
          return midi;
        }
      }
    }

    // 再检查白键
    if (localY >= 0 && localY <= this.keyHeight) {
      for (const [midi, pos] of this.whiteKeyPositions) {
        if (x >= pos.x && x <= pos.x + pos.width) {
          return midi;
        }
      }
    }

    return null;
  }

  getRangeText(): string {
    return `${noteToName(this.config.from)} - ${noteToName(this.config.to)}`;
  }

  getFrom(): number {
    return this.config.from;
  }

  getTo(): number {
    return this.config.to;
  }

  getKeyWidth(): number {
    return this.keyWidth;
  }

  destroy() {
    this.whiteKeyPositions.clear();
    this.blackKeyPositions.clear();
    this.pressedKeys.clear();
  }
}

export { KEYBOARD_RANGES };