import type { NoteEvent, StopFn } from "smplr";
import { useSamplerStore, instrumentEvents } from "@/stores/sampler";
import { createLogger } from "@/utils/logger";
import {
  initializeAudioContext,
  getAudioContext,
  getLoader,
  getScheduler,
  resetLoader,
  disposeAudioContext,
  audioContextInitialized,
} from "@/services/sampler/AudioContextService";
import { createInstrument } from "@/services/sampler/InstrumentFactory";
import { InstrumentCacheManager } from "@/services/sampler/InstrumentCacheManager";
import { runWithConcurrency } from "@/utils/concurrency";
import type { BatchDownloadResult } from "@/services/sampler/types";

// 重新导出类型以保持向后兼容（原 useSamplerService.ts L606-610）
export type { BatchDownloadResult } from "@/services/sampler/types";

const logger = createLogger("SamplerService");

// ─── 组合模块（模块级单例） ───
// Facade 仅负责：组合 AudioContextService / InstrumentFactory / InstrumentCacheManager，
// 将 CacheManager 的返回值翻译为 instrumentEvents 事件，并暴露与原 API 一致的接口。
const cacheManager = new InstrumentCacheManager({
  createContext: () => ensureReady(),
  createInstrument: (info) => {
    const ctx = getAudioContext();
    return createInstrument(ctx, getLoader(ctx), getScheduler(ctx), info);
  },
});

/** 确保 AudioContext 已启动 + Store 事件已订阅（幂等） */
async function ensureReady(): Promise<BaseAudioContext> {
  const ctx = await initializeAudioContext();
  const store = useSamplerStore();
  store.subscribeToEvents(); // 幂等，Store 内部有 eventsSubscribed 守卫
  return ctx;
}

// ─── 加载（触发事件） ───
/**
 * 加载并切换到指定音色。
 *
 * 事件语义：
 * - 命中缓存 → onCacheSwitch
 * - 在途加载 → 复用 Promise，不重复触发事件
 * - 新加载 → onLoadStart + (onLoadProgress) + (onLoadSuccess | onLoadError+onCacheSwitch)
 */
async function loadInstrument(instrumentId: string): Promise<void> {
  const store = useSamplerStore();
  const info = store.gmInstrumentCatalogMap.get(instrumentId);
  if (!info) {
    const error = new Error(`Unknown instrument: ${instrumentId}`);
    instrumentEvents.onLoadError.internalInvoke({ instrumentId, error });
    throw error;
  }

  // 1. 命中 ready 缓存 → 切换活跃 + onCacheSwitch
  if (cacheManager.isReady(instrumentId)) {
    await cacheManager.load(instrumentId, info);
    instrumentEvents.onCacheSwitch.internalInvoke({ instrumentId });
    return;
  }

  // 2. 在途加载 → 复用 Promise，不重复触发 onLoadStart
  const inflight = cacheManager.getLoadingPromise(instrumentId);
  if (inflight) {
    await inflight;
    return;
  }

  // 3. 新加载 → 触发 onLoadStart，委托 cacheManager 执行
  instrumentEvents.onLoadStart.internalInvoke({
    instrumentId,
    instrument: info,
  });
  try {
    const result = await cacheManager.load(instrumentId, info, {
      onProgress: (pct) =>
        instrumentEvents.onLoadProgress.internalInvoke({
          instrumentId,
          progress: pct,
        }),
    });
    if (result.fromCache) {
      // 竞态保护：在 isReady/inflight 检查与 load() 之间被其他调用加载完成
      instrumentEvents.onCacheSwitch.internalInvoke({ instrumentId });
    } else {
      instrumentEvents.onLoadSuccess.internalInvoke({
        instrumentId,
        instrument: info,
        fromCache: result.fromCache,
      });
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    // 加载失败时恢复到上一个成功的乐器
    const lastId = cacheManager.getLastSuccessfulId();
    if (lastId) {
      instrumentEvents.onCacheSwitch.internalInvoke({ instrumentId: lastId });
    }
    instrumentEvents.onLoadError.internalInvoke({ instrumentId, error });
    throw err;
  }
}

// ─── 播放（纯代理，移植自原 L477-542，逻辑不变） ───
/** 播放音符（持续模式 — 直到调用 noteOff 或 stopNote） */
function noteOn(note: number | string, velocity = 100): StopFn | null {
  const inst = cacheManager.getActive();
  if (!inst) return null;
  try {
    const event: NoteEvent = { note, velocity, stopId: note };
    return inst.start(event);
  } catch (err) {
    logger.error("[SamplerService] noteOn error: %s", err);
    return null;
  }
}

/** 停止指定音符（持续模式） */
function noteOff(note: number | string): void {
  const inst = cacheManager.getActive();
  if (!inst) return;
  try {
    inst.stop({ stopId: note });
  } catch (err) {
    logger.error("[SamplerService] noteOff error: %s", err);
  }
}

/** 播放音符（固定时长模式） */
function playNote(
  note: number | string,
  velocity = 100,
  duration?: number,
): StopFn | null {
  const inst = cacheManager.getActive();
  if (!inst) return null;
  try {
    const event: NoteEvent = {
      note,
      velocity,
      ...(duration != null ? { duration } : {}),
    };
    return inst.start(event);
  } catch (err) {
    logger.error("[SamplerService] playNote error: %s", err);
    return null;
  }
}

/** 停止指定音符 */
function stopNote(note: number | string): void {
  noteOff(note);
}

/** 停止所有音符 */
function stopAllNotes(): void {
  const inst = cacheManager.getActive();
  if (!inst) return;
  try {
    inst.stop();
  } catch (err) {
    logger.error("[SamplerService] stopAllNotes error: %s", err);
  }
}

// ─── 缓存大小（移植自原 L545-567，逻辑不变） ───
/** 获取采样器缓存大小（字节）— 精确计算 CacheStorage 中的条目大小 */
async function getCacheSize(): Promise<number> {
  try {
    const cacheNames = await caches.keys();
    let totalSize = 0;
    for (const name of cacheNames) {
      if (name.includes("midi-jar-sampler")) {
        const cache = await caches.open(name);
        const requests = await cache.keys();
        for (const req of requests) {
          const response = await cache.match(req);
          if (response) {
            const blob = await response.blob();
            totalSize += blob.size;
          }
        }
      }
    }
    return totalSize;
  } catch (err) {
    logger.warn("[SamplerService] getCacheSize error: %s", err);
    return 0;
  }
}

// ─── 清除缓存（移植自原 L570-604，委托模块重置状态） ───
/** 清除音色缓存并销毁当前实例（需后续重新加载） */
async function clearCache(): Promise<string | null> {
  const currentId = cacheManager.getLastSuccessfulId();

  // 先销毁当前实例
  const active = cacheManager.getActive();
  if (active) {
    try {
      active.dispose();
    } catch (err) {
      logger.warn("[SamplerService] dispose during clearCache error: %s", err);
    }
  }

  // 清除 CacheStorage
  try {
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      if (name.includes("midi-jar-sampler")) {
        await caches.delete(name);
      }
    }
  } catch (err) {
    logger.error("[SamplerService] clearCache error: %s", err);
  }

  // 重建 loader（委托 AudioContextService）
  resetLoader();
  // 重置上次成功标记
  cacheManager.resetLastSuccessful();

  logger.info("[SamplerService] Cache cleared");

  // 返回之前加载的乐器 ID，供调用方自动重载
  return currentId;
}

// ─── 卸载（委托 CacheManager） ───
/**
 * 卸载指定音源（从缓存池移除并 dispose 实例）
 *
 * @param instrumentId - 要卸载的音源 ID
 * @returns 是否成功卸载
 */
function unloadInstrument(instrumentId: string): boolean {
  return cacheManager.unload(instrumentId);
}

// ─── 批量下载（用 runWithConcurrency + 触发事件） ───
/**
 * 批量下载缓存音源（并发）
 *
 * 并发加载多个音源，失败不影响其他音源。
 * 返回成功列表和失败列表（含错误信息）。
 *
 * @param instrumentIds - 要下载的音源 ID 列表
 * @param concurrency - 并发数限制（默认 16）
 * @returns 批量下载结果
 */
export async function batchDownloadInstruments(
  instrumentIds: string[],
  concurrency = 16,
): Promise<BatchDownloadResult> {
  const store = useSamplerStore();
  const result: BatchDownloadResult = { succeeded: [], failed: [] };

  logger.info(
    "[SamplerService] Starting batch download for %d instruments (concurrency: %d)",
    instrumentIds.length,
    concurrency,
  );

  // 触发批量下载开始事件
  instrumentEvents.onBatchStart.internalInvoke({
    total: instrumentIds.length,
  });

  // 跟踪活跃下载
  const activeDownloads = new Set<string>();

  // 创建下载任务工厂（每个任务包含错误处理）
  const tasks = instrumentIds.map((id) => async () => {
    activeDownloads.add(id);
    try {
      const info = store.gmInstrumentCatalogMap.get(id);
      if (!info) throw new Error(`Unknown instrument: ${id}`);

      // 已缓存的跳过（保留原行为：不触发事件，直接标记成功）
      if (store.instruments[id]?.loaded) {
        result.succeeded.push(id);
        return;
      }

      // 触发加载开始事件
      instrumentEvents.onLoadStart.internalInvoke({
        instrumentId: id,
        instrument: info,
      });

      await cacheManager.downloadToCache(id, info, (pct) =>
        instrumentEvents.onLoadProgress.internalInvoke({
          instrumentId: id,
          progress: pct,
        }),
      );

      // 触发成功事件
      instrumentEvents.onLoadSuccess.internalInvoke({
        instrumentId: id,
        instrument: info,
        fromCache: false,
      });

      result.succeeded.push(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const error = err instanceof Error ? err : new Error(msg);

      // 触发错误事件
      instrumentEvents.onLoadError.internalInvoke({
        instrumentId: id,
        error,
      });

      result.failed.push({ id, error: msg });
    } finally {
      activeDownloads.delete(id);

      // 更新已完成数量和进度
      const completed = result.succeeded.length + result.failed.length;
      const progress = Math.round((completed / instrumentIds.length) * 100);

      // 触发批量下载进度事件
      instrumentEvents.onBatchProgress.internalInvoke({
        completed,
        total: instrumentIds.length,
        progress,
        activeDownloads: Array.from(activeDownloads),
      });
    }
  });

  await runWithConcurrency(tasks, concurrency);

  // 触发批量下载完成事件
  instrumentEvents.onBatchComplete.internalInvoke({
    succeeded: result.succeeded,
    failed: result.failed,
  });

  logger.info(
    "[SamplerService] Batch download complete: %d succeeded, %d failed",
    result.succeeded.length,
    result.failed.length,
  );

  return result;
}

// ─── 释放（委托各模块） ───
/** 释放所有资源 */
function dispose(): void {
  cacheManager.disposeAll();
  disposeAudioContext();
  logger.info("[SamplerService] Disposed");
}

/**
 * 全局音源服务 composable（模块级单例）
 *
 * 管理所有 smplr 采样器实例，提供统一的音符播放/停止接口。
 * 所有视图共用同一个服务实例。
 *
 * 调用 loadInstrument 时会自动初始化 AudioContext，无需手动调用 init()。
 */
export function useSamplerService() {
  return {
    // state
    isInitialized: audioContextInitialized,
    /** 音源缓存池（只读，用于查询缓存状态） */
    cachePool: cacheManager.getPool(),

    // events
    events: instrumentEvents,

    // actions
    loadInstrument,
    unloadInstrument,
    playNote,
    noteOn,
    noteOff,
    stopNote,
    stopAllNotes,
    getCacheSize,
    clearCache,
    dispose,
    batchDownloadInstruments,
  };
}
