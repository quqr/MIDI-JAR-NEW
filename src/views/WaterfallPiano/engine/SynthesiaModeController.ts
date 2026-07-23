import type { ParticleConfig, ScheduledNote } from "../types";
import type { NoteBlock, NoteBlockPool } from "./NoteBlockPool";
import type { RealtimeModeController } from "./RealtimeModeController";
import type { NoteBlockMode } from "./NoteBlockSystem";
import type { Event } from "@/utils/delegate";
import { createLogger } from "@/utils/logger";

const logger = createLogger("SynthesiaModeController");

/** 生成 note block 唯一标识键的回调签名 */
export type NoteKeyFn = (note: {
  trackIndex: number;
  midi: number;
  time: number;
}) => string;

/** Synthesia 模式控制器：管理跟随传输时间线滚动的预定音符序列，负责方块创建/回收、
 *  音符触发/结束事件以及 seek 回退处理。同时承担 triggeredNoteKeys / endedNoteKeys
 *  的追踪，避免方块回收后重建时重复触发回调。 */
export class SynthesiaModeController {
  private synthesiaNotes: ScheduledNote[] = [];
  private synthesiaCursor = 0;
  private synthesiaBlockMap = new Map<string, NoteBlock>();
  private transportTime = 0;
  private transportPlaying = false;
  private lastTransportTime = 0;
  /** 记录已触发过的音符 key，防止方块回收后重建时重复触发回调 */
  private triggeredNoteKeys = new Set<string>();
  /** 已结束的音符 key，用于不依赖 block 对象的结束追踪 */
  private endedNoteKeys = new Set<string>();

  constructor(
    private readonly pool: NoteBlockPool,
    private readonly getActive: () => NoteBlock[],
    private readonly realtime: RealtimeModeController,
    private readonly getHeight: () => number,
    private readonly getParticleConfig: () => ParticleConfig | null,
    private readonly getMode: () => NoteBlockMode,
    private readonly onNoteTrigger: Event<{ midi: number; velocity: number; hand?: string }>,
    private readonly onNoteEnd: Event<{ midi: number }>,
    private readonly noteKey: NoteKeyFn,
  ) {}

  /** 载入 synthesia 模式待播放的音符序列，并重置内部状态 */
  scheduleSynthesiaNotes(notes: ScheduledNote[]): void {
    this.synthesiaNotes = notes;
    this.synthesiaCursor = 0;
    this.synthesiaBlockMap.clear();
    this.realtime.clearTriggeredState();
    this.triggeredNoteKeys.clear();
    this.releaseAllActiveBlocks();
  }

  setTransportTime(t: number): void {
    this.transportTime = t;
  }
  setTransportPlaying(playing: boolean): void {
    this.transportPlaying = playing;
  }

  /** 当前 transport 是否处于播放状态（供 Facade.update 判断） */
  isTransportPlaying(): boolean {
    return this.transportPlaying;
  }

  /** 在 synthesia 模式下标记某个 MIDI 音符已被按下 */
  triggerSynthesiaNote(midi: number, _velocity: number): void {
    this.realtime.getTriggeredSet().add(midi);
  }
  /** 在 synthesia 模式下取消某个 MIDI 音符的按下标记 */
  releaseSynthesiaNote(midi: number): void {
    this.realtime.getTriggeredSet().delete(midi);
  }

  /** 清空 synthesia 视觉方块映射（保留 triggeredNoteKeys 等追踪状态） */
  clearVisualState(): void {
    this.synthesiaBlockMap.clear();
  }
  /** 暴露 triggeredNoteKeys 引用（供 StateSync 在 syncToTime 中读取） */
  getTriggeredNoteKeys(): Set<string> {
    return this.triggeredNoteKeys;
  }
  /** 暴露 endedNoteKeys 引用（供 StateSync 在 syncToTime 中读取） */
  getEndedNoteKeys(): Set<string> {
    return this.endedNoteKeys;
  }

  /** 暴露 synthesiaBlockMap 引用（供 StateSync 在 syncToTime 中删除已回收方块） */
  getSynthesiaBlockMap(): Map<string, NoteBlock> {
    return this.synthesiaBlockMap;
  }

  /** 清空 transport 时间与游标相关状态 */
  clearTransportState(): void {
    this.transportTime = 0;
    this.lastTransportTime = 0;
  }

  /** 清空 synthesia 序列与游标（保留视觉方块与追踪状态） */
  resetSequence(): void {
    this.synthesiaNotes = [];
    this.synthesiaCursor = 0;
    this.lastTransportTime = 0;
  }

  /** 清空触发/结束追踪集合与引用计数 */
  clearTriggeredAndEndedKeys(): void {
    this.triggeredNoteKeys.clear();
    this.endedNoteKeys.clear();
    this.realtime.clearTriggeredState();
  }

  /**
   * synthesia 模式下的核心更新逻辑：根据传输时间推进游标、创建/更新 note block，
   * 并处理 seek 回退和音符触发/结束事件
   */
  update(pps: number): void {
    const t = this.transportTime;
    const lookAhead = this.particleConfig?.lookAhead ?? 3;
    const notes = this.synthesiaNotes;
    const len = notes.length;
    const prevTime = this.lastTransportTime;
    const active = this.getActive();

    // 检测向后跳转或循环：transport 时间回退超过 0.1 秒
    if (t < this.lastTransportTime - 0.1) {
      logger.debug(
        `Seek backward detected: ${this.lastTransportTime.toFixed(2)}s → ${t.toFixed(2)}s, resetting state`,
      );
      this.synthesiaCursor = 0;
      this.synthesiaBlockMap.clear();
      this.triggeredNoteKeys.clear();
      this.endedNoteKeys.clear();
      this.realtime.clearTriggeredState();
      // 释放所有 synthesia 方块（trackIndex >= 0），保留 realtime 方块
      for (let i = active.length - 1; i >= 0; i--) {
        const b = active[i];
        if (b.trackIndex >= 0) {
          active.splice(i, 1);
          this.pool.release(b);
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

    const createVisualBlocks = this.getMode() === "synthesia";

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
        this.realtime.addActiveMidi(note.midi);
        logger.debug(
          `Trigger: midi=${note.midi}, time=${note.time.toFixed(2)}s`,
        );
        this.onNoteTrigger.internalInvoke({ midi: note.midi, velocity: note.velocity, hand: note.hand });
        frameTriggered++;
      }

      // ── 段2: 结束检查（两种模式都执行，不依赖 block）──
      if (!this.endedNoteKeys.has(key) && t >= note.time + note.duration) {
        this.endedNoteKeys.add(key);
        this.realtime.removeActiveMidi(note.midi);
        this.onNoteEnd.internalInvoke({ midi: note.midi });
      }

      // ── 段3: 视觉方块管理（仅 synthesia 模式）──
      if (!createVisualBlocks) continue;

      let block = this.synthesiaBlockMap.get(key);
      if (!block || !block.active) {
        if (this.triggeredNoteKeys.has(key)) {
          frameAlreadyTriggered++;
          continue;
        }
        block = this.pool.acquire();
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
        active.push(block);
        this.synthesiaBlockMap.set(key, block);
        frameCreated++;
      }

      block.y = this.getHeight() - timeUntilHit * pps;
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
          `t=${t.toFixed(2)}s active=${active.length} created=${frameCreated} triggered=${frameTriggered} skipped=${frameSkipped} reuse-skip=${frameAlreadyTriggered} triggeredKeys=${this.triggeredNoteKeys.size} midiActive=${this.realtime.getActiveMidiCountSize()}`,
        );
      }
    }

    // 方块回收循环（仅 synthesia 模式，swap-remove O(1) 替代 splice O(n)）
    if (createVisualBlocks) {
      const height = this.getHeight();
      for (let i = active.length - 1; i >= 0; i--) {
        const b = active[i];
        if (b.trackIndex < 0) continue;
        const blockTop = b.y - b.height;
        const recycleThreshold = height * 0.5;
        if (blockTop > height + recycleThreshold) {
          this.synthesiaBlockMap.delete(
            `${b.trackIndex}-${b.midi}-${b.startTime}`,
          );
          const last = active.length - 1;
          if (i < last) active[i] = active[last];
          active.pop();
          this.pool.release(b);
        }
      }
    }
  }

  /** 根据给定时间重新构建已触发和已结束的音符追踪集合 */
  rebuildTriggeredState(time: number): void {
    this.triggeredNoteKeys.clear();
    this.endedNoteKeys.clear();
    this.realtime.clearTriggeredState();

    for (const note of this.synthesiaNotes) {
      const key = this.noteKey(note);
      if (note.time <= time) {
        this.triggeredNoteKeys.add(key);
        // 引用计数管理
        this.realtime.addActiveMidi(note.midi);
      }
      if (note.time + note.duration <= time) {
        this.endedNoteKeys.add(key);
        // 引用计数减少
        this.realtime.removeActiveMidi(note.midi);
      }
    }
  }

  /** 释放所有活跃方块并清空 active 数组 */
  private releaseAllActiveBlocks(): void {
    const active = this.getActive();
    for (const b of active) this.pool.release(b);
    active.length = 0;
  }

  private get particleConfig(): ParticleConfig | null {
    return this.getParticleConfig();
  }
}
