import { ref, shallowRef, readonly } from "vue";
import * as Tone from "tone";
import * as smplr from "smplr";
import type { LoadProgress, NoteEvent, StopFn } from "smplr";
import { useSamplerStore, instrumentEvents } from "@/stores/sampler";
import type { InstrumentInfo } from "@/stores/sampler";
import { createLogger } from "@/utils/logger";

const logger = createLogger("SamplerService");

// smplr 实例类型 — 使用 InstrumentInstance 的公共接口
type SmplrInstance = {
  ready: Promise<void>;
  start(event: NoteEvent): StopFn;
  stop(target?: unknown): void;
  output: { volume: number; disconnect: () => void };
  loadProgress: LoadProgress;
  dispose: () => void;
};

// ─── 模块级单例状态 ───
// 确保所有调用 useSamplerService() 的组件共享同一个服务实例
// 注意：必须使用 shallowRef 而非 ref，因为 smplr 内部使用 WeakSet + private fields
// 来跟踪实例身份，Vue 的 ref() 会用 Proxy 包装对象导致 WeakSet 查找失败
const activeInstance = shallowRef<SmplrInstance | null>(null);
let sharedLoader: smplr.SampleLoader | null = null;
let sharedScheduler: smplr.Scheduler | null = null;
let audioContext: BaseAudioContext | null = null;
const isInitialized = ref(false);
/** 当前成功加载的乐器 ID（即使后续加载失败，此值保持上一个成功的） */
let lastSuccessfulInstrumentId: string | null = null;

// ─── 音源缓存系统 ───
/**
 * 乐器缓存信息
 *
 * 状态转换：
 * - idle → loading: 开始加载
 * - loading → ready: 加载成功
 * - loading → error: 加载失败
 * - error → loading: 重试加载
 */
interface InstrumentCacheInfo {
  /** 乐器实例（加载完成后不为 null） */
  instrument: SmplrInstance | null;
  /** 加载中的 Promise（加载完成后清理） */
  loadingPromise: Promise<void> | null;
  /** 当前状态 */
  state: "idle" | "loading" | "ready" | "error";
  /** 错误信息（失败时存储） */
  error?: Error;
  /** 重试次数 */
  retryCount: number;
}

/** 音源缓存池（Map<instrumentId, InstrumentCacheInfo>） */
const instrumentCachePool = new Map<string, InstrumentCacheInfo>();

/** 最大重试次数 */
const MAX_RETRY_COUNT = 3;
/** 获取或创建共享的 SampleLoader */
function getSharedLoader(ctx: BaseAudioContext): smplr.SampleLoader {
  if (!sharedLoader) {
    sharedLoader = smplr.SampleLoader(ctx, {
      storage: smplr.CacheStorage("midi-jar-sampler"),
    });
  }
  return sharedLoader;
}

/** 获取或创建共享的 Scheduler */
function getSharedScheduler(ctx: BaseAudioContext): smplr.Scheduler {
  if (!sharedScheduler) {
    sharedScheduler = smplr.Scheduler(ctx, {
      lookaheadMs: 200,
      intervalMs: 50,
    });
  }
  return sharedScheduler;
}

/** 获取 AudioContext (从 Tone 共享) */
function getAudioContext(): BaseAudioContext {
  return Tone.getContext().rawContext;
}

/** 确保采样器服务已初始化 */
async function ensureInitialized(): Promise<BaseAudioContext> {
  if (isInitialized.value && audioContext) {
    return audioContext;
  }

  // 确保 Tone AudioContext 已启动
  await Tone.start();

  audioContext = getAudioContext();
  isInitialized.value = true;

  // 确保事件已订阅
  const store = useSamplerStore();
  store.subscribeToEvents();

  logger.info("[SamplerService] Initialized (lazy)");
  return audioContext;
}

/** 根据 factory 类型创建 smplr 乐器实例，支持 factoryOptions 覆盖 */
function createInstrument(
  ctx: BaseAudioContext,
  info: InstrumentInfo,
): SmplrInstance {
  const loader = getSharedLoader(ctx);
  const scheduler = getSharedScheduler(ctx);

  const commonOptions = {
    volume: 100,
    loader,
    scheduler,
  };

  // factoryOptions 中的 instrument 字段可覆盖默认的 info.id
  const factoryInstrument =
    (info.factoryOptions?.instrument as string) ?? info.id;

  switch (info.factory) {
    case "splendid-grand-piano":
      return smplr.SplendidGrandPiano(ctx, {
        ...commonOptions,
        decayTime: 0.5,
      }) as unknown as SmplrInstance;

    case "soundfont":
      return smplr.Soundfont(ctx, {
        ...commonOptions,
        instrument: info.id, // soundfont 使用 GM 标准名称
      }) as unknown as SmplrInstance;

    case "electric-piano":
      return smplr.ElectricPiano(ctx, {
        ...commonOptions,
        instrument: factoryInstrument, // CP80, PianetT, WurlitzerEP200, TX81Z
      }) as unknown as SmplrInstance;

    case "mallet":
      return smplr.Mallet(ctx, {
        ...commonOptions,
        instrument: factoryInstrument,
      }) as unknown as SmplrInstance;

    case "mellotron":
      return smplr.Mellotron(ctx, {
        ...commonOptions,
        instrument: factoryInstrument,
      }) as unknown as SmplrInstance;

    case "drum-machine":
      return smplr.DrumMachine(ctx, {
        ...commonOptions,
        instrument: "TR-808",
      }) as unknown as SmplrInstance;

    case "smolken":
      return smplr.Smolken(ctx, {
        ...commonOptions,
        instrument: factoryInstrument,
      }) as unknown as SmplrInstance;

    case "versilian":
      return smplr.Versilian(ctx, {
        ...commonOptions,
        instrument: factoryInstrument,
      }) as unknown as SmplrInstance;

    default:
      // 回退到 Soundfont
      return smplr.Soundfont(ctx, {
        ...commonOptions,
        instrument: info.id,
      }) as unknown as SmplrInstance;
  }
}

/**
 * 加载并切换到指定音色（使用新的缓存机制）
 *
 * @param instrumentId - 要加载的音源 ID
 */
async function loadInstrument(instrumentId: string): Promise<void> {
  const store = useSamplerStore();

  // 1. 查找乐器信息（从 store 的字典中）
  const info = store.gmInstrumentCatalogMap.get(instrumentId);
  if (!info) {
    const error = new Error(`Unknown instrument: ${instrumentId}`);
    instrumentEvents.onLoadError.internalInvoke({
      instrumentId,
      error,
    });
    throw error;
  }

  // 2. 检查缓存池
  let cache = instrumentCachePool.get(instrumentId);

  // 情况 1：已缓存且已加载完成
  if (cache?.state === "ready" && cache.instrument) {
    logger.debug(
      "[SamplerService] Instrument already cached: %s",
      instrumentId,
    );
    // 切换到该乐器
    switchToCachedInstrument(instrumentId, cache.instrument);
    return;
  }

  // 情况 2：正在加载中（复用 Promise）
  if (cache?.state === "loading" && cache.loadingPromise) {
    logger.debug(
      "[SamplerService] Reusing loading promise for %s",
      instrumentId,
    );
    return cache.loadingPromise;
  }

  // 情况 3：加载失败（检查重试次数）
  if (cache?.state === "error") {
    if (cache.retryCount >= MAX_RETRY_COUNT) {
      logger.warn(
        "[SamplerService] Max retry count reached for %s",
        instrumentId,
      );
      throw (
        cache.error || new Error(`Failed to load instrument: ${instrumentId}`)
      );
    }
    logger.info(
      "[SamplerService] Retrying to load %s (attempt %d)",
      instrumentId,
      cache.retryCount + 1,
    );
  }

  // 情况 4：需要加载（新加载或重试）
  await loadInstrumentInternal(instrumentId, info);
}

/**
 * 内部加载逻辑
 */
async function loadInstrumentInternal(
  instrumentId: string,
  info: InstrumentInfo,
): Promise<void> {
  const store = useSamplerStore();
  const ctx = await ensureInitialized();

  // 如果已经在加载同一乐器，不重复
  if (store.isLoading && store.currentInstrumentId === instrumentId) {
    return;
  }

  // 获取或创建缓存条目
  let cache = instrumentCachePool.get(instrumentId);
  if (!cache) {
    cache = {
      instrument: null,
      loadingPromise: null,
      state: "idle",
      retryCount: 0,
    };
    instrumentCachePool.set(instrumentId, cache);
  }

  // 更新缓存状态
  cache.state = "loading";

  // 卸载旧音源：仅在旧音源不在缓存池中时才 dispose
  if (activeInstance.value) {
    const oldId = lastSuccessfulInstrumentId;
    const oldCache = oldId ? instrumentCachePool.get(oldId) : undefined;

    if (oldCache && oldCache.state === "ready") {
      // 旧音源在缓存池中 → 保留实例，仅切换引用
      logger.debug(
        "[SamplerService] Keeping old instrument in cache: %s",
        oldId,
      );
    } else {
      // 旧音源不在缓存池中 → 安全销毁
      try {
        activeInstance.value.dispose();
        logger.debug(
          "[SamplerService] Disposed old instrument (not in cache): %s",
          oldId,
        );
      } catch (err) {
        logger.warn("[SamplerService] dispose error (ignored): %s", err);
      }
    }
    activeInstance.value = null;
  }

  // 触发加载开始事件（在创建加载 Promise 之前）
  instrumentEvents.onLoadStart.internalInvoke({
    instrumentId,
    instrument: info,
  });

  // 创建加载 Promise
  const loadingPromise = (async () => {
    try {
      const instance = createInstrument(ctx, info);

      // 进度轮询机制（每 100ms 更新一次）
      const progressInterval = setInterval(() => {
        try {
          const progress = instance.loadProgress;
          if (progress && progress.total > 0) {
            const percent = Math.round(
              (progress.loaded / progress.total) * 100,
            );

            // 触发进度事件
            instrumentEvents.onLoadProgress.internalInvoke({
              instrumentId,
              progress: percent,
            });
          }
        } catch {
          // 某些实例可能不支持 loadProgress 属性，忽略错误
        }
      }, 100);

      // 等待加载完成
      await instance.ready;

      // 清除进度轮询
      clearInterval(progressInterval);

      // 更新缓存
      cache.instrument = instance;
      cache.state = "ready";
      cache.loadingPromise = null; // 清理 Promise

      // 更新活跃实例
      activeInstance.value = instance;
      lastSuccessfulInstrumentId = instrumentId;

      // 触发成功事件
      const finalProgress = instance.loadProgress;
      const fromCache =
        finalProgress && finalProgress.loaded === finalProgress.total;
      instrumentEvents.onLoadSuccess.internalInvoke({
        instrumentId,
        instrument: info,
        fromCache: fromCache || false,
      });

      logger.info("[SamplerService] Loaded instrument: %s", info.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const error = err instanceof Error ? err : new Error(msg);

      // 更新缓存状态
      cache.state = "error";
      cache.error = error;
      cache.retryCount++;
      cache.loadingPromise = null;

      // 健壮性：加载失败时恢复到上一个成功的乐器
      if (lastSuccessfulInstrumentId) {
        instrumentEvents.onCacheSwitch.internalInvoke({
          instrumentId: lastSuccessfulInstrumentId,
        });
      }

      // 触发错误事件
      instrumentEvents.onLoadError.internalInvoke({
        instrumentId,
        error,
      });

      logger.error("[SamplerService] Failed to load instrument: %s", msg);
      throw err;
    }
  })();

  // 存储 Promise 到缓存
  cache.loadingPromise = loadingPromise;

  try {
    await loadingPromise;
  } catch (err) {
    // 错误已经在 Promise 内部处理，这里只是传播
    throw err;
  }
}

/**
 * 切换到已缓存的乐器
 */
function switchToCachedInstrument(
  instrumentId: string,
  instance: SmplrInstance,
): void {
  // 销毁旧实例
  if (activeInstance.value && activeInstance.value !== instance) {
    try {
      activeInstance.value.dispose();
    } catch (err) {
      logger.warn("[SamplerService] dispose error (ignored): %s", err);
    }
  }

  // 更新活跃实例
  activeInstance.value = instance;
  lastSuccessfulInstrumentId = instrumentId;

  // 触发缓存切换事件
  instrumentEvents.onCacheSwitch.internalInvoke({ instrumentId });
}

/**
 * 卸载指定音源（从缓存池移除并 dispose 实例）
 *
 * @param instrumentId - 要卸载的音源 ID
 * @returns 是否成功卸载
 */
function unloadInstrument(instrumentId: string): boolean {
  // 不允许卸载当前正在使用的音源
  if (lastSuccessfulInstrumentId === instrumentId) {
    logger.warn(
      "[SamplerService] Cannot unload current active instrument: %s",
      instrumentId,
    );
    return false;
  }

  const cache = instrumentCachePool.get(instrumentId);
  if (!cache) {
    logger.debug(
      "[SamplerService] Instrument not in cache pool: %s",
      instrumentId,
    );
    return false;
  }

  // 正在加载中，不允许卸载
  if (cache.state === "loading") {
    logger.warn(
      "[SamplerService] Cannot unload instrument while loading: %s",
      instrumentId,
    );
    return false;
  }

  // dispose 实例
  if (cache.instrument) {
    try {
      cache.instrument.dispose();
    } catch (err) {
      logger.warn(
        "[SamplerService] dispose error for %s: %s",
        instrumentId,
        err,
      );
    }
  }

  // 从缓存池移除
  instrumentCachePool.delete(instrumentId);

  logger.info("[SamplerService] Unloaded instrument: %s", instrumentId);
  return true;
}

/** 播放音符（持续模式 — 直到调用 noteOff 或 stopNote） */
function noteOn(note: number | string, velocity = 100): StopFn | null {
  if (!activeInstance.value) {
    return null;
  }

  try {
    const event: NoteEvent = {
      note,
      velocity,
      stopId: note,
    };
    return activeInstance.value.start(event);
  } catch (err) {
    logger.error("[SamplerService] noteOn error: %s", err);
    return null;
  }
}

/** 停止指定音符（持续模式） */
function noteOff(note: number | string) {
  if (!activeInstance.value) return;
  try {
    activeInstance.value.stop({ stopId: note });
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
  if (!activeInstance.value) {
    return null;
  }

  try {
    const event: NoteEvent = {
      note,
      velocity,
      ...(duration != null ? { duration } : {}),
    };
    return activeInstance.value.start(event);
  } catch (err) {
    logger.error("[SamplerService] playNote error: %s", err);
    return null;
  }
}

/** 停止指定音符 */
function stopNote(note: number | string) {
  noteOff(note);
}

/** 停止所有音符 */
function stopAllNotes() {
  if (!activeInstance.value) return;
  try {
    activeInstance.value.stop();
  } catch (err) {
    logger.error("[SamplerService] stopAllNotes error: %s", err);
  }
}

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

/** 清除音色缓存并销毁当前实例（需后续重新加载） */
async function clearCache(): Promise<string | null> {
  const currentId = lastSuccessfulInstrumentId;

  // 先销毁当前实例
  if (activeInstance.value) {
    try {
      activeInstance.value.dispose();
    } catch (err) {
      logger.warn("[SamplerService] dispose during clearCache error: %s", err);
    }
    activeInstance.value = null;
  }

  try {
    // 清除 CacheStorage
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      if (name.includes("midi-jar-sampler")) {
        await caches.delete(name);
      }
    }
  } catch (err) {
    logger.error("[SamplerService] clearCache error: %s", err);
  }

  // 重建 loader
  sharedLoader = null;
  // 重置状态
  lastSuccessfulInstrumentId = null;

  logger.info("[SamplerService] Cache cleared");

  // 返回之前加载的乐器 ID，供调用方自动重载
  return currentId;
}

/** 批量下载音源结果类型 */
export type BatchDownloadResult = {
  succeeded: string[];
  failed: Array<{ id: string; error: string }>;
};

/**
 * 下载单个乐器到缓存（不切换当前乐器）
 *
 * @param instrumentId - 要下载的音源 ID
 * @returns Promise<void>
 */
async function downloadInstrumentToCache(instrumentId: string): Promise<void> {
  const store = useSamplerStore();
  const ctx = await ensureInitialized();

  const info = store.gmInstrumentCatalogMap.get(instrumentId);
  if (!info) {
    throw new Error(`Unknown instrument: ${instrumentId}`);
  }

  // 如果已经加载，跳过
  if (store.instruments[instrumentId]?.loaded) {
    logger.info("[SamplerService] Instrument already cached: %s", instrumentId);
    return;
  }

  // 触发加载开始事件
  instrumentEvents.onLoadStart.internalInvoke({
    instrumentId,
    instrument: info,
  });

  try {
    const instance = createInstrument(ctx, info);

    // 进度轮询
    const progressInterval = setInterval(() => {
      try {
        const progress = instance.loadProgress;
        if (progress && progress.total > 0) {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          instrumentEvents.onLoadProgress.internalInvoke({
            instrumentId,
            progress: percent,
          });
        }
      } catch {
        // 忽略不支持 loadProgress 的实例
      }
    }, 100);

    await instance.ready;

    clearInterval(progressInterval);

    // 触发成功事件
    instrumentEvents.onLoadSuccess.internalInvoke({
      instrumentId,
      instrument: info,
      fromCache: false,
    });

    // 销毁实例（只保留缓存）
    try {
      instance.dispose();
    } catch (err) {
      logger.warn("[SamplerService] dispose after cache error: %s", err);
    }

    logger.info("[SamplerService] Cached instrument: %s", instrumentId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const error = err instanceof Error ? err : new Error(msg);

    // 触发错误事件
    instrumentEvents.onLoadError.internalInvoke({
      instrumentId,
      error,
    });

    throw err;
  }
}

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
  const result: BatchDownloadResult = {
    succeeded: [],
    failed: [],
  };

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

  // 创建下载任务的 Promise 数组（每个都包含错误处理）
  const downloadTasks = instrumentIds.map(async (id) => {
    activeDownloads.add(id);

    try {
      await downloadInstrumentToCache(id);
      result.succeeded.push(id);
      logger.info("[SamplerService] Downloaded: %s", id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.failed.push({ id, error: msg });
      logger.error("[SamplerService] Failed to download %s: %s", id, msg);
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

  // 使用简单的并发控制：分批执行
  for (let i = 0; i < downloadTasks.length; i += concurrency) {
    const batch = downloadTasks.slice(i, i + concurrency);
    await Promise.all(batch);
  }

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

/** 释放所有资源 */
function dispose() {
  if (activeInstance.value) {
    try {
      activeInstance.value.dispose();
    } catch (err) {
      logger.warn("[SamplerService] dispose error: %s", err);
    }
    activeInstance.value = null;
  }
  // 清理缓存池中的所有实例
  for (const [id, cache] of instrumentCachePool) {
    if (cache.instrument) {
      try {
        cache.instrument.dispose();
      } catch (err) {
        logger.warn("[SamplerService] dispose cache error for %s: %s", id, err);
      }
    }
  }
  instrumentCachePool.clear();

  if (sharedScheduler) {
    try {
      sharedScheduler.stop();
    } catch (err) {
      logger.warn("[SamplerService] scheduler stop error: %s", err);
    }
    sharedScheduler = null;
  }
  sharedLoader = null;
  audioContext = null;
  isInitialized.value = false;
  lastSuccessfulInstrumentId = null;
  logger.info("[SamplerService] Disposed");
}

/**
 * 全局音源服务 composable（模块级单例）
 *
 * 管理所有 smplr 采样器实例,提供统一的音符播放/停止接口。
 * 所有视图共用同一个服务实例。
 *
 * 调用 loadInstrument 时会自动初始化 AudioContext,无需手动调用 init()。
 */
export function useSamplerService() {
  return {
    // state
    isInitialized: readonly(isInitialized),
    /** 音源缓存池（只读，用于查询缓存状态） */
    cachePool: instrumentCachePool as ReadonlyMap<string, InstrumentCacheInfo>,

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
