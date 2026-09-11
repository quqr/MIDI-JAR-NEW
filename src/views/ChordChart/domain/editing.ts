/**
 * 编辑操作纯函数（和弦级增删改）。
 *
 * 全部为**不可变**变换：接收数组/对象，返回新数组/新对象，绝不原地修改。
 * 这样 store 的快照撤销才能与「上一次快照」正确对比，也便于将来接 command pattern。
 *
 * 本文件不依赖 Vue / Pinia，可被 store、导入流程、批处理脚本共用。
 */

import { clampBeats, normalizeChordUnit } from "./grid";
import { createChordUnit, createMeasure } from "./empty";
import { transposeChordUnit, transposeNoteName } from "./chordText";

import type { AccidentalPreference } from "@/views/CircleOfFifths/circleOfFifths";
import type {
  ChartMeasure,
  ChordBeats,
  ChordUnit,
  ChordChart,
  CursorPos,
  Selection,
} from "./types";

/* ── 小节级变换 ───────────────────────────────────────── */

/**
 * 对指定小节应用变换，返回新的小节数组。
 * 索引越界时原样返回（不抛错——UI 竞态下越界是常态，静默忽略比崩溃好）。
 */
export function applyMeasureEdit(
  measures: ChartMeasure[],
  index: number,
  fn: (measure: ChartMeasure) => ChartMeasure,
): ChartMeasure[] {
  if (index < 0 || index >= measures.length) return measures;
  return measures.map((m, i) => (i === index ? fn(m) : m));
}

/* ── 和弦数组变换 ─────────────────────────────────────── */

/** 在指定位置插入和弦（clamp 到 [0, length]） */
export function insertChord(
  chords: ChordUnit[],
  index: number,
  unit: ChordUnit,
): ChordUnit[] {
  const at = Math.max(0, Math.min(index, chords.length));
  const next = [...chords];
  next.splice(at, 0, normalizeChordUnit(unit));
  return next;
}

/** 删除指定位置的和弦（越界原样返回） */
export function removeChord(chords: ChordUnit[], index: number): ChordUnit[] {
  if (index < 0 || index >= chords.length) return chords;
  return chords.filter((_, i) => i !== index);
}

/** 替换指定位置的和弦（越界原样返回） */
export function replaceChord(
  chords: ChordUnit[],
  index: number,
  unit: ChordUnit,
): ChordUnit[] {
  if (index < 0 || index >= chords.length) return chords;
  return chords.map((c, i) => (i === index ? normalizeChordUnit(unit) : c));
}

/** 设置和弦时长 */
export function setChordBeats(chord: ChordUnit, beats: ChordBeats): ChordUnit {
  return { ...chord, beats: clampBeats(beats) };
}

/** 切换和弦显示尺寸 */
export function toggleChordSize(chord: ChordUnit): ChordUnit {
  return { ...chord, size: chord.size === "normal" ? "small" : "normal" };
}

/** 设置和弦的 alternate（深度限 1：被设为 alternate 的单元自身清空 alternate） */
export function setAlternate(
  chord: ChordUnit,
  alternate: ChordUnit | null,
): ChordUnit {
  if (!alternate) return { ...chord, alternate: null };
  const cleaned = createChordUnit(alternate);
  cleaned.alternate = null;
  return { ...chord, alternate: cleaned };
}

/* ── 光标与选区 ───────────────────────────────────────── */

/** 把光标夹到当前曲目的有效范围内 */
export function clampCursor(chart: ChordChart, pos: CursorPos): CursorPos {
  const measureIndex = Math.max(
    0,
    Math.min(pos.measureIndex, chart.measures.length - 1),
  );
  const measure = chart.measures[measureIndex];
  const chordCount = measure?.chords.length ?? 0;

  let chordIndex: number | null = pos.chordIndex;
  if (chordIndex !== null) {
    chordIndex =
      chordCount === 0
        ? null
        : Math.max(0, Math.min(chordIndex, chordCount - 1));
  }
  return { measureIndex, chordIndex };
}

/**
 * 光标右移一格。
 *
 * 语义（对齐 iReal 键盘导航）：小节内右移越过最后一个和弦 → 进入下一小节的
 * 第一个和弦；在最后一个小节末尾 → 停在原地（不循环，避免误触跳回开头）。
 * 小节级光标（chordIndex === null）右移 → 进入该小节第一个和弦。
 */
export function cursorRight(chart: ChordChart, pos: CursorPos): CursorPos {
  const measure = chart.measures[pos.measureIndex];
  const count = measure?.chords.length ?? 0;

  if (pos.chordIndex === null) {
    return count > 0 ? { ...pos, chordIndex: 0 } : pos;
  }
  if (pos.chordIndex + 1 < count) {
    return { ...pos, chordIndex: pos.chordIndex + 1 };
  }
  if (pos.measureIndex + 1 < chart.measures.length) {
    const nextMeasure = chart.measures[pos.measureIndex + 1];
    return {
      measureIndex: pos.measureIndex + 1,
      chordIndex: (nextMeasure?.chords.length ?? 0) > 0 ? 0 : null,
    };
  }
  return pos;
}

/** 光标左移一格（右移的镜像；开头处停住） */
export function cursorLeft(chart: ChordChart, pos: CursorPos): CursorPos {
  if (pos.chordIndex === null) {
    if (pos.measureIndex === 0) return pos;
    const prev = chart.measures[pos.measureIndex - 1];
    const count = prev?.chords.length ?? 0;
    return {
      measureIndex: pos.measureIndex - 1,
      chordIndex: count > 0 ? count - 1 : null,
    };
  }
  if (pos.chordIndex > 0) {
    return { ...pos, chordIndex: pos.chordIndex - 1 };
  }
  if (pos.measureIndex > 0) {
    const prev = chart.measures[pos.measureIndex - 1];
    const count = prev?.chords.length ?? 0;
    return {
      measureIndex: pos.measureIndex - 1,
      chordIndex: count > 0 ? count - 1 : null,
    };
  }
  return { ...pos, chordIndex: null };
}

/** 光标下移一个小节（保持小节内和弦序号，越界则夹紧） */
export function cursorDown(chart: ChordChart, pos: CursorPos): CursorPos {
  return clampCursor(chart, { ...pos, measureIndex: pos.measureIndex + 1 });
}

/** 光标上移一个小节 */
export function cursorUp(chart: ChordChart, pos: CursorPos): CursorPos {
  return clampCursor(chart, { ...pos, measureIndex: pos.measureIndex - 1 });
}

/**
 * 按 system 布局把光标左右移到「相邻 system 的同位置小节」。
 *
 * 传入 `systems` 而非在内部算，是为了让调用方复用 store 里已 memo 的分页结果。
 */
export function cursorToAdjacentSystem(
  systems: number[][],
  pos: CursorPos,
  dir: 1 | -1,
): CursorPos {
  const sysIndex = systems.findIndex((s) => s.includes(pos.measureIndex));
  if (sysIndex < 0) return pos;

  const targetSys = systems[sysIndex + dir];
  if (!targetSys) return pos;

  const slot = systems[sysIndex].indexOf(pos.measureIndex);
  const target = targetSys[Math.min(slot, targetSys.length - 1)];
  return { measureIndex: target, chordIndex: pos.chordIndex };
}

/** 选区规范化：返回 [start, end] 且保证 start <= end（按书写顺序比较） */
export function normalizeSelection(sel: Selection): [CursorPos, CursorPos] {
  const a = sel.anchor;
  const b = sel.focus;
  const aKey = [a.measureIndex, a.chordIndex ?? -1] as const;
  const bKey = [b.measureIndex, b.chordIndex ?? -1] as const;
  const before =
    aKey[0] < bKey[0] || (aKey[0] === bKey[0] && aKey[1] <= bKey[1]);
  return before ? [a, b] : [b, a];
}

/** 判断某个和弦是否落在选区内（含端点） */
export function isChordInSelection(
  sel: Selection | null,
  measureIndex: number,
  chordIndex: number,
): boolean {
  if (!sel) return false;
  const [start, end] = normalizeSelection(sel);
  const s = [start.measureIndex, start.chordIndex ?? -1] as const;
  const e = [end.measureIndex, end.chordIndex ?? -1] as const;
  const t = [measureIndex, chordIndex] as const;
  const afterStart = t[0] > s[0] || (t[0] === s[0] && t[1] >= s[1]);
  const beforeEnd = t[0] < e[0] || (t[0] === e[0] && t[1] <= e[1]);
  return afterStart && beforeEnd;
}

/* ── 结构性操作 ───────────────────────────────────────── */

/** 末尾追加小节（继承最后一小节的拍号与分组） */
export function appendMeasure(measures: ChartMeasure[]): ChartMeasure[] {
  const last = measures[measures.length - 1];
  const next = createMeasure();
  if (last) {
    next.timeSignature = last.timeSignature;
    next.grouping = last.grouping;
  }
  return [...measures, next];
}

/** 在指定位置插入小节（复制前一小节的拍号，避免中途换拍号造成的意外） */
export function insertMeasureAt(
  measures: ChartMeasure[],
  index: number,
): ChartMeasure[] {
  const at = Math.max(0, Math.min(index, measures.length));
  const prev = measures[at - 1];
  const next = createMeasure();
  if (prev) {
    next.timeSignature = prev.timeSignature;
    next.grouping = prev.grouping;
  }
  const result = [...measures];
  result.splice(at, 0, next);
  return result;
}

/** 删除指定小节（至少保留 1 个） */
export function removeMeasureAt(
  measures: ChartMeasure[],
  index: number,
): ChartMeasure[] {
  if (measures.length <= 1) return measures;
  if (index < 0 || index >= measures.length) return measures;
  return measures.filter((_, i) => i !== index);
}

/** 删除选区内的小节（至少保留 1 个） */
export function removeMeasuresInRange(
  measures: ChartMeasure[],
  from: number,
  to: number,
): ChartMeasure[] {
  const lo = Math.max(0, Math.min(from, to));
  const hi = Math.min(measures.length - 1, Math.max(from, to));
  const kept = measures.filter((_, i) => i < lo || i > hi);
  return kept.length > 0 ? kept : [createMeasure()];
}

/* ── 锚点索引维护（段落记号 / 谱面文字挂在小节索引上） ─── */

/**
 * 小节插入后重排锚点：插入位及之后的小节索引整体 +1。
 * （新小节占据 `at`，原 `at` 及以后的内容顺延）
 */
export function reindexAnchorsAfterInsert<T extends { measureIndex: number }>(
  items: T[],
  at: number,
): T[] {
  return items.map((it) =>
    it.measureIndex >= at ? { ...it, measureIndex: it.measureIndex + 1 } : it,
  );
}

/**
 * 小节删除后重排锚点：删掉挂在被删小节上的锚点，其后的小节索引整体 -1。
 */
export function reindexAnchorsAfterRemove<T extends { measureIndex: number }>(
  items: T[],
  at: number,
): T[] {
  return items
    .filter((it) => it.measureIndex !== at)
    .map((it) =>
      it.measureIndex > at ? { ...it, measureIndex: it.measureIndex - 1 } : it,
    );
}

/* ── 整曲移调 ─────────────────────────────────────────── */

/**
 * 整曲移调：所有和弦（含上方小和弦）的根音 / 低音平移，调号主音同步改写，
 * **不改和弦性质**（iReal 的 soft transposition 语义）。
 *
 * 段落记号 / 谱面文字 / 小节结构与音乐无关，原样保留。
 * 拼写偏好复用 `settings.notation.accidentals`，由调用方传入。
 */
export function transposeChart(
  chart: ChordChart,
  semitones: number,
  preference: AccidentalPreference,
): ChordChart {
  if (semitones === 0) return chart;
  const tonic = transposeNoteName(chart.meta.key.tonic, semitones, preference);
  return {
    ...chart,
    meta: {
      ...chart.meta,
      key: { ...chart.meta.key, tonic: tonic || chart.meta.key.tonic },
    },
    measures: chart.measures.map((m) => ({
      ...m,
      chords: m.chords.map((c) => transposeChordUnit(c, semitones, preference)),
    })),
  };
}
