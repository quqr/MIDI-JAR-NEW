import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RECORDING_STORAGE_KEY } from "../constants";
import type { RecordedNote } from "../types";

const { store } = vi.hoisted(() => ({ store: new Map<string, string>() }));

vi.mock("@/helpers/storage", () => ({
  saveToStorage: <T>(key: string, data: T): void => {
    store.set(key, JSON.stringify(data));
  },
  loadFromStorage: <T>({ key, defaultValue }: { key: string; defaultValue: T }): T => {
    const v = store.get(key);
    if (v) return JSON.parse(v) as T;
    return defaultValue;
  },
  removeFromStorage: (key: string): void => {
    store.delete(key);
  },
}));

import { Recorder } from "../audio/Recorder";

describe("Recorder", () => {
  let recorder: Recorder;

  beforeEach(() => {
    vi.useFakeTimers();
    store.clear();
    recorder = new Recorder();
  });

  afterEach(() => {
    recorder.dispose();
    vi.useRealTimers();
  });

  describe("录制", () => {
    it("startRecording + recordNoteOn/Off + stopRecording 返回音符", () => {
      recorder.startRecording();
      vi.advanceTimersByTime(100);
      recorder.recordNoteOn(60, 100);
      vi.advanceTimersByTime(400);
      recorder.recordNoteOff(60);
      const notes = recorder.stopRecording();
      expect(notes).toHaveLength(1);
      expect(notes[0].midi).toBe(60);
      expect(notes[0].velocity).toBe(100);
      expect(notes[0].time).toBeCloseTo(0.1, 2);
      expect(notes[0].duration).toBeCloseTo(0.4, 2);
    });

    it("重复 recordNoteOn 同 midi 只记录一次", () => {
      recorder.startRecording();
      vi.advanceTimersByTime(100);
      recorder.recordNoteOn(60, 100);
      vi.advanceTimersByTime(50);
      recorder.recordNoteOn(60, 100);
      vi.advanceTimersByTime(200);
      recorder.recordNoteOff(60);
      const notes = recorder.stopRecording();
      expect(notes).toHaveLength(1);
    });

    it("未录制时 recordNoteOn 被忽略", () => {
      recorder.recordNoteOn(60, 100);
      recorder.recordNoteOff(60);
      const notes = recorder.stopRecording();
      expect(notes).toHaveLength(0);
    });

    it("stopRecording 未录制时返回空数组", () => {
      const notes = recorder.stopRecording();
      expect(notes).toHaveLength(0);
    });

    it("stopRecording 时 pending 音符被结算", () => {
      recorder.startRecording();
      vi.advanceTimersByTime(100);
      recorder.recordNoteOn(60, 100);
      vi.advanceTimersByTime(200);
      const notes = recorder.stopRecording();
      expect(notes).toHaveLength(1);
      expect(notes[0].duration).toBeGreaterThan(0);
    });
  });

  describe("getScheduledNotes", () => {
    it("loadNotes 后返回 hand=unknown, trackIndex=-1", () => {
      const recorded: RecordedNote[] = [
        { midi: 60, velocity: 100, time: 0, duration: 1 },
      ];
      recorder.loadNotes(recorded);
      const scheduled = recorder.getScheduledNotes();
      expect(scheduled).toHaveLength(1);
      expect(scheduled[0].hand).toBe("unknown");
      expect(scheduled[0].trackIndex).toBe(-1);
    });
  });

  describe("播放", () => {
    it("startPlayback 后 getIsPlaying 为 true", () => {
      recorder.loadNotes([
        { midi: 60, velocity: 100, time: 0, duration: 1 },
      ]);
      recorder.startPlayback();
      expect(recorder.getIsPlaying()).toBe(true);
      expect(recorder.getIsPaused()).toBe(false);
    });

    it("推进时间 → onNoteOn 被调用", () => {
      recorder.loadNotes([
        { midi: 60, velocity: 100, time: 0, duration: 1 },
      ]);
      const noteOnSpy = vi.fn();
      recorder.setCallbacks({ onNoteOn: noteOnSpy });
      recorder.startPlayback();
      vi.advanceTimersByTime(16);
      expect(noteOnSpy).toHaveBeenCalledWith(60, 100, "unknown");
    });

    it("推进到 note 结束 → onNoteOff 被调用", () => {
      recorder.loadNotes([
        { midi: 60, velocity: 100, time: 0, duration: 1 },
      ]);
      const noteOffSpy = vi.fn();
      recorder.setCallbacks({ onNoteOff: noteOffSpy });
      recorder.startPlayback();
      vi.advanceTimersByTime(1100);
      expect(noteOffSpy).toHaveBeenCalledWith(60);
    });

    it("推进到 duration → onPlaybackEnd 触发", () => {
      recorder.loadNotes([
        { midi: 60, velocity: 100, time: 0, duration: 1 },
      ]);
      const endSpy = vi.fn();
      recorder.setCallbacks({ onPlaybackEnd: endSpy });
      recorder.startPlayback();
      vi.advanceTimersByTime(1100);
      expect(endSpy).toHaveBeenCalledTimes(1);
      expect(recorder.getIsPlaying()).toBe(false);
    });

    it("pausePlayback 后 getCurrentTime 冻结", () => {
      recorder.loadNotes([
        { midi: 60, velocity: 100, time: 0, duration: 2 },
      ]);
      recorder.startPlayback();
      vi.advanceTimersByTime(500);
      recorder.pausePlayback();
      const frozen = recorder.getCurrentTime();
      vi.advanceTimersByTime(500);
      expect(recorder.getCurrentTime()).toBeCloseTo(frozen, 5);
      expect(recorder.getIsPaused()).toBe(true);
    });

    it("resumePlayback 后继续播放", () => {
      recorder.loadNotes([
        { midi: 60, velocity: 100, time: 0, duration: 2 },
      ]);
      recorder.startPlayback();
      vi.advanceTimersByTime(500);
      recorder.pausePlayback();
      vi.advanceTimersByTime(500);
      recorder.resumePlayback();
      expect(recorder.getIsPlaying()).toBe(true);
      expect(recorder.getIsPaused()).toBe(false);
    });

    it("stopPlayback 后状态归零", () => {
      recorder.loadNotes([
        { midi: 60, velocity: 100, time: 0, duration: 2 },
      ]);
      recorder.startPlayback();
      recorder.stopPlayback();
      expect(recorder.getIsPlaying()).toBe(false);
      expect(recorder.getIsPaused()).toBe(false);
    });

    it("seekTo 后 getCurrentTime 返回 seek 值", () => {
      recorder.loadNotes([
        { midi: 60, velocity: 100, time: 0, duration: 2 },
      ]);
      recorder.startPlayback();
      recorder.seekTo(1.0);
      expect(recorder.getCurrentTime()).toBeCloseTo(1.0, 2);
    });

    it("空音符时 startPlayback 不启动", () => {
      recorder.startPlayback();
      expect(recorder.getIsPlaying()).toBe(false);
    });
  });

  describe("持久化", () => {
    it("saveToStorage + loadFromStorage 往返一致", () => {
      const recorded: RecordedNote[] = [
        { midi: 60, velocity: 100, time: 0.5, duration: 1.0 },
        { midi: 62, velocity: 80, time: 1.5, duration: 0.5 },
      ];
      recorder.loadNotes(recorded);
      recorder.saveToStorage();
      const loaded = recorder.loadFromStorage();
      expect(loaded).toEqual(recorded);
    });

    it("clearStorage 后 loadFromStorage 返回空", () => {
      const recorded: RecordedNote[] = [
        { midi: 60, velocity: 100, time: 0.5, duration: 1.0 },
      ];
      recorder.loadNotes(recorded);
      recorder.saveToStorage();
      recorder.clearStorage();
      const loaded = recorder.loadFromStorage();
      expect(loaded).toEqual([]);
    });

    it("loadFromStorage 空键返回空数组", () => {
      store.clear();
      const loaded = recorder.loadFromStorage();
      expect(loaded).toEqual([]);
    });

    it("stopRecording 自动保存到 storage", () => {
      recorder.startRecording();
      vi.advanceTimersByTime(100);
      recorder.recordNoteOn(60, 100);
      vi.advanceTimersByTime(200);
      recorder.recordNoteOff(60);
      recorder.stopRecording();
      const stored = store.get(RECORDING_STORAGE_KEY);
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].midi).toBe(60);
    });
  });
});
