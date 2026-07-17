import type { WaterfallPianoSettings, ScheduledNote } from "../types";
import { noteToColor, type CustomColors } from "./NoteColorMapper";
import type { KeyboardRenderer } from "./KeyboardRenderer";
import { createLogger } from "@/utils/logger";

const logger = createLogger("NoteBlockSystem");

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
  /** 记录已触发过的音符 key，防止方块回收后重建时重复触发回调 */
  private triggeredNoteKeys = new Set<string>();
  /** 已结束的音符 key，用于不依赖 block 对象的结束追踪 */
  private endedNoteKeys = new Set<string>();
  /** MIDI 驱动的 realtime 方块引用计数（支持同音高重叠） */
  private realtimeRefCount = new Map<number, number>();
  /** MIDI 音符的引用计数，用于在多个同音高音符并发时正确清理 triggeredSet */
  private activeMidiCount = new Map<number, number>();
  callbacks: NoteBlockCallbacks = {};

  /**
   * 辅助：判断颜色是否有效
   */
  private isValidColor(color: unknown): color is string {
    return typeof color === "string" && color.length > 0;
  }

  /**
   * 提取绘制路径逻辑，避免重复代码
   */
  private drawPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    if (r > 0) {
      this.roundRect(ctx, x, y, w, h, r);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.closePath();
  }

  /**
   * 渲染 Aura 发光效果（高斯模糊 + 混合模式）
   */
  private renderAura(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    cornerRadius: number,
    color: string,
    time: number,
  ): void {
    const config = this.settings?.aura;
    if (!config?.enabled || config.radius <= 0 || config.intensity <= 0) return;

    const baseAlpha = (config.intensity / 100) * 0.8;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    switch (config.style) {
      case "glow": {
        ctx.save();
        const blurPad = config.radius * 2;
        ctx.filter = `blur(${config.radius}px)`;
        ctx.globalAlpha = baseAlpha;
        ctx.fillStyle = color;
        this.drawPath(
          ctx,
          x - blurPad,
          y - blurPad,
          width + blurPad * 2,
          height + blurPad * 2,
          cornerRadius,
        );
        ctx.fill();
        ctx.restore();
        break;
      }

      case "rainbow": {
        const hue = (time * config.animationSpeed * 0.05) % 360;
        const rainbowColor = `hsl(${hue}, 80%, 60%)`;
        ctx.save();
        const blurPad = config.radius * 2;
        ctx.filter = `blur(${config.radius}px)`;
        ctx.globalAlpha = baseAlpha;
        ctx.fillStyle = rainbowColor;
        this.drawPath(
          ctx,
          x - blurPad,
          y - blurPad,
          width + blurPad * 2,
          height + blurPad * 2,
          cornerRadius,
        );
        ctx.fill();
        ctx.restore();
        break;
      }

      case "dual": {
        if (
          config.backgroundColor &&
          this.isValidColor(config.backgroundColor)
        ) {
          ctx.save();
          const outerPad = config.radius * 3;
          ctx.filter = `blur(${config.radius * 1.5}px)`;
          ctx.globalAlpha = baseAlpha * 0.5;
          ctx.fillStyle = config.backgroundColor;
          this.drawPath(
            ctx,
            x - outerPad,
            y - outerPad,
            width + outerPad * 2,
            height + outerPad * 2,
            cornerRadius,
          );
          ctx.fill();
          ctx.restore();
        }

        ctx.save();
        const innerPad = config.radius * 2;
        ctx.filter = `blur(${config.radius}px)`;
        ctx.globalAlpha = baseAlpha;
        ctx.fillStyle = color;
        this.drawPath(
          ctx,
          x - innerPad,
          y - innerPad,
          width + innerPad * 2,
          height + innerPad * 2,
          cornerRadius,
        );
        ctx.fill();
        ctx.restore();
        break;
      }

      case "custom": {
        const pColor = config.primaryColor || color;
        const bColor = config.backgroundColor;

        if (bColor && this.isValidColor(bColor)) {
          ctx.save();
          const outerPad = config.radius * 3;
          ctx.filter = `blur(${config.radius * 1.5}px)`;
          ctx.globalAlpha = baseAlpha * 0.5;
          ctx.fillStyle = bColor;
          this.drawPath(
            ctx,
            x - outerPad,
            y - outerPad,
            width + outerPad * 2,
            height + outerPad * 2,
            cornerRadius,
          );
          ctx.fill();
          ctx.restore();

          ctx.save();
          const innerPad = config.radius * 2;
          ctx.filter = `blur(${config.radius}px)`;
          ctx.globalAlpha = baseAlpha;
          ctx.fillStyle = pColor;
          this.drawPath(
            ctx,
            x - innerPad,
            y - innerPad,
            width + innerPad * 2,
            height + innerPad * 2,
            cornerRadius,
          );
          ctx.fill();
          ctx.restore();
        } else {
          ctx.save();
          const blurPad = config.radius * 2;
          ctx.filter = `blur(${config.radius}px)`;
          ctx.globalAlpha = baseAlpha;
          ctx.fillStyle = pColor;
          this.drawPath(
            ctx,
            x - blurPad,
            y - blurPad,
            width + blurPad * 2,
            height + blurPad * 2,
            cornerRadius,
          );
          ctx.fill();
          ctx.restore();
        }
        break;
      }
    }

    ctx.restore();
  }

  /**
   * 初始化画布和配置
   * @param canvas - 用于渲染 note block 的画布元素
   * @param settings - 瀑布钢琴的全局配置
   */
  init(canvas: HTMLCanvasElement, settings: WaterfallPianoSettings): void {
    if (!canvas) return;
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
    this.triggeredNoteKeys.clear();
    this.endedNoteKeys.clear();
    this.realtimeRefCount.clear();
    this.activeMidiCount.clear();
    this.synthesiaNotes = [];
    this.synthesiaCursor = 0;
    this.synthesiaBlockMap.clear();
    this.lastTransportTime = 0;
  }

  /** 清空视觉方块但保留触发/结束追踪状态（用于模式切换） */
  clearVisualBlocks(): void {
    for (const b of this.active) this.release(b);
    this.active = [];
    this.realtimeHeld.clear();
    this.realtimeRefCount.clear();
    this.synthesiaBlockMap.clear();
    // 保留: triggeredNoteKeys / endedNoteKeys / activeMidiCount / triggeredSet / synthesiaNotes / synthesiaCursor
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
    this.triggeredNoteKeys.clear();
    this.activeMidiCount.clear();
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

  /** MIDI 驱动的 realtime 方块创建（引用计数，支持同音高重叠） */
  playRealtimeNoteFromMidi(midi: number, velocity: number): void {
    const count = this.realtimeRefCount.get(midi) ?? 0;
    this.realtimeRefCount.set(midi, count + 1);
    if (count === 0) this.playRealtimeNote(midi, velocity);
  }

  /** MIDI 驱动的 realtime 方块释放（引用计数，归零时才真正释放） */
  releaseRealtimeNoteFromMidi(midi: number): void {
    const count = this.realtimeRefCount.get(midi) ?? 0;
    if (count <= 1) {
      this.realtimeRefCount.delete(midi);
      this.releaseRealtimeNote(midi);
    } else {
      this.realtimeRefCount.set(midi, count - 1);
    }
  }

  /** 引用计数：将 MIDI 音符加入 triggeredSet */
  private addActiveMidi(midi: number): void {
    const count = this.activeMidiCount.get(midi) ?? 0;
    this.activeMidiCount.set(midi, count + 1);
    this.triggeredSet.add(midi);
  }

  /** 引用计数：减少 MIDI 音符计数，归零时从 triggeredSet 移除 */
  private removeActiveMidi(midi: number): void {
    const count = this.activeMidiCount.get(midi) ?? 0;
    if (count <= 1) {
      this.activeMidiCount.delete(midi);
      this.triggeredSet.delete(midi);
    } else {
      this.activeMidiCount.set(midi, count - 1);
    }
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

    if (this.transportPlaying) {
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
    const prevTime = this.lastTransportTime;

    // 检测向后跳转或循环：transport 时间回退超过 0.1 秒
    if (t < this.lastTransportTime - 0.1) {
      logger.debug(
        `Seek backward detected: ${this.lastTransportTime.toFixed(2)}s → ${t.toFixed(2)}s, resetting state`,
      );
      this.synthesiaCursor = 0;
      this.synthesiaBlockMap.clear();
      this.triggeredSet.clear();
      this.triggeredNoteKeys.clear();
      this.endedNoteKeys.clear();
      this.activeMidiCount.clear();
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

    const createVisualBlocks = this.mode === "synthesia";

    // 每帧统计（用于诊断）
    let frameCreated = 0;
    let frameTriggered = 0;
    let frameSkipped = 0;
    let frameAlreadyTriggered = 0;

    const startIdx = this.synthesiaCursor;
    for (let ni = startIdx; ni < len; ni++) {
      const note = notes[ni];
      const timeUntilHit = note.time - t;
      if (timeUntilHit > lookAhead) break;

      const endOffset = t - (note.time + note.duration);
      if (endOffset > lookAhead) {
        frameSkipped++;
        continue;
      }

      const key = this.noteKey(note);

      // ── 段1: 触发检查（两种模式都执行，不依赖 block）──
      if (!this.triggeredNoteKeys.has(key) && timeUntilHit <= 0) {
        this.triggeredNoteKeys.add(key);
        this.addActiveMidi(note.midi);
        logger.debug(
          `Trigger: midi=${note.midi}, time=${note.time.toFixed(2)}s`,
        );
        this.callbacks.onNoteTrigger?.(note.midi, note.velocity, note.hand);
        frameTriggered++;
      }

      // ── 段2: 结束检查（两种模式都执行，不依赖 block）──
      if (!this.endedNoteKeys.has(key) && t >= note.time + note.duration) {
        this.endedNoteKeys.add(key);
        this.removeActiveMidi(note.midi);
        this.callbacks.onNoteEnd?.(note.midi);
      }

      // ── 段3: 视觉方块管理（仅 synthesia 模式）──
      if (!createVisualBlocks) continue;

      let block = this.synthesiaBlockMap.get(key);
      if (!block || !block.active) {
        if (this.triggeredNoteKeys.has(key)) {
          frameAlreadyTriggered++;
          continue;
        }
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
        frameCreated++;
      }

      block.y = this.height - timeUntilHit * pps;
      block.height = note.duration * pps;
      block.triggered = this.triggeredNoteKeys.has(key);
      block.ended = this.endedNoteKeys.has(key);
    }

    // 每秒输出一次帧摘要（避免日志爆炸）
    if (Math.floor(t) !== Math.floor(prevTime)) {
      if (
        frameCreated > 0 ||
        frameTriggered > 0 ||
        frameSkipped > 0 ||
        frameAlreadyTriggered > 0
      ) {
        logger.debug(
          `t=${t.toFixed(2)}s active=${this.active.length} created=${frameCreated} triggered=${frameTriggered} skipped=${frameSkipped} reuse-skip=${frameAlreadyTriggered} triggeredKeys=${this.triggeredNoteKeys.size} midiActive=${this.activeMidiCount.size}`,
        );
      }
    }

    // 方块回收循环（仅 synthesia 模式）
    if (createVisualBlocks) {
      for (let i = this.active.length - 1; i >= 0; i--) {
        const b = this.active[i];
        if (b.trackIndex < 0) continue;
        const blockTop = b.y - b.height;
        const recycleThreshold = this.height * 0.5;
        if (blockTop > this.height + recycleThreshold) {
          this.active.splice(i, 1);
          this.synthesiaBlockMap.delete(
            `${b.trackIndex}-${b.midi}-${b.startTime}`,
          );
          this.release(b);
        }
      }
    }
  }

  /** 根据配置中的速度参数计算每秒下落像素数（已修复 MIDI 播放问题）*/
  private pixelsPerSecond(): number {
    if (!this.settings) return 200;
    return this.settings.particles.speed * 100;
  }

  render(): void {
    if (!this.ctx || !this.settings || !this.keyboardRenderer) return;
    const ctx = this.ctx;
    const p = this.settings.particles;
    ctx.clearRect(0, 0, this.width, this.height);

    // ✨ 新增：裁剪区域，防止光晕溢出
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.width, this.height);
    ctx.clip();

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

    // 获取时间戳用于 Rainbow 动画
    const time = performance.now();

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

      // ✨ 新增：渲染 Aura 发光效果（在实体方块之前）
      if (this.settings.aura.enabled) {
        const shouldApplyAura =
          this.settings.aura.target === "all" ||
          (this.settings.aura.target === "triggered" && isTriggered);

        if (shouldApplyAura) {
          this.renderAura(
            ctx,
            x,
            y,
            blockWidth,
            h,
            p.cornerRadius,
            color,
            time,
          );
        }
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      if (p.cornerRadius > 0) {
        this.roundRect(ctx, x, y, blockWidth, h, p.cornerRadius);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, blockWidth, h);
      }
      // 触发状态的视觉反馈通过颜色增亮实现，不再使用边框
      ctx.globalAlpha = 1;
    }

    // ✨ 恢复裁剪
    ctx.restore();
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

  /**
   * 完整状态同步：根据给定时间重建所有方块的 Y 坐标、触发状态、结束状态和活跃状态
   * 用于暂停恢复后确保方块显示与当前播放进度一致，避免视觉撕裂
   * @param time - 当前播放时间（秒）
   */
  syncToTime(time: number): void {
    if (this.mode !== "synthesia") return;

    const pps = this.pixelsPerSecond();
    const lookAhead = this.settings ? this.settings.particles.lookAhead : 3;

    // 同步所有方块状态
    for (const block of this.active) {
      if (block.trackIndex < 0) continue; // 跳过 realtime 方块
      const timeUntilHit = block.startTime - time;
      block.y = this.height - timeUntilHit * pps;
      block.height = block.duration * pps;
      const key = this.noteKey({
        trackIndex: block.trackIndex,
        midi: block.midi,
        time: block.startTime,
      });
      block.triggered = this.triggeredNoteKeys.has(key);
      block.ended = this.endedNoteKeys.has(key);
    }

    // 清理已离开屏幕的方块
    const recycleThreshold = this.height * 0.5;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i];
      if (b.trackIndex < 0) continue;
      const blockTop = b.y - b.height;
      if (
        blockTop > this.height + recycleThreshold ||
        time - (b.startTime + b.duration) > lookAhead + b.duration + 1
      ) {
        const key = `${b.trackIndex}-${b.midi}-${b.startTime}`;
        this.synthesiaBlockMap.delete(key);
        this.active.splice(i, 1);
        this.release(b);
      }
    }

    // 重建 triggeredNoteKeys 和 endedNoteKeys
    this.rebuildTriggeredState(time);

    logger.debug(
      `syncToTime: t=${time.toFixed(2)}s, active=${this.active.length}, triggeredKeys=${this.triggeredNoteKeys.size}`,
    );
  }

  /**
   * 根据给定时间重新构建已触发和已结束的音符追踪集合
   * @param time - 当前播放时间（秒）
   */
  private rebuildTriggeredState(time: number): void {
    this.triggeredNoteKeys.clear();
    this.endedNoteKeys.clear();
    this.activeMidiCount.clear();
    this.triggeredSet.clear();

    for (const note of this.synthesiaNotes) {
      const key = this.noteKey(note);
      if (note.time <= time) {
        this.triggeredNoteKeys.add(key);
        // 引用计数管理
        const count = this.activeMidiCount.get(note.midi) ?? 0;
        this.activeMidiCount.set(note.midi, count + 1);
        this.triggeredSet.add(note.midi);
      }
      if (note.time + note.duration <= time) {
        this.endedNoteKeys.add(key);
        // 引用计数减少
        const count = this.activeMidiCount.get(note.midi) ?? 0;
        if (count <= 1) {
          this.activeMidiCount.delete(note.midi);
          this.triggeredSet.delete(note.midi);
        } else {
          this.activeMidiCount.set(note.midi, count - 1);
        }
      }
    }
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
