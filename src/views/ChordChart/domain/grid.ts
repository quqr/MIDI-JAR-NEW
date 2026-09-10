/**
 * 和弦谱网格测量与布局纯函数。
 *
 * 本模块不依赖 Vue / DOM，可直接用 node 冒烟（符合项目「不写单测」的约定）。
 *
 * 核心概念（见 ADR 0022）：
 * - **cell** 是渲染层概念：一条 system 固定 `CELLS_PER_SYSTEM`（16）个 cell，等宽。
 * - **拍（beat）** 是音乐概念：4/4 下一拍 = 一个 cell。
 * - `ChordUnit.beats` 就是该和弦占用的 cell 数；和弦起始位置由前序 beats 累计推导，
 *   **单元自身不存绝对位置**（避免两套真相源）。
 * - 小节永不跨 system——由 `layoutSystems` 的贪心装箱保证。
 */

import {
  CELLS_PER_SYSTEM,
  HALF_BEATS_PER_BEAT,
  MAX_MEASURES,
} from "../constants";
import type {
  ChartIssue,
  ChartMeasure,
  ChordBeats,
  ChordChart,
  ChordUnit,
  TimeSignature,
} from "./types";

/* ── 拍号 ─────────────────────────────────────────────── */

/** 拍号 → 每小节拍数（iReal 记号：T44 = 4/4，T12 = 12/8） */
export function measureCells(ts: TimeSignature): number {
  switch (ts) {
    case "T44":
      return 4;
    case "T34":
      return 3;
    case "T24":
      return 2;
    case "T54":
      return 5;
    case "T64":
      return 6;
    case "T74":
      return 7;
    case "T22":
      return 2;
    case "T32":
      return 3;
    case "T58":
      return 5;
    case "T68":
      return 6;
    case "T78":
      return 7;
    case "T98":
      return 9;
    case "T12":
      return 12;
    default:
      return 4;
  }
}

/** 全部可用拍号（UI 选项顺序：常用在前） */
export const TIME_SIGNATURES: readonly TimeSignature[] = [
  "T44",
  "T34",
  "T24",
  "T54",
  "T64",
  "T74",
  "T22",
  "T32",
  "T58",
  "T68",
  "T78",
  "T98",
  "T12",
] as const;

/** 拍号 → 显示文本（"4/4"） */
export function formatTimeSignature(ts: TimeSignature): string {
  if (ts === "T12") return "12/8"; // 两位分子特例，否则会被拆成 "1/2"
  const body = ts.slice(1);
  return `${body[0]}/${body.slice(1)}`;
}

/**
 * 空档拍数 → 休止符种类（iReal 行为：和弦未占满的拍画休止）。
 *
 * - ≥4 拍（含整小节全空）：全休止符（记谱惯例 = 「整小节休止」，不限拍数）；
 * - 2–3 拍：二分休止符；
 * - 1 拍：四分休止符。
 */
export function restForCells(
  cells: number,
): "restWhole" | "restHalf" | "restQuarter" {
  if (cells >= 4) return "restWhole";
  if (cells >= 2) return "restHalf";
  return "restQuarter";
}

/**
 * 拍号的默认奇数拍分组。
 * iReal 约定：5 拍默认 3+2，7 拍默认 4+3；其余无分组。
 */
export function defaultGrouping(ts: TimeSignature): number[] | null {
  const cells = measureCells(ts);
  if (cells === 5) return [3, 2];
  if (cells === 7) return [4, 3];
  return null;
}

/**
 * 解析某小节实际生效的拍号（null = 继承前一小节）。
 * @param measures - 全部小节
 * @param index - 目标小节索引
 * @returns 生效的拍号；索引越界时回退 4/4
 */
export function resolveTimeSignature(
  measures: ChartMeasure[],
  index: number,
): TimeSignature {
  for (let i = Math.min(index, measures.length - 1); i >= 0; i -= 1) {
    const ts = measures[i]?.timeSignature;
    if (ts) return ts;
  }
  return "T44";
}

/** 解析某小节实际生效的奇数拍分组（null = 用拍号默认值） */
export function resolveGrouping(
  measures: ChartMeasure[],
  index: number,
): number[] | null {
  const explicit = measures[index]?.grouping;
  if (explicit) return explicit;
  return defaultGrouping(resolveTimeSignature(measures, index));
}

/* ── 时长与偏移 ───────────────────────────────────────── */

/**
 * 拍数 → 半拍整数（内部精度单位），规避 1.5 拍的浮点误差。
 * 1 拍 → 2、1.5 拍 → 3、4 拍 → 8。
 */
export function toHalfBeats(beats: ChordBeats): number {
  return Math.round(beats * HALF_BEATS_PER_BEAT);
}

/** 半拍整数 → 拍数 */
export function fromHalfBeats(halfBeats: number): number {
  return halfBeats / HALF_BEATS_PER_BEAT;
}

/** 和弦个数的上限（不能超过小节拍数，最短 1 拍） */
export function maxChordsPerMeasure(ts: TimeSignature): number {
  return measureCells(ts);
}

/**
 * 每个和弦的起始 cell 偏移（按前序 beats 累计）。
 * 第一个和弦恒从 0 开始（对应「空 cell 不推迟和弦」语义）。
 * @returns 与 `m.chords` 等长的偏移数组（单位：拍）
 */
export function chordOffsets(m: ChartMeasure): number[] {
  const offsets: number[] = [];
  let cursor = 0;
  for (const chord of m.chords) {
    offsets.push(cursor);
    cursor += chord.beats;
  }
  return offsets;
}

/** 小节实际占用的 cell 数（= beats 之和，可少于小节容量） */
export function usedCells(m: ChartMeasure): number {
  return m.chords.reduce((sum, c) => sum + c.beats, 0);
}

/**
 * 小节的渲染宽度（cell 数）。
 *
 * 取「实际占用」与「拍号容量」的较大者：
 * - 空小节仍占满一整小节宽度（视觉上是一小节，不是一个空位）；
 * - 超填时按实际占用撑开（校验层会同时报错）。
 */
export function renderCells(m: ChartMeasure, ts: TimeSignature): number {
  return Math.max(usedCells(m), measureCells(ts));
}

/** 累计半拍数（用于精确比较，避免浮点） */
export function usedHalfBeats(m: ChartMeasure): number {
  return m.chords.reduce((sum, c) => sum + toHalfBeats(c.beats), 0);
}

/* ── 归一化 ───────────────────────────────────────────── */

/** 把和弦时长夹到合法档位（1 / 1.5 / 2 / 3 / 4） */
export function clampBeats(value: number): ChordBeats {
  const allowed: ChordBeats[] = [1, 1.5, 2, 3, 4];
  let best: ChordBeats = allowed[0];
  let bestDelta = Infinity;
  for (const candidate of allowed) {
    const delta = Math.abs(candidate - value);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = candidate;
    }
  }
  return best;
}

/**
 * 归一化单个和弦：
 * - 1. 把时长夹到合法档位；
 * - 2. 隐藏根音但无低音时，去掉无意义的 invisibleRoot；
 * - 3. alternate 深度裁剪为 1（其自身 alternate 恒置 null）。
 */
export function normalizeChordUnit(chord: ChordUnit): ChordUnit {
  const beats = clampBeats(chord.beats);
  const hasBass = typeof chord.bass === "string" && chord.bass.length > 0;
  const invisibleRoot = chord.invisibleRoot && hasBass;
  let alternate = chord.alternate;
  if (alternate) {
    alternate = {
      ...normalizeChordUnit(alternate),
      alternate: null,
      beats,
    };
  }
  return { ...chord, beats, invisibleRoot, alternate };
}

/**
 * 归一化一个小节：
 * - 1. 规范化每个和弦；
 * - 2. N.C. 与 invisibleRoot 互斥（N.C. 时清空根音与低音）；
 * - 3. 裁掉超出小节容量的尾部和弦（iReal：「写多了最后几个被丢弃」）。
 */
export function normalizeMeasure(
  m: ChartMeasure,
  ts: TimeSignature = "T44",
): ChartMeasure {
  const capacity = measureCells(ts);
  const normalized: ChordUnit[] = [];
  let used = 0;

  for (const raw of m.chords) {
    const chord = normalizeChordUnit(raw);
    if (used + chord.beats > capacity) break; // 丢弃超出容量的尾部（iReal 语义）
    if (chord.noChord) {
      // N.C.：清掉根音/低音，保持独占语义
      normalized.push({
        ...chord,
        root: "",
        bass: null,
        invisibleRoot: false,
      });
    } else {
      normalized.push(chord);
    }
    used += chord.beats;
  }

  return { ...m, chords: normalized };
}

/* ── system 布局 ──────────────────────────────────────── */

/**
 * 把小节按 system 切分（贪心装箱）。
 *
 * 目标：**小节永不跨行**（iReal「跨行小节」是无法播放的头号原因）。
 * 代价：每行尾部可能留空——这是可接受的，因为 cell 宽度是纯外观。
 *
 * @returns 每行包含的小节索引数组
 */
export function layoutSystems(
  measures: ChartMeasure[],
  cellsPerSystem = CELLS_PER_SYSTEM,
): number[][] {
  const systems: number[][] = [];
  let current: number[] = [];
  let used = 0;

  for (let i = 0; i < measures.length; i += 1) {
    const ts = resolveTimeSignature(measures, i);
    const width = renderCells(measures[i], ts);

    // 单个小节就超过一行容量：独占一行（避免死循环 / 空行）
    if (width > cellsPerSystem) {
      if (current.length > 0) {
        systems.push(current);
        current = [];
        used = 0;
      }
      systems.push([i]);
      continue;
    }

    if (used + width > cellsPerSystem && current.length > 0) {
      systems.push(current);
      current = [];
      used = 0;
    }

    current.push(i);
    used += width;
  }

  if (current.length > 0) systems.push(current);
  if (systems.length === 0) systems.push([]);
  return systems;
}

/** 小节索引 → system 索引的反查（供键盘上下移动） */
export function measureToSystemIndex(
  measures: ChartMeasure[],
  measureIndex: number,
  cellsPerSystem = CELLS_PER_SYSTEM,
): number {
  const systems = layoutSystems(measures, cellsPerSystem);
  for (let s = 0; s < systems.length; s += 1) {
    if (systems[s].includes(measureIndex)) return s;
  }
  return 0;
}

/* ── 校验 ─────────────────────────────────────────────── */

/**
 * 校验曲目的可播放性 / 数据健康度。
 *
 * 约定：**不阻塞输入**——编辑器允许临时非法状态，由本函数产出问题列表供 UI 标红。
 */
export function validateChart(chart: ChordChart): ChartIssue[] {
  const issues: ChartIssue[] = [];
  const { measures } = chart;

  if (measures.length === 0) {
    issues.push({
      level: "error",
      measureIndex: -1,
      messageKey: "chordChart.issue.emptyChart",
    });
    return issues;
  }

  if (measures.length > MAX_MEASURES) {
    issues.push({
      level: "warning",
      measureIndex: -1,
      messageKey: "chordChart.issue.tooManyMeasures",
    });
  }

  for (let i = 0; i < measures.length; i += 1) {
    const m = measures[i];
    const ts = resolveTimeSignature(measures, i);
    const capacity = measureCells(ts);
    const used = usedCells(m);

    // 超填：和弦时长之和超过小节容量
    if (used > capacity) {
      issues.push({
        level: "error",
        measureIndex: i,
        messageKey: "chordChart.issue.tooManyBeats",
      });
    }

    // 和弦数超过拍数（iReal：一小节不能播超过拍数的和弦）
    if (m.chords.length > capacity) {
      issues.push({
        level: "error",
        measureIndex: i,
        messageKey: "chordChart.issue.tooManyChords",
      });
    }

    // 空小节：iReal 语义下会被跳过，属警告而非错误
    if (m.chords.length === 0) {
      issues.push({
        level: "warning",
        measureIndex: i,
        messageKey: "chordChart.issue.emptyMeasure",
      });
    }

    // 首小节必须有可见和弦才能起播（iReal 明确报此错）
    if (i === 0 && (m.chords.length === 0 || m.chords[0].noChord)) {
      issues.push({
        level: "error",
        measureIndex: 0,
        messageKey: "chordChart.issue.firstMeasureNeedsChord",
      });
    }

    // 单小节独占一行 = 跨行风险提示（渲染层仍能画，但语义上异常）
    if (renderCells(m, ts) > CELLS_PER_SYSTEM) {
      issues.push({
        level: "warning",
        measureIndex: i,
        messageKey: "chordChart.issue.measureTooWide",
      });
    }

    // 反复段收尾在空小节上（iReal 明确报此错）
    if (m.barlineEnd === "repeat-end" && m.chords.length === 0) {
      issues.push({
        level: "error",
        measureIndex: i,
        messageKey: "chordChart.issue.repeatEndsOnEmptyMeasure",
      });
    }
  }

  return issues;
}

/** 曲目是否可播放（无 error 级问题） */
export function isChartPlayable(chart: ChordChart): boolean {
  return !validateChart(chart).some((issue) => issue.level === "error");
}

/** 按小节索引取出该小节的问题列表 */
export function issuesByMeasure(
  issues: ChartIssue[],
): Map<number, ChartIssue[]> {
  const map = new Map<number, ChartIssue[]>();
  for (const issue of issues) {
    const list = map.get(issue.measureIndex) ?? [];
    list.push(issue);
    map.set(issue.measureIndex, list);
  }
  return map;
}
