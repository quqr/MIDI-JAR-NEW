import { Midi } from "@tonejs/midi";
import * as Tone from "tone";
import type { ScheduledNote, MidiTrackInfo } from "../types";

export interface MidiPlayerCallbacks {
  onNoteOn?: (midi: number, velocity: number, hand: "left" | "right" | "unknown", trackIndex: number) => void;
  onNoteOff?: (midi: number) => void;
  onPlaybackEnd?: () => void;
  onProgress?: (current: number, duration: number) => void;
  onScheduledNotesReady?: (notes: ScheduledNote[]) => void;
  onTracksReady?: (tracks: MidiTrackInfo[]) => void;
}

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

  private collectNotes(): ScheduledNote[] {
    if (!this.midi) return [];
    const result: ScheduledNote[] = [];
    // 只处理有音符的轨道
    const nonEmptyTracks = this.midi.tracks.filter((track) => track.notes.length > 0);
    const selected =
      this.selectedTracks.length > 0
        ? this.selectedTracks.filter((idx) => nonEmptyTracks[idx])
        : nonEmptyTracks.map((_, i) => i);
    for (const trackIdx of selected) {
      const track = nonEmptyTracks[trackIdx];
      if (!track) continue;
      const hand: "left" | "right" | "unknown" = trackIdx === 0 ? "right" : trackIdx === 1 ? "left" : "unknown";
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

  setPlaybackSpeed(speed: number): void {
    if (speed <= 0) return;
    this.playbackSpeed = speed;
    Tone.getTransport().bpm.value = 120 * speed;
    this.recomputeTriggeredState();
  }

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
        this.callbacks.onNoteOn?.(note.midi, note.velocity, note.hand, note.trackIndex);
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
