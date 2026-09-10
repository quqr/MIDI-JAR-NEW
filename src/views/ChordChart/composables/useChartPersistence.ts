/**
 * 曲库持久化。
 *
 * 存储布局（首期纯 Web / localStorage，见 ADR 0022 §持久化）：
 * - **索引**：`LIBRARY_STORAGE_KEY` → `{ version, entries: ChartLibraryEntry[] }`
 *   只存轻量元数据（id / 曲名 / 作曲 / 更新时间），供曲库列表快速渲染。
 * - **单曲**：`CHART_STORAGE_PREFIX + id` → `StoredChart`
 *   完整曲目对象。拆成两个键是为了让列表页不必反序列化全部曲目。
 *
 * 本模块是**唯一**读写这两个键的地方；Store 不直接碰 localStorage。
 */

import {
  CHART_STORAGE_PREFIX,
  CHART_FORMAT_VERSION,
  LIBRARY_STORAGE_KEY,
} from "../constants";
import {
  fromStoredChart,
  toStoredChart,
  createEmptyChart,
} from "../domain/empty";
import {
  loadFromStorage,
  removeFromStorage,
  saveToStorage,
} from "@/helpers/storage";
import { createLogger } from "@/utils/logger";

import type { ChartLibraryEntry, ChordChart } from "../domain/types";

const logger = createLogger("ChordChartStorage");

/** 曲库索引的持久化包封 */
interface StoredLibrary {
  version: number;
  entries: ChartLibraryEntry[];
}

/** 生成曲目 id（时间戳 + 随机后缀，确保同毫秒多次新建不冲突） */
export function createChartId(): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `c${time}${rand}`;
}

/** 单曲存储键 */
function chartKey(id: string): string {
  return `${CHART_STORAGE_PREFIX}${id}`;
}

/* ── 索引 ─────────────────────────────────────────────── */

/** 读取曲库索引；损坏或缺失时返回空数组 */
export function loadLibraryIndex(): ChartLibraryEntry[] {
  const stored = loadFromStorage<Partial<StoredLibrary>>({
    key: LIBRARY_STORAGE_KEY,
    defaultValue: {},
  });
  const entries = stored?.entries;
  if (!Array.isArray(entries)) return [];
  // 逐条结构校验：脏数据直接丢弃，不让它污染列表
  return entries.filter(
    (e): e is ChartLibraryEntry =>
      !!e &&
      typeof e.id === "string" &&
      typeof e.title === "string" &&
      typeof e.composer === "string" &&
      typeof e.updatedAt === "number",
  );
}

/** 写入曲库索引 */
export function saveLibraryIndex(entries: ChartLibraryEntry[]): void {
  saveToStorage<StoredLibrary>(LIBRARY_STORAGE_KEY, {
    version: CHART_FORMAT_VERSION,
    entries,
  });
}

/* ── 单曲 ─────────────────────────────────────────────── */

/** 读取单曲；不存在或结构非法时返回 null */
export function loadChart(id: string): ChordChart | null {
  const raw = loadFromStorage<unknown>({
    key: chartKey(id),
    defaultValue: null,
  });
  const chart = fromStoredChart(raw);
  if (!chart) {
    logger.warn(`Failed to load chart (id: ${id})`);
  }
  return chart;
}

/** 写入单曲 */
export function saveChart(id: string, chart: ChordChart): void {
  saveToStorage(chartKey(id), toStoredChart(chart));
}

/** 删除单曲 */
export function deleteChart(id: string): void {
  removeFromStorage(chartKey(id));
}

/* ── 复合操作 ─────────────────────────────────────────── */

/**
 * 新建曲目并写入存储。
 * @param title - 曲名（空则留给调用方后续补；存储层不生成占位文案，避免 i18n 泄漏）
 * @returns 新曲目 id
 */
export function createChart(title = ""): string {
  const id = createChartId();
  const chart = createEmptyChart(16);
  chart.meta.title = title;
  saveChart(id, chart);
  upsertLibraryEntry(id, chart);
  return id;
}

/**
 * 新增或更新索引条目。
 *
 * 语义：**总是**把该条目挪到最前（最近更新优先），不是原地替换。
 * 原地替换会让刚编辑过的旧曲目沉在列表底部，与「按 updatedAt 倒序」的
 * 展示约定自相矛盾。
 */
export function upsertLibraryEntry(id: string, chart: ChordChart): void {
  const rest = loadLibraryIndex().filter((e) => e.id !== id);
  const entry: ChartLibraryEntry = {
    id,
    title: chart.meta.title,
    composer: chart.meta.composer,
    updatedAt: Date.now(),
  };
  saveLibraryIndex([entry, ...rest]);
}

/** 删除曲目（同时清索引） */
export function removeChart(id: string): void {
  deleteChart(id);
  saveLibraryIndex(loadLibraryIndex().filter((e) => e.id !== id));
}

/** 从已有曲目派生副本（iReal 的 Duplicate） */
export function duplicateChart(id: string): string | null {
  const source = loadChart(id);
  if (!source) return null;

  const newId = createChartId();
  const copy: ChordChart = structuredClone(source);
  copy.meta = { ...copy.meta, title: `${copy.meta.title} copy` };
  saveChart(newId, copy);
  upsertLibraryEntry(newId, copy);
  return newId;
}

/* ── 导出 / 导入（.mjchart 文本） ─────────────────────── */

/** 序列化为可下载的文本 */
export function serializeChart(chart: ChordChart): string {
  return JSON.stringify(toStoredChart(chart), null, 2);
}

/** 从文本反序列化；非法时返回 null */
export function deserializeChart(text: string): ChordChart | null {
  try {
    return fromStoredChart(JSON.parse(text));
  } catch {
    return null;
  }
}
