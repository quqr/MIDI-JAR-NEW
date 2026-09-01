import { describe, expect, it } from "vitest";
import { buildTempoMap } from "@/views/ScoreScroll/utils/beatMap";
import { extractTrackInfo, toScore3dNotes } from "../engine/noteMapper";
import type { MapperTrackInput } from "../engine/noteMapper";

const TEMPO_120 = buildTempoMap([{ ticks: 0, bpm: 120, time: 0 }], 480);

/** 便捷构造：一个含音符的输入轨 */
function track(
  notes: { midi: number; velocity?: number; time: number; duration: number }[],
  channel = 0,
): MapperTrackInput {
  return {
    channel,
    notes: notes.map((n) => ({ velocity: 0.8, ...n })),
  };
}

describe("toScore3dNotes — track 分组", () => {
  it("格式 1 双轨：非空轨按顺序获得 trackIndex", () => {
    const result = toScore3dNotes(
      [
        track([{ midi: 72, time: 0, duration: 1 }]),
        track([], 0),
        track([{ midi: 48, time: 0.5, duration: 2 }], 1),
      ],
      { groupBy: "track", tempoMap: TEMPO_120 },
    );

    // 空轨被剔除，非空轨连续编号
    expect(result.tracks.map((t) => t.trackIndex)).toEqual([0, 1]);
    const t0 = result.notes.filter((n) => n.trackIndex === 0);
    const t1 = result.notes.filter((n) => n.trackIndex === 1);
    expect(t0).toHaveLength(1);
    expect(t1).toHaveLength(1);
    expect(t1[0].midi).toBe(48);
  });

  it("timeOff = time + duration，数据层保留音长", () => {
    const result = toScore3dNotes(
      [track([{ midi: 60, time: 2, duration: 1.5 }])],
      { groupBy: "track", tempoMap: TEMPO_120 },
    );
    expect(result.notes[0].timeOn).toBe(2);
    expect(result.notes[0].timeOff).toBeCloseTo(3.5, 10);
  });

  it("beatOn 经 tempo map 换算（120 BPM：1 秒 = 2 拍）", () => {
    const result = toScore3dNotes(
      [track([{ midi: 60, time: 1, duration: 1 }])],
      { groupBy: "track", tempoMap: TEMPO_120 },
    );
    expect(result.notes[0].beatOn).toBeCloseTo(2, 10);
  });

  it("同音高重叠音符各自保留", () => {
    const result = toScore3dNotes(
      [
        track([
          { midi: 64, time: 0, duration: 2 },
          { midi: 64, time: 1, duration: 2 },
        ]),
      ],
      { groupBy: "track", tempoMap: TEMPO_120 },
    );
    expect(result.notes).toHaveLength(2);
    expect(result.notes[0].timeOn).toBe(0);
    expect(result.notes[1].timeOn).toBe(1);
  });

  it("输出按 timeOn 升序排序", () => {
    const result = toScore3dNotes(
      [
        track([
          { midi: 70, time: 3, duration: 1 },
          { midi: 60, time: 0, duration: 1 },
        ]),
      ],
      { groupBy: "track", tempoMap: TEMPO_120 },
    );
    expect(result.notes.map((n) => n.timeOn)).toEqual([0, 3]);
  });

  it("duration 为 0 或负数时钳制 timeOff = timeOn", () => {
    const result = toScore3dNotes(
      [
        track([
          { midi: 60, time: 1, duration: 0 },
          { midi: 62, time: 2, duration: -1 },
        ]),
      ],
      { groupBy: "track", tempoMap: TEMPO_120 },
    );
    expect(result.notes[0].timeOff).toBe(1);
    expect(result.notes[1].timeOff).toBe(2);
  });

  it("velocity 钳制到 [0,1]", () => {
    const result = toScore3dNotes(
      [
        track([
          { midi: 60, time: 0, duration: 1, velocity: -0.5 },
          { midi: 62, time: 1, duration: 1, velocity: 2 },
        ]),
      ],
      { groupBy: "track", tempoMap: TEMPO_120 },
    );
    expect(result.notes[0].velocity).toBe(0);
    expect(result.notes[1].velocity).toBe(1);
  });

  it("duration 为总时长（最后一个 timeOff）", () => {
    const result = toScore3dNotes(
      [
        track([
          { midi: 60, time: 0, duration: 4 },
          { midi: 62, time: 6, duration: 2 },
        ]),
      ],
      { groupBy: "track", tempoMap: TEMPO_120 },
    );
    expect(result.duration).toBeCloseTo(8, 10);
  });

  it("无音符输入返回空结果", () => {
    const result = toScore3dNotes([], {
      groupBy: "track",
      tempoMap: TEMPO_120,
    });
    expect(result.notes).toEqual([]);
    expect(result.tracks).toEqual([]);
    expect(result.duration).toBe(0);
  });
});

describe("toScore3dNotes — channel 回退分组", () => {
  it("同通道的多条输入轨合并为一条声部轨", () => {
    const result = toScore3dNotes(
      [
        track([{ midi: 72, time: 0, duration: 1 }], 0),
        track([{ midi: 60, time: 0, duration: 1 }], 0),
        track([{ midi: 48, time: 0, duration: 1 }], 1),
      ],
      { groupBy: "channel", tempoMap: TEMPO_120 },
    );
    expect(result.tracks).toHaveLength(2);
    const ch0 = result.notes.filter((n) => n.trackIndex === 0);
    expect(ch0.map((n) => n.midi).sort()).toEqual([60, 72]);
  });

  it("通道按升序分配 trackIndex", () => {
    const result = toScore3dNotes(
      [
        track([{ midi: 48, time: 0, duration: 1 }], 3),
        track([{ midi: 72, time: 0, duration: 1 }], 1),
      ],
      { groupBy: "channel", tempoMap: TEMPO_120 },
    );
    expect(result.tracks.map((t) => t.trackIndex)).toEqual([0, 1]);
    const ch1 = result.notes.find((n) => n.midi === 72);
    expect(ch1?.trackIndex).toBe(0);
  });
});

describe("extractTrackInfo", () => {
  it("汇总每轨音符数与音高范围", () => {
    const info = extractTrackInfo(
      [
        track([
          { midi: 60, time: 0, duration: 1 },
          { midi: 72, time: 1, duration: 1 },
        ]),
      ],
      "track",
    );
    expect(info).toEqual([
      { trackIndex: 0, noteCount: 2, minMidi: 60, maxMidi: 72 },
    ]);
  });
});
