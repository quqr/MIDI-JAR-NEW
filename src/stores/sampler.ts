import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import type { LoadProgress } from "smplr";
import { loadFromStorage, saveToStorage } from "@/helpers/storage";

import instrumentsData from "@/data/instruments.json";

const SAMPLER_STORAGE_KEY = "midi-jar-sampler-state";

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

  // --- Actions ---
  function registerInstrument(info: InstrumentInfo) {
    instruments.value[info.id] = { ...info };
  }

  function setCurrentInstrument(id: string) {
    currentInstrumentId.value = id;
  }

  function setLoading(value: boolean) {
    isLoading.value = value;
  }

  function setReady(value: boolean) {
    isReady.value = value;
  }

  function setLoadProgress(progress: LoadProgress) {
    loadProgress.value = progress;
  }

  function setError(msg: string | null) {
    error.value = msg;
  }

  function updateInstrumentStatus(
    id: string,
    status: { loaded?: boolean; loading?: boolean; error?: string },
  ) {
    const inst = instruments.value[id];
    if (inst) {
      if (status.loaded !== undefined) inst.loaded = status.loaded;
      if (status.loading !== undefined) inst.loading = status.loading;
      if (status.error !== undefined) inst.error = status.error;
    }
  }

  /**
   * 从 JSON 文件加载音色列表
   * @param jsonPath JSON 文件路径（默认为内置的 instruments.json）
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
   * 重新从 JSON 文件加载音色列表并更新 catalog
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
    // getters
    currentInstrument,
    gmInstrumentCatalog,
    instrumentsByCategory,
    savedInstrumentId,
    // actions
    registerInstrument,
    setCurrentInstrument,
    setLoading,
    setReady,
    setLoadProgress,
    setError,
    updateInstrumentStatus,
    loadInstrumentsFromJSON,
    refreshInstrumentList,
  };
});
