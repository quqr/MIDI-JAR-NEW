import type { WaterfallPianoSettings, ScheduledNote } from "../types";
import { noteToColor, type CustomColors } from "./NoteColorMapper";
import type { KeyboardRenderer } from "./KeyboardRenderer";

/** note block 的渲染模式：realtime 为实时下落，synthesia 为跟随传输时间线滚动 */
export type NoteBlockMode = "realtime" | "synthesia";

const BLACK_KEY_CLASSES = new Set([1, 3, 6, 8, 10]);
const BLACK_KEY_WIDTH_RATIO = 0.6;

/**
 * 判断给定的 MIDI 音符编号是否对应黑键
 * @param midi - MIDI 音符号（0-127）
 */
function isBlackKey(midi: number): boolean {
  return BLACK_KEY_CLASSES.has(((midi % 12) + 12) % 12);
}

/** 单个 note block 的内部数据结构 */
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

/** note block 生命周期的回调集合 */
interface NoteBlockCallbacks {
  onNoteTrigger?: (
    midi: number,
    velocity: number,
    hand: "left" | "right" | "unknown",
  ) => void;
  onNoteEnd?: (midi: number) => void;
}

const POOL_MAX = 512;

/**
 * 瀑布式钢琴的 note block 管理系统
 * 负责 note block 的创建、更新、渲染和对象池回收，支持 realtime 和 synthesia 两种模式
 */
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

  /**
   * 初始化画布和配置
   * @param canvas - 用于渲染 note block 的画布元素
   * @param settings - 瀑布钢琴的全局配置
   */
  init(canvas: HTMLCanvasElement, settings: WaterfallPianoSettings): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.settings = settings;
  }

  /**
   * 调整画布尺寸并设置设备像素比
   * @param width - 逻辑宽度
   * @param height - 逻辑高度
   * @param dpr - 设备像素比，用于高清屏适配
   * @param keyboardRenderer - 键盘渲染器，用于计算方块水平位置
   */
  resize(
    width: number,
    height: number,
    dpr: number,
    keyboardRenderer: KeyboardRenderer,
  ): void {
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

  /**
   * 载入 synthesia 模式待播放的音符序列，并重置内部状态
   * @param notes - 按时间排序的预定音符列表
   */
  scheduleSynthesiaNotes(notes: ScheduledNote[]): void {
    this.synthesiaNotes = notes;
    this.synthesiaCursor = 0;
    this.synthesiaBlockMap.clear();
    this.triggeredSet.clear();
    this.active = []; // 清空活跃方块，确保重播时状态干净
  }

  setTransportTime(t: number): void {
    this.transportTime = t;
  }

  setTransportPlaying(playing: boolean): void {
    this.transportPlaying = playing;
  }

  /**
   * 在 synthesia 模式下标记某个 MIDI 音符已被按下
   * @param midi - MIDI 音符号
   * @param _velocity - 力度（当前未使用）
   */
  triggerSynthesiaNote(midi: number, _velocity: number): void {
    this.triggeredSet.add(midi);
  }

  /**
   * 在 synthesia 模式下取消某个 MIDI 音符的按下标记
   * @param midi - MIDI 音符号
   */
  releaseSynthesiaNote(midi: number): void {
    this.triggeredSet.delete(midi);
  }

  /** 获取当前活跃（已触发但未结束）的 MIDI 音符列表 */
  getActiveMidiNotes(): number[] {
    return Array.from(this.triggeredSet);
  }

  /** 获取活跃音符块的中心位置（归一化坐标），用于方块覆盖流体发射 */
  getActiveBlockPositions(
    keyboardRenderer: KeyboardRenderer,
    totalHeight: number,
  ): Array<{
    midi: number;
    normX: number;
    normY: number;
    blockWidth: number;
    blockHeight: number;
  }> {
    const result: Array<{
      midi: number;
      normX: number;
      normY: number;
      blockWidth: number;
      blockHeight: number;
    }> = [];
    const whiteKeyWidth = keyboardRenderer.getWhiteKeyWidth();
    const blackKeyWidth = whiteKeyWidth * BLACK_KEY_WIDTH_RATIO;
    for (const b of this.active) {
      if (!b.triggered || b.ended) continue;
      const isBlack = isBlackKey(b.midi);
      const blockWidth = isBlack ? blackKeyWidth * 0.9 : whiteKeyWidth * 0.85;
      const blockHeight = b.height <= 0 ? blockWidth : b.height;
      const normX = keyboardRenderer.midiToX(b.midi) / this.width;
      // normY: 从屏幕空间转换到 WebGL 坐标（y=0 底部，y=1 顶部）
      // 使用方块底部 b.y（最靠近命中线的一侧），尾焰从方块底部喷射
      const normY = 1 - b.y / totalHeight;
      result.push({
        midi: b.midi,
        normX,
        normY: Math.max(0, Math.min(1, normY)),
        blockWidth,
        blockHeight,
      });
    }
    return result;
  }

  /**
   * 在 realtime 模式下为按下的 MIDI 音符创建一个从底部向上生长的 note block
   * @param midi - MIDI 音符号
   * @param velocity - 力度值
   */
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

  /**
   * 在 realtime 模式下标记 note block 为释放状态，方块将开始向上滑出屏幕
   * @param midi - MIDI 音符号
   */
  releaseRealtimeNote(midi: number): void {
    const block = this.realtimeHeld.get(midi);
    if (!block) return;
    block.releasing = true;
    block.fadeTime = 0;
    this.realtimeHeld.delete(midi);
  }

  /** 从对象池中获取一个 note block，池为空时创建新实例 */
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

  /** 将 note block 回收到对象池，池满时丢弃 */
  private release(b: NoteBlock): void {
    b.active = false;
    if (this.pool.length < POOL_MAX) {
      this.pool.push(b);
    }
  }

  /**
   * 每帧更新所有活跃 note block 的位置和状态
   * @param deltaTime - 距上一帧的时间间隔（秒）
   */
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

  /** 根据音符的轨道、MIDI 编号和起始时间生成唯一标识键 */
  private noteKey(note: {
    trackIndex: number;
    midi: number;
    time: number;
  }): string {
    return `${note.trackIndex}-${note.midi}-${note.time}`;
  }

  /**
   * synthesia 模式下的核心更新逻辑：根据传输时间推进游标、创建/更新 note block，
   * 并处理 seek 回退和音符触发/结束事件
   * @param pps - 每秒下落像素数
   */
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
    if (
      this.synthesiaCursor > 0 &&
      this.synthesiaCursor < len &&
      notes[this.synthesiaCursor].time > t + lookAhead
    ) {
      this.synthesiaCursor = 0;
    }

    // Advance cursor past notes that are too far in the past to matter
    while (
      this.synthesiaCursor < len &&
      t -
        (notes[this.synthesiaCursor].time +
          notes[this.synthesiaCursor].duration) >
        lookAhead + notes[this.synthesiaCursor].duration + 1
    ) {
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
      // synthesia 下落模式：方块从屏幕顶部下落到命中线
      // b.y = 方块底部位置；timeUntilHit > 0 时方块在命中线上方
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
        this.synthesiaBlockMap.delete(
          `${b.trackIndex}-${b.midi}-${b.startTime}`,
        );
        this.release(b);
      }
    }
  }

  /** 根据配置中的速度参数计算每秒下落像素数 */
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
      const baseColor = noteToColor(
        b.midi,
        p.colorScheme,
        b.hand,
        customColors,
      );
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

/** 将十六进制颜色向白色混合，ratio 为 0 时不变，为 1 时纯白 */
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
