import { describe, expect, it } from "vitest";
import { layoutTrail } from "../engine/layoutTrail";
import type { Score3dNote } from "../types";
import { DEFAULT_LAYOUT_OPTIONS } from "../constants";

const OPT = DEFAULT_LAYOUT_OPTIONS;

/** 便捷构造音符 */
function note(
  midi: number,
  timeOn: number,
  trackIndex = 0,
  timeOff = timeOn + 1,
  velocity = 0.8,
): Score3dNote {
  return { midi, timeOn, timeOff, trackIndex, velocity, beatOn: timeOn * 2 };
}

describe("layoutTrail — 基础布局", () => {
  it("x = timeOn × unitsPerSecond，按时间升序", () => {
    const tracks = layoutTrail([note(60, 2), note(64, 0), note(67, 1)], OPT);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].points.map((p) => p.x)).toEqual([0, 6, 12]);
  });

  it("y 以全曲最低音归一化：(midi - globalMin) × unitsPerSemitone", () => {
    const tracks = layoutTrail([note(60, 0), note(64, 1), note(48, 2, 1)], OPT);
    // globalMin = 48
    expect(tracks[0].points.map((p) => p.y)).toEqual([6, 8]);
    expect(tracks[1].points[0].y).toBe(0);
  });

  it("z 按声部轨分层：trackIndex × staffGap", () => {
    const tracks = layoutTrail([note(60, 0, 0), note(48, 0, 1)], OPT);
    expect(tracks[0].points[0].z).toBe(0);
    expect(tracks[1].points[0].z).toBe(3);
  });

  it("空输入返回空数组", () => {
    expect(layoutTrail([], OPT)).toEqual([]);
  });

  it("输出按 trackIndex 升序", () => {
    const tracks = layoutTrail(
      [note(48, 0, 2), note(60, 0, 1), note(72, 0, 0)],
      OPT,
    );
    expect(tracks.map((t) => t.trackIndex)).toEqual([0, 1, 2]);
  });
});

describe("layoutTrail — 和弦处理（ADR 0007）", () => {
  it("和弦取最高音为主音，其余音高进入锚点（升序）", () => {
    const t = 0;
    const tracks = layoutTrail(
      [note(60, t), note(64, t), note(67, t), note(72, t)],
      OPT,
    );
    expect(tracks[0].points).toHaveLength(1);
    expect(tracks[0].points[0].y).toBeCloseTo(
      (72 - 60) * OPT.unitsPerSemitone,
      10,
    );
    expect(tracks[0].chordAnchors).toEqual([
      {
        pointIndex: 0,
        otherMidis: [60, 64, 67],
        otherPoints: [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 2, z: 0 },
          { x: 0, y: 3.5, z: 0 },
        ],
      },
    ]);
  });

  it("chordPolicy = bottom 时取最低音为主音", () => {
    const tracks = layoutTrail([note(60, 0), note(64, 0), note(67, 0)], {
      ...OPT,
      chordPolicy: "bottom",
    });
    expect(tracks[0].points[0].y).toBe(0);
    expect(tracks[0].chordAnchors[0].otherMidis).toEqual([64, 67]);
  });

  it("同度重复（unison）不产生锚点", () => {
    const tracks = layoutTrail([note(60, 0), note(60, 0)], OPT);
    expect(tracks[0].points).toHaveLength(1);
    expect(tracks[0].chordAnchors).toEqual([]);
  });

  it("单音旋律不产生锚点", () => {
    const tracks = layoutTrail([note(60, 0), note(64, 1), note(67, 2)], OPT);
    expect(tracks[0].chordAnchors).toEqual([]);
  });

  it("混合：和弦与单音交错时锚点索引指向正确的主音点", () => {
    const tracks = layoutTrail(
      [note(60, 0), note(64, 0), note(67, 1), note(72, 2), note(76, 2)],
      OPT,
    );
    // 时间 0 和 2 是和弦，1 是单音
    expect(tracks[0].points).toHaveLength(3);
    expect(tracks[0].chordAnchors).toHaveLength(2);
    expect(tracks[0].chordAnchors[0]).toEqual({
      pointIndex: 0,
      otherMidis: [60],
      otherPoints: [{ x: 0, y: 0, z: 0 }],
    });
    expect(tracks[0].chordAnchors[1]).toEqual({
      pointIndex: 2,
      otherMidis: [72],
      otherPoints: [{ x: 12, y: 6, z: 0 }],
    });
  });
});
