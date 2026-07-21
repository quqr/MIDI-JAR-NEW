import { ref, readonly } from "vue";
import * as smplr from "smplr";
import type { LoadProgress, NoteEvent, StopFn } from "smplr";
import { useSamplerStore } from "@/stores/sampler";
import type { InstrumentInfo } from "@/stores/sampler";
import logger from "@/utils/logger";

// smplr 实例类型 — 使用 InstrumentInstance 的公共接口
type SmplrInstance = {
  ready: Promise<void>;
  start(event: NoteEvent): StopFn;
  stop(target?: unknown): void;
  output: { volume: number; disconnect: () => void };
  loadProgress: LoadProgress;
  dispose: () => void;
};

/**
 * 全局音源服务 composable
 *
 * 管理所有 smplr 采样器实例,提供统一的音符播放/停止接口。
 * 所有视图共用同一个服务实例。
 */
export function useSamplerService() {
  const store = useSamplerStore();

  // 当前活跃的 smplr 实例
  const activeInstance = ref<SmplrInstance | null>(null);
  // 共享的 SampleLoader 和 Scheduler
  let sharedLoader: smplr.SampleLoader | null = null;
  let sharedScheduler: smplr.Scheduler | null = null;
  // AudioContext 引用 (由 useAudioContext 管理,此处只引用)
  let audioContext: BaseAudioContext | null = null;

  const isInitialized = ref(false);

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

  /** 初始化采样器服务 (需在 AudioContext 就绪后调用) */
  async function init(ctx: BaseAudioContext) {
    if (isInitialized.value) return;
    audioContext = ctx;
    isInitialized.value = true;
    logger.info("[SamplerService] Initialized");
  }

  /** 根据 factory 类型创建 smplr 乐器实例 */
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
      onLoadProgress: (progress: LoadProgress) => {
        store.setLoadProgress(progress);
      },
    };

    switch (info.factory) {
      case "splendid-grand-piano":
        return smplr.SplendidGrandPiano(ctx, {
          ...commonOptions,
          decayTime: 0.5,
        }) as unknown as SmplrInstance;

      case "soundfont":
        return smplr.Soundfont(ctx, {
          ...commonOptions,
          instrument: info.id,
        }) as unknown as SmplrInstance;

      case "electric-piano":
        return smplr.ElectricPiano(ctx, {
          ...commonOptions,
          instrument: info.id,
        }) as unknown as SmplrInstance;

      case "mallet":
        return smplr.Mallet(ctx, {
          ...commonOptions,
          instrument: info.id,
        }) as unknown as SmplrInstance;

      case "mellotron":
        return smplr.Mellotron(ctx, {
          ...commonOptions,
          instrument: info.id,
        }) as unknown as SmplrInstance;

      case "drum-machine":
        return smplr.DrumMachine(ctx, {
          ...commonOptions,
          instrument: "TR-808",
        }) as unknown as SmplrInstance;

      case "smolken":
        return smplr.Smolken(ctx, {
          ...commonOptions,
          instrument: info.id,
        }) as unknown as SmplrInstance;

      case "versilian":
        return smplr.Versilian(ctx, {
          ...commonOptions,
          instrument: info.id,
        }) as unknown as SmplrInstance;

      default:
        // 回退到 Soundfont
        return smplr.Soundfont(ctx, {
          ...commonOptions,
          instrument: info.id,
        }) as unknown as SmplrInstance;
    }
  }

  /** 加载并切换到指定音色 */
  async function loadInstrument(instrumentId: string): Promise<void> {
    if (!audioContext) {
      throw new Error("SamplerService not initialized. Call init() first.");
    }

    const catalog = store.gmInstrumentCatalog;
    const info = catalog.find((i) => i.id === instrumentId);
    if (!info) {
      throw new Error(`Unknown instrument: ${instrumentId}`);
    }

    // 如果已经在加载,不重复
    if (store.isLoading && store.currentInstrumentId === instrumentId) {
      return;
    }

    // 如果当前音色已加载,直接切换
    if (activeInstance.value && store.currentInstrumentId === instrumentId) {
      return;
    }

    // 销毁旧实例
    if (activeInstance.value) {
      activeInstance.value.stop();
      activeInstance.value.dispose();
      activeInstance.value = null;
    }

    store.setLoading(true);
    store.setError(null);
    store.setCurrentInstrument(instrumentId);
    store.updateInstrumentStatus(instrumentId, { loading: true });

    try {
      const instance = createInstrument(audioContext, info);
      await instance.ready;

      activeInstance.value = instance;
      store.setReady(true);
      store.setLoading(false);
      store.updateInstrumentStatus(instrumentId, { loaded: true, loading: false });
      logger.info(`[SamplerService] Loaded instrument: ${info.name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      store.setError(msg);
      store.setLoading(false);
      store.setReady(false);
      store.updateInstrumentStatus(instrumentId, { loading: false, error: msg });
      logger.error(`[SamplerService] Failed to load instrument: ${msg}`);
      throw err;
    }
  }

  /** 播放音符 */
  function playNote(
    note: number | string,
    velocity = 100,
    duration?: number,
  ): StopFn | null {
    if (!activeInstance.value) {
      logger.warn("[SamplerService] No instrument loaded");
      return null;
    }

    const event: NoteEvent = {
      note,
      velocity,
      ...(duration != null ? { duration } : {}),
    };

    return activeInstance.value.start(event);
  }

  /** 停止指定音符 */
  function stopNote(note: number | string) {
    if (!activeInstance.value) return;
    activeInstance.value.stop({ stopId: note });
  }

  /** 停止所有音符 */
  function stopAllNotes() {
    if (!activeInstance.value) return;
    activeInstance.value.stop();
  }

  /** 清除音色缓存 */
  async function clearCache() {
    // CacheStorage 的缓存由浏览器管理
    // 这里只需要清除 smplr 内部的 buffer 缓存
    if (sharedLoader) {
      // smplr 1.0 的 SampleLoader 内部会缓存已加载的 buffer
      // 重建 loader 来清除缓存
      sharedLoader = null;
    }
    logger.info("[SamplerService] Cache cleared");
  }

  /** 释放所有资源 */
  function dispose() {
    if (activeInstance.value) {
      activeInstance.value.stop();
      activeInstance.value.dispose();
      activeInstance.value = null;
    }
    if (sharedScheduler) {
      sharedScheduler.stop();
      sharedScheduler = null;
    }
    sharedLoader = null;
    audioContext = null;
    isInitialized.value = false;
    store.setReady(false);
    store.setCurrentInstrument("");
    logger.info("[SamplerService] Disposed");
  }

  return {
    // state
    isInitialized: readonly(isInitialized),

    // actions
    init,
    loadInstrument,
    playNote,
    stopNote,
    stopAllNotes,
    clearCache,
    dispose,
  };
}
