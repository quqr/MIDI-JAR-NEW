import { saveToStorage, loadFromStorage, removeFromStorage } from "@/helpers/storage";
import { RECORDING_STORAGE_KEY } from "../constants";
import type { RecordedNote, ScheduledNote } from "../types";

export interface RecorderCallbacks {
  onNoteOn?: (midi: number, velocity: number, hand: "left" | "right" | "unknown") => void;
  onNoteOff?: (midi: number) => void;
  onPlaybackEnd?: () => void;
  onProgress?: (current: number, duration: number) => void;
  onScheduledNotesReady?: (notes: ScheduledNote[]) => void;
}

export class Recorder {
  private notes: RecordedNote[] = [];
  private pending = new Map<number, { velocity: number; startTime: number }>();
  private recordStartTime = 0;
  private isRecording = false;
  private isPlaying = false;
  private isPaused = false;
  private playStartTime = 0;
  private pausedAt = 0;
  private triggeredIndices = new Set<number>();
  private endedIndices = new Set<number>();
  callbacks: RecorderCallbacks = {};

  startRecording(): void {
    this.notes = [];
    this.pending.clear();
    this.recordStartTime = performance.now();
    this.isRecording = true;
  }

  stopRecording(): RecordedNote[] {
    if (!this.isRecording) return this.notes;
    this.isRecording = false;
    const now = performance.now() - this.recordStartTime;
    for (const [midi, info] of this.pending) {
      this.notes.push({
        midi,
        velocity: info.velocity,
        time: info.startTime / 1000,
        duration: Math.max(0, (now - info.startTime) / 1000),
      });
    }
    this.pending.clear();
    this.saveToStorage();
    return this.notes;
  }

  recordNoteOn(midi: number, velocity: number): void {
    if (!this.isRecording) return;
    if (this.pending.has(midi)) return;
    const startTime = performance.now() - this.recordStartTime;
    this.pending.set(midi, { velocity, startTime });
  }

  recordNoteOff(midi: number): void {
    if (!this.isRecording) return;
    const info = this.pending.get(midi);
    if (!info) return;
    const now = performance.now() - this.recordStartTime;
    this.notes.push({
      midi,
      velocity: info.velocity,
      time: info.startTime / 1000,
      duration: Math.max(0, (now - info.startTime) / 1000),
    });
    this.pending.delete(midi);
  }

  loadNotes(notes: RecordedNote[]): void {
    this.notes = [...notes];
    this.callbacks.onScheduledNotesReady?.(this.getScheduledNotes());
  }

  startPlayback(): void {
    if (this.notes.length === 0) return;
    this.resetPlaybackState();
    this.pausedAt = 0;
    this.playStartTime = performance.now();
    this.isPlaying = true;
    this.isPaused = false;
    this.callbacks.onScheduledNotesReady?.(this.getScheduledNotes());
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
    this.resetPlaybackState();
  }

  seekTo(seconds: number): void {
    const clamped = Math.max(0, Math.min(seconds, this.getDuration()));
    this.pausedAt = clamped;
    this.playStartTime = performance.now() - clamped * 1000;
    this.recomputeTriggeredState(clamped);
  }

  getDuration(): number {
    if (this.notes.length === 0) return 0;
    let max = 0;
    for (const n of this.notes) {
      const end = n.time + n.duration;
      if (end > max) max = end;
    }
    return max;
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
    return this.notes;
  }

  clearStorage(): void {
    removeFromStorage(RECORDING_STORAGE_KEY);
    this.notes = [];
  }

  dispose(): void {
    this.isRecording = false;
    this.isPlaying = false;
    this.isPaused = false;
    this.pending.clear();
    this.resetPlaybackState();
  }

  private resetPlaybackState(): void {
    this.triggeredIndices.clear();
    this.endedIndices.clear();
  }

  private recomputeTriggeredState(current: number): void {
    this.triggeredIndices.clear();
    this.endedIndices.clear();
    for (let i = 0; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.time <= current) this.triggeredIndices.add(i);
      if (n.time + n.duration <= current) this.endedIndices.add(i);
    }
  }

  /** 每帧由 WaterfallEngine 主循环调用，推进播放进度并触发回调 */
  tick(): void {
    const current = this.getCurrentTime();
    for (let i = 0; i < this.notes.length; i++) {
      if (this.triggeredIndices.has(i)) continue;
      const n = this.notes[i];
      if (n.time <= current) {
        this.triggeredIndices.add(i);
        this.callbacks.onNoteOn?.(n.midi, n.velocity, n.hand ?? "unknown");
      }
    }
    for (let i = 0; i < this.notes.length; i++) {
      if (this.endedIndices.has(i)) continue;
      const n = this.notes[i];
      if (n.time + n.duration <= current) {
        this.endedIndices.add(i);
        this.callbacks.onNoteOff?.(n.midi);
      }
    }
    this.callbacks.onProgress?.(current, this.getDuration());
    if (current >= this.getDuration() && this.getDuration() > 0) {
      this.isPlaying = false;
      this.isPaused = false;
      this.callbacks.onPlaybackEnd?.();
    }
  }
}
