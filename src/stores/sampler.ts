import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import type { LoadProgress } from "smplr";
import { loadFromStorage, saveToStorage } from "@/helpers/storage";
import { InstrumentEvents } from "@/types/instrument-events";
import { createLogger } from "@/utils/logger";

import instrumentsData from "@/data/instruments.json";

const SAMPLER_STORAGE_KEY = "midi-jar-sampler-state";
const SAMPLER_CACHE_KEY = "midi-jar-sampler-cached-instruments";

const logger = createLogger("sampler");

/** 音色工厂类型 */
export type InstrumentFactoryType =
  | "soundfont"
  | "splendid-grand-piano"
  | "electric-piano"
  | "mallet"
  | "mellotron"
  | "drum-machine"
  | "smolken"
  | "versilian"
  | "drum-abuse";

/** 音色注册信息 */
export type InstrumentInfo = {
  id: string;
  name: string;
  category: InstrumentCategory;
  factory: InstrumentFactoryType;
  /** smplr instrument 选项 (传给工厂的额外参数) */
  factoryOptions?: Record<string, unknown>;
  loaded?: boolean;
  loading?: boolean;
  error?: string;
  /** 加载进度 (0-100) */
  loadProgress?: number;
};

/** GM 音色分类 */
export type InstrumentCategory =
  | "Piano"
  | "Chromatic Percussion"
  | "Organ"
  | "Guitar"
  | "Bass"
  | "Strings"
  | "Ensemble"
  | "Brass"
  | "Reed"
  | "Pipe"
  | "Synth Lead"
  | "Synth Pad"
  | "Synth Effects"
  | "Ethnic"
  | "Percussive"
  | "Sound Effects"
  | "Drums";

/** JSON 音色数据类型 */
type InstrumentJsonData = {
  version: string;
  instruments: Array<{
    id: string;
    name: string;
    gmProgram: number | null;
    category: InstrumentCategory;
    factory: string;
    factoryOptions?: Record<string, unknown>;
  }>;
  categories: InstrumentCategory[];
};

/** 从 JSON 数据转换音色列表 */
function parseInstrumentsFromJson(data: InstrumentJsonData): InstrumentInfo[] {
  return data.instruments.map((inst) => ({
    id: inst.id,
    name: inst.name,
    category: inst.category,
    factory: inst.factory as InstrumentFactoryType,
    factoryOptions: inst.factoryOptions,
  }));
}

/** 默认音色列表（从 JSON 静态加载） */
const DEFAULT_INSTRUMENTS: InstrumentInfo[] = parseInstrumentsFromJson(
  instrumentsData as InstrumentJsonData,
);

export const INSTRUMENT_CATEGORIES: InstrumentCategory[] = [
  "Piano",
  "Chromatic Percussion",
  "Organ",
  "Guitar",
  "Bass",
  "Strings",
  "Ensemble",
  "Brass",
  "Reed",
  "Pipe",
  "Synth Lead",
  "Synth Pad",
  "Synth Effects",
  "Ethnic",
  "Percussive",
  "Sound Effects",
  "Drums",
];

// ─── 模块级事件实例（与 service 共享） ───
export const instrumentEvents = new InstrumentEvents();

export const useSamplerStore = defineStore("sampler", () => {
  // --- State ---
  const currentInstrumentId = ref<string | null>(null);
  const instruments = ref<Record<string, InstrumentInfo>>({});
  const isLoading = ref(false);
  const isReady = ref(false);
  const loadProgress = ref<LoadProgress>({ loaded: 0, total: 0 });
  const error = ref<string | null>(null);
  /** 全局声音开关 — 控制所有页面是否使用采样器发声 */
  const soundEnabled = ref(true);
  /** 动态加载的音色列表 */
  const instrumentCatalog = ref<InstrumentInfo[]>(DEFAULT_INSTRUMENTS);
  /** 是否正在刷新音色列表 */
  const isRefreshing = ref(false);
  /** 是否正在批量下载 */
  const isBatchDownloading = ref(false);
  /** 批量下载进度 (0-100) */
  const batchDownloadProgress = ref(0);
  /** 批量下载总数 */
  const batchDownloadTotal = ref(0);
  /** 批量下载已完成数 */
  const batchDownloadCompleted = ref(0);

  // --- 持久化：仅保存 currentInstrumentId 和 soundEnabled ---
  const savedState = loadFromStorage<{
    currentInstrumentId: string | null;
    soundEnabled: boolean;
  }>({
    key: SAMPLER_STORAGE_KEY,
    defaultValue: { currentInstrumentId: null, soundEnabled: true },
  });
  if (savedState.currentInstrumentId) {
    currentInstrumentId.value = savedState.currentInstrumentId;
  }
  if (typeof savedState.soundEnabled === "boolean") {
    soundEnabled.value = savedState.soundEnabled;
  }

  // 自动持久化关键状态
  watch(
    [currentInstrumentId, soundEnabled],
    ([id, enabled]) => {
      saveToStorage(SAMPLER_STORAGE_KEY, {
        currentInstrumentId: id,
        soundEnabled: enabled,
      });
    },
    { deep: true },
  );

  /** 获取上次成功加载的乐器 ID（供 Sampler 页面 onMounted 恢复用） */
  const savedInstrumentId = computed(() => {
    const id = loadFromStorage<{ currentInstrumentId: string | null }>({
      key: SAMPLER_STORAGE_KEY,
      defaultValue: { currentInstrumentId: null },
    }).currentInstrumentId;
    return id;
  });

  // --- Getters ---
  const currentInstrument = computed<InstrumentInfo | null>(() => {
    if (!currentInstrumentId.value) return null;
    return instruments.value[currentInstrumentId.value] ?? null;
  });

  const gmInstrumentCatalog = computed<InstrumentInfo[]>(() => {
    return instrumentCatalog.value;
  });

  /** GM 音色字典（O(1) 查找） */
  const gmInstrumentCatalogMap = computed<Map<string, InstrumentInfo>>(() => {
    const map = new Map<string, InstrumentInfo>();
    for (const inst of instrumentCatalog.value) {
      map.set(inst.id, inst);
    }
    return map;
  });

  const instrumentsByCategory = computed<
    Record<InstrumentCategory, InstrumentInfo[]>
  >(() => {
    const result: Record<string, InstrumentInfo[]> = {};
    for (const inst of instrumentCatalog.value) {
      if (!result[inst.category]) result[inst.category] = [];
      result[inst.category].push(inst);
    }
    return result as Record<InstrumentCategory, InstrumentInfo[]>;
  });

  // --- Actions（仅保留非事件驱动的） ---
  function registerInstrument(info: InstrumentInfo) {
    instruments.value[info.id] = { ...info };
  }

  /**
   * 持久化已缓存乐器列表到 localStorage
   */
  function persistCachedInstruments() {
    const cachedIds: string[] = [];
    for (const [id, inst] of Object.entries(instruments.value)) {
      if (inst.loaded) {
        cachedIds.push(id);
      }
    }
    saveToStorage(SAMPLER_CACHE_KEY, cachedIds);
  }

  /**
   * 从 localStorage 恢复已缓存乐器的 UI 状态
   * （实际音频数据在 CacheStorage 中，刷新不丢失）
   */
  function restoreCachedInstruments() {
    const cachedIds = loadFromStorage<string[]>({
      key: SAMPLER_CACHE_KEY,
      defaultValue: [],
    });

    if (cachedIds.length === 0) return;

    for (const id of cachedIds) {
      // 在 catalog 中查找乐器信息
      const info = instrumentCatalog.value.find((inst) => inst.id === id);
      if (info) {
        instruments.value[id] = {
          ...info,
          loaded: true,
          loading: false,
          loadProgress: 100,
        };
      }
    }

    logger.debug(
      "[sampler] Restored %d cached instruments from localStorage",
      cachedIds.length,
    );
  }

  // 初始化时恢复缓存状态
  restoreCachedInstruments();

  // 如果有保存的当前乐器且已缓存，恢复 isReady 状态
  if (
    currentInstrumentId.value &&
    instruments.value[currentInstrumentId.value]?.loaded
  ) {
    isReady.value = true;
  }

  /**
   * 从 JSON 文件加载音色列表
   */
  async function loadInstrumentsFromJSON(
    jsonPath?: string,
  ): Promise<InstrumentInfo[]> {
    try {
      if (jsonPath) {
        const response = await fetch(jsonPath);
        const data = (await response.json()) as InstrumentJsonData;
        return parseInstrumentsFromJson(data);
      }
      return DEFAULT_INSTRUMENTS;
    } catch (err) {
      console.error("[sampler] Failed to load instruments JSON:", err);
      return DEFAULT_INSTRUMENTS;
    }
  }

  /**
   * 刷新音色列表
   */
  async function refreshInstrumentList(): Promise<void> {
    if (isRefreshing.value) return;

    isRefreshing.value = true;
    try {
      const newList = await loadInstrumentsFromJSON();
      instrumentCatalog.value = newList;
    } finally {
      isRefreshing.value = false;
    }
  }

  // --- 事件订阅：store 自行响应事件更新状态 ---
  let eventsSubscribed = false;

  /**
   * 订阅事件（延迟初始化，避免循环依赖）
   * 在 service 初始化后调用
   */
  function subscribeToEvents() {
    if (eventsSubscribed) return;
    eventsSubscribed = true;

    // 加载开始 → 更新全局状态
    instrumentEvents.onLoadStart.add((args) => {
      registerInstrument(args.instrument);
      isLoading.value = true;
      error.value = null;
      currentInstrumentId.value = args.instrumentId;

      const inst = instruments.value[args.instrumentId];
      if (inst) {
        inst.loading = true;
        inst.loadProgress = 0;
      }
    });

    // 加载进度 → 更新单个乐器进度
    instrumentEvents.onLoadProgress.add((args) => {
      const inst = instruments.value[args.instrumentId];
      if (inst) {
        inst.loadProgress = args.progress;
      }
      // 同步更新全局进度（兼容旧代码）
      loadProgress.value = {
        loaded: args.progress,
        total: 100,
      };
    });

    // 加载成功 → 更新状态 + 持久化缓存列表
    instrumentEvents.onLoadSuccess.add((args) => {
      isReady.value = true;
      isLoading.value = false;
      currentInstrumentId.value = args.instrumentId;

      const inst = instruments.value[args.instrumentId];
      if (inst) {
        inst.loaded = true;
        inst.loading = false;
        inst.loadProgress = 100;
      }

      // 持久化已缓存乐器列表
      persistCachedInstruments();
    });

    // 加载失败 → 更新状态 + 从缓存列表移除
    instrumentEvents.onLoadError.add((args) => {
      isLoading.value = false;
      error.value = args.error.message;

      const inst = instruments.value[args.instrumentId];
      if (inst) {
        inst.loading = false;
        inst.error = args.error.message;
        inst.loadProgress = 0;
        inst.loaded = false;
      }

      // 更新持久化缓存列表
      persistCachedInstruments();
    });

    // 缓存切换 → 更新状态
    instrumentEvents.onCacheSwitch.add((args) => {
      currentInstrumentId.value = args.instrumentId;
      isReady.value = true;
      isLoading.value = false;
    });

    // 批量下载开始
    instrumentEvents.onBatchStart.add((args) => {
      isBatchDownloading.value = true;
      batchDownloadTotal.value = args.total;
      batchDownloadCompleted.value = 0;
      batchDownloadProgress.value = 0;
    });

    // 批量下载进度
    instrumentEvents.onBatchProgress.add((args) => {
      batchDownloadCompleted.value = args.completed;
      batchDownloadProgress.value = args.progress;
    });

    // 批量下载完成
    instrumentEvents.onBatchComplete.add(() => {
      isBatchDownloading.value = false;
      batchDownloadProgress.value = 100;
    });
  }

  return {
    // state
    currentInstrumentId,
    instruments,
    isLoading,
    isReady,
    loadProgress,
    error,
    soundEnabled,
    instrumentCatalog,
    isRefreshing,
    isBatchDownloading,
    batchDownloadProgress,
    batchDownloadTotal,
    batchDownloadCompleted,
    // getters
    currentInstrument,
    gmInstrumentCatalog,
    gmInstrumentCatalogMap,
    instrumentsByCategory,
    savedInstrumentId,
    // actions
    registerInstrument,
    loadInstrumentsFromJSON,
    refreshInstrumentList,
    subscribeToEvents,
  };
});
