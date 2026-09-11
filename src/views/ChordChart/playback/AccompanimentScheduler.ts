/**
 * 伴奏调度器：AudioContext 时钟前瞻调度（复用 ISoundEngine 的前瞻模式）。
 *
 * 职责（见计划 Phase 3）：
 * - beat→秒换算：swingRatio ≠ 0.5 时对八分位做非线性映射（分段线性），
 *   映射是 beat 的纯函数、与 tempo 无关 → 变速重锚天然兼容；
 * - look-ahead ~0.1s、tick ~25ms，事件以 AudioContext 绝对秒提交给 smplr；
 * - mute 用乐器通道音量（smplr output.volume，即底层 gain），lookahead 内
 *   已提交事件也能即时静音；
 * - transpose 只作用于 piano/bass（drums 的 MIDI 是音色选择不是音高）；
 * - stop/pause 对已 trigger 的音符调用 instrument.stop() 主动 release，
 *   防止尾音拖沓；pause = 停调度 + release + 记录当前 beat，不用 AudioContext.suspend()。
 */

import { createLogger } from "@/utils/logger";

import type { AccompanimentEvent, AccompanimentTrack } from "./compGenerator";
import { drumMidi } from "./compGenerator";
import type { Groove } from "./grooves";
import type { SmplrInstance } from "@/services/sampler/types";

const logger = createLogger("AccompanimentScheduler");

/** 前瞻窗口（秒） */
const LOOKAHEAD_SEC = 0.1;
/** 调度轮询间隔（毫秒） */
const TICK_MS = 25;
/** 默认音符时值下限（秒），防止 drum 短音时长为 0 */
const MIN_DURATION_SEC = 0.05;

/** 三轨乐器集合 */
export interface AccompanimentInstruments {
  piano: SmplrInstance;
  bass: SmplrInstance;
  drums: SmplrInstance;
}

/** 当前播放状态回调（UI 高亮 / chorus 计数） */
export interface SchedulerCallbacks {
  /** 每个调度 tick 调用，报告当前 beat 与 event 索引（结束时 idx = events.length） */
  onTick?: (currentBeat: number) => void;
  /** 全部事件播完 */
  onEnded?: () => void;
}

/** swing 分段线性映射：等分八分位（x.5）→「整数拍 + ratio × 拍长」域 */
export function swingMap(beat: number, ratio: number): number {
  if (ratio === 0.5) return beat;
  const n = Math.floor(beat + 1e-6);
  const frac = beat - n;
  if (frac <= 0.5) return n + frac * (2 * ratio);
  return n + ratio + (frac - 0.5) * (2 * (1 - ratio));
}

/** 乐器通道音量档位 */
const CHANNEL_VOLUME = { on: 100, off: 0 };

export class AccompanimentScheduler {
  private instruments: AccompanimentInstruments | null = null;
  private events: AccompanimentEvent[] = [];
  private groove: Groove | null = null;
  private bpm = 120;
  private tempoScale = 1;
  private transposition = 0;
  private muted: Record<AccompanimentTrack, boolean> = { piano: false, bass: false, drums: false };

  /** 锚点：映射域 beat ↔ ctx 时间秒 */
  private anchorBeat = 0;
  private anchorTime = 0;
  /** 下一个待调度事件索引 */
  private nextIndex = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private callbacks: SchedulerCallbacks = {};

  /** 注入三轨乐器（全部 ready 后才可 start） */
  setInstruments(instruments: AccompanimentInstruments | null): void {
    this.instruments = instruments;
  }

  /** 静音状态变化 → 通道音量即时生效 */
  setMuted(track: AccompanimentTrack, muted: boolean): void {
    this.muted[track] = muted;
    const inst = this.instruments?.[track];
    if (inst) inst.output.volume = muted ? CHANNEL_VOLUME.off : CHANNEL_VOLUME.on;
  }

  setTransposition(semis: number): void {
    this.transposition = semis;
  }

  /** 装载曲目：事件（beat 域）+ groove（swing）+ 基础 BPM */
  load(events: AccompanimentEvent[], groove: Groove, bpm: number): void {
    this.events = events;
    this.groove = groove;
    this.bpm = bpm;
  }

  /** 当前 beat（含 swing 域换算的反映射近似——UI 高亮只需整数拍，直接用线性域即可） */
  currentBeat(): number {
    if (!this.running) return this.anchorBeat;
    const now = this.audioNow();
    const spb = 60 / (this.bpm * this.tempoScale);
    return this.anchorBeat + (now - this.anchorTime) / spb;
  }

  /** 从指定 beat 开始播放（等分 beat 域） */
  start(fromBeat: number, callbacks: SchedulerCallbacks = {}): void {
    if (!this.instruments) throw new Error("Instruments not set");
    this.callbacks = callbacks;
    this.anchorTime = this.audioNow();
    this.anchorBeat = fromBeat;
    this.nextIndex = this.findIndexForBeat(fromBeat);
    this.running = true;
    // 应用当前静音状态
    for (const track of ["piano", "bass", "drums"] as const) {
      this.setMuted(track, this.muted[track]);
    }
    this.tick();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  /** 变速：重锚（当前 beat 不变，速度换算系数更新） */
  setTempoScale(scale: number): void {
    const nowBeat = this.currentBeat();
    this.tempoScale = scale;
    this.anchorBeat = nowBeat;
    this.anchorTime = this.audioNow();
    // lookahead 内已提交事件按旧速度发声（≤0.1s 误差，可接受）
  }

  /** 暂停：停调度 + release + 返回当前 beat（恢复时作为重锚点） */
  pause(): number {
    const beat = this.currentBeat();
    this.stopTimer();
    this.releaseAll();
    this.running = false;
    this.anchorBeat = beat;
    return beat;
  }

  /** 停止：停调度 + release + 归零 */
  stop(): void {
    this.stopTimer();
    this.releaseAll();
    this.running = false;
    this.anchorBeat = 0;
    this.nextIndex = 0;
  }

  /* ── 内部 ───────────────────────────────────────────── */

  private audioNow(): number {
    // instruments[0].context 即共享 AudioContext
    const ctx = this.instruments?.piano.context;
    return ctx ? ctx.currentTime : 0;
  }

  private findIndexForBeat(beat: number): number {
    const idx = this.events.findIndex((e) => e.startBeat >= beat);
    return idx === -1 ? this.events.length : idx;
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** release 已提交到音频线程的音符（piano/bass 长音；drums 自然衰减） */
  private releaseAll(): void {
    if (!this.instruments) return;
    try {
      this.instruments.piano.stop();
      this.instruments.bass.stop();
      this.instruments.drums.stop();
    } catch (err) {
      logger.warn("[AccompanimentScheduler] release error: %s", err);
    }
  }

  private tick(): void {
    if (!this.running || !this.instruments || !this.groove) return;
    const now = this.audioNow();
    const spb = 60 / (this.bpm * this.tempoScale);
    const horizon = now + LOOKAHEAD_SEC;

    while (this.nextIndex < this.events.length) {
      const ev = this.events[this.nextIndex];
      // 事件时刻：swing 映射后相对锚点的秒数
      const mapped = swingMap(ev.startBeat, this.groove.swingRatio);
      const mappedAnchor = swingMap(this.anchorBeat, this.groove.swingRatio);
      const when = this.anchorTime + (mapped - mappedAnchor) * spb;
      if (when > horizon) break;

      this.scheduleEvent(ev, when, spb);
      this.nextIndex += 1;
    }

    this.callbacks.onTick?.(this.currentBeat());

    if (this.nextIndex >= this.events.length) {
      const endBeat = this.events.length > 0 ? this.events[this.events.length - 1].startBeat : 0;
      if (this.currentBeat() > endBeat + 1) {
        this.stopTimer();
        this.running = false;
        this.callbacks.onEnded?.();
      }
    }
  }

  private scheduleEvent(ev: AccompanimentEvent, when: number, spb: number): void {
    if (!this.instruments) return;
    const velocity = Math.round(Math.min(1, Math.max(0, ev.velocity)) * 127);
    const duration = Math.max(MIN_DURATION_SEC, ev.durationBeats * spb);

    try {
      if (ev.track === "drums") {
        // drums 不参与 transpose（MIDI = 音色选择）；piece → GM 鼓键位
        const midi = ev.piece ? drumMidi(ev.piece, this.groove?.drumKit ?? "acoustic") : ev.midi;
        this.instruments.drums.start({
          note: midi,
          time: when,
          duration,
          velocity,
        });
        return;
      }
      const inst = this.instruments[ev.track];
      inst.start({
        note: ev.midi + this.transposition,
        time: when,
        duration,
        velocity,
      });
    } catch (err) {
      logger.warn("[AccompanimentScheduler] schedule error: %s", err);
    }
  }
}
