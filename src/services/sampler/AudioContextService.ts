import { readonly, ref } from "vue";
import * as Tone from "tone";
import * as smplr from "smplr";
import { createLogger } from "@/utils/logger";

const logger = createLogger("AudioContextService");

// ─── 模块级单例 ───
// 仅管理 Tone.js 启动 + smplr Loader/Scheduler 单例 + audioContext 引用。
// 浏览器自动播放策略解锁由 src/composables/useAudioContext.ts 负责，本模块不参与。
let audioContext: BaseAudioContext | null = null;
let sharedLoader: smplr.SampleLoader | null = null;
let sharedScheduler: smplr.Scheduler | null = null;
const isInitialized = ref(false);

/** 获取 Tone 的底层 AudioContext（不触发启动） */
export function getAudioContext(): BaseAudioContext {
  return Tone.getContext().rawContext as unknown as BaseAudioContext;
}

/** 启动 Tone 并初始化 audioContext（幂等） */
export async function initializeAudioContext(): Promise<BaseAudioContext> {
  if (isInitialized.value && audioContext) {
    return audioContext;
  }
  await Tone.start();
  audioContext = getAudioContext();
  isInitialized.value = true;
  logger.info("[AudioContextService] Initialized (lazy)");
  return audioContext;
}

/** 获取/创建共享 SampleLoader（同一 ctx 上单例） */
export function getLoader(ctx: BaseAudioContext): smplr.SampleLoader {
  if (!sharedLoader) {
    sharedLoader = smplr.SampleLoader(ctx, {
      storage: smplr.CacheStorage("midi-jar-sampler"),
    });
  }
  return sharedLoader;
}

/** 获取/创建共享 Scheduler（同一 ctx 上单例） */
export function getScheduler(ctx: BaseAudioContext): smplr.Scheduler {
  if (!sharedScheduler) {
    sharedScheduler = smplr.Scheduler(ctx, {
      lookaheadMs: 200,
      intervalMs: 50,
    });
  }
  return sharedScheduler;
}

/** 重置 Loader（clearCache 时调用，强制下次重建） */
export function resetLoader(): void {
  sharedLoader = null;
}

/** 停止并重置 Scheduler */
export function resetScheduler(): void {
  if (sharedScheduler) {
    try {
      sharedScheduler.stop();
    } catch (err) {
      logger.warn("[AudioContextService] scheduler stop error: %s", err);
    }
  }
  sharedScheduler = null;
}

/** 释放全部音频资源（保留 Tone 上下文本身，仅清理本模块持有的引用） */
export function disposeAudioContext(): void {
  resetScheduler();
  resetLoader();
  audioContext = null;
  isInitialized.value = false;
  logger.info("[AudioContextService] Disposed");
}

/** 只读初始化状态（供 Facade 重新导出） */
export const audioContextInitialized = readonly(isInitialized);
