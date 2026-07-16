import { Midi } from "@tonejs/midi";
import * as Tone from "tone";
import type { ScheduledNote, MidiTrackInfo } from "../types";

/** MIDI 文件播放器的回调集合，用于通知外部组件音符触发、播放结束、进度变化等事件 */
export interface MidiPlayerCallbacks {
  onNoteOn?: (
    midi: number,
    velocity: number,
    hand: "left" | "right" | "unknown",
    trackIndex: number,
  ) => void;
  onNoteOff?: (midi: number) => void;
  onPlaybackEnd?: () => void;
  onProgress?: (current: number, duration: number) => void;
  onScheduledNotesReady?: (notes: ScheduledNote[]) => void;
  onTracksReady?: (tracks: MidiTrackInfo[]) => void;
}

/**
 * MIDI 文件播放器，负责解析 MIDI 文件、管理播放状态、按帧推进音符触发/结束回调。
 * 基于 Tone.js Transport 实现时间轴控制。
 */
export class MidiFilePlayer {
  private midi: Midi | null = null;
  private notes: ScheduledNote[] = [];
  private tracks: MidiTrackInfo[] = [];
  private duration = 0;
  private isPlaying = false;
  private isPaused = false;
  private playbackSpeed = 1;
  private selectedTracks: number[] = [];
  private loop = false;
  private triggeredIndices = new Set<number>();
  private endedIndices = new Set<number>();
  callbacks: MidiPlayerCallbacks = {};

  /**
   * 加载并解析 MIDI 文件，提取轨道信息与调度音符，通过回调通知外部组件
   * @param file - 用户选择的 MIDI 文件
   * @returns 解析后的轨道信息列表
   */
  async loadFile(file: File): Promise<MidiTrackInfo[]> {
    const arrayBuffer = await file.arrayBuffer();
    this.midi = new Midi(arrayBuffer);
    this.tracks = this.extractTrackInfo();
    this.duration = this.midi.duration;
    this.notes = this.collectNotes();
    this.callbacks.onTracksReady?.(this.tracks);
    this.callbacks.onScheduledNotesReady?.(this.notes);
    return this.tracks;
  }

  /** 从已解析的 MIDI 数据中提取含音符轨道的摘要信息（名称、音符数、乐器） */
  private extractTrackInfo(): MidiTrackInfo[] {
    if (!this.midi) return [];
    return this.midi.tracks
      .filter((track) => track.notes.length > 0)
      .map((track, idx) => ({
        index: idx,
        name: track.name || `Track ${idx + 1}`,
        noteCount: track.notes.length,
        instrument: track.instrument.name || "Unknown",
      }));
  }

  /**
   * 根据当前选中的轨道收集所有调度音符，按轨道序号推断左右手归属，按时间排序
   * 若未指定轨道则默认收集全部含音符轨道
   */
  private collectNotes(): ScheduledNote[] {
    if (!this.midi) return [];
    const result: ScheduledNote[] = [];
    // 只处理有音符的轨道
    const nonEmptyTracks = this.midi.tracks.filter(
      (track) => track.notes.length > 0,
    );
    const selected =
      this.selectedTracks.length > 0
        ? this.selectedTracks.filter((idx) => nonEmptyTracks[idx])
        : nonEmptyTracks.map((_, i) => i);
    for (const trackIdx of selected) {
      const track = nonEmptyTracks[trackIdx];
      if (!track) continue;
      const hand: "left" | "right" | "unknown" =
        trackIdx === 0 ? "right" : trackIdx === 1 ? "left" : "unknown";
      for (const note of track.notes) {
        result.push({
          midi: note.midi,
          velocity: Math.round(note.velocity * 127),
          time: note.time,
          duration: note.duration,
          hand,
          trackIndex: trackIdx,
        });
      }
    }
    result.sort((a, b) => a.time - b.time);
    return result;
  }

  getTracks(): MidiTrackInfo[] {
    return this.tracks;
  }

  getScheduledNotes(): ScheduledNote[] {
    return this.notes;
  }

  startPlayback(): void {
    if (this.notes.length === 0) return;
    this.resetPlaybackState();
    Tone.getTransport().seconds = 0;
    Tone.getTransport().start();
    this.isPlaying = true;
    this.isPaused = false;
    // 重新通知 NoteBlockSystem，确保方块系统状态完全重置
    this.callbacks.onScheduledNotesReady?.(this.notes);
  }

  pausePlayback(): void {
    if (!this.isPlaying) return;
    Tone.getTransport().pause();
    this.isPlaying = false;
    this.isPaused = true;
  }

  resumePlayback(): void {
    if (!this.isPaused) return;
    Tone.getTransport().start();
    this.isPlaying = true;
    this.isPaused = false;
  }

  stopPlayback(): void {
    Tone.getTransport().stop();
    Tone.getTransport().seconds = 0;
    this.isPlaying = false;
    this.isPaused = false;
    this.resetPlaybackState();
  }

  /**
   * 跳转到指定时间位置，并根据播放速度换算为 Transport 实际秒数
   * @param seconds - 目标位置（原始时间，不受播放速度影响）
   */
  seekTo(seconds: number): void {
    Tone.getTransport().seconds = seconds / this.playbackSpeed;
    this.recomputeTriggeredState();
  }

  getDuration(): number {
    return this.duration;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  getCurrentTime(): number {
    return Tone.getTransport().seconds * this.playbackSpeed;
  }

  /**
   * 设置播放速度倍率，同步调整 Transport BPM 并重新计算已触发音符状态
   * @param speed - 播放速度倍率，必须大于 0（1 为原始速度）
   */
  setPlaybackSpeed(speed: number): void {
    if (speed <= 0) return;
    this.playbackSpeed = speed;
    Tone.getTransport().bpm.value = 120 * speed;
    this.recomputeTriggeredState();
  }

  /**
   * 设置参与播放的轨道索引，会重新收集调度音符并通过回调通知外部
   * @param indices - 轨道索引数组，空数组表示使用全部轨道
   */
  setSelectedTracks(indices: number[]): void {
    this.selectedTracks = indices;
    if (this.midi) {
      this.notes = this.collectNotes();
      this.callbacks.onScheduledNotesReady?.(this.notes);
    }
  }

  setLoop(loop: boolean): void {
    this.loop = loop;
  }

  setCallbacks(callbacks: MidiPlayerCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  private resetPlaybackState(): void {
    this.triggeredIndices.clear();
    this.endedIndices.clear();
  }

  /** 根据当前播放时间重新计算已触发和已结束音符的索引集合，用于 seek 或变速后恢复正确状态 */
  private recomputeTriggeredState(): void {
    const currentOriginal = this.getCurrentTime();
    this.triggeredIndices.clear();
    this.endedIndices.clear();
    for (let i = 0; i < this.notes.length; i++) {
      const note = this.notes[i];
      if (note.time <= currentOriginal) {
        this.triggeredIndices.add(i);
      }
      if (note.time + note.duration <= currentOriginal) {
        this.endedIndices.add(i);
      }
    }
  }

  /** 每帧由 WaterfallEngine 主循环调用，推进播放进度并触发回调 */
  tick(): void {
    const current = this.getCurrentTime();
    for (let i = 0; i < this.notes.length; i++) {
      if (this.triggeredIndices.has(i)) continue;
      const note = this.notes[i];
      if (note.time <= current) {
        this.triggeredIndices.add(i);
        this.callbacks.onNoteOn?.(
          note.midi,
          note.velocity,
          note.hand,
          note.trackIndex,
        );
      }
    }
    for (let i = 0; i < this.notes.length; i++) {
      if (this.endedIndices.has(i)) continue;
      const note = this.notes[i];
      if (note.time + note.duration <= current) {
        this.endedIndices.add(i);
        this.callbacks.onNoteOff?.(note.midi);
      }
    }
    this.callbacks.onProgress?.(current, this.duration);
    if (current >= this.duration) {
      if (this.loop) {
        Tone.getTransport().seconds = 0;
        this.resetPlaybackState();
      } else {
        this.isPlaying = false;
        this.isPaused = false;
        Tone.getTransport().stop();
        this.callbacks.onPlaybackEnd?.();
      }
    }
  }

  dispose(): void {
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    this.midi = null;
    this.notes = [];
    this.tracks = [];
    this.resetPlaybackState();
  }
}
