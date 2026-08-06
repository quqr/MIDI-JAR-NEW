import type { InstrumentInfo } from "@/stores/sampler";
import type {
  CacheEntry,
  CacheManagerDeps,
  LoadOptions,
  LoadResult,
  SmplrInstance,
} from "./types";
import { createLogger } from "@/utils/logger";

const logger = createLogger("InstrumentCacheManager");

/** 最大重试次数（移植自 useSamplerService.ts L60） */
const MAX_RETRY_COUNT = 3;
/** 进度轮询间隔（移植自 L315） */
const PROGRESS_POLL_MS = 100;

/**
 * 乐器缓存管理器：缓存池 + 状态机 + Promise 复用 + 重试。
 *
 * 与原 useSamplerService.ts 的关键区别：
 * - 不触发任何 instrumentEvents 事件，仅通过返回值与 onProgress 回调与上层通信；
 * - active 实例以普通字段持有（不再用 shallowRef）；
 * - 通过构造函数注入 createContext / createInstrument，使其不直接依赖 Tone/smplr，可用纯 mock 测试。
 */
export class InstrumentCacheManager {
  private readonly pool = new Map<string, CacheEntry>();
  private readonly deps: CacheManagerDeps;
  private active: SmplrInstance | null = null;
  private lastSuccessfulId: string | null = null;

  constructor(deps: CacheManagerDeps) {
    this.deps = deps;
  }

  // ─── 查询 ───

  /** 缓存是否就绪（可直接命中） */
  isReady(id: string): boolean {
    const e = this.pool.get(id);
    return e?.state === "ready" && e.instrument != null;
  }

  /** 获取条目（供 Facade 查询缓存状态） */
  getEntry(id: string): CacheEntry | undefined {
    return this.pool.get(id);
  }

  /** 只读缓存池 */
  getPool(): ReadonlyMap<string, CacheEntry> {
    return this.pool;
  }

  /** 当前活跃实例 */
  getActive(): SmplrInstance | null {
    return this.active;
  }

  /** 上次成功的乐器 ID */
  getLastSuccessfulId(): string | null {
    return this.lastSuccessfulId;
  }

  /** 在途加载 Promise（供 Facade 做事件去重） */
  getLoadingPromise(id: string): Promise<LoadResult> | null {
    return this.pool.get(id)?.loadingPromise ?? null;
  }

  // ─── 加载 ───

  /**
   * 加载乐器并切换为活跃实例。
   *
   * - 命中 ready 缓存 → 切换活跃，返回 { fromCache: true }
   * - 在途加载 → 返回已有 Promise（去重）
   * - 重试次数耗尽 → 抛错
   * - 否则执行加载流程
   */
  load(
    id: string,
    info: InstrumentInfo,
    opts: LoadOptions = {},
  ): Promise<LoadResult> {
    // 1. 命中 ready
    const existing = this.pool.get(id);
    if (existing?.state === "ready" && existing.instrument) {
      this.setActive(existing.instrument, id);
      logger.debug("[CacheManager] Cache hit: %s", id);
      return Promise.resolve({
        instance: existing.instrument,
        fromCache: true,
      });
    }
    // 2. 在途 → 复用 Promise
    if (existing?.state === "loading" && existing.loadingPromise) {
      logger.debug("[CacheManager] Reusing loading promise: %s", id);
      return existing.loadingPromise;
    }
    // 3. 重试耗尽 — 返回 rejected Promise（保持 load() 总是返回 Promise 的契约）
    if (existing?.state === "error" && existing.retryCount >= MAX_RETRY_COUNT) {
      logger.warn("[CacheManager] Max retries reached: %s", id);
      return Promise.reject(
        existing.error ?? new Error(`Failed to load instrument: ${id}`),
      );
    }
    // 4. 执行加载
    // 关键：在调用 doLoad（其内部首行就 await）之前，**同步**写入 entry.state=loading
    // 与 loadingPromise，避免连续两次 load() 因尚未写入池而无法去重。
    let entry = existing;
    if (!entry) {
      entry = {
        instrument: null,
        loadingPromise: null,
        state: "idle",
        retryCount: 0,
      };
      this.pool.set(id, entry);
    }
    entry.state = "loading";
    const promise = this.doLoad(id, info, opts, entry);
    entry.loadingPromise = promise;
    return promise;
  }

  /** 实际加载流程（移植自 loadInstrumentInternal L250-397，去掉事件触发） */
  private async doLoad(
    id: string,
    info: InstrumentInfo,
    opts: LoadOptions,
    entry: CacheEntry,
  ): Promise<LoadResult> {
    // createContext 的副作用是确保 AudioContext 已启动；
    // 实际 ctx 由 deps.createInstrument 闭包内自行取用，此处无需持有引用。
    await this.deps.createContext();

    // 卸载旧活跃实例（仅当不在缓存池时才 dispose）
    this.maybeDisposeActiveExcept(id);

    try {
      const instance = this.deps.createInstrument(info);
      const stopPoll = this.startProgressPoll(instance, opts.onProgress);
      try {
        await instance.ready;
      } finally {
        stopPoll();
      }
      // 成功
      entry.instrument = instance;
      entry.state = "ready";
      entry.loadingPromise = null;
      this.setActive(instance, id);
      const fromCache = this.computeFromCache(instance);
      logger.info("[CacheManager] Loaded: %s", info.name);
      return { instance, fromCache };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      entry.state = "error";
      entry.error = error;
      entry.retryCount += 1;
      entry.loadingPromise = null;
      // 失败时恢复到上一个成功的活跃实例
      this.restoreActiveToLastSuccessful();
      logger.error("[CacheManager] Failed to load %s: %s", id, error.message);
      throw err;
    }
  }

  // ─── 下载（预加载到 CacheStorage，不切换活跃） ───

  /**
   * 下载乐器到 CacheStorage 但不保留实例、不切换活跃。
   * 移植自 downloadInstrumentToCache L618-689（去掉事件触发）。
   */
  async downloadToCache(
    id: string,
    info: InstrumentInfo,
    onProgress?: (percent: number) => void,
  ): Promise<void> {
    await this.deps.createContext();
    const instance = this.deps.createInstrument(info);
    const stopPoll = this.startProgressPoll(instance, onProgress);
    try {
      await instance.ready;
    } finally {
      stopPoll();
    }
    // 仅保留 CacheStorage 数据，释放实例
    try {
      instance.dispose();
    } catch (err) {
      logger.warn("[CacheManager] dispose after download error: %s", err);
    }
    logger.info("[CacheManager] Cached (download): %s", id);
  }

  // ─── 卸载 ───

  /** 卸载指定乐器（移植自 unloadInstrument L429-475） */
  unload(id: string): boolean {
    // 不允许卸载当前正在使用的音源
    if (this.lastSuccessfulId === id) {
      logger.warn(
        "[CacheManager] Cannot unload current active instrument: %s",
        id,
      );
      return false;
    }
    const entry = this.pool.get(id);
    if (!entry) {
      logger.debug("[CacheManager] Instrument not in cache pool: %s", id);
      return false;
    }
    // 正在加载中，不允许卸载
    if (entry.state === "loading") {
      logger.warn(
        "[CacheManager] Cannot unload instrument while loading: %s",
        id,
      );
      return false;
    }
    // dispose 实例
    if (entry.instrument) {
      try {
        entry.instrument.dispose();
      } catch (err) {
        logger.warn("[CacheManager] dispose error for %s: %s", id, err);
      }
    }
    // 从缓存池移除
    this.pool.delete(id);
    logger.info("[CacheManager] Unloaded: %s", id);
    return true;
  }

  // ─── 清理 ───

  /** 释放全部资源（移植自 dispose L775-809 中缓存部分） */
  disposeAll(): void {
    if (this.active) {
      try {
        this.active.dispose();
      } catch (err) {
        logger.warn("[CacheManager] dispose active error: %s", err);
      }
      this.active = null;
    }
    for (const [id, entry] of this.pool) {
      if (entry.instrument) {
        try {
          entry.instrument.dispose();
        } catch (err) {
          logger.warn("[CacheManager] dispose cache error for %s: %s", id, err);
        }
      }
    }
    this.pool.clear();
    this.lastSuccessfulId = null;
    logger.info("[CacheManager] Disposed all");
  }

  /** 重置上次成功标记（clearCache 时调用） */
  resetLastSuccessful(): void {
    this.lastSuccessfulId = null;
  }

  // ─── 内部辅助 ───

  private setActive(instance: SmplrInstance, id: string): void {
    if (this.active && this.active !== instance) {
      try {
        this.active.dispose();
      } catch (err) {
        logger.warn("[CacheManager] dispose old active error: %s", err);
      }
    }
    this.active = instance;
    this.lastSuccessfulId = id;
  }

  /** 仅 dispose 不在缓存池的旧活跃实例（移植自 L277-301） */
  private maybeDisposeActiveExcept(keepId: string): void {
    if (!this.active) return;
    const oldId = this.lastSuccessfulId;
    const oldEntry = oldId ? this.pool.get(oldId) : undefined;
    if (oldEntry?.state === "ready") {
      // 旧音源在缓存池中 → 保留实例，仅切换引用
      logger.debug("[CacheManager] Keeping old instrument in cache: %s", oldId);
    } else {
      // 旧音源不在缓存池中 → 安全销毁
      try {
        this.active.dispose();
        logger.debug(
          "[CacheManager] Disposed old instrument (not in cache): %s",
          oldId,
        );
      } catch (err) {
        logger.warn("[CacheManager] dispose old error: %s", err);
      }
    }
    this.active = null;
    void keepId;
  }

  /** 失败时恢复活跃实例到上次成功的缓存条目 */
  private restoreActiveToLastSuccessful(): void {
    const lastId = this.lastSuccessfulId;
    if (lastId) {
      const entry = this.pool.get(lastId);
      if (entry?.state === "ready" && entry.instrument) {
        this.active = entry.instrument;
        logger.debug(
          "[CacheManager] Restored active to last successful: %s",
          lastId,
        );
      }
    }
  }

  /** 进度轮询（移植自 L315-332 / L643-656，改为回调而非事件） */
  private startProgressPoll(
    instance: SmplrInstance,
    onProgress?: (percent: number) => void,
  ): () => void {
    if (!onProgress) return () => {};
    const handle = setInterval(() => {
      try {
        const p = instance.loadProgress;
        if (p && p.total > 0) {
          onProgress(Math.round((p.loaded / p.total) * 100));
        }
      } catch {
        // 某些实例可能不支持 loadProgress 属性，忽略错误
      }
    }, PROGRESS_POLL_MS);
    return () => clearInterval(handle);
  }

  /** 判断是否从 CacheStorage 命中（移植自 L350-352） */
  private computeFromCache(instance: SmplrInstance): boolean {
    const p = instance.loadProgress;
    return !!(p && p.loaded === p.total);
  }
}
