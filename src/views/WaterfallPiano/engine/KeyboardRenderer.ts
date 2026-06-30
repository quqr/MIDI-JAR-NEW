import * as PIXI from "pixi.js";

const KEYBOARD_RANGES: Record<string, { from: number; to: number }> = {
  "88": { from: 21, to: 108 },
  "61": { from: 36, to: 96 },
  "49": { from: 36, to: 84 },
};

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
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

export class KeyboardRenderer {
  private container: PIXI.Container;
  private whiteKeys: Map<number, PIXI.Graphics> = new Map();
  private blackKeys: Map<number, PIXI.Graphics> = new Map();
  private pressedKeys = new Set<number>();
  private config: KeyboardConfig;
  private keyWidth = 0;
  private keyHeight = 0;
  private whiteKeyCount = 0;
  containerOffsetY = 0;

  constructor(container: PIXI.Container) {
    this.container = container;
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

  draw(width: number, height: number) {
    this.container.removeChildren();
    this.whiteKeys.clear();
    this.blackKeys.clear();
    this.pressedKeys.clear();

    this.keyHeight = height;
    this.whiteKeyCount = 0;
    for (let midi = this.config.from; midi <= this.config.to; midi++) {
      if (!isBlackKey(midi)) this.whiteKeyCount++;
    }

    this.keyWidth = width / this.whiteKeyCount;
    const blackKeyWidth = this.keyWidth * 0.6;
    const blackKeyHeight = this.keyHeight * 0.6;

    // 先画白键
    let x = 0;
    let whiteIndex = 0;
    for (let midi = this.config.from; midi <= this.config.to; midi++) {
      if (isBlackKey(midi)) continue;

      const key = new PIXI.Graphics();
      if (this.config.keyCornerRadius > 0) {
        key.roundRect(0, 0, this.keyWidth - 1, this.keyHeight, this.config.keyCornerRadius);
      } else {
        key.rect(0, 0, this.keyWidth - 1, this.keyHeight);
      }
      key.fill(this.config.whiteKeyColor);
      if (this.config.keyBorderWidth > 0) {
        key.stroke({ color: this.config.keyBorderColor, width: this.config.keyBorderWidth });
      } else {
        key.stroke({ color: "#ccc", width: 1 });
      }
      key.x = x;
      key.y = 0;
      (key as { __midi?: number }).__midi = midi;

      if (this.config.showLabels) {
        const label = new PIXI.Text({
          text: noteToName(midi),
          style: {
            fontSize: 10,
            fill: "#666",
            align: "center",
          },
        });
        label.anchor.set(0.5, 1);
        label.x = this.keyWidth / 2;
        label.y = this.keyHeight - 5;
        key.addChild(label);
      }

      this.whiteKeys.set(midi, key);
      this.container.addChild(key);
      x += this.keyWidth;
      whiteIndex++;
    }

    // 再画黑键
    let prevWhiteX = 0;
    for (let midi = this.config.from; midi <= this.config.to; midi++) {
      if (!isBlackKey(midi)) {
        prevWhiteX = this.getWhiteKeyX(midi);
        continue;
      }

      const key = new PIXI.Graphics();
      const r = Math.max(3, this.config.keyCornerRadius);
      key.roundRect(0, 0, blackKeyWidth, blackKeyHeight, r);
      key.fill(this.config.blackKeyColor);
      if (this.config.keyBorderWidth > 0) {
        key.stroke({ color: this.config.keyBorderColor, width: this.config.keyBorderWidth });
      }
      // 黑键位置：前一个白键的右边缘 - 黑键宽度/2
      key.x = prevWhiteX + this.keyWidth - blackKeyWidth / 2;
      key.y = 0;
      (key as { __midi?: number }).__midi = midi;

      this.blackKeys.set(midi, key);
      this.container.addChild(key);
    }

    // 绘制键盘分隔线
    if (this.config.separatorEnabled && this.config.separatorThickness > 0) {
      const separator = new PIXI.Graphics();
      separator.rect(0, 0, width, this.config.separatorThickness);
      separator.fill(this.config.separatorColor);
      separator.y = -this.config.separatorThickness;
      this.container.addChild(separator);
    }
  }

  private getWhiteKeyX(midi: number): number {
    let x = 0;
    for (let m = this.config.from; m < midi; m++) {
      if (!isBlackKey(m)) x += this.keyWidth;
    }
    return x;
  }

  highlightNote(midi: number) {
    if (this.pressedKeys.has(midi)) return;
    this.pressedKeys.add(midi);

    const key = this.whiteKeys.get(midi) || this.blackKeys.get(midi);
    if (!key) return;

    const isBlack = isBlackKey(midi);
    key.clear();
    if (isBlack) {
      const blackKeyWidth = this.keyWidth * 0.6;
      const blackKeyHeight = this.keyHeight * 0.6;
      const r = Math.max(3, this.config.keyCornerRadius);
      key.roundRect(0, 0, blackKeyWidth, blackKeyHeight, r);
      key.fill(this.config.pressedKeyColor);
    } else {
      if (this.config.keyCornerRadius > 0) {
        key.roundRect(0, 0, this.keyWidth - 1, this.keyHeight, this.config.keyCornerRadius);
      } else {
        key.rect(0, 0, this.keyWidth - 1, this.keyHeight);
      }
      key.fill(this.config.pressedKeyColor);
      key.stroke({ color: "#aaa", width: 1 });
    }
  }

  clearHighlight(midi: number) {
    if (!this.pressedKeys.has(midi)) return;
    this.pressedKeys.delete(midi);

    const isBlack = isBlackKey(midi);
    const key = isBlack ? this.blackKeys.get(midi) : this.whiteKeys.get(midi);
    if (!key) return;

    key.clear();
    if (isBlack) {
      const blackKeyWidth = this.keyWidth * 0.6;
      const blackKeyHeight = this.keyHeight * 0.6;
      const r = Math.max(3, this.config.keyCornerRadius);
      key.roundRect(0, 0, blackKeyWidth, blackKeyHeight, r);
      key.fill(this.config.blackKeyColor);
      if (this.config.keyBorderWidth > 0) {
        key.stroke({ color: this.config.keyBorderColor, width: this.config.keyBorderWidth });
      }
    } else {
      if (this.config.keyCornerRadius > 0) {
        key.roundRect(0, 0, this.keyWidth - 1, this.keyHeight, this.config.keyCornerRadius);
      } else {
        key.rect(0, 0, this.keyWidth - 1, this.keyHeight);
      }
      key.fill(this.config.whiteKeyColor);
      if (this.config.keyBorderWidth > 0) {
        key.stroke({ color: this.config.keyBorderColor, width: this.config.keyBorderWidth });
      } else {
        key.stroke({ color: "#ccc", width: 1 });
      }
    }
  }

  clearAllHighlights() {
    for (const midi of this.pressedKeys) {
      this.clearHighlight(midi);
    }
  }

  getNoteX(midi: number): number {
    // 检查是否在范围内
    if (midi < this.config.from || midi > this.config.to) return -1;

    if (isBlackKey(midi)) {
      // getWhiteKeyX(midi) 对于黑键天然返回其中心位置
      // 因为黑键不计入白键累加，结果等于前一个白键右边缘 = 黑键中心
      return this.getWhiteKeyX(midi);
    }
    return this.getWhiteKeyX(midi) + this.keyWidth / 2;
  }

  getNoteAtPoint(x: number, y: number): number | null {
    // 将全局坐标转换为键盘容器的本地坐标
    const localY = y - this.containerOffsetY;

    // 先检查黑键（在上层）
    const blackKeyWidth = this.keyWidth * 0.6;
    const blackKeyHeight = this.keyHeight * 0.6;

    if (localY >= 0 && localY <= blackKeyHeight) {
      for (const [midi, key] of this.blackKeys) {
        if (x >= key.x && x <= key.x + blackKeyWidth) {
          return midi;
        }
      }
    }

    // 再检查白键
    if (localY >= 0 && localY <= this.keyHeight) {
      const whiteIndex = Math.floor(x / this.keyWidth);
      if (whiteIndex >= 0 && whiteIndex < this.whiteKeyCount) {
        // 找到第 whiteIndex 个白键的 midi
        let count = 0;
        for (let midi = this.config.from; midi <= this.config.to; midi++) {
          if (!isBlackKey(midi)) {
            if (count === whiteIndex) return midi;
            count++;
          }
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
}

export { KEYBOARD_RANGES };
