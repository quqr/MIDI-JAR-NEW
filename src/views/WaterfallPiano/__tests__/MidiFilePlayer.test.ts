import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@tonejs/midi", () => {
  return {
    Midi: class MockMidi {
      tracks: Array<{
        name: string;
        instrument: { name: string };
        notes: Array<{
          midi: number;
          velocity: number;
          time: number;
          duration: number;
        }>;
      }>;
      duration: number;
      constructor() {
        this.tracks = [
          {
            name: "Piano",
            instrument: { name: "Acoustic Grand Piano" },
            notes: [
              { midi: 60, velocity: 0.8, time: 0, duration: 0.5 },
              { midi: 62, velocity: 0.7, time: 1, duration: 0.5 },
            ],
          },
          {
            name: "Guitar",
            instrument: { name: "Acoustic Guitar" },
            notes: [{ midi: 64, velocity: 0.6, time: 2, duration: 0.5 }],
          },
        ];
        this.duration = 3;
      }
    },
  };
});

import { MidiFilePlayer } from "../midi/MidiFilePlayer";
import type { Clock } from "../audio/PerfClock";

/** 可控时钟：允许测试手动推进时间 */
class MockClock implements Clock {
  private _position = 0;
  private _rate = 1;

  start(): void { /* no-op for mock */ }
  pause(): void { /* no-op for mock */ }
  stop(): void { this._position = 0; }
  seek(seconds: number): void { this._position = seconds; }
  getPosition(): number { return this._position; }
  setRate(rate: number): void { this._rate = rate; }
  getRate(): number { return this._rate; }

  /** 测试辅助：手动设置当前位置 */
  setPosition(seconds: number): void { this._position = seconds; }
}

function mockFile(): File {
  return {
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  } as unknown as File;
}

describe("MidiFilePlayer", () => {
  let player: MidiFilePlayer;
  let clock: MockClock;

  beforeEach(() => {
    vi.useFakeTimers();
    clock = new MockClock();
    player = new MidiFilePlayer(clock);
  });

  afterEach(() => {
    player.dispose();
    vi.useRealTimers();
  });

  it("loadFile 返回 tracks 且触发回调", async () => {
    const tracksSpy = vi.fn();
    const notesSpy = vi.fn();
    player.setCallbacks({
      onTracksReady: tracksSpy,
      onScheduledNotesReady: notesSpy,
    });
    const tracks = await player.loadFile(mockFile());
    expect(tracks).toHaveLength(2);
    expect(tracks[0].name).toBe("Piano");
    expect(tracks[0].noteCount).toBe(2);
    expect(tracks[1].name).toBe("Guitar");
    expect(tracks[1].noteCount).toBe(1);
    expect(tracksSpy).toHaveBeenCalledTimes(1);
    expect(notesSpy).toHaveBeenCalledTimes(1);
  });

  it("loadFile 后 getDuration 返回 3", async () => {
    await player.loadFile(mockFile());
    expect(player.getDuration()).toBe(3);
  });

  it("loadFile 后 getScheduledNotes 返回排序后的 3 个音符", async () => {
    await player.loadFile(mockFile());
    const notes = player.getScheduledNotes();
    expect(notes).toHaveLength(3);
    expect(notes[0].time).toBeLessThanOrEqual(notes[1].time);
    expect(notes[1].time).toBeLessThanOrEqual(notes[2].time);
    expect(notes[0].midi).toBe(60);
    expect(notes[0].trackIndex).toBe(0);
    expect(notes[0].hand).toBe("right");
    expect(notes[2].trackIndex).toBe(1);
    expect(notes[2].hand).toBe("left");
  });

  it("startPlayback 后 getIsPlaying 为 true", async () => {
    await player.loadFile(mockFile());
    player.startPlayback();
    expect(player.getIsPlaying()).toBe(true);
    expect(player.getIsPaused()).toBe(false);
  });

  it("startPlayback 后推进时间 → onProgress 被调用", async () => {
    await player.loadFile(mockFile());
    const progressSpy = vi.fn();
    player.setCallbacks({ onProgress: progressSpy });
    player.startPlayback();
    clock.setPosition(1.0);
    player.tick();
    expect(progressSpy).toHaveBeenCalled();
    const lastCall = progressSpy.mock.calls[progressSpy.mock.calls.length - 1];
    expect(lastCall[0]).toBe(1.0);
    expect(lastCall[1]).toBe(3);
  });

  it("pausePlayback 后 getIsPaused 为 true", async () => {
    await player.loadFile(mockFile());
    player.startPlayback();
    player.pausePlayback();
    expect(player.getIsPlaying()).toBe(false);
    expect(player.getIsPaused()).toBe(true);
  });

  it("resumePlayback 后 getIsPlaying 为 true", async () => {
    await player.loadFile(mockFile());
    player.startPlayback();
    player.pausePlayback();
    player.resumePlayback();
    expect(player.getIsPlaying()).toBe(true);
    expect(player.getIsPaused()).toBe(false);
  });

  it("stopPlayback 后状态归零", async () => {
    await player.loadFile(mockFile());
    player.startPlayback();
    player.stopPlayback();
    expect(player.getIsPlaying()).toBe(false);
    expect(player.getIsPaused()).toBe(false);
  });

  it("setPlaybackSpeed(2) → getCurrentTime 随 clock rate 变化", async () => {
    await player.loadFile(mockFile());
    player.setPlaybackSpeed(2);
    // clock 内部 rate=2，设置 position 后 getCurrentTime 直接返回 clock position
    clock.setPosition(1.5);
    expect(player.getCurrentTime()).toBe(1.5);
  });

  it("seekTo(1.0) → clock 位置更新", async () => {
    await player.loadFile(mockFile());
    player.seekTo(1.0);
    expect(clock.getPosition()).toBe(1.0);
  });

  it("setSelectedTracks([0]) → getScheduledNotes 只含 track 0", async () => {
    await player.loadFile(mockFile());
    player.setSelectedTracks([0]);
    const notes = player.getScheduledNotes();
    expect(notes).toHaveLength(2);
    expect(notes.every((n) => n.trackIndex === 0)).toBe(true);
  });

  it("无音符时 startPlayback 不启动", async () => {
    player.startPlayback();
    expect(player.getIsPlaying()).toBe(false);
  });

  it("播放到 duration 且 loop=true → onPlaybackEnd 不触发，位置归零", async () => {
    await player.loadFile(mockFile());
    const endSpy = vi.fn();
    player.setCallbacks({ onPlaybackEnd: endSpy });
    player.setLoop(true);
    player.startPlayback();
    clock.setPosition(3.0);
    player.tick();
    expect(endSpy).not.toHaveBeenCalled();
    expect(clock.getPosition()).toBe(0);
  });

  it("播放到 duration 且 loop=false → onPlaybackEnd 触发", async () => {
    await player.loadFile(mockFile());
    const endSpy = vi.fn();
    player.setCallbacks({ onPlaybackEnd: endSpy });
    player.startPlayback();
    clock.setPosition(3.0);
    player.tick();
    expect(endSpy).toHaveBeenCalledTimes(1);
    expect(player.getIsPlaying()).toBe(false);
  });

  it("tick 触发 noteOn 回调", async () => {
    await player.loadFile(mockFile());
    const noteOnSpy = vi.fn();
    player.setCallbacks({ onNoteOn: noteOnSpy });
    player.startPlayback();
    // 第一个音符 time=0，tick 后应触发
    player.tick();
    expect(noteOnSpy).toHaveBeenCalledWith(60, 102, "right", 0);
  });

  it("tick 触发 noteOff 回调（音符结束时）", async () => {
    await player.loadFile(mockFile());
    const noteOffSpy = vi.fn();
    player.setCallbacks({ onNoteOff: noteOffSpy });
    player.startPlayback();
    // 第一个音符 time=0, duration=0.5 → end=0.5
    clock.setPosition(0.5);
    player.tick();
    expect(noteOffSpy).toHaveBeenCalled();
  });

  it("dispose 后 clock 停止", async () => {
    await player.loadFile(mockFile());
    player.startPlayback();
    player.dispose();
    expect(clock.getPosition()).toBe(0);
  });
});
