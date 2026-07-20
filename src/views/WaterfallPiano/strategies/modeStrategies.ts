import type { ShallowRef } from "vue";
import type { MidiFilePlayer } from "../midi/MidiFilePlayer";
import type { Recorder } from "../audio/Recorder";
import type { WaterfallEngine } from "../engine/WaterfallEngine";
import type { ContentType } from "../types";

/**
 * 播放策略接口 — 抽象 MIDI 文件回放与录音回放的差异
 *
 * 通过策略模式消除 WaterfallPiano.vue 中基于 contentType 的 if/else 分支：
 * - midi 模式（对应 synthesia 显示）：需要联动流体渲染（setFluidPaused），
 *   全新开始时需重置 NoteBlockSystem 时间轴。
 * - recording 模式（对应 realtime 显示）：仅做基础回放控制，不涉及流体联动。
 *
 * 调用方通过 {@link createPlaybackStrategy} 获取与当前 contentType 对应的策略实例，
 * 在 play/pause/stop/seek/frameTick 等入口统一调用策略方法，无需判断内容类型。
 */
export interface PlaybackStrategy {
  /** 每帧推进播放进度（由引擎 frameCallback 调用） */
  tick(): void;
  /** 全新开始播放（非从暂停恢复） */
  startPlayback(): void;
  /** 从暂停状态恢复播放 */
  resumePlayback(): void;
  /** 暂停播放 */
  pausePlayback(): void;
  /** 停止播放 */
  stopPlayback(): void;
  /** 跳转到指定时间位置 */
  seekTo(seconds: number): void;
  /** 是否需要在播放/暂停/停止时联动流体渲染状态（仅 midi 模式为 true） */
  readonly managesFluid: boolean;
}

/** 引擎 ShallowRef 类型别名 */
export type EngineRef = ShallowRef<WaterfallEngine | null>;

/**
 * MIDI 文件回放策略
 *
 * 封装 {@link MidiFilePlayer} 的播放控制，并在全新开始时重置 NoteBlockSystem 时间轴。
 * 流体渲染由本策略负责联动：播放时恢复，暂停/停止时暂停以避免空转导致帧率下降。
 */
export class MidiPlaybackStrategy implements PlaybackStrategy {
  readonly managesFluid = true;

  constructor(
    private readonly player: MidiFilePlayer,
    private readonly engine: EngineRef,
  ) {}

  tick(): void {
    this.player.tick();
  }

  startPlayback(): void {
    this.player.startPlayback();
    this.engine.value?.noteBlockSystemRef.setTransportTime(0);
  }

  resumePlayback(): void {
    this.player.resumePlayback();
  }

  pausePlayback(): void {
    this.player.pausePlayback();
  }

  stopPlayback(): void {
    this.player.stopPlayback();
  }

  seekTo(seconds: number): void {
    this.player.seekTo(seconds);
  }
}

/**
 * 录音回放策略
 *
 * 封装 {@link Recorder} 的播放控制，不涉及流体渲染联动与时间轴重置。
 */
export class RecordingPlaybackStrategy implements PlaybackStrategy {
  readonly managesFluid = false;

  constructor(private readonly recorder: Recorder) {}

  tick(): void {
    this.recorder.tick();
  }

  startPlayback(): void {
    this.recorder.startPlayback();
  }

  resumePlayback(): void {
    this.recorder.resumePlayback();
  }

  pausePlayback(): void {
    this.recorder.pausePlayback();
  }

  stopPlayback(): void {
    this.recorder.stopPlayback();
  }

  seekTo(seconds: number): void {
    this.recorder.seekTo(seconds);
  }
}

/**
 * 根据内容类型与可用播放源创建策略实例
 *
 * @param contentType - 当前内容类型（"midi" / "recording" / "none"）
 * @param player - MIDI 文件播放器实例（可空）
 * @param recorder - 录制器实例（可空）
 * @param engine - 引擎 ShallowRef，供 midi 策略联动 NoteBlockSystem
 * @returns 对应策略实例；若无可用源则返回 null
 */
export function createPlaybackStrategy(
  contentType: ContentType,
  player: MidiFilePlayer | null,
  recorder: Recorder | null,
  engine: EngineRef,
): PlaybackStrategy | null {
  if (contentType === "midi" && player) {
    return new MidiPlaybackStrategy(player, engine);
  }
  if (contentType === "recording" && recorder) {
    return new RecordingPlaybackStrategy(recorder);
  }
  return null;
}
