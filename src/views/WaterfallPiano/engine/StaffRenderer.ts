import * as PIXI from "pixi.js";

// ─── MIDI 到五线谱位置映射（高音谱号） ───
// 五线谱从下到上 5 条线：E4, G4, B4, D5, F5
// 间隔（从下到上）：F4, A4, C5, E5
// MIDI 中 C4 = 60, D4 = 62, E4 = 64, F4 = 65, G4 = 67, A4 = 69, B4 = 71, C5 = 72, D5 = 74, E5 = 76, F5 = 77
// 五线谱位置（每个半位置 = 一个线/间），以 E4 (MIDI 64) 为 0：
// 每升高一个位置（线到间或间到线）= 升高一个二度（音名进一位）
// 但需考虑升降号：C#4 (61) 与 C4 (60) 在五线谱同一位置

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

// 计算 MIDI 音符在五线谱上的"音名位置"（不考虑升降号）
// 返回相对于 E4 (MIDI 64) 的位置：E4=0, F4=1, G4=2, A4=3, B4=4, C5=5, D5=6, E5=7, F5=8
// noteIndex (0-11) 到 diatonic 的映射：C=0, D=1, E=2, F=3, G=4, A=5, B=6
// 注意 E-F 和 B-C 之间没有黑键，所以不能简单用 noteIndex/2
const DIATONIC_MAP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];

export function midiToStaffPosition(midi: number): number {
  const noteIndex = midi % 12; // 0-11, C=0
  const octave = Math.floor(midi / 12) - 1; // C4 = octave 4
  const diatonic = DIATONIC_MAP[noteIndex];
  // C4 (midi 60) 的"线间位置"基准：
  // 5 线谱以 E4 为 0，E4 在第 4 八度。
  // C4 相对 E4 是 -2 位置（C4 < D4 < E4）
  const c4Position = (octave - 4) * 7 - 2; // C4 = -2, C5 = 5
  return c4Position + diatonic;
}

export function midiToAccidental(midi: number): "none" | "sharp" | "flat" {
  const noteIndex = midi % 12;
  return [1, 3, 6, 8, 10].includes(noteIndex) ? "sharp" : "none";
}

export function midiToNoteName(midi: number): string {
  const noteIndex = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  return NOTE_NAMES[noteIndex] + octave;
}

interface StaffNote {
  midi: number;
  sprite: PIXI.Container;
  fadeStart: number; // 0 表示未开始淡出；正值表示淡出开始的时刻
  alpha: number;
  targetAlpha: number;
}

export class StaffRenderer {
  private container: PIXI.Container;
  private group: PIXI.Container;
  private background: PIXI.Graphics;
  private staffGraphics: PIXI.Graphics;
  private notesLayer: PIXI.Container;
  private visible = false;
  private width = 200;
  private height = 100;
  private staffTopY = 20;
  private lineSpacing = 8;
  private activeNotes = new Map<number, StaffNote>();

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container();
    this.group = new PIXI.Container();
    this.background = new PIXI.Graphics();
    this.staffGraphics = new PIXI.Graphics();
    this.notesLayer = new PIXI.Container();
    this.group.addChild(this.background);
    this.group.addChild(this.staffGraphics);
    this.group.addChild(this.notesLayer);
    this.container.addChild(this.group);
    parent.addChild(this.container);
    this.drawStaff();
    this.group.visible = false;
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.group.visible = visible;
    if (!visible) {
      this.clearAllNotes();
    }
  }

  resize(width: number, _height: number) {
    // 五线谱指示器固定在右上角，尺寸固定
    this.container.x = width - this.width - 20;
    this.container.y = 20;
  }

  private drawStaff() {
    this.background.clear();
    this.staffGraphics.clear();

    // 半透明深色背景（遵从原则：深色背景用半透明+填充色，非毛玻璃）
    this.background.roundRect(0, 0, this.width, this.height, 8);
    this.background.fill({ color: 0x000000, alpha: 0.5 });
    this.background.stroke({ color: 0xffffff, alpha: 0.15, width: 1 });

    // 5 条线
    const lineColor = 0xffffff;
    const lineAlpha = 0.7;
    const startX = 16;
    const endX = this.width - 16;
    for (let i = 0; i < 5; i++) {
      const y = this.staffTopY + i * this.lineSpacing;
      this.staffGraphics.moveTo(startX, y);
      this.staffGraphics.lineTo(endX, y);
      this.staffGraphics.stroke({
        color: lineColor,
        alpha: lineAlpha,
        width: 1,
      });
    }

    // 高音谱号（简化为文字 𝄞）
    const clef = new PIXI.Text({
      text: "𝄞",
      style: {
        fontFamily: "serif",
        fontSize: 40,
        fill: 0xffffff,
      },
    });
    clef.alpha = 0.8;
    clef.anchor.set(0.5, 0.5);
    clef.x = startX + 8;
    clef.y = this.staffTopY + 2 * this.lineSpacing; // 中间线
    this.staffGraphics.addChild(clef);
  }

  onNoteOn(midi: number) {
    if (!this.visible) return;
    if (this.activeNotes.has(midi)) {
      // 已经存在，恢复目标 alpha
      const existing = this.activeNotes.get(midi)!;
      existing.targetAlpha = 1;
      existing.fadeStart = 0;
      return;
    }
    const sprite = this.createNoteSprite(midi);
    this.notesLayer.addChild(sprite);
    this.activeNotes.set(midi, {
      midi,
      sprite,
      fadeStart: 0,
      alpha: 0,
      targetAlpha: 1,
    });
  }

  onNoteOff(midi: number) {
    const note = this.activeNotes.get(midi);
    if (note) {
      note.fadeStart = performance.now();
      note.targetAlpha = 0;
    }
  }

  private createNoteSprite(midi: number): PIXI.Container {
    const container = new PIXI.Container();
    const pos = midiToStaffPosition(midi); // E4=0
    // 位置 -> y 坐标：位置 0 (E4) 在第 1 条线（staffTopY + 4 * lineSpacing，因为 5 线谱从上到下，最下是 E4）
    // 实际上 5 线谱从下到上：E4(底), F4, G4, A4, B4(顶)
    // 我们绘制时从上到下：F5(顶), D5, B4, G4, E4(底)
    // staffTopY + 0*lineSpacing = F5 = position 8
    // staffTopY + 4*lineSpacing = E4 = position 0
    // 所以 y = staffTopY + (8 - pos) * (lineSpacing / 2)
    const y = this.staffTopY + (8 - pos) * (this.lineSpacing / 2);
    container.x = this.width / 2 + 20;
    container.y = y;

    // 加线（如果音符在五线谱外）
    if (pos < 0 || pos > 8) {
      const ledger = new PIXI.Graphics();
      const ledgerLen = 10;
      if (pos < 0) {
        // 下方加线
        for (let p = -2; p >= pos; p -= 2) {
          const ly = this.staffTopY + (8 - p) * (this.lineSpacing / 2) - y;
          ledger.moveTo(-ledgerLen, ly);
          ledger.lineTo(ledgerLen, ly);
          ledger.stroke({ color: 0xffffff, alpha: 0.7, width: 1 });
        }
      } else {
        // 上方加线
        for (let p = 10; p <= pos; p += 2) {
          const ly = this.staffTopY + (8 - p) * (this.lineSpacing / 2) - y;
          ledger.moveTo(-ledgerLen, ly);
          ledger.lineTo(ledgerLen, ly);
          ledger.stroke({ color: 0xffffff, alpha: 0.7, width: 1 });
        }
      }
      container.addChild(ledger);
    }

    // 音符头（实心椭圆）
    const head = new PIXI.Graphics();
    head.ellipse(0, 0, 5, 4);
    head.fill({ color: 0xffffff, alpha: 0.95 });
    container.addChild(head);

    // 升号
    if (midiToAccidental(midi) === "sharp") {
      const sharp = new PIXI.Text({
        text: "♯",
        style: { fontFamily: "serif", fontSize: 16, fill: 0xffffff },
      });
      sharp.alpha = 0.9;
      sharp.anchor.set(1, 0.5);
      sharp.x = -8;
      sharp.y = 0;
      container.addChild(sharp);
    }

    return container;
  }

  update(_deltaSeconds: number) {
    if (!this.visible) return;
    const now = performance.now();
    const fadeDuration = 300; // ms
    const toRemove: number[] = [];

    for (const [midi, note] of this.activeNotes) {
      if (note.targetAlpha === 0 && note.fadeStart > 0) {
        const t = (now - note.fadeStart) / fadeDuration;
        note.alpha = Math.max(0, 1 - t);
        if (note.alpha <= 0) {
          toRemove.push(midi);
        }
      } else if (note.targetAlpha === 1 && note.alpha < 1) {
        // 淡入
        note.alpha = Math.min(1, note.alpha + _deltaSeconds * 6);
      }
      note.sprite.alpha = note.alpha;
    }

    for (const midi of toRemove) {
      const note = this.activeNotes.get(midi)!;
      this.notesLayer.removeChild(note.sprite);
      note.sprite.destroy({ children: true });
      this.activeNotes.delete(midi);
    }
  }

  private clearAllNotes() {
    for (const [, note] of this.activeNotes) {
      this.notesLayer.removeChild(note.sprite);
      note.sprite.destroy({ children: true });
    }
    this.activeNotes.clear();
  }

  destroy() {
    this.clearAllNotes();
    this.container.destroy({ children: true });
  }
}
