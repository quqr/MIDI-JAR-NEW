/**
 * 时间线编译器测试：覆盖反复 / ending / D.C. / D.S. 控制流（见计划 Phase 1 必测 case）。
 */

import { describe, expect, it } from "vitest";

import {
  ChartTooComplexError,
  compileTimeline,
  findEntryIndexAtBeat,
  findSeekEntryIndex,
  MAX_TIMELINE_ENTRIES,
} from "../timeline";
import { createChordUnit, createMeasure, createRepeatMark } from "../../domain/empty";
import type { ChartMeasure, ChordChart, JumpCommand } from "../../domain/types";

/* ── 测试谱面工厂 ─────────────────────────────────────── */

function measureWithChord(
  partial: Partial<ChartMeasure> = {},
  chord = createChordUnit({ root: "C", type: "maj7", beats: 4 }),
): ChartMeasure {
  return { ...createMeasure(), chords: [chord], ...partial };
}

/** 简化建谱：传小节序列 + meta.repeats */
function chartOf(
  measures: ChartMeasure[],
  repeats = 1,
): ChordChart {
  return {
    meta: {
      title: "t",
      composer: "",
      style: "",
      key: { tonic: "C", mode: "major" },
      tempo: 120,
      repeats,
      notation: "symbol",
    },
    measures,
    sections: [],
    texts: [],
    systemSpacing: {},
  };
}

/** 提取演奏的小节索引序列 */
function seq(chart: ChordChart, repeats?: number): number[] {
  return compileTimeline(chart, repeats === undefined ? {} : { repeats }).entries.map(
    (e) => e.measureIndex,
  );
}

/** 搭一个带 C 和弦的 4 小节谱的快捷方式 */
function simpleMeasures(n: number): ChartMeasure[] {
  return Array.from({ length: n }, () => measureWithChord({}, createChordUnit({ root: "C", type: "maj7", beats: 4 }))).map(
    (m, i) => ({ ...m, chords: [createChordUnit({ root: `C${i}`, type: "maj7", beats: 4 })] }),
  );
}

function withMark(m: ChartMeasure, mark: Partial<ReturnType<typeof createRepeatMark>>): ChartMeasure {
  return { ...m, repeat: { ...createRepeatMark(), ...mark } };
}

/* ── Case 1：单一 repeat / playTimes ──────────────────── */

describe("单一反复", () => {
  it("repeat-start/end 播两遍", () => {
    const m = simpleMeasures(4);
    m[1].barlineStart = "repeat-start";
    m[2].barlineEnd = "repeat-end";
    // |0 |1: |2:| |3 → 0 1 2 1 2 3
    expect(seq(chartOf(m))).toEqual([0, 1, 2, 1, 2, 3]);
  });

  it("playTimes=3 播三遍", () => {
    const m = simpleMeasures(2);
    m[0].barlineStart = "repeat-start";
    m[1].barlineEnd = "repeat-end";
    m[1].repeat = { ...createRepeatMark(), playTimes: 3 };
    expect(seq(chartOf(m))).toEqual([0, 1, 0, 1, 0, 1]);
  });

  it("只有逆反复线（无 repeat-start）→ 从头反复", () => {
    const m = simpleMeasures(3);
    m[2].barlineEnd = "repeat-end";
    expect(seq(chartOf(m))).toEqual([0, 1, 2, 0, 1, 2]);
  });

  it("两段独立反复：第二段逆反复回到第一段之后", () => {
    const m = simpleMeasures(4);
    m[1].barlineEnd = "repeat-end"; // 段1：0-1 逆反复
    m[3].barlineEnd = "repeat-end"; // 段2：2-3 逆反复
    expect(seq(chartOf(m))).toEqual([0, 1, 0, 1, 2, 3, 2, 3]);
  });
});

/* ── Case 2：endings ──────────────────────────────────── */

describe("endings", () => {
  it("|1. |2. 两结尾", () => {
    const m = simpleMeasures(4);
    m[0].barlineStart = "repeat-start";
    m[1] = withMark(m[1], { ending: 1 });
    m[1].barlineEnd = "repeat-end";
    m[2] = withMark(m[2], { ending: 2 });
    // pass1: 0 1 → repeat → pass2: 0 2 3（ending 2 后接普通小节继续）
    expect(seq(chartOf(m))).toEqual([0, 1, 0, 2, 3]);
  });

  it("|1. |2. |3. 三结尾依次分配", () => {
    const m = simpleMeasures(4);
    m[0].barlineStart = "repeat-start";
    m[1] = withMark(m[1], { ending: 1 });
    m[1].barlineEnd = "repeat-end";
    m[2] = withMark(m[2], { ending: 2 });
    m[2].barlineEnd = "repeat-end";
    m[3] = withMark(m[3], { ending: 3 });
    // pass1: 0 1 → pass2: 0 2 → pass3: 0 3
    expect(seq(chartOf(m))).toEqual([0, 1, 0, 2, 0, 3]);
  });

  it("结尾数 < playTimes：第 2 遍起落在最后结尾，逆反复线随 ending 1 被跳过", () => {
    const m = simpleMeasures(4);
    m[0].barlineStart = "repeat-start";
    m[1] = withMark(m[1], { ending: 1 });
    m[1].barlineEnd = "repeat-end";
    m[1].repeat = { ...createRepeatMark(), ending: 1, playTimes: 3 };
    m[2] = withMark(m[2], { ending: 2 });
    // pass1: 0 1(e1)；pass2 起 e1 被跳过（含其逆反复线）→ 0 2 3
    expect(seq(chartOf(m))).toEqual([0, 1, 0, 2, 3]);
  });
});

/* ── Case 4/5/6：D.C. / D.S. ──────────────────────────── */

describe("D.C. 系列", () => {
  it("普通 D.C.：回曲首再播到尾", () => {
    const m = simpleMeasures(3);
    m[2] = withMark(m[2], { jump: "dc" });
    expect(seq(chartOf(m))).toEqual([0, 1, 2, 0, 1, 2]);
  });

  it("D.C. al Fine：跳回后停在 END（Fine）小节", () => {
    const m = simpleMeasures(4);
    m[1] = withMark(m[1], { end: true });
    m[3] = withMark(m[3], { jump: "dc-al-fine" });
    expect(seq(chartOf(m))).toEqual([0, 1, 2, 3, 0, 1]);
  });

  it("D.C. al Coda：两跳（回曲首 → 重到指令小节 → 跳 coda 小节）", () => {
    const m = simpleMeasures(5);
    m[3] = withMark(m[3], { jump: "dc-al-coda" }); // To Coda 点 = 指令小节
    m[4] = withMark(m[4], { coda: true }); // coda 段写在曲尾（iReal 惯例）
    // 首遍 0 1 2 →(在 3 执行 D.C.)→ 0 1 2 → 重到 3 跳 coda → 4
    expect(seq(chartOf(m))).toEqual([0, 1, 2, 3, 0, 1, 2, 4]);
  });
});

describe("D.S. 系列", () => {
  function segnoChart(jump: JumpCommand): ChordChart {
    const m = simpleMeasures(5);
    m[2] = withMark(m[2], { segno: true });
    m[4] = withMark(m[4], { jump });
    return chartOf(m);
  }

  it("D.S.：跳到 segno 再播到尾", () => {
    expect(seq(segnoChart("ds"))).toEqual([0, 1, 2, 3, 4, 2, 3, 4]);
  });

  it("D.S. al Coda 两跳：segno → 指令小节 → coda", () => {
    const m = simpleMeasures(6);
    m[1] = withMark(m[1], { segno: true });
    m[4] = withMark(m[4], { jump: "ds-al-coda" });
    m[5] = withMark(m[5], { coda: true }); // coda 段在曲尾
    // 首遍 0 1 2 3 4 →(在 4 执行 D.S.)→ 1 2 3 → 重到 4 跳 coda → 5
    expect(seq(chartOf(m))).toEqual([0, 1, 2, 3, 4, 1, 2, 3, 5]);
  });

  it("D.S. al 1st：跳回 segno 后重演 1st ending", () => {
    const m = simpleMeasures(5);
    m[1] = withMark(m[1], { segno: true });
    m[1].barlineStart = "repeat-start";
    m[2] = withMark(m[2], { ending: 1 });
    m[2].barlineEnd = "repeat-end";
    m[3] = withMark(m[3], { ending: 2 });
    m[4] = withMark(m[4], { jump: "ds-al-1st" });
    // p1: 0 1 2(e1) → repeat → p2: 1 3(e2) 4 → D.S.al1st → 1 2(e1) →
    // 反复次数耗尽 → e2 被跳过 → 4（D.S. 所在小节重播，与普通 D.S. 一致）
    expect(seq(chartOf(m))).toEqual([0, 1, 2, 1, 3, 4, 1, 2, 4]);
  });

  it("无 segno 的 D.S.：不崩、不死循环、记 warning", () => {
    const m = simpleMeasures(3);
    m[2] = withMark(m[2], { jump: "ds" });
    const result = compileTimeline(chartOf(m));
    expect(result.entries.map((e) => e.measureIndex)).toEqual([0, 1, 2]);
    expect(result.warnings.some((w) => w.includes("Segno"))).toBe(true);
  });

  it("无 Coda 记号的 al Coda：忽略第二跳、记 warning", () => {
    const m = simpleMeasures(3);
    m[2] = withMark(m[2], { jump: "dc-al-coda" });
    const result = compileTimeline(chartOf(m));
    expect(result.entries.map((e) => e.measureIndex)).toEqual([0, 1, 2, 0, 1, 2]);
    expect(result.warnings.some((w) => w.includes("Coda"))).toBe(true);
  });
});

/* ── Case 8：chorus × 内层 repeat ─────────────────────── */

describe("外层 chorus 与内层 repeat 组合", () => {
  it("repeats=2 时内层反复每个 chorus 独立执行", () => {
    const m = simpleMeasures(2);
    m[0].barlineStart = "repeat-start";
    m[1].barlineEnd = "repeat-end";
    expect(seq(chartOf(m, 2))).toEqual([0, 1, 0, 1, 0, 1, 0, 1]);
  });

  it("同 measureIndex 一对多：playIndex 单调递增", () => {
    const m = simpleMeasures(1);
    const result = compileTimeline(chartOf(m, 3));
    expect(result.entries.map((e) => e.playIndex)).toEqual([0, 1, 2]);
    expect(result.entries.every((e) => e.chorusIndex === e.playIndex)).toBe(true);
  });
});

/* ── Case 9：展开上限 ─────────────────────────────────── */

describe("展开上限", () => {
  it("病态谱面抛 ChartTooComplexError", () => {
    const m = simpleMeasures(1);
    m[0].barlineStart = "repeat-start";
    m[0].barlineEnd = "repeat-end";
    m[0].repeat = { ...createRepeatMark(), playTimes: 2 };
    const chart = chartOf(m, Math.ceil(MAX_TIMELINE_ENTRIES / 2) + 10);
    expect(() => compileTimeline(chart)).toThrow(ChartTooComplexError);
  });
});

/* ── Case 10：拍号拍位 ────────────────────────────────── */

describe("拍位与拍号", () => {
  it("逐小节拍号下 beats 累计正确", () => {
    const m = simpleMeasures(3);
    m[1].timeSignature = "T68"; // 6 拍
    m[2].timeSignature = "T54"; // 5 拍
    const result = compileTimeline(chartOf(m));
    expect(result.entries.map((e) => e.beats)).toEqual([4, 6, 5]);
    expect(result.entries[1].startBeat).toBe(4);
    expect(result.entries[2].startBeat).toBe(10);
    expect(result.totalBeats).toBe(15);
  });

  it("unit 级拍位：小节内多和弦（含 1.5 拍）", () => {
    const m = measureWithChord(
      {},
      createChordUnit({ root: "C", type: "maj7", beats: 1.5 }),
    );
    m.chords.push(createChordUnit({ root: "F", type: "7", beats: 2 }));
    m.chords.push(createChordUnit({ root: "B", type: "m7", beats: 0.5 as never }));
    const result = compileTimeline(chartOf([m]));
    const units = result.entries[0].chordUnits;
    expect(units[0]).toMatchObject({ startBeat: 0, beats: 1.5 });
    expect(units[1]).toMatchObject({ startBeat: 1.5, beats: 2 });
    expect(units[2]).toMatchObject({ startBeat: 3.5, beats: 0.5 });
  });

  it("拍定位与 seek 定位", () => {
    const m = simpleMeasures(3);
    const result = compileTimeline(chartOf(m));
    expect(findEntryIndexAtBeat(result.entries, 5)).toBe(1);
    expect(findEntryIndexAtBeat(result.entries, 0)).toBe(0);
    expect(findSeekEntryIndex(result.entries, 1, null)).toBe(1);
    expect(findSeekEntryIndex(result.entries, 0, 1)).toBe(-1);
  });
});
