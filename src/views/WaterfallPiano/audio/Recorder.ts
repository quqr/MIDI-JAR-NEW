import {
  saveToStorage,
  loadFromStorage,
  removeFromStorage,
} from "@/helpers/storage";
import { RECORDING_STORAGE_KEY } from "../constants";
import type { RecordedNote, ScheduledNote } from "../types";
import { EventScheduler } from "./EventScheduler";
import { waterfallPianoEvents } from "../events";

export interface RecorderCallbacks {
  onNoteOn?: (
    midi: number,
    velocity: number,
    hand: "left" | "right" | "unknown",
  ) => void;
  onNoteOff?: (midi: number) => void;
  onPlaybackEnd?: () => void;
  onProgress?: (current: number, duration: number) => void;
  onScheduledNotesReady?: (notes: ScheduledNote[]) => void;
}

/**
 * MIDI 录音与回放控制器，
 * 负责录制弹奏的音符序列、回放已录制的音符，
 * 并通过 tick() 方法驱动瀑布流视图的进度更新。
 * 使用 EventScheduler 游标调度替代全量扫描。
 */
export class Recorder {
  private notes: RecordedNote[] = [];
  private pending = new Map<number, { velocity: number; startTime: number }>();
  private recordStartTime = 0;
  private isRecording = false;
  /** 增量维护的最大时长（所有音符的最大 endTime），避免每帧 O(n) 扫描 */
  private _maxDuration = 0;
  /** 内部防护标志，仅用于 startPlayback/pausePlayback 等方法的防御性检查。
   *  播放状态的权威来源是 PlayerStateMachine，外部代码不应依赖此字段。 */
  private isPlaying = false;
  /** @see isPlaying */
  private isPaused = false;
  private playStartTime = 0;
  private pausedAt = 0;
  callbacks: RecorderCallbacks = {};

  private readonly scheduler: EventScheduler<ScheduledNote>;

  constructor() {
    this.scheduler = new EventScheduler<ScheduledNote>({
      onTrigger: (note) => {
        this.callbacks.onNoteOn?.(note.midi, note.velocity, note.hand);
        waterfallPianoEvents.onNoteOn.internalInvoke({ midi: note.midi, velocity: note.velocity });
      },
      onRelease: (note) => {
        this.callbacks.onNoteOff?.(note.midi);
        waterfallPianoEvents.onNoteOff.internalInvoke({ midi: note.midi });
      },
    });
  }

  startRecording(): void {
    this.notes = [];
    this.pending.clear();
    this._maxDuration = 0;
    this.recordStartTime = performance.now();
    this.isRecording = true;
  }

  stopRecording(): RecordedNote[] {
    if (!this.isRecording) return this.notes;
    this.isRecording = false;
    const now = performance.now() - this.recordStartTime;
    for (const [midi, info] of this.pending) {
      const note: RecordedNote = {
        midi,
        velocity: info.velocity,
        time: info.startTime / 1000,
        duration: Math.max(0, (now - info.startTime) / 1000),
      };
      this.notes.push(note);
      this.updateMaxDuration(note);
    }
    this.pending.clear();
    this.saveToStorage();
    return this.notes;
  }

  /**
   * 记录音符按下事件，同一 MIDI 编号在未释放前不会重复记录
   * @param midi - MIDI 音符编号 (0-127)
   * @param velocity - 力度值 (0-127)
   */
  recordNoteOn(midi: number, velocity: number): void {
    if (!this.isRecording) return;
    if (this.pending.has(midi)) return;
    const startTime = performance.now() - this.recordStartTime;
    this.pending.set(midi, { velocity, startTime });
  }

  /**
   * 记录音符释放事件，与 recordNoteOn 配对使用以完成一个音符的时长计算
   * @param midi - MIDI 音符编号 (0-127)
   */
  recordNoteOff(midi: number): void {
    if (!this.isRecording) return;
    const info = this.pending.get(midi);
    if (!info) return;
    const now = performance.now() - this.recordStartTime;
    const note: RecordedNote = {
      midi,
      velocity: info.velocity,
      time: info.startTime / 1000,
      duration: Math.max(0, (now - info.startTime) / 1000),
    };
    this.notes.push(note);
    this.updateMaxDuration(note);
    this.pending.delete(midi);
  }

  /**
   * 加载外部音符序列（如从 MIDI 文件解析的结果），并触发 onScheduledNotesReady 回调
   * @param notes - 要加载的音符数组
   */
  loadNotes(notes: RecordedNote[]): void {
    this.notes = [...notes];
    this.recomputeMaxDuration();
    const scheduled = this.getScheduledNotes();
    this.scheduler.setNotes(scheduled);
    this.callbacks.onScheduledNotesReady?.(scheduled);
    waterfallPianoEvents.onScheduledNotesReady.internalInvoke({ notes: scheduled });
  }

  startPlayback(): void {
    if (this.notes.length === 0) return;
    this.scheduler.reset();
    this.pausedAt = 0;
    this.playStartTime = performance.now();
    this.isPlaying = true;
    this.isPaused = false;
    this.callbacks.onScheduledNotesReady?.(this.getScheduledNotes());
    waterfallPianoEvents.onScheduledNotesReady.internalInvoke({ notes: this.getScheduledNotes() });
  }

  pausePlayback(): void {
    if (!this.isPlaying) return;
    this.pausedAt = this.getCurrentTime();
    this.isPlaying = false;
    this.isPaused = true;
  }

  resumePlayback(): void {
    if (!this.isPaused) return;
    this.playStartTime = performance.now() - this.pausedAt * 1000;
    this.isPlaying = true;
    this.isPaused = false;
  }

  stopPlayback(): void {
    this.isPlaying = false;
    this.isPaused = false;
    this.pausedAt = 0;
    this.scheduler.reset();
  }

  /**
   * 跳转到指定时间点播放，会重新定位调度器游标
   * @param seconds - 目标时间位置（秒）
   */
  seekTo(seconds: number): void {
    const clamped = Math.max(0, Math.min(seconds, this.getDuration()));
    this.pausedAt = clamped;
    this.playStartTime = performance.now() - clamped * 1000;
    this.scheduler.seek(clamped);
  }

  getDuration(): number {
    return this._maxDuration;
  }

  /** 增量更新 _maxDuration（仅在添加新音符时调用） */
  private updateMaxDuration(note: RecordedNote): void {
    const end = note.time + note.duration;
    if (end > this._maxDuration) this._maxDuration = end;
  }

  /** 从当前 notes 数组重建 _maxDuration（loadNotes / loadFromStorage 后调用） */
  private recomputeMaxDuration(): void {
    let max = 0;
    for (const n of this.notes) {
      const end = n.time + n.duration;
      if (end > max) max = end;
    }
    this._maxDuration = max;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  getCurrentTime(): number {
    if (this.isPaused || !this.isPlaying) return this.pausedAt;
    return (performance.now() - this.playStartTime) / 1000;
  }

  /**
   * 将内部 RecordedNote 转换为 ScheduledNote 格式，
   * 补充 hand 默认值和 trackIndex 占位，供回放和瀑布流视图使用
   * @returns 可供调度的音符列表
   */
  getScheduledNotes(): ScheduledNote[] {
    return this.notes.map((n) => ({
      midi: n.midi,
      velocity: n.velocity,
      time: n.time,
      duration: n.duration,
      hand: n.hand ?? "unknown",
      trackIndex: -1,
    }));
  }

  setCallbacks(callbacks: RecorderCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  saveToStorage(): void {
    saveToStorage(RECORDING_STORAGE_KEY, this.notes);
  }

  loadFromStorage(): RecordedNote[] {
    this.notes = loadFromStorage<RecordedNote[]>({
      key: RECORDING_STORAGE_KEY,
      defaultValue: [],
    });
    this.recomputeMaxDuration();
    return this.notes;
  }

  clearStorage(): void {
    removeFromStorage(RECORDING_STORAGE_KEY);
    this.notes = [];
    this._maxDuration = 0;
  }

  dispose(): void {
    this.isRecording = false;
    this.isPlaying = false;
    this.isPaused = false;
    this.pending.clear();
    this.scheduler.reset();
  }

  /** 每帧由 WaterfallEngine 主循环调用，推进播放进度并触发回调 */
  tick(): void {
    const current = this.getCurrentTime();
    const dur = this._maxDuration;
    this.scheduler.tick(current);
    this.callbacks.onProgress?.(current, dur);
    waterfallPianoEvents.onPlaybackProgress.internalInvoke({ currentTime: current, duration: dur });
    if (current >= dur && dur > 0) {
      this.isPlaying = false;
      this.isPaused = false;
      this.scheduler.reset();
      this.callbacks.onPlaybackEnd?.();
      waterfallPianoEvents.onPlaybackEnd.internalInvoke();
    }
  }
}
