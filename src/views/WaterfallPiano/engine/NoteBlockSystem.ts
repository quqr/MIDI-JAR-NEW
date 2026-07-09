// Canvas 2D 音符块系统（从 PixiJS 重写，移除粒子特效）

import { isBlackKey } from "./KeyboardRenderer";
import type { ColorScheme, ScheduledNote, FlowDirection } from "../types";

// ─── 音符块 ───
interface NoteBlock {
  midi: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  alpha: number;
  startTime: number;
  active: boolean;
  hitTime: number;
  endTime: number;
  hasTriggered: boolean;
  hasEnded: boolean;
  velocity: number;
  hand: "left" | "right" | "unknown";
  trackColor: number | null;
}

export interface NoteBlockCallbacks {
  onNoteTrigger?: (midi: number, velocity: number, hand: "left" | "right" | "unknown") => void;
  onNoteEnd?: (midi: number) => void;
}

export class NoteBlockSystem {
  private blocks: NoteBlock[] = [];

  private mode: "realtime" | "synthesia" = "realtime";

  // 布局
  private keyboardY = 0;
  private canvasHeight = 0;
  private canvasWidth = 0;
  private keyWidth = 0;
  private blackKeyWidth = 0;

  // 速度
  private realtimeSpeed = 2;
  private fallSpeed = 120;
  private lookAhead = 3;

  // 视觉配置（简化）
  private colorScheme: ColorScheme = "pitch";
  private opacity = 0.9;
  private cornerRadius = 3;

  // 命中线配置（简化）
  private hitLineVisible = true;
  private hitLineColor = "#ffffff";
  private hitLineThickness = 2;

  // Synthesia 播放状态
  private transportTime = 0;
  private isTransportPlaying = false;
  private flowDirection: FlowDirection = "down";

  private callbacks: NoteBlockCallbacks = {};

  constructor() {
    // 无需初始化 PixiJS 容器
  }

  setCallbacks(callbacks: NoteBlockCallbacks) {
    this.callbacks = callbacks;
  }

  // ─── 布局设置 ───
  setCanvasSize(width: number, height: number) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.updateFallSpeed();
  }

  setKeyboardY(y: number) {
    this.keyboardY = y;
    this.updateFallSpeed();
  }

  setKeyWidth(width: number) {
    this.keyWidth = width;
    this.blackKeyWidth = width * 0.6;
  }

  private updateFallSpeed() {
    const fallDistance = this.keyboardY;
    if (this.lookAhead > 0 && fallDistance > 0) {
      this.fallSpeed = fallDistance / this.lookAhead;
    }
  }

  setMode(mode: "realtime" | "synthesia") {
    this.mode = mode;
  }

  // ─── 视觉配置 ───
  setRealtimeSpeed(speed: number) {
    this.realtimeSpeed = speed;
  }

  setLookAhead(seconds: number) {
    this.lookAhead = seconds;
    this.updateFallSpeed();
  }

  setColorScheme(scheme: ColorScheme) {
    this.colorScheme = scheme;
  }

  setOpacity(op: number) {
    this.opacity = op;
  }

  setCornerRadius(r: number) {
    this.cornerRadius = r;
  }

  setFlowDirection(direction: FlowDirection) {
    this.flowDirection = direction;
  }

  setHitLineConfig(config: { visible: boolean; color: string; thickness: number }) {
    this.hitLineVisible = config.visible;
    this.hitLineColor = config.color;
    this.hitLineThickness = config.thickness;
  }

  // ─── Synthesia 播放控制 ───
  setTransportTime(time: number) {
    this.transportTime = time;
  }

  setTransportPlaying(playing: boolean) {
    this.isTransportPlaying = playing;
  }

  // ─── 实时模式：开始音符 ───
  startRealtimeNote(midi: number, x: number, velocity: number) {
    if (midi < 0 || midi > 127) return;
    if (velocity < 0 || velocity > 127) velocity = Math.max(0, Math.min(127, velocity));

    // 防止同一 MIDI 音符多次激活
    for (let i = this.blocks.length - 1; i >= 0; i--) {
      const b = this.blocks[i];
      if (b.midi === midi && b.active) {
        b.active = false;
        b.endTime = performance.now();
        b.hasEnded = true;
        break;
      }
    }

    const color = this.resolveColor(midi, "unknown", null);
    const w = isBlackKey(midi) ? this.blackKeyWidth : this.keyWidth;
    const block: NoteBlock = {
      midi,
      x: x - w / 2,
      y: this.keyboardY,
      width: w,
      height: 0,
      color,
      alpha: this.opacity,
      startTime: performance.now(),
      active: true,
      hitTime: 0,
      endTime: 0,
      hasTriggered: true,
      hasEnded: false,
      velocity,
      hand: "unknown",
      trackColor: null,
    };
    this.blocks.push(block);
  }

  endRealtimeNote(midi: number) {
    if (midi < 0 || midi > 127) return;

    for (let i = this.blocks.length - 1; i >= 0; i--) {
      const b = this.blocks[i];
      if (b.midi === midi && b.active) {
        b.active = false;
        b.endTime = performance.now();
        b.hasEnded = true;
        break;
      }
    }
  }

  // ─── Synthesia 模式：调度音符 ───
  scheduleNotes(notes: ScheduledNote[], getX: (midi: number) => number) {
    for (const note of notes) {
      const x = getX(note.midi);
      if (x < 0) continue;
      const color = this.resolveColor(note.midi, note.hand, null);
      const blockHeight = Math.max(8, note.duration * this.fallSpeed);
      const w = isBlackKey(note.midi) ? this.blackKeyWidth : this.keyWidth;

      const block: NoteBlock = {
        midi: note.midi,
        x: x - w / 2,
        y: 0,
        width: w,
        height: blockHeight,
        color,
        alpha: this.opacity,
        startTime: 0,
        active: false,
        hitTime: note.time,
        endTime: note.time + note.duration,
        hasTriggered: false,
        hasEnded: false,
        velocity: note.velocity,
        hand: note.hand,
        trackColor: null,
      };
      this.blocks.push(block);
    }
  }

  // ─── 颜色解析 ───
  private resolveColor(midi: number, hand: "left" | "right" | "unknown", trackColor: number | null): number {
    if (trackColor !== null) return trackColor;

    switch (this.colorScheme) {
      case "pitch": {
        const t = (midi - 21) / 87;
        return this.hslToHex(t * 300, 85, 55);
      }
      case "hands": {
        if (hand === "left") return 0x6366f1;
        if (hand === "right") return 0x14b8a6;
        return 0xf59e0b;
      }
      case "rainbow": {
        const hue = ((midi - 21) / 87) * 360;
        return this.hslToHex(hue, 90, 55);
      }
      case "warm": {
        const t = (midi - 21) / 87;
        return this.hslToHex(t * 60, 90, 55);
      }
      case "cool": {
        const t = (midi - 21) / 87;
        return this.hslToHex(180 + t * 80, 80, 50);
      }
      case "neon": {
        const t = (midi - 21) / 87;
        return this.hslToHex(t * 360, 100, 60);
      }
      default:
        return 0x6366f1;
    }
  }

  private hslToHex(h: number, s: number, l: number): number {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color);
    };
    return (f(0) << 16) + (f(8) << 8) + f(4);
  }

  private numberToHex(color: number): string {
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  // ─── 主更新循环 ───
  update(delta: number, _deltaSeconds: number) {
    const now = performance.now();
    const toRemove: number[] = [];

    for (let i = 0; i < this.blocks.length; i++) {
      const block = this.blocks[i];

      if (this.mode === "realtime") {
        this.updateRealtimeBlock(block, now, delta);
      } else {
        this.updateSynthesiaBlock(block);
      }

      if (this.shouldRemove(block, now)) {
        toRemove.push(i);
      }
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.blocks.splice(toRemove[i], 1);
    }
  }

  // ─── 渲染到 Canvas ───
  render(ctx: CanvasRenderingContext2D) {
    // 绘制命中线
    this.drawHitLine(ctx);

    // 绘制音符块
    for (const block of this.blocks) {
      this.drawBlock(ctx, block);
    }
  }

  // ─── 实时模式更新 ───
  private updateRealtimeBlock(block: NoteBlock, now: number, delta: number) {
    if (block.active) {
      const elapsed = now - block.startTime;
      block.height = Math.max(8, elapsed * this.realtimeSpeed * 0.06);
      block.y = this.keyboardY - block.height;
    } else {
      // 释放后匹配生长速度继续向上飘
      block.y -= this.realtimeSpeed * 0.06 * delta;
    }
  }

  // ─── Synthesia 模式更新 ───
  private updateSynthesiaBlock(block: NoteBlock) {
    if (!this.isTransportPlaying) return;

    const hitY = this.keyboardY;
    if (this.flowDirection === "down") {
      block.y = hitY - (block.hitTime - this.transportTime) * this.fallSpeed;
    } else {
      block.y = hitY + (block.hitTime - this.transportTime) * this.fallSpeed - block.height;
    }

    // 触发 noteOn
    if (!block.hasTriggered && this.transportTime >= block.hitTime) {
      block.hasTriggered = true;
      this.callbacks.onNoteTrigger?.(block.midi, block.velocity, block.hand);
    }

    // 触发 noteOff
    if (!block.hasEnded && this.transportTime >= block.endTime) {
      block.hasEnded = true;
      this.callbacks.onNoteEnd?.(block.midi);
    }
  }

  // ─── 移除判断 ───
  private shouldRemove(block: NoteBlock, _now: number): boolean {
    if (this.mode === "realtime") {
      // 仅在完全飘出屏幕顶部时移除
      return block.hasEnded && block.y + block.height < 0;
    } else {
      if (this.flowDirection === "down") {
        return block.hasEnded && block.y > this.canvasHeight;
      } else {
        return block.hasEnded && block.y + block.height < 0;
      }
    }
  }

  // ─── 绘制命中线 ───
  private drawHitLine(ctx: CanvasRenderingContext2D) {
    if (!this.hitLineVisible) return;

    const y = this.keyboardY;
    ctx.strokeStyle = this.hitLineColor;
    ctx.lineWidth = this.hitLineThickness;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(this.canvasWidth, y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ─── 绘制音符块 ───
  private drawBlock(ctx: CanvasRenderingContext2D, block: NoteBlock) {
    const { x, y, width, height, color, alpha } = block;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.numberToHex(color);

    // 圆角矩形
    const r = Math.min(this.cornerRadius, width / 2, height / 2);
    if (r > 0) {
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, r);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, width, height);
    }

    // 高亮边框（活跃状态）
    const isActive = block.active || (this.mode === "synthesia" && block.hasTriggered && !block.hasEnded);
    if (isActive) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = alpha * 0.6;
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  // ─── 清理 ───
  clear() {
    this.blocks = [];
  }

  clearBlocksOnly() {
    this.blocks = [];
  }

  getBlockCount(): number {
    return this.blocks.length;
  }

  getActiveBlockCount(): number {
    return this.blocks.filter(
      (b) => b.active || (this.mode === "synthesia" && b.hasTriggered && !b.hasEnded)
    ).length;
  }

  getBlocks(): readonly NoteBlock[] {
    return this.blocks;
  }

  getKeyboardY(): number {
    return this.keyboardY;
  }

  destroy() {
    this.clear();
  }
}