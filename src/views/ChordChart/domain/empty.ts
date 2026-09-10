/**
 * 空白曲目工厂与和弦单元工厂。
 *
 * 所有「新建」路径的唯一入口，保证默认值集中。
 */

import {
  CHART_FORMAT_VERSION,
  DEFAULT_TEMPO,
  MAX_MEASURES,
} from "../constants";
import type {
  ChartKey,
  ChartMeasure,
  ChordBeats,
  ChordSize,
  ChordUnit,
  ChordChart,
  ChartMeta,
  RepeatMark,
  StoredChart,
} from "./types";
/** 默认调号：C 大调（与项目 notation.key 默认值一致） */
export const DEFAULT_CHART_KEY: ChartKey = { tonic: "C", mode: "major" };

/** 创建一个小节（默认 4/4、无和弦、无标记） */
export function createMeasure(): ChartMeasure {
  return {
    timeSignature: null,
    grouping: null,
    chords: [],
    barlineStart: "single",
    repeat: null,
    barlineEnd: "single",
  };
}

/**
 * 创建一个和弦单元。
 * @param partial - 需要覆盖的字段
 */
export function createChordUnit(partial: Partial<ChordUnit> = {}): ChordUnit {
  return {
    root: "",
    type: "",
    bass: null,
    beats: 4,
    alternate: null,
    noChord: false,
    invisibleRoot: false,
    size: "normal",
    ...partial,
  };
}

/** 创建一个空的反复标记对象（供 UI 逐项 toggle） */
export function createRepeatMark(): RepeatMark {
  return {
    ending: null,
    segno: false,
    coda: false,
    fermata: false,
    jump: null,
    playTimes: null,
    end: false,
  };
}

/** 默认曲目元信息 */
export function createChartMeta(partial: Partial<ChartMeta> = {}): ChartMeta {
  return {
    title: "",
    composer: "",
    style: "",
    key: { ...DEFAULT_CHART_KEY },
    tempo: DEFAULT_TEMPO,
    repeats: 1,
    notation: "symbol",
    ...partial,
  };
}

/**
 * 创建一张空白曲目。
 * @param measureCount - 初始小节数（默认 16，即 4 条 system）
 */
export function createEmptyChart(measureCount = 16): ChordChart {
  const count = Math.max(1, Math.min(measureCount, MAX_MEASURES));
  return {
    meta: createChartMeta(),
    measures: Array.from({ length: count }, () => createMeasure()),
    sections: [],
    texts: [],
    systemSpacing: {},
  };
}

/** 把曲目包封为带版本号的持久化结构 */
export function toStoredChart(chart: ChordChart): StoredChart {
  return {
    version: CHART_FORMAT_VERSION,
    chart,
  };
}

/**
 * 校验并解包持久化结构。
 *
 * 首期只有 version 1，不做迁移；但保留版本分支以冻结格式语义。
 * @returns 合法曲目对象；结构不合法时返回 null
 */
export function fromStoredChart(stored: unknown): ChordChart | null {
  if (!stored || typeof stored !== "object") return null;

  const candidate = stored as Partial<StoredChart>;
  if (typeof candidate.version !== "number") return null;
  if (!candidate.chart || typeof candidate.chart !== "object") return null;

  // version 1：直接采用；未来版本在此加迁移分支。
  if (candidate.version > CHART_FORMAT_VERSION) return null;

  return normalizeLoadedChart(candidate.chart as ChordChart);
}

/**
 * 把外部载入的曲目补全到当前类型契约（容忍旧数据缺字段）。
 * 只做结构补全，不做音乐语义修正（那是 validate 的职责）。
 */
export function normalizeLoadedChart(raw: Partial<ChordChart>): ChordChart {
  const measures = Array.isArray(raw.measures) ? raw.measures : [];
  return {
    meta: createChartMeta(raw.meta ?? {}),
    measures:
      measures.length > 0
        ? measures.map((m) => ({
            timeSignature: m?.timeSignature ?? null,
            grouping: m?.grouping ?? null,
            chords: Array.isArray(m?.chords)
              ? m.chords.map((c) => createChordUnit(c))
              : [],
            barlineStart: m?.barlineStart ?? "single",
            repeat: m?.repeat ?? null,
            barlineEnd: m?.barlineEnd ?? "single",
          }))
        : [createMeasure()],
    sections: Array.isArray(raw.sections) ? raw.sections : [],
    texts: Array.isArray(raw.texts) ? raw.texts : [],
    systemSpacing:
      raw.systemSpacing && typeof raw.systemSpacing === "object"
        ? raw.systemSpacing
        : {},
  };
}

/** 和弦时长选项（供 UI 直接消费） */
export const CHORD_BEATS_VALUES: readonly ChordBeats[] = [
  1, 1.5, 2, 3, 4,
] as const;

/** 和弦尺寸选项 */
export const CHORD_SIZE_VALUES: readonly ChordSize[] = [
  "normal",
  "small",
] as const;
