import type { LoadProgress, NoteEvent, StopFn } from "smplr";
import type { InstrumentInfo } from "@/stores/sampler";

/** smplr 实例的公共接口（替代原 useSamplerService.ts L12-19 的本地类型） */
export interface SmplrInstance {
  ready: Promise<void>;
  start(event: NoteEvent): StopFn;
  stop(target?: unknown): void;
  output: { volume: number; disconnect: () => void };
  loadProgress: LoadProgress;
  dispose: () => void;
}

/** 缓存条目状态机（原 InstrumentCacheInfo，L43-54） */
export type CacheState = "idle" | "loading" | "ready" | "error";

export interface CacheEntry {
  /** 乐器实例（加载完成后不为 null） */
  instrument: SmplrInstance | null;
  /** 加载中的 Promise（加载完成后清理） */
  loadingPromise: Promise<LoadResult> | null;
  /** 当前状态 */
  state: CacheState;
  /** 错误信息（失败时存储） */
  error?: Error;
  /** 重试次数 */
  retryCount: number;
}

/** 加载结果（CacheManager.load 返回值，供 Facade 翻译为事件） */
export interface LoadResult {
  instance: SmplrInstance;
  /** 是否直接命中缓存（未重新创建实例） */
  fromCache: boolean;
}

/** 加载选项（CacheManager.load 入参） */
export interface LoadOptions {
  /** 进度回调（CacheManager 内部轮询 loadProgress 时调用，不触发事件） */
  onProgress?: (percent: number) => void;
}

/** 批量下载结果（原 useSamplerService.ts L606-610，重新导出以保持兼容） */
export type BatchDownloadResult = {
  succeeded: string[];
  failed: Array<{ id: string; error: string }>;
};

/** CacheManager 依赖注入接口（使其不直接依赖 Tone/smplr） */
export interface CacheManagerDeps {
  /** 确保 AudioContext 已初始化，返回 ctx */
  createContext: () => Promise<BaseAudioContext>;
  /** 根据乐器信息创建 smplr 实例 */
  createInstrument: (info: InstrumentInfo) => SmplrInstance;
}
