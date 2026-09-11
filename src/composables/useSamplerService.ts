import type { NoteEvent, StopFn } from "smplr";
import { watch } from "vue";
import { useSamplerStore, instrumentEvents } from "@/stores/sampler";
import { useVstStore } from "@/stores/vst";
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
import type { ToneSource } from "@/types/vst";

// 重新导出类型以保持向后兼容（原 useSamplerService.ts L606-610）
export type { BatchDownloadResult } from "@/services/sampler/types";

const logger = createLogger("SamplerService");

// ─── VST 后端（B2 架构缝） ───
// 音源来源在 store 里是单一决策源；这里把 8 个播放入口按 toneSource 分流。
// 公开签名与 smplr 路径完全一致（失败一律静默返回 null/undefined），
// 因此 5+ 个直接调用 useSamplerService() 的模块无需任何改动。
//
// VST 路径**不做** isReady 门控（那是采样器的加载语义）；
// 是否发声由 soundEnabled 与后端状态机共同决定。

/** 读取当前音源来源 */
function currentToneSource(): ToneSource {
  return useSamplerStore().toneSource;
}

/** 是否处于"无音源"静默态（出厂默认；不出声、不初始化音频） */
function isSilent(): boolean {
  return currentToneSource() === "none";
}

/**
 * 是否允许 VST 发声。
 *
 * - `soundEnabled` 是全局开关，对两条路径同等生效；
 * - 后端必须处于 `running`（插件已加载且音频流已起）；
 * - 崩溃态（`error`）下**停止接收 MIDI**——这是 ADR 0021 的显式约定。
 */
function vstCanSound(): boolean {
  const vst = useVstStore();
  return (
    useSamplerStore().soundEnabled === true && vst.status.state === "running"
  );
}

/**
 * 把 note 归一为 0-127 的 MIDI 音高号。
 *
 * 调用方常传 `number`，但 `useScalePlayer` 走 tonal 转换后仍可能是字符串；
 * 采样器路径把字符串交给 smplr 自行解析，VST 路径则必须自己转。
 */
function toMidiNumber(note: number | string): number | null {
  if (typeof note === "number") {
    return Number.isFinite(note)
      ? Math.max(0, Math.min(127, Math.round(note)))
      : null;
  }
  // 形如 "C4" / "C#4" / "Db4"
  const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(note.trim());
  if (!match) return null;
  const [, letter, accidental, octaveText] = match;
  const semitones: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  const base = semitones[letter.toUpperCase()];
  if (base == null) return null;
  const shift = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  // 科学音高记号：C4 = 60 → (octave + 1) * 12 + semitone
  const midi = (Number(octaveText) + 1) * 12 + base + shift;
  if (!Number.isFinite(midi)) return null;
  return Math.max(0, Math.min(127, Math.round(midi)));
}

/** 归一 velocity（0-127）到 MIDI 字节的 0-127 */
function toMidiVelocity(velocity: number): number {
  if (!Number.isFinite(velocity)) return 100;
  return Math.max(0, Math.min(127, Math.round(velocity)));
}

// MIDI 状态字节。VST 插件监听的是 0-based 通道号（channel 0 = MIDI 通道 1）。
const MIDI_CHANNEL_0 = 0;
const STATUS_NOTE_ON = 0x90 | MIDI_CHANNEL_0;
/** 全部音符关闭（CC 123）；用于 stopAllNotes 与加载/卸载时的兜底清音 */
const STATUS_CC = 0xb0 | MIDI_CHANNEL_0;
const CC_ALL_NOTES_OFF = 123;

/**
 * 从联盟类型 `NoteEvent` 取出 note / velocity。
 * `smplr` 的 `NoteEvent` 可能是完整对象、音名或 MIDI 号，VST 路径必须自行归一。
 */
function splitNoteEvent(event: NoteEvent): {
  note: number | string;
  velocity: number;
} {
  if (typeof event === "string" || typeof event === "number") {
    return { note: event, velocity: 100 };
  }
  return { note: event.note, velocity: event.velocity ?? 100 };
}

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

// ─── 播放（按音源来源分流） ───
/** 播放音符（持续模式 — 直到调用 noteOff 或 stopNote） */
function noteOn(note: number | string, velocity = 100): StopFn | null {
  if (isSilent()) return null;
  if (currentToneSource() === "vst") {
    if (vstCanSound()) {
      const midi = toMidiNumber(note);
      if (midi != null) {
        void useVstStore().sendMidi([
          STATUS_NOTE_ON,
          midi,
          toMidiVelocity(velocity),
        ]);
      }
    }
    return null;
  }

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
  if (isSilent()) return;
  if (currentToneSource() === "vst") {
    // noteOff 始终发送：即使插件刚崩溃，清音也是安全且必要的
    if (vstCanSound()) {
      const midi = toMidiNumber(note);
      if (midi != null) {
        // 用 noteOn velocity=0 更稳妥：部分插件只实现 Note On
        void useVstStore().sendMidi([STATUS_NOTE_ON, midi, 0]);
      }
    }
    return;
  }

  const inst = cacheManager.getActive();
  if (!inst) return;
  try {
    inst.stop({ stopId: note });
  } catch (err) {
    logger.error("[SamplerService] noteOff error: %s", err);
  }
}

// ─── 前瞻调度（score-scroll 播放：按 AudioContext 时间精确发声） ───

/** 音频时钟当前值（AudioContext 秒）；无活动乐器时返回 null */
function getAudioNow(): number | null {
  // 时钟始终取 smplr 的 AudioContext：VST 路径下后端音频流由 cpal 驱动，
  // 其时钟无法（也不应由）前端读取，故返回 null → 调用方退化为立即触发。
  const inst = cacheManager.getActive();
  return inst ? inst.context.currentTime : null;
}

/**
 * 前瞻调度：按 AudioContext 时间精确触发音符（smplr 原生 time 支持），
 * 主线程卡顿不影响发声时刻。event 需携带唯一 stopId 供取消。
 *
 * VST 路径没有对等的“定时投递”API（`send_vst_midi` 是立即入队），
 * 因此退化为立即发送；调用方的调度循环仍按自身节奏触发。
 */
function scheduleNoteEvent(event: NoteEvent): StopFn | null {
  if (isSilent()) return null;
  if (currentToneSource() === "vst") {
    if (vstCanSound()) {
      const { note, velocity } = splitNoteEvent(event);
      const midi = toMidiNumber(note);
      if (midi != null) {
        void useVstStore().sendMidi([
          STATUS_NOTE_ON,
          midi,
          toMidiVelocity(velocity),
        ]);
      }
    }
    return null;
  }

  const inst = cacheManager.getActive();
  if (!inst) return null;
  try {
    return inst.start(event);
  } catch (err) {
    logger.error("[SamplerService] scheduleNoteEvent error: %s", err);
    return null;
  }
}

/** 按 stopId 停止/取消前瞻调度的音符（time 省略 = 立即） */
function stopByStopId(stopId: string | number, time?: number): void {
  if (isSilent()) return;
  if (currentToneSource() === "vst") {
    if (vstCanSound()) {
      const midi = toMidiNumber(stopId);
      if (midi != null) {
        void useVstStore().sendMidi([STATUS_NOTE_ON, midi, 0]);
      }
    }
    return;
  }

  const inst = cacheManager.getActive();
  if (!inst) return;
  try {
    inst.stop({ stopId, ...(time != null ? { time } : {}) });
  } catch (err) {
    logger.error("[SamplerService] stopByStopId error: %s", err);
  }
}

/**
 * `playNote` 固定时长模式的 VST 补发 noteOff 定时器。
 * 按 MIDI 音高号索引：同一音高再次触发时取消上一个，避免“旧定时器把新音符掐掉”。
 */
const vstNoteOffTimers = new Map<number, ReturnType<typeof setTimeout>>();

/** 安排一次 VST noteOff；同音高重复触发会重置计时 */
function scheduleVstNoteOff(midi: number, delayMs: number) {
  const previous = vstNoteOffTimers.get(midi);
  if (previous != null) clearTimeout(previous);

  const timer = setTimeout(() => {
    vstNoteOffTimers.delete(midi);
    void useVstStore().sendMidi([STATUS_NOTE_ON, midi, 0]);
  }, delayMs);
  vstNoteOffTimers.set(midi, timer);
}

/** 清空全部待发的 VST noteOff（切音源/释放时调用） */
function clearVstNoteOffTimers() {
  for (const timer of vstNoteOffTimers.values()) clearTimeout(timer);
  vstNoteOffTimers.clear();
}

/** 播放音符（固定时长模式） */
function playNote(
  note: number | string,
  velocity = 100,
  duration?: number,
): StopFn | null {
  if (isSilent()) return null;
  if (currentToneSource() === "vst") {
    if (vstCanSound()) {
      const midi = toMidiNumber(note);
      if (midi != null) {
        const vel = toMidiVelocity(velocity);
        void useVstStore().sendMidi([STATUS_NOTE_ON, midi, vel]);
        if (duration != null && duration > 0) {
          // 前端定时 noteOff；duration 单位与 smplr 路径一致（秒）
          scheduleVstNoteOff(midi, duration * 1000);
        }
      }
    }
    return null;
  }

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
  if (isSilent()) return;
  noteOff(note);
}

/** 停止所有音符 */
function stopAllNotes(): void {
  if (isSilent()) return;
  if (currentToneSource() === "vst") {
    clearVstNoteOffTimers();
    // 用 CC 123 (All Notes Off) 一次性清音，避免逐音符补发 noteOff
    if (useVstStore().status.state === "running") {
      void useVstStore().sendMidi([STATUS_CC, CC_ALL_NOTES_OFF, 0]);
    }
    return;
  }

  const inst = cacheManager.getActive();
  if (!inst) return;
  try {
    inst.stop();
  } catch (err) {
    logger.error("[SamplerService] stopAllNotes error: %s", err);
  }
}

// ─── 切换音源时的 VST 卸载延迟（L2） ───
// 用户切到内置采样器后，插件**不立即卸载**：来回切换是高频操作，而 VST 重载需要
// 重新 dlopen + 起音频流（数百毫秒到数秒，还可能有授权弹窗）。延迟窗口内切回则取消。
const VST_UNLOAD_DELAY_MS = 30_000;
let vstUnloadTimer: ReturnType<typeof setTimeout> | null = null;

/** 取消待执行的 VST 卸载 */
function cancelVstUnload() {
  if (vstUnloadTimer != null) {
    clearTimeout(vstUnloadTimer);
    vstUnloadTimer = null;
  }
}

/** 安排一次延迟卸载；重复调用会重置计时 */
function scheduleVstUnload() {
  cancelVstUnload();
  vstUnloadTimer = setTimeout(() => {
    vstUnloadTimer = null;
    void useVstStore().unload();
  }, VST_UNLOAD_DELAY_MS);
}

/**
 * 安装 toneSource 切换副作用（幂等）。
 *
 * - 切到 `vst`：取消待卸载，并把该加载的插件加载起来（若有选中项）；
 * - 切到 `sampler` / `none`：先清音（避免卡住的 note），再延迟卸载插件。
 *
 * 由 Sampler 页面在挂载时调用一次；store 在切换时就地生效。
 */
let toneSourceWatcherInstalled = false;
function installToneSourceWatcher() {
  if (toneSourceWatcherInstalled) return;
  toneSourceWatcherInstalled = true;

  const samplerStore = useSamplerStore();
  watch(
    () => samplerStore.toneSource,
    (next) => {
      if (next === "vst") {
        cancelVstUnload();
      } else {
        // 采样器路径下 VST 不再发声，先把挂着的音符与待发 noteOff 清掉
        clearVstNoteOffTimers();
        void useVstStore().sendMidi([STATUS_CC, CC_ALL_NOTES_OFF, 0]);
        scheduleVstUnload();
      }
    },
  );
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
  cancelVstUnload();
  clearVstNoteOffTimers();
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
    getAudioNow,
    scheduleNoteEvent,
    stopByStopId,
    stopNote,
    stopAllNotes,
    getCacheSize,
    clearCache,
    dispose,
    batchDownloadInstruments,
    /** 安装 toneSource 切换副作用（Sampler 页挂载时调用一次，幂等） */
    installToneSourceWatcher,
    /** 取消待执行的 VST 卸载（外部需要保活插件时调用） */
    cancelVstUnload,
  };
}
