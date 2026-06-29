import { Midi } from "@tonejs/midi";
import * as Tone from "tone";
import type { MidiTrackInfo, ScheduledNote } from "../types";

export interface MidiFileCallbacks {
  onNoteOn: (midi: number, velocity: number, trackIndex: number, hand: "left" | "right" | "unknown") => void;
  onNoteOff: (midi: number, trackIndex: number) => void;
  onPlaybackEnd: () => void;
  onProgress: (progress: number, seconds: number) => void;
  onScheduledNotesReady?: (notes: ScheduledNote[]) => void;
}

export class MidiFilePlayer {
  private midi: Midi | null = null;
  private callbacks: MidiFileCallbacks | null = null;
  private isPlaying = false;
  private isPaused = false;
  private playbackSpeed = 1;
  private selectedTracks: Set<number> = new Set();
  private duration = 0;
  private scheduledNotes: ScheduledNote[] = [];
  private activeNotes = new Set<number>();
  private progressRAF: number | null = null;
  private pauseOffset = 0; // 秒

  setCallbacks(callbacks: MidiFileCallbacks) {
    this.callbacks = callbacks;
  }

  async loadFile(file: File): Promise<MidiTrackInfo[]> {
    const arrayBuffer = await file.arrayBuffer();
    this.midi = new Midi(arrayBuffer);
    this.duration = this.midi.duration;

    this.selectedTracks.clear();
    const tracks: MidiTrackInfo[] = [];

    this.midi.tracks.forEach((track, index) => {
      this.selectedTracks.add(index);
      tracks.push({
        index,
        name: track.name || `Track ${index + 1}`,
        noteCount: track.notes.length,
        instrument: track.instrument.name || "Unknown",
      });
    });

    this.prepareScheduledNotes();
    return tracks;
  }

  // ─── 准备调度的音符列表 ───
  private prepareScheduledNotes() {
    if (!this.midi) return;
    this.scheduledNotes = [];

    const trackCount = this.midi.tracks.length;
    for (let trackIndex = 0; trackIndex < trackCount; trackIndex++) {
      if (!this.selectedTracks.has(trackIndex)) continue;

      const track = this.midi.tracks[trackIndex];
      const hand = this.detectHand(trackIndex, trackCount);

      for (const note of track.notes) {
        this.scheduledNotes.push({
          midi: note.midi,
          velocity: Math.round(note.velocity * 127),
          time: note.time,
          duration: note.duration,
          hand,
          trackIndex,
        });
      }
    }

    this.callbacks?.onScheduledNotesReady?.(this.scheduledNotes);
  }

  // ─── 左右手检测：轨道优先 + 音高回退 ───
  private detectHand(trackIndex: number, trackCount: number): "left" | "right" | "unknown" {
    if (trackCount >= 2) {
      // 钢琴 MIDI 通常 track 0 = 右手, track 1 = 左手
      // 但 track 0 可能是 tempo track（无音符）
      if (trackIndex === 0) return "right";
      if (trackIndex === 1) return "left";
      return "unknown";
    }
    return "unknown";
  }

  setPlaybackSpeed(speed: number) {
    this.playbackSpeed = speed;
    if (this.isPlaying) {
      Tone.getTransport().bpm.value = 120 * speed;
    }
  }

  setSelectedTracks(tracks: number[]) {
    this.selectedTracks.clear();
    tracks.forEach((t) => this.selectedTracks.add(t));
    if (this.midi) {
      this.prepareScheduledNotes();
    }
  }

  // ─── 播放 ───
  async startPlayback() {
    if (!this.midi || this.isPlaying) return;

    await Tone.start();

    const transport = Tone.getTransport();
    transport.cancel();

    this.isPlaying = true;
    this.isPaused = false;
    this.activeNotes.clear();

    // 设置速度
    transport.bpm.value = 120 * this.playbackSpeed;

    // 设置起始位置
    transport.seconds = this.pauseOffset;
    const startSeconds = this.pauseOffset;

    // 调度所有音符
    for (const note of this.scheduledNotes) {
      const noteOnTime = note.time;
      const noteOffTime = note.time + note.duration;

      // 跳过已经过去的音符的 noteOn
      if (noteOnTime >= startSeconds) {
        transport.schedule((_time) => {
          if (!this.isPlaying) return;
          this.activeNotes.add(note.midi);
          this.callbacks?.onNoteOn(note.midi, note.velocity, note.trackIndex, note.hand);
        }, noteOnTime);
      }

      // 跳过已经过去的音符的 noteOff
      if (noteOffTime >= startSeconds) {
        transport.schedule((_time) => {
          if (!this.isPlaying) return;
          this.activeNotes.delete(note.midi);
          this.callbacks?.onNoteOff(note.midi, note.trackIndex);
        }, noteOffTime);
      }
    }

    // 调度播放结束
    transport.schedule((_time) => {
      this.stopPlayback();
      this.callbacks?.onPlaybackEnd();
    }, this.duration + 0.1);

    transport.start();

    // 进度报告
    this.startProgressLoop();
  }

  // ─── 暂停 ───
  pausePlayback() {
    if (!this.isPlaying || this.isPaused) return;
    this.isPaused = true;
    this.isPlaying = false;

    const transport = Tone.getTransport();
    this.pauseOffset = transport.seconds;
    transport.pause();

    // 释放所有活跃音符
    for (const midi of this.activeNotes) {
      this.callbacks?.onNoteOff(midi, -1);
    }
    this.activeNotes.clear();

    this.stopProgressLoop();
  }

  // ─── 恢复 ───
  async resumePlayback() {
    if (!this.midi || this.isPlaying || !this.isPaused) return;
    this.isPaused = false;
    await this.startPlayback();
  }

  // ─── 停止 ───
  stopPlayback() {
    this.isPlaying = false;
    this.isPaused = false;
    this.pauseOffset = 0;

    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    transport.seconds = 0;

    // 释放所有活跃音符
    for (const midi of this.activeNotes) {
      this.callbacks?.onNoteOff(midi, -1);
    }
    this.activeNotes.clear();

    this.stopProgressLoop();
  }

  // ─── 跳转到指定位置（秒）───
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

  // ─── 进度循环 ───
  private startProgressLoop() {
    this.stopProgressLoop();
    const loop = () => {
      if (!this.isPlaying) return;
      const transport = Tone.getTransport();
      const seconds = transport.seconds;
      const progress = Math.min(1, seconds / this.duration);
      this.callbacks?.onProgress(progress, seconds);
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

  // ─── 查询方法 ───
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

  getScheduledNotes(): ScheduledNote[] {
    return this.scheduledNotes;
  }

  getLoadedTracks(): MidiTrackInfo[] {
    if (!this.midi) return [];
    return this.midi.tracks.map((track, index) => ({
      index,
      name: track.name || `Track ${index + 1}`,
      noteCount: track.notes.length,
      instrument: track.instrument.name || "Unknown",
    }));
  }

  dispose() {
    this.stopPlayback();
    this.midi = null;
    this.scheduledNotes = [];
  }
}
