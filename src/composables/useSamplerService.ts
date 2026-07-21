import { ref, shallowRef, readonly } from "vue";
import * as Tone from "tone";
import * as smplr from "smplr";
import type { LoadProgress, NoteEvent, StopFn } from "smplr";
import { useSamplerStore } from "@/stores/sampler";
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
/** 并发保护：每次 loadInstrument 调用递增，用于检测竞态条件 */
let loadIdCounter = 0;

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
  return Tone.context.rawContext;
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
  logger.info("[SamplerService] Initialized (lazy)");
  return audioContext;
}

/** 根据 factory 类型创建 smplr 乐器实例，支持 factoryOptions 覆盖 */
function createInstrument(
  ctx: BaseAudioContext,
  info: InstrumentInfo,
): SmplrInstance {
  const store = useSamplerStore();
  const loader = getSharedLoader(ctx);
  const scheduler = getSharedScheduler(ctx);

  const commonOptions = {
    volume: 100,
    loader,
    scheduler,
    onLoadProgress: (progress: LoadProgress) => {
      store.setLoadProgress(progress);
    },
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

/** 加载并切换到指定音色（健壮：失败时不破坏已有状态，并发安全） */
async function loadInstrument(instrumentId: string): Promise<void> {
  const store = useSamplerStore();
  const currentLoadId = ++loadIdCounter;

  // 自动初始化：确保 AudioContext 可用
  const ctx = await ensureInitialized();

  // 并发保护：如果在 await 期间有新的加载请求，直接退出
  if (currentLoadId !== loadIdCounter) {
    logger.debug(
      "[SamplerService] Stale load request for %s, skipping",
      instrumentId,
    );
    return;
  }

  const catalog = store.gmInstrumentCatalog;
  const info = catalog.find((i) => i.id === instrumentId);
  if (!info) {
    throw new Error(`Unknown instrument: ${instrumentId}`);
  }

  // 注册乐器信息到 store（确保 currentInstrument computed 和 ✓ badge 正常工作）
  store.registerInstrument(info);

  // 如果已经在加载同一乐器,不重复
  if (store.isLoading && store.currentInstrumentId === instrumentId) {
    return;
  }

  // 如果当前音色已加载,直接切换
  if (activeInstance.value && lastSuccessfulInstrumentId === instrumentId) {
    return;
  }

  // 清理旧乐器的 loading 状态（防止标记卡住）
  const oldInstrumentId = store.currentInstrumentId;
  if (oldInstrumentId && oldInstrumentId !== instrumentId) {
    store.updateInstrumentStatus(oldInstrumentId, { loading: false });
  }

  // 销毁旧实例（dispose 内部已包含 stop 逻辑）
  if (activeInstance.value) {
    try {
      activeInstance.value.dispose();
    } catch (err) {
      logger.warn("[SamplerService] dispose error (ignored): %s", err);
    }
    activeInstance.value = null;
  }

  store.setLoading(true);
  store.setError(null);
  store.setCurrentInstrument(instrumentId);
  store.updateInstrumentStatus(instrumentId, { loading: true });

  try {
    const instance = createInstrument(ctx, info);

    // 并发保护：在等待 ready 期间检查是否有更新的请求
    await instance.ready;

    if (currentLoadId !== loadIdCounter) {
      logger.debug(
        "[SamplerService] Load cancelled for %s during ready, disposing",
        instrumentId,
      );
      try {
        instance.dispose();
      } catch {
        /* ignored */
      }
      return;
    }

    activeInstance.value = instance;
    lastSuccessfulInstrumentId = instrumentId;
    store.setReady(true);
    store.setLoading(false);
    store.updateInstrumentStatus(instrumentId, {
      loaded: true,
      loading: false,
    });

    // 加载完成后主动更新进度到最终状态
    try {
      const finalProgress = instance.loadProgress;
      if (finalProgress && finalProgress.total > 0) {
        store.setLoadProgress(finalProgress);
      }
    } catch {
      // 某些实例可能不支持 loadProgress 属性
    }

    logger.info("[SamplerService] Loaded instrument: %s", info.name);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    store.setError(msg);
    store.setLoading(false);
    // 健壮性：加载失败时不破坏 isReady — 如果之前有成功加载的乐器，它仍然可用
    if (!lastSuccessfulInstrumentId) {
      store.setReady(false);
    } else {
      // 恢复到上一个成功的乐器 ID
      store.setCurrentInstrument(lastSuccessfulInstrumentId);
    }
    store.updateInstrumentStatus(instrumentId, { loading: false, error: msg });
    logger.error("[SamplerService] Failed to load instrument: %s", msg);
    throw err;
  }
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
  const store = useSamplerStore();
  store.setReady(false);
  store.setLoading(false);
  lastSuccessfulInstrumentId = null;

  logger.info("[SamplerService] Cache cleared");

  // 返回之前加载的乐器 ID，供调用方自动重载
  return currentId;
}

/** 释放所有资源 */
function dispose() {
  const store = useSamplerStore();
  if (activeInstance.value) {
    try {
      activeInstance.value.dispose();
    } catch (err) {
      logger.warn("[SamplerService] dispose error: %s", err);
    }
    activeInstance.value = null;
  }
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
  store.setReady(false);
  store.setCurrentInstrument("");
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

    // actions
    loadInstrument,
    playNote,
    noteOn,
    noteOff,
    stopNote,
    stopAllNotes,
    getCacheSize,
    clearCache,
    dispose,
  };
}
