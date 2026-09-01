import { describe, expect, it } from "vitest";
import {
  beatToSeconds,
  buildTempoMap,
  buildTempoMapFromMeasures,
  findCurrentMeasureIndex,
  findCurrentSystem,
  secondsToBeat,
  systemYAtBeat,
} from "../utils/beatMap";
import type { ScoreSystemInfo } from "../types";

describe("buildTempoMap", () => {
  it("空速度表使用默认 120 BPM", () => {
    const map = buildTempoMap([], 480);
    expect(map).toEqual([{ startBeat: 0, startTime: 0, bpm: 120 }]);
  });

  it("ticks 按 ppq 转换为拍", () => {
    const map = buildTempoMap(
      [
        { ticks: 0, bpm: 120, time: 0 },
        { ticks: 960, bpm: 60, time: 2 },
      ],
      480,
    );
    expect(map[0].startBeat).toBe(0);
    expect(map[1].startBeat).toBe(2);
    expect(map[1].bpm).toBe(60);
  });

  it("非法 bpm 回退为默认值", () => {
    const map = buildTempoMap([{ ticks: 0, bpm: 0, time: 0 }], 480);
    expect(map[0].bpm).toBe(120);
  });
});

describe("buildTempoMapFromMeasures", () => {
  it("空小节列表使用默认 120 BPM", () => {
    const map = buildTempoMapFromMeasures([]);
    expect(map).toEqual([{ startBeat: 0, startTime: 0, bpm: 120 }]);
  });

  it("bpm 为 0 的小节沿用前值，首小节用默认值", () => {
    const map = buildTempoMapFromMeasures([
      { startBeat: 0, bpm: 0 },
      { startBeat: 4, bpm: 90 },
      { startBeat: 8, bpm: 0 },
    ]);
    expect(map).toEqual([
      { startBeat: 0, startTime: 0, bpm: 120 },
      { startBeat: 4, startTime: 2, bpm: 90 },
    ]);
  });

  it("startTime 按拍位分段累加", () => {
    const map = buildTempoMapFromMeasures([
      { startBeat: 0, bpm: 60 },
      { startBeat: 4, bpm: 120 },
    ]);
    expect(map).toEqual([
      { startBeat: 0, startTime: 0, bpm: 60 },
      { startBeat: 4, startTime: 4, bpm: 120 },
    ]);
    // 验证与 secondsToBeat 互逆：第 5 拍 = 4.5s
    expect(secondsToBeat(map, 4.5)).toBe(5);
  });
});

describe("secondsToBeat / beatToSeconds", () => {
  const constant = buildTempoMap([{ ticks: 0, bpm: 120, time: 0 }], 480);

  it("恒定 120 BPM：1 秒 = 2 拍", () => {
    expect(secondsToBeat(constant, 0)).toBe(0);
    expect(secondsToBeat(constant, 1)).toBe(2);
    expect(secondsToBeat(constant, 3)).toBe(6);
  });

  it("恒定 120 BPM：拍 → 秒 与正变换互逆", () => {
    expect(beatToSeconds(constant, 0)).toBe(0);
    expect(beatToSeconds(constant, 2)).toBe(1);
    expect(beatToSeconds(constant, 6)).toBe(3);
  });

  it("负值输入被钳制到 0", () => {
    expect(secondsToBeat(constant, -5)).toBe(0);
    expect(beatToSeconds(constant, -1)).toBe(0);
  });

  it("变速段按分段线性映射", () => {
    // 0-2s @120bpm（0-4 拍），2s 起 @60bpm
    const map = buildTempoMap(
      [
        { ticks: 0, bpm: 120, time: 0 },
        { ticks: 1920, bpm: 60, time: 2 },
      ],
      480,
    );
    expect(secondsToBeat(map, 2)).toBe(4);
    expect(secondsToBeat(map, 3)).toBe(5); // 60bpm = 1 拍/秒
    expect(beatToSeconds(map, 5)).toBe(3);
  });
});

describe("systemYAtBeat", () => {
  const systems: ScoreSystemInfo[] = [
    { index: 0, startBeat: 0, endBeat: 8, topY: 0, bottomY: 100 },
    { index: 1, startBeat: 8, endBeat: 16, topY: 120, bottomY: 220 },
    { index: 2, startBeat: 16, endBeat: 24, topY: 240, bottomY: 340 },
  ];

  it("行起始拍返回该行 topY", () => {
    expect(systemYAtBeat(systems, 0)).toBe(0);
    expect(systemYAtBeat(systems, 8)).toBe(120);
    expect(systemYAtBeat(systems, 16)).toBe(240);
  });

  it("行间线性插值：中点在两行 topY 之间", () => {
    expect(systemYAtBeat(systems, 4)).toBe(60);
    expect(systemYAtBeat(systems, 12)).toBe(180);
  });

  it("早于第一行时钳制到第一行 topY", () => {
    expect(systemYAtBeat(systems, -5)).toBe(0);
  });

  it("最后一行在其时值内向底部滚动，之后保持", () => {
    expect(systemYAtBeat(systems, 20)).toBe(290);
    expect(systemYAtBeat(systems, 24)).toBe(240);
    expect(systemYAtBeat(systems, 100)).toBe(240);
  });

  it("空数据返回 null", () => {
    expect(systemYAtBeat([], 5)).toBeNull();
  });
});

describe("findCurrentSystem", () => {
  const systems: ScoreSystemInfo[] = [
    { index: 0, startBeat: 0, endBeat: 8, topY: 0, bottomY: 100 },
    { index: 1, startBeat: 8, endBeat: 16, topY: 120, bottomY: 220 },
    { index: 2, startBeat: 16, endBeat: 24, topY: 240, bottomY: 340 },
  ];

  it("返回 startBeat <= beat 的最后一个系统行", () => {
    expect(findCurrentSystem(systems, 0)?.index).toBe(0);
    expect(findCurrentSystem(systems, 7.9)?.index).toBe(0);
    expect(findCurrentSystem(systems, 8)?.index).toBe(1);
    expect(findCurrentSystem(systems, 100)?.index).toBe(2);
  });

  it("早于第一行时返回第一行", () => {
    expect(findCurrentSystem(systems, -3)?.index).toBe(0);
  });

  it("空数据返回 null", () => {
    expect(findCurrentSystem([], 5)).toBeNull();
  });
});

describe("findCurrentMeasureIndex", () => {
  const measures = [
    { index: 0, startBeat: 0 },
    { index: 1, startBeat: 4 },
    { index: 2, startBeat: 8 },
  ];

  it("返回 startBeat <= beat 的最后一个小节索引", () => {
    expect(findCurrentMeasureIndex(measures, 3.9)).toBe(0);
    expect(findCurrentMeasureIndex(measures, 4)).toBe(1);
    expect(findCurrentMeasureIndex(measures, 100)).toBe(2);
  });

  it("无匹配时返回 -1", () => {
    expect(findCurrentMeasureIndex([], 1)).toBe(-1);
  });
});
