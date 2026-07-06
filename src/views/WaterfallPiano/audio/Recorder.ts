import * as Tone from "tone";
import type { RecordedNote, ScheduledNote } from "../types";

export interface RecorderCallbacks {
  onNoteOn: (midi: number, velocity: number) => void;
  onNoteOff: (midi: number) => void;
  onPlaybackEnd: () => void;
  onProgress?: (progress: number, seconds: number) => void;
  onScheduledNotesReady?: (notes: ScheduledNote[]) => void;
}

export class Recorder {
  private recordedNotes: RecordedNote[] = [];
  private pendingNotes = new Map<
    number,
    { startTime: number; velocity: number }
  >();
  private startTime = 0;
  private callbacks: RecorderCallbacks | null = null;
  private isPlaying = false;
  private isPaused = false;
  private duration = 0;
  private activeNotes = new Set<number>();
  private progressRAF: number | null = null;
  private pauseOffset = 0;

  isRecording = false;

  setCallbacks(callbacks: RecorderCallbacks) {
    this.callbacks = callbacks;
  }

  // ─── 录制 ───
  startRecording() {
    this.recordedNotes = [];
    this.pendingNotes.clear();
    this.startTime = Date.now();
    this.isRecording = true;
  }

  stopRecording(): RecordedNote[] {
    this.isRecording = false;
    for (const [midi, data] of this.pendingNotes) {
      this.recordedNotes.push({
        midi,
        velocity: data.velocity,
        time: data.startTime - this.startTime,
        duration: Date.now() - data.startTime,
      });
    }
    this.pendingNotes.clear();
    return this.recordedNotes;
  }

  recordNoteOn(midi: number, velocity: number) {
    if (!this.isRecording) return;
    this.pendingNotes.set(midi, {
      startTime: Date.now(),
      velocity,
    });
  }

  recordNoteOff(midi: number) {
    if (!this.isRecording) return;
    const data = this.pendingNotes.get(midi);
    if (data) {
      this.recordedNotes.push({
        midi,
        velocity: data.velocity,
        time: data.startTime - this.startTime,
        duration: Date.now() - data.startTime,
      });
      this.pendingNotes.delete(midi);
    }
  }

  getRecordedNotes(): RecordedNote[] {
    return this.recordedNotes;
  }

  setRecordedNotes(notes: RecordedNote[]) {
    this.recordedNotes = notes;
  }

  hasRecording(): boolean {
    return this.recordedNotes.length > 0;
  }

  // ─── 回放 ───
  private getScheduledNotes(): ScheduledNote[] {
    return this.recordedNotes.map((note, i) => ({
      midi: note.midi,
      velocity: note.velocity,
      time: note.time / 1000,
      duration: note.duration / 1000,
      hand: "unknown" as const,
      trackIndex: i,
    }));
  }

  async startPlayback(notes?: RecordedNote[]) {
    if (notes) {
      this.recordedNotes = notes;
    }
    if (this.recordedNotes.length === 0) return;

    await Tone.start();

    const transport = Tone.getTransport();
    transport.cancel();

    this.isPlaying = true;
    this.isPaused = false;
    this.activeNotes.clear();

    // 计算总时长
    this.duration = this.recordedNotes.reduce((max, n) => {
      return Math.max(max, (n.time + n.duration) / 1000);
    }, 0);

    transport.bpm.value = 120;
    transport.seconds = this.pauseOffset;
    const startSeconds = this.pauseOffset;

    // 通知调度音符
    this.callbacks?.onScheduledNotesReady?.(this.getScheduledNotes());

    // 调度音符
    for (const note of this.recordedNotes) {
      const noteOnTime = note.time / 1000;
      const noteOffTime = (note.time + note.duration) / 1000;

      if (noteOnTime >= startSeconds) {
        transport.schedule(() => {
          if (!this.isPlaying) return;
          this.activeNotes.add(note.midi);
          this.callbacks?.onNoteOn(note.midi, note.velocity);
        }, noteOnTime);
      }

      if (noteOffTime >= startSeconds) {
        transport.schedule(() => {
          if (!this.isPlaying) return;
          this.activeNotes.delete(note.midi);
          this.callbacks?.onNoteOff(note.midi);
        }, noteOffTime);
      }
    }

    // 调度结束
    transport.schedule(() => {
      this.stopPlayback();
      this.callbacks?.onPlaybackEnd();
    }, this.duration + 0.1);

    transport.start();
    this.startProgressLoop();
  }

  pausePlayback() {
    if (!this.isPlaying || this.isPaused) return;
    this.isPaused = true;
    this.isPlaying = false;

    const transport = Tone.getTransport();
    this.pauseOffset = transport.seconds;
    transport.pause();

    for (const midi of this.activeNotes) {
      this.callbacks?.onNoteOff(midi);
    }
    this.activeNotes.clear();

    this.stopProgressLoop();
  }

  async resumePlayback() {
    if (this.isPlaying || !this.isPaused) return;
    this.isPaused = false;
    await this.startPlayback();
  }

  stopPlayback() {
    this.isPlaying = false;
    this.isPaused = false;
    this.pauseOffset = 0;

    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    transport.seconds = 0;

    for (const midi of this.activeNotes) {
      this.callbacks?.onNoteOff(midi);
    }
    this.activeNotes.clear();

    this.stopProgressLoop();
  }

  seekTo(seconds: number) {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.pausePlayback();
    }
    this.pauseOffset = Math.max(0, Math.min(seconds, this.duration));

    if (wasPlaying) {
      this.startPlayback();
    }
  }

  private startProgressLoop() {
    this.stopProgressLoop();
    const loop = () => {
      if (!this.isPlaying) return;
      const transport = Tone.getTransport();
      const seconds = transport.seconds;
      const progress = Math.min(1, seconds / this.duration);
      this.callbacks?.onProgress?.(progress, seconds);
      this.progressRAF = requestAnimationFrame(loop);
    };
    this.progressRAF = requestAnimationFrame(loop);
  }

  private stopProgressLoop() {
    if (this.progressRAF !== null) {
      cancelAnimationFrame(this.progressRAF);
      this.progressRAF = null;
    }
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  getDuration(): number {
    return this.duration;
  }

  getCurrentTime(): number {
    if (this.isPlaying) {
      return Tone.getTransport().seconds;
    }
    return this.pauseOffset;
  }

  clear() {
    this.stopPlayback();
    this.recordedNotes = [];
    this.pendingNotes.clear();
  }

  /** 销毁所有资源并释放引用，应在组件 onUnmounted 中调用 */
  dispose() {
    this.stopPlayback();
    this.callbacks = null;
    this.recordedNotes = [];
    this.pendingNotes.clear();
    this.activeNotes.clear();
  }
}
