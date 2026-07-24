import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { loadFromStorage, saveToStorage } from "@/helpers/storage";
import { debounce } from "@/helpers/debounce";
import { deepClone } from "@/helpers/object";
import {
  defaultWaterfallSettings,
  STORAGE_KEY,
  SETTINGS_VERSION,
} from "../constants";
import type {
  WaterfallPianoSettings,
  RecordedNote,
  FluidAdvancedParams,
  BackgroundConfig,
  SoundEngineUserConfig,
  SynthEnvelopeConfig,
} from "../types";

/** 深合并一个配置段：默认值 + 用户存储值 */
function mergeSection<T extends object>(
  defaults: T,
  stored: Partial<T> | undefined,
): T {
  if (!stored) return deepClone(defaults);
  return { ...deepClone(defaults), ...stored };
}

/**
 * 迁移旧版 fluidParams（大写字段名）到新版用户友好字段名（小写驼峰）
 * @param raw - localStorage 中读取的原始流体参数对象
 * @returns 迁移后的 FluidAdvancedParams，缺失字段用默认值填充
 */
function migrateFluidParams(
  raw: Record<string, unknown> | undefined,
): FluidAdvancedParams {
  const result: FluidAdvancedParams = {};
  if (!raw) return deepClone(defaultWaterfallSettings.background.fluidParams);

  for (const k of [
    "splatRadius",
    "trailLength",
    "flowPersistence",
    "bloomIntensity",
    "splatColorHue",
  ] as const) {
    if (raw[k] !== undefined) (result as Record<string, unknown>)[k] = raw[k];
  }
  if (raw.bloom !== undefined) result.bloom = raw.bloom as boolean;
  if (raw.hitExplosion !== undefined)
    result.hitExplosion = raw.hitExplosion as boolean;
  if (raw.blockCoverage !== undefined)
    result.blockCoverage = raw.blockCoverage as boolean;

  // 扰动参数迁移（直接透传）
  for (const k of [
    "fluidSplatPerturbation",
    "hitExplosionPerturbation",
    "blockCoveragePerturbation",
    "sustainedSplatPerturbation",
  ] as const) {
    if (raw[k] !== undefined) (result as Record<string, unknown>)[k] = raw[k];
  }

  if (raw.SPLAT_RADIUS !== undefined && result.splatRadius === undefined) {
    let v = raw.SPLAT_RADIUS as number;
    if (v > 10) v = v / 100;
    if (v > 0.01) v = v / 100;
    result.splatRadius = Math.max(0.0001, Math.min(0.01, v));
  }
  if (
    raw.DENSITY_DISSIPATION !== undefined &&
    result.trailLength === undefined
  ) {
    result.trailLength = 1 - (raw.DENSITY_DISSIPATION as number) / 4;
  }
  if (
    raw.VELOCITY_DISSIPATION !== undefined &&
    result.flowPersistence === undefined
  ) {
    result.flowPersistence = 1 - (raw.VELOCITY_DISSIPATION as number) / 4;
  }
  if (raw.BLOOM !== undefined && result.bloom === undefined)
    result.bloom = raw.BLOOM as boolean;
  if (raw.BLOOM_INTENSITY !== undefined && result.bloomIntensity === undefined)
    result.bloomIntensity = raw.BLOOM_INTENSITY as number;
  if (raw.HIT_EXPLOSION !== undefined && result.hitExplosion === undefined)
    result.hitExplosion = raw.HIT_EXPLOSION as boolean;
  if (raw.BLOCK_COVERAGE !== undefined && result.blockCoverage === undefined)
    result.blockCoverage = raw.BLOCK_COVERAGE as boolean;
  if (raw.SPLAT_COLOR_HUE !== undefined && result.splatColorHue === undefined)
    result.splatColorHue = raw.SPLAT_COLOR_HUE as number;

  return {
    ...deepClone(defaultWaterfallSettings.background.fluidParams),
    ...result,
  };
}

/**
 * 从 localStorage 加载设置，处理版本不匹配重置与旧字段迁移
 * @returns 合并默认值后的完整 WaterfallPianoSettings
 */
function loadSettings(): WaterfallPianoSettings {
  // 检查设置版本号，不匹配则重置为默认值
  const versionKey = `${STORAGE_KEY}__version`;
  const storedVersion = loadFromStorage<number>({
    key: versionKey,
    defaultValue: 0,
  });
  if (storedVersion !== SETTINGS_VERSION) {
    saveToStorage(versionKey, SETTINGS_VERSION);
    return deepClone(defaultWaterfallSettings);
  }

  const stored = loadFromStorage<
    Partial<WaterfallPianoSettings> & {
      background?: Partial<BackgroundConfig> & {
        type?: string;
        fluidResolution?: number;
      };
      audio?: unknown;
      physicalPiano?: unknown;
    }
  >({
    key: STORAGE_KEY,
    defaultValue: {},
  });

  if (Object.keys(stored).length > 0) {
    const storedBg = stored.background as Record<string, unknown> | undefined;
    let fluidEnabled = storedBg?.fluidEnabled as boolean | undefined;
    let bgType = storedBg?.type as string | undefined;
    if (bgType === "fluid") {
      bgType = "preset";
      fluidEnabled = true;
    }

    const background: BackgroundConfig = {
      ...defaultWaterfallSettings.background,
      ...storedBg,
      type:
        (bgType as BackgroundConfig["type"]) ??
        defaultWaterfallSettings.background.type,
      fluidEnabled:
        fluidEnabled ?? defaultWaterfallSettings.background.fluidEnabled,
      fluidParams: migrateFluidParams(
        storedBg?.fluidParams as Record<string, unknown> | undefined,
      ),
    };
    delete (background as unknown as Record<string, unknown>).fluidResolution;

    return {
      particles: mergeSection(
        defaultWaterfallSettings.particles,
        stored.particles,
      ),
      background,
      keyboard: mergeSection(
        defaultWaterfallSettings.keyboard,
        stored.keyboard,
      ),
      midiFile: mergeSection(
        defaultWaterfallSettings.midiFile,
        stored.midiFile,
      ),
      sound: {
        ...mergeSection(
          defaultWaterfallSettings.sound,
          stored.sound as Partial<SoundEngineUserConfig> | undefined,
        ),
        envelope: mergeSection(
          defaultWaterfallSettings.sound.envelope,
          (stored.sound as Record<string, unknown> | undefined)?.envelope as
            | Partial<SynthEnvelopeConfig>
            | undefined,
        ),
        modulationEnvelope: mergeSection(
          defaultWaterfallSettings.sound.modulationEnvelope,
          (stored.sound as Record<string, unknown> | undefined)
            ?.modulationEnvelope as Partial<SynthEnvelopeConfig> | undefined,
        ),
      },
      aura: mergeSection(defaultWaterfallSettings.aura, stored.aura),
    };
  }
  return deepClone(defaultWaterfallSettings);
}

export const useWaterfallPianoStore = defineStore("WaterfallPiano", () => {
  const settings = ref<WaterfallPianoSettings>(loadSettings());
  const recordedNotes = ref<RecordedNote[]>([]);
  const currentMidiFileName = ref<string>("");
  /** 将全部设置恢复为默认值 */
  function resetSettings() {
    settings.value = deepClone(defaultWaterfallSettings);
  }

  /**
   * 将指定配置段恢复为默认值
   * @template K - WaterfallPianoSettings 的键类型
   * @param group - 要重置的配置段名称（如 "particles"、"keyboard"）
   */
  function resetGroup<K extends keyof WaterfallPianoSettings>(group: K) {
    settings.value[group] = deepClone(defaultWaterfallSettings[group]);
  }

  /**
   * 更新某个配置段中的单个字段值
   * @template K - WaterfallPianoSettings 的键类型
   * @param section - 配置段名称（如 "particles"、"keyboard"）
   * @param key - 该配置段内要修改的字段名
   * @param value - 新值
   */
  function updateSetting<K extends keyof WaterfallPianoSettings>(
    section: K,
    key: keyof WaterfallPianoSettings[K],
    value: unknown,
  ) {
    (settings.value[section] as Record<string, unknown>)[key as string] = value;
  }

  const debouncedSave = debounce((...args: unknown[]) => {
    saveToStorage(STORAGE_KEY, args[0] as WaterfallPianoSettings);
  }, 300) as (s: WaterfallPianoSettings) => void;

  watch(settings, (s) => debouncedSave(s), { deep: true });

  return {
    settings,
    recordedNotes,
    currentMidiFileName,
    resetSettings,
    resetGroup,
    updateSetting,
  };
});
