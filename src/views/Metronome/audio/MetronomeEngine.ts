import { initializeAudioContext } from "@/services/sampler/AudioContextService";
import {
  slotsPerBeatOf,
  type ClickKind,
  type MetronomeParams,
  type MetronomeStatus,
  type MetronomeVisualState,
} from "../types";
import { createClickSynth, type ClickSynth } from "./clickSynth";
import { CLICK_VOICES } from "./clickVoices";

/**
 * 节拍器引擎：以 AudioContext 时钟为唯一时间源的前瞻调度器。
 *
 * 为什么不复用 PerfClock + EventScheduler：
 * - PerfClock 基于 performance.now()，墙钟与音频钟的 ppm 偏差会在几分钟内累积成
 *   可听的漂移；节拍网格是完全均匀周期，直接用 ctx.currentTime 天然无漂移。
 * - EventScheduler 面向「有限、按 time 升序、带 duration」的乐谱音符，
 *   在无限网格场景下 setNotes / seek 全是死代码。
 *
 * 为什么不直接用 rAF 驱动调度：后台标签页 rAF 被节流到 ~1Hz，声音会断。
 */
const LOOKAHEAD_SEC = 0.15;
/** 后台标签页定时器被节流到 1s 左右，前瞻放大以续上节拍 */
const HIDDEN_LOOKAHEAD_SEC = 1.2;
const TICK_INTERVAL_MS = 25;
const START_DELAY_SEC = 0.08;
const RESTART_DELAY_SEC = 0.06;
/** 单次 tick 最多补排的 slot 数（异常情况下的死循环保护） */
const MAX_SLOTS_PER_TICK = 512;

export class MetronomeEngine {
  private params: MetronomeParams;
  private ctxInternal: AudioContext | null = null;
  private synth: ClickSynth | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private statusValue: MetronomeStatus = "idle";
  private startTime = 0;
  private slotIndex = 0;
  private nextSlotTime = 0;

  constructor(params: MetronomeParams) {
    this.params = cloneParams(params);
  }

  get status(): MetronomeStatus {
    return this.statusValue;
  }

  private get secondsPerSlot(): number {
    const spb = slotsPerBeatOf(this.params.subdivision);
    return 60 / this.params.bpm / spb;
  }

  private get slotsPerBar(): number {
    return (
      this.params.timeSignature.numerator *
      slotsPerBeatOf(this.params.subdivision)
    );
  }

  async start(): Promise<void> {
    if (this.statusValue !== "idle") return;
    this.statusValue = "starting";

    const base = await initializeAudioContext();
    // AudioContextService 暴露的是 BaseAudioContext，实际就是 Tone 的 AudioContext
    const ctx = base as unknown as AudioContext;
    if (ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch {
        // resume 失败（无用户手势等）：保持未启动状态
      }
    }
    if (ctx.state !== "running") {
      this.statusValue = "idle";
      return;
    }

    this.ctxInternal = ctx;
    if (!this.master) {
      this.master = ctx.createGain();
      this.master.connect(ctx.destination);
    }
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setValueAtTime(this.params.volume, ctx.currentTime);
    this.synth ??= createClickSynth(ctx, this.master);

    this.statusValue = "playing";
    this.resetGrid(ctx.currentTime + START_DELAY_SEC);
    this.timer = window.setInterval(() => this.tick(), TICK_INTERVAL_MS);
    this.tick();
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    const ctx = this.ctxInternal;
    if (ctx && this.master) {
      this.synth?.cancelPending(ctx.currentTime);
      this.master.gain.cancelScheduledValues(ctx.currentTime);
      this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
    }
    this.statusValue = "idle";
  }

  /**
   * 彻底拆除：只断开本模块自己的节点。
   * 绝不调用 disposeAudioContext()——那是采样器全局单例的重置器。
   */
  dispose(): void {
    this.stop();
    this.synth?.dispose();
    this.synth = null;
    if (this.master) {
      try {
        this.master.disconnect();
      } catch {
        // 已断开则忽略
      }
      this.master = null;
    }
    this.ctxInternal = null;
  }

  setParams(next: MetronomeParams): void {
    const prev = this.params;
    const structural =
      next.timeSignature.numerator !== prev.timeSignature.numerator ||
      next.timeSignature.denominator !== prev.timeSignature.denominator ||
      next.subdivision !== prev.subdivision ||
      next.countInBars !== prev.countInBars;

    this.params = cloneParams(next);

    const ctx = this.ctxInternal;
    if (ctx && this.master) {
      this.master.gain.setTargetAtTime(
        this.params.volume,
        ctx.currentTime,
        0.02,
      );
    }
    // 结构性变更（拍号 / 细分 / 预备小节）无法热更新：回到小节第一拍重新开始
    if (structural && this.statusValue === "playing" && ctx) {
      this.synth?.cancelPending(ctx.currentTime);
      this.resetGrid(ctx.currentTime + RESTART_DELAY_SEC);
    }
  }

  getVisualState(): MetronomeVisualState | null {
    const ctx = this.ctxInternal;
    if (!ctx || this.statusValue !== "playing") return null;

    const spb = slotsPerBeatOf(this.params.subdivision);
    const slotsPerBar = this.slotsPerBar;
    const countInSlots = this.params.countInBars * slotsPerBar;
    const secPerSlot = this.secondsPerSlot;
    const now = ctx.currentTime;

    const pos = (now - this.startTime) / secPerSlot;
    const slot = Math.max(0, Math.floor(pos));
    const barIndex = Math.floor(slot / slotsPerBar);
    const within = slot - barIndex * slotsPerBar;
    const beatIndex = Math.floor(within / spb);
    const subIndex = within - beatIndex * spb;
    const silent = slot < countInSlots;
    const kind: ClickKind =
      subIndex === 0
        ? (this.params.accents[beatIndex] ?? "medium")
        : "subdivision";

    return {
      running: true,
      barIndex,
      beatIndex,
      subIndex,
      beatProgress: (subIndex + (pos - slot)) / spb,
      barProgress: (within + (pos - slot)) / slotsPerBar,
      slotStart: this.startTime + slot * secPerSlot,
      slotSec: secPerSlot,
      now,
      kind,
      silent,
      countInBar: silent ? barIndex + 1 : 0,
      countInBeat: silent ? beatIndex + 1 : 0,
    };
  }

  private resetGrid(startTime: number): void {
    this.startTime = startTime;
    this.slotIndex = 0;
    this.nextSlotTime = startTime;
  }

  private lookahead(): number {
    return document.hidden ? HIDDEN_LOOKAHEAD_SEC : LOOKAHEAD_SEC;
  }

  private tick(): void {
    const ctx = this.ctxInternal;
    if (!ctx || this.statusValue !== "playing") return;

    const horizon = ctx.currentTime + this.lookahead();
    let guard = 0;
    while (this.nextSlotTime < horizon && guard < MAX_SLOTS_PER_TICK) {
      this.emitSlot(this.nextSlotTime);
      this.nextSlotTime += this.secondsPerSlot;
      this.slotIndex += 1;
      guard += 1;
    }
  }

  private emitSlot(when: number): void {
    const spb = slotsPerBeatOf(this.params.subdivision);
    const slotsPerBar = this.slotsPerBar;
    const countInSlots = this.params.countInBars * slotsPerBar;
    const idx = this.slotIndex;
    const silent = idx < countInSlots;

    const musicIdx = idx - countInSlots;
    const bar = Math.floor(musicIdx / slotsPerBar);
    const within = musicIdx - bar * slotsPerBar;
    const beat = Math.floor(within / spb);
    const sub = within - beat * spb;
    const kind: ClickKind =
      sub === 0 ? (this.params.accents[beat] ?? "medium") : "subdivision";

    if (!silent && kind !== "silent") {
      this.synth?.trigger(
        CLICK_VOICES[kind],
        when,
        sub === 0 ? 1 : this.params.subdivisionVolume,
      );
    }
  }
}

function cloneParams(params: MetronomeParams): MetronomeParams {
  return {
    ...params,
    timeSignature: { ...params.timeSignature },
    accents: [...params.accents],
  };
}
