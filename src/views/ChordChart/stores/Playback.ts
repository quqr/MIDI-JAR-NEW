/**
 * 和弦谱伴奏播放 store。
 *
 * 职责（见计划 Phase 3）：
 * - 编排 timeline 编译 → 伴奏生成 → 调度器播放；
 * - 三轨乐器预载（piano / acoustic_bass / TR-808），进入视图即可后台调用 preload；
 * - **播放态锁定编辑**：`editLocked`（status !== "idle"）供编辑器禁用所有编辑入口；
 * - seek 语义：「当前 playIndex 之后最近的该 measureIndex 实例」（停止态取首个）。
 *
 * 乐器加载用独立 InstrumentCacheManager 实例（不切换全局 currentInstrument，
 * 不干扰 WaterfallPiano 的音色状态）。
 */

import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { createLogger } from "@/utils/logger";
import {
  initializeAudioContext,
  getAudioContext,
  getLoader,
  getScheduler,
} from "@/services/sampler/AudioContextService";
import { createInstrument } from "@/services/sampler/InstrumentFactory";
import { InstrumentCacheManager } from "@/services/sampler/InstrumentCacheManager";
import type { InstrumentInfo } from "@/stores/sampler";
import type { SmplrInstance } from "@/services/sampler/types";

import { compileTimeline, findEntryIndexAtBeat, findSeekEntryIndex } from "../playback/timeline";
import { ChartTooComplexError } from "../playback/timeline";
import { generateAccompaniment } from "../playback/compGenerator";
import type { AccompanimentTrack } from "../playback/compGenerator";
import { DEFAULT_GROOVE, grooveById, resolveGroove } from "../playback/grooves";
import type { Groove } from "../playback/grooves";
import { AccompanimentScheduler } from "../playback/AccompanimentScheduler";
import { useChordChartStore } from "./ChordChart";

const logger = createLogger("ChordChartPlayback");

/* ── 三轨乐器注册信息 ─────────────────────────────────── */

const PIANO_INFO: InstrumentInfo = {
  id: "splendid-grand-piano",
  name: "SplendidGrandPiano",
  category: "Piano",
  factory: "splendid-grand-piano",
};

const BASS_INFO: InstrumentInfo = {
  id: "acoustic_bass",
  name: "Acoustic Bass",
  category: "Bass",
  factory: "soundfont",
};

const DRUMS_INFO: InstrumentInfo = {
  id: "TR-808",
  name: "TR-808",
  category: "Drums",
  factory: "drum-machine",
};

export type PlaybackStatus = "idle" | "playing" | "paused";

export const usePlaybackStore = defineStore("chordChartPlayback", () => {
  /* ── 状态 ─────────────────────────────────────────── */

  const status = ref<PlaybackStatus>("idle");
  const currentMeasureIndex = ref(0);
  const currentPlayIndex = ref(0);
  const chorusIndex = ref(0);
  const tempoScale = ref(1);
  const transposition = ref(0);
  const mutedTracks = ref<Record<AccompanimentTrack, boolean>>({
    piano: false,
    bass: false,
    drums: false,
  });
  /** null = 跟随 meta.style */
  const grooveId = ref<string | null>(null);
  const isLoadingInstruments = ref(false);
  const instrumentLoadError = ref<string | null>(null);
  const compileError = ref<string | null>(null);

  /* ── 引擎对象（非响应式） ─────────────────────────── */

  let scheduler: AccompanimentScheduler | null = null;
  /** 当前时间线缓存（播放期间复用） */
  let timelineEntries: ReturnType<typeof compileTimeline>["entries"] = [];
  let pausedBeat = 0;

  function ensureScheduler(): AccompanimentScheduler {
    if (!scheduler) scheduler = new AccompanimentScheduler();
    return scheduler;
  }

  /** 独立缓存管理器：三轨乐器池，不触碰全局 currentInstrument */
  let cacheManager: InstrumentCacheManager | null = null;

  function ensureCacheManager(): InstrumentCacheManager {
    if (!cacheManager) {
      cacheManager = new InstrumentCacheManager({
        createContext: initializeAudioContext,
        createInstrument: (info) =>
          createInstrument(
            getAudioContext(),
            getLoader(getAudioContext()),
            getScheduler(getAudioContext()),
            info,
          ),
      });
    }
    return cacheManager;
  }

  /* ── 派生 ─────────────────────────────────────────── */

  /** 播放/暂停态锁定编辑（P0-2） */
  const editLocked = computed(() => status.value !== "idle");

  const chartStore = useChordChartStore();

  /** 生效 groove：显式选择优先，否则按 meta.style 文本解析 */
  const activeGroove = computed<Groove>(() => {
    if (grooveId.value) return grooveById(grooveId.value);
    return resolveGroove(chartStore.chart.meta.style);
  });

  const chorusCount = computed(() => Math.max(1, chartStore.chart.meta.repeats ?? 1));

  /* ── 乐器加载 ─────────────────────────────────────── */

  /** 预载三轨乐器（进入视图时后台调用，幂等） */
  async function preloadInstruments(): Promise<void> {
    if (isLoadingInstruments.value || instrumentLoadError.value) return;
    isLoadingInstruments.value = true;
    instrumentLoadError.value = null;
    const manager = ensureCacheManager();
    try {
      for (const info of [PIANO_INFO, BASS_INFO, DRUMS_INFO]) {
        await manager.load(info.id, info);
      }
    } catch (err) {
      instrumentLoadError.value = err instanceof Error ? err.message : String(err);
      logger.error("[ChordChartPlayback] instrument load failed: %s", instrumentLoadError.value);
    } finally {
      isLoadingInstruments.value = false;
    }
  }

  /** 从缓存池取出三轨实例 */
  function resolveInstruments():
    | { piano: SmplrInstance; bass: SmplrInstance; drums: SmplrInstance }
    | null {
    const manager = ensureCacheManager();
    const get = (id: string): SmplrInstance | null => manager.getEntry(id)?.instrument ?? null;
    const piano = get(PIANO_INFO.id);
    const bass = get(BASS_INFO.id);
    const drums = get(DRUMS_INFO.id);
    if (!piano || !bass || !drums) return null;
    return { piano, bass, drums };
  }

  /* ── 播放控制 ─────────────────────────────────────── */

  /** 编译时间线 + 生成伴奏 + 装载调度器（每次播放前调用，保证用最新谱面） */
  function preparePlayback(): boolean {
    compileError.value = null;
    try {
      const timeline = compileTimeline(chartStore.chart);
      if (timeline.entries.length === 0) {
        compileError.value = "chordChart.playback.error.emptyChart";
        return false;
      }
      timelineEntries = timeline.entries;
      if (timeline.warnings.length > 0) {
        logger.warn("[ChordChartPlayback] timeline warnings: %j", timeline.warnings);
      }
      const groove = activeGroove.value;
      const events = generateAccompaniment(chartStore.chart, timeline, groove);
      const sched = ensureScheduler();
      sched.load(events, groove, chartStore.chart.meta.tempo);
      return true;
    } catch (err) {
      if (err instanceof ChartTooComplexError) {
        compileError.value = "chordChart.playback.error.tooComplex";
      } else {
        compileError.value = "chordChart.playback.error.compile";
        logger.error("[ChordChartPlayback] compile failed: %s", err);
      }
      return false;
    }
  }

  function applyTick(beat: number): void {
    const idx = findEntryIndexAtBeat(timelineEntries, beat);
    if (idx < 0) return;
    const entry = timelineEntries[idx];
    currentMeasureIndex.value = entry.measureIndex;
    currentPlayIndex.value = entry.playIndex;
    chorusIndex.value = entry.chorusIndex;
  }

  /** 开始/恢复播放。fromBeat 缺省：暂停态续播，否则从头。 */
  async function play(fromBeat?: number): Promise<void> {
    if (status.value === "playing") return;

    // 乐器未就绪 → 先加载
    if (!resolveInstruments()) {
      await preloadInstruments();
      if (!resolveInstruments()) return; // 加载失败：instrumentLoadError 已记录
    }
    const instruments = resolveInstruments()!;

    // 暂停续播不需要重编译；其余情况重编译（谱面可能已改）
    if (status.value !== "paused" || timelineEntries.length === 0) {
      if (!preparePlayback()) return;
      pausedBeat = 0;
    }

    const sched = ensureScheduler();
    sched.setInstruments(instruments);
    sched.setTempoScale(tempoScale.value);
    sched.setTransposition(transposition.value);
    for (const track of ["piano", "bass", "drums"] as const) {
      sched.setMuted(track, mutedTracks.value[track]);
    }

    const startBeat = fromBeat ?? pausedBeat;
    try {
      sched.start(startBeat, {
        onTick: applyTick,
        onEnded: () => stop(),
      });
      status.value = "playing";
      applyTick(startBeat);
    } catch (err) {
      logger.error("[ChordChartPlayback] start failed: %s", err);
      status.value = "idle";
    }
  }

  /** 暂停（记录 beat，可续播） */
  function pause(): void {
    if (status.value !== "playing") return;
    pausedBeat = ensureScheduler().pause();
    status.value = "paused";
  }

  /** 停止（归零，解除编辑锁定） */
  function stop(): void {
    ensureScheduler().stop();
    status.value = "idle";
    currentMeasureIndex.value = 0;
    currentPlayIndex.value = 0;
    chorusIndex.value = 0;
    pausedBeat = 0;
  }

  /** seek：当前 playIndex 之后最近的该 measureIndex 实例；停止态取首个实例 */
  function seek(measureIndex: number): void {
    const fromPlay = status.value === "idle" ? null : currentPlayIndex.value;
    const idx = findSeekEntryIndex(timelineEntries, measureIndex, fromPlay);
    if (idx < 0) return;
    const entry = timelineEntries[idx];
    if (status.value === "playing") {
      // 热跳转：重新从该 beat 起（调度器重锚 + 重定位事件索引）
      pausedBeat = 0;
      ensureScheduler().stop();
      ensureScheduler().start(entry.startBeat, { onTick: applyTick, onEnded: () => stop() });
    } else {
      pausedBeat = entry.startBeat;
    }
    currentMeasureIndex.value = entry.measureIndex;
    currentPlayIndex.value = entry.playIndex;
    chorusIndex.value = entry.chorusIndex;
  }

  /* ── 参数调整 ─────────────────────────────────────── */

  function setTempoScale(scale: number): void {
    tempoScale.value = Math.min(1.5, Math.max(0.5, scale));
    if (status.value === "playing") ensureScheduler().setTempoScale(tempoScale.value);
  }

  function setTranspose(semis: number): void {
    transposition.value = Math.min(12, Math.max(-12, Math.round(semis)));
    ensureScheduler().setTransposition(transposition.value);
  }

  function toggleMute(track: AccompanimentTrack): void {
    mutedTracks.value[track] = !mutedTracks.value[track];
    ensureScheduler().setMuted(track, mutedTracks.value[track]);
  }

  function setGroove(id: string | null): void {
    grooveId.value = id;
    // 播放中切换风格：下一轮 preparePlayback 生效（不在热切换上花复杂度）
  }

  return {
    // state
    status,
    currentMeasureIndex,
    currentPlayIndex,
    chorusIndex,
    tempoScale,
    transposition,
    mutedTracks,
    grooveId,
    isLoadingInstruments,
    instrumentLoadError,
    compileError,
    // computed
    editLocked,
    activeGroove,
    chorusCount,
    // actions
    preloadInstruments,
    play,
    pause,
    stop,
    seek,
    setTempoScale,
    setTranspose,
    toggleMute,
    setGroove,
    // 供 UI 展示默认 groove
    defaultGroove: DEFAULT_GROOVE,
  };
});
