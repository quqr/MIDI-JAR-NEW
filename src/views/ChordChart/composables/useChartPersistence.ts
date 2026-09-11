/**
 * 曲库持久化（Tauri 文件系统 + 内存缓存，见计划 Phase 0）。
 *
 * 存储布局（appData/charts/）：
 * - **索引**：`index.json` → `StoredLibrary`（version + 轻量条目，列表页快速渲染）
 * - **单曲**：`<id>.json` → `StoredChart`（完整曲目，带版本号）
 *
 * 架构：
 * - **同步 API + 内存缓存**：store 的同步调用面不变；本模块启动时异步水合缓存，
 *   写操作更新缓存并入队，由串行 flusher 落盘。
 * - **迁移 gate（P1）**：水合（含 localStorage → 文件迁移）完成前，落盘队列不 flush——
 *   缓存可写（内存安全），但绝不与迁移交错写文件。
 * - **原子写（P1）**：先写 `<file>.tmp` 再 rename 覆盖，崩溃时不会留半个 JSON。
 * - **Web 回退**：非 Tauri 环境（纯浏览器 dev）自动回退旧 localStorage 路径。
 *
 * 本模块是**唯一**读写曲库文件/localStorage 旧键的地方；Store 不直接碰存储。
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

/* ── Tauri fs 访问层 ──────────────────────────────────── */

const CHARTS_DIR = "charts";

/** 是否运行在 Tauri 桌面环境（否则回退 localStorage） */
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** 动态加载 plugin-fs（非 Tauri 环境返回 null） */
async function fsPlugin(): Promise<typeof import("@tauri-apps/plugin-fs") | null> {
  if (!isTauri()) return null;
  try {
    return await import("@tauri-apps/plugin-fs");
  } catch (err) {
    logger.warn("[ChordChartStorage] plugin-fs unavailable: %s", err);
    return null;
  }
}

/** 原子写 JSON：mkdir(递归) → 写 .tmp → rename 覆盖 */
async function atomicWriteJson(fs: typeof import("@tauri-apps/plugin-fs"), file: string, data: unknown): Promise<void> {
  await fs.mkdir(CHARTS_DIR, { baseDir: fs.BaseDirectory.AppData, recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeTextFile(tmp, JSON.stringify(data), { baseDir: fs.BaseDirectory.AppData });
  await fs.rename(tmp, file, {
    oldPathBaseDir: fs.BaseDirectory.AppData,
    newPathBaseDir: fs.BaseDirectory.AppData,
  });
}

/* ── 缓存与落盘队列 ───────────────────────────────────── */

interface PendingOp {
  kind: "index" | "chart" | "delete";
  id?: string;
}

/** 内存缓存（水合后与文件一致；写操作即时生效） */
const cache = new Map<string, ChordChart>();
let libraryEntries: ChartLibraryEntry[] = [];

/** 落盘队列（串行 flush，去重：同 id 只保留最新 op） */
const pendingQueue = new Map<string, PendingOp>();
let hydrated = false;
let hydrating: Promise<void> | null = null;
let flushChain: Promise<void> = Promise.resolve();

function enqueue(op: PendingOp): void {
  if (!isTauri()) return; // Web 回退：缓存即 localStorage 同步写（见下方 fallback）
  const key = op.kind === "index" ? "index" : `chart:${op.id}`;
  pendingQueue.set(key, op);
  void flushChain.then(() => flushOne());
}

async function flushOne(): Promise<void> {
  // 迁移 gate：水合完成前不落盘
  if (!hydrated) return;
  const fs = await fsPlugin();
  if (!fs) return;
  // 队列可能因随后写操作继续增长；每次取快照批量落盘
  while (pendingQueue.size > 0) {
    const ops = [...pendingQueue.values()];
    pendingQueue.clear();
    for (const op of ops) {
      try {
        if (op.kind === "index") {
          await atomicWriteJson(fs, `${CHARTS_DIR}/index.json`, {
            version: CHART_FORMAT_VERSION,
            entries: libraryEntries,
          });
        } else if (op.kind === "chart" && op.id) {
          const chart = cache.get(op.id);
          if (chart) {
            await atomicWriteJson(fs, `${CHARTS_DIR}/${op.id}.json`, toStoredChart(chart));
          }
        } else if (op.kind === "delete" && op.id) {
          try {
            await fs.remove(`${CHARTS_DIR}/${op.id}.json`, { baseDir: fs.BaseDirectory.AppData });
          } catch {
            // 文件不存在等：忽略
          }
        }
      } catch (err) {
        logger.error("[ChordChartStorage] flush failed (%s %s): %s", op.kind, op.id ?? "", err);
      }
    }
  }
}

/* ── localStorage 旧键（迁移源 / Web 回退） ───────────── */

/** 单曲存储键（旧布局） */
function chartKey(id: string): string {
  return `${CHART_STORAGE_PREFIX}${id}`;
}

function readLocalIndex(): ChartLibraryEntry[] {
  const stored = loadFromStorage<Partial<StoredLibrary>>({
    key: LIBRARY_STORAGE_KEY,
    defaultValue: {},
  });
  const entries = stored?.entries;
  if (!Array.isArray(entries)) return [];
  return entries.filter(
    (e): e is ChartLibraryEntry =>
      !!e &&
      typeof e.id === "string" &&
      typeof e.title === "string" &&
      typeof e.composer === "string" &&
      typeof e.updatedAt === "number",
  );
}

/* ── 水合 + 迁移 ─────────────────────────────────────── */

/**
 * 初始化曲库存储（App / 视图启动时 await 一次；幂等）。
 * - Tauri：读文件 → 缓存；文件为空而 localStorage 有旧数据时执行迁移（写入文件）。
 * - Web：读 localStorage → 缓存。
 */
export async function initChartLibrary(): Promise<void> {
  if (hydrated) return;
  if (hydrating) return hydrating;
  hydrating = (async () => {
    const fs = await fsPlugin();
    if (!fs) {
      // Web 回退：直接用 localStorage（语义与旧实现一致）
      libraryEntries = readLocalIndex();
      for (const e of libraryEntries) {
        const raw = loadFromStorage<unknown>({ key: chartKey(e.id), defaultValue: null });
        const chart = fromStoredChart(raw);
        if (chart) cache.set(e.id, chart);
      }
      hydrated = true;
      return;
    }

    // 读索引
    let fileIndex: ChartLibraryEntry[] = [];
    try {
      const text = await fs.readTextFile(`${CHARTS_DIR}/index.json`, {
        baseDir: fs.BaseDirectory.AppData,
      });
      const parsed = JSON.parse(text) as Partial<StoredLibrary>;
      if (Array.isArray(parsed?.entries)) fileIndex = parsed.entries;
    } catch {
      fileIndex = [];
    }

    // 迁移：文件索引为空且 localStorage 有旧数据 → 拷贝到文件（旧键保留不删）
    const localIndex = readLocalIndex();
    if (fileIndex.length === 0 && localIndex.length > 0) {
      logger.info("[ChordChartStorage] migrating %d charts from localStorage", localIndex.length);
      fileIndex = localIndex;
      for (const entry of localIndex) {
        const raw = loadFromStorage<unknown>({ key: chartKey(entry.id), defaultValue: null });
        const chart = fromStoredChart(raw);
        if (chart) {
          cache.set(entry.id, chart);
          enqueue({ kind: "chart", id: entry.id });
        }
      }
      libraryEntries = fileIndex;
      enqueue({ kind: "index" });
      hydrated = true;
      await flushOne(); // 迁移数据立即落盘
      return;
    }

    // 正常水合：按索引逐个读单曲（缺失/损坏的条目丢弃并刷索引）
    const valid: ChartLibraryEntry[] = [];
    for (const entry of fileIndex) {
      try {
        const text = await fs.readTextFile(`${CHARTS_DIR}/${entry.id}.json`, {
          baseDir: fs.BaseDirectory.AppData,
        });
        const chart = fromStoredChart(JSON.parse(text));
        if (chart) {
          cache.set(entry.id, chart);
          valid.push(entry);
        } else {
          logger.warn("[ChordChartStorage] corrupt chart file dropped: %s", entry.id);
        }
      } catch {
        logger.warn("[ChordChartStorage] chart file missing, dropped: %s", entry.id);
      }
    }
    libraryEntries = valid;
    hydrated = true;
  })();
  return hydrating;
}

/* ── 索引（同步 API，缓存 + 队列） ─────────────────────── */

/** 读取曲库索引 */
export function loadLibraryIndex(): ChartLibraryEntry[] {
  return libraryEntries;
}

/** 写入曲库索引 */
export function saveLibraryIndex(entries: ChartLibraryEntry[]): void {
  libraryEntries = entries;
  if (isTauri()) {
    enqueue({ kind: "index" });
  } else {
    saveToStorage<StoredLibrary>(LIBRARY_STORAGE_KEY, {
      version: CHART_FORMAT_VERSION,
      entries,
    });
  }
}

/* ── 单曲 ─────────────────────────────────────────────── */

/** 读取单曲；不存在或结构非法时返回 null */
export function loadChart(id: string): ChordChart | null {
  const chart = cache.get(id) ?? null;
  if (!chart) {
    logger.warn(`Failed to load chart (id: ${id})`);
  }
  return chart;
}

/** 写入单曲 */
export function saveChart(id: string, chart: ChordChart): void {
  cache.set(id, chart);
  if (isTauri()) {
    enqueue({ kind: "chart", id });
  } else {
    saveToStorage(chartKey(id), toStoredChart(chart));
  }
}

/** 删除单曲 */
export function deleteChart(id: string): void {
  cache.delete(id);
  if (isTauri()) {
    enqueue({ kind: "delete", id });
  } else {
    removeFromStorage(chartKey(id));
  }
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
