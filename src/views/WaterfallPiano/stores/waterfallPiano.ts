import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { loadFromStorage, saveToStorage } from "@/helpers/storage";
import { debounce } from "@/helpers/debounce";
import {
  defaultWaterfallSettings,
  STORAGE_KEY,
} from "../constants";
import type {
  WaterfallPianoSettings,
  RecordedNote,
  FluidAdvancedParams,
  BackgroundConfig,
} from "../types";

// 迁移旧版 fluidParams（大写字段名）到新版用户友好字段名（小写驼峰）
function migrateFluidParams(
  raw: Record<string, unknown> | undefined,
): FluidAdvancedParams {
  const result: FluidAdvancedParams = {};
  if (!raw) return { ...defaultWaterfallSettings.background.fluidParams };

  for (const k of [
    "splatRadius",
    "trailLength",
    "flowPersistence",
    "bloomIntensity",
    "splatColorHue",
  ] as const) {
    if (raw[k] !== undefined)
      (result as Record<string, unknown>)[k] = raw[k];
  }
  if (raw.bloom !== undefined) result.bloom = raw.bloom as boolean;
  if (raw.hitExplosion !== undefined)
    result.hitExplosion = raw.hitExplosion as boolean;
  if (raw.blockCoverage !== undefined)
    result.blockCoverage = raw.blockCoverage as boolean;

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
  if (
    raw.BLOOM_INTENSITY !== undefined &&
    result.bloomIntensity === undefined
  )
    result.bloomIntensity = raw.BLOOM_INTENSITY as number;
  if (raw.HIT_EXPLOSION !== undefined && result.hitExplosion === undefined)
    result.hitExplosion = raw.HIT_EXPLOSION as boolean;
  if (raw.BLOCK_COVERAGE !== undefined && result.blockCoverage === undefined)
    result.blockCoverage = raw.BLOCK_COVERAGE as boolean;
  if (
    raw.SPLAT_COLOR_HUE !== undefined &&
    result.splatColorHue === undefined
  )
    result.splatColorHue = raw.SPLAT_COLOR_HUE as number;

  return {
    ...defaultWaterfallSettings.background.fluidParams,
    ...result,
  };
}

function loadSettings(): WaterfallPianoSettings {
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
    const storedBg = stored.background as
      | Record<string, unknown>
      | undefined;
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
      particles: {
        ...defaultWaterfallSettings.particles,
        ...stored.particles,
      },
      background,
      keyboard: {
        ...defaultWaterfallSettings.keyboard,
        ...stored.keyboard,
      },
      midiFile: {
        ...defaultWaterfallSettings.midiFile,
        ...stored.midiFile,
      },
    };
  }
  return { ...defaultWaterfallSettings };
}

export const useWaterfallPianoStore = defineStore("waterfallPiano", () => {
  const settings = ref<WaterfallPianoSettings>(loadSettings());
  const recordedNotes = ref<RecordedNote[]>([]);
  const isRecording = ref(false);
  const isPlaying = ref(false);
  const currentMidiFileName = ref<string>("");
  const octaveOffset = ref(0);

  function resetSettings() {
    settings.value = { ...defaultWaterfallSettings };
  }

  function resetGroup<K extends keyof WaterfallPianoSettings>(group: K) {
    settings.value[group] = { ...defaultWaterfallSettings[group] };
  }

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
    isRecording,
    isPlaying,
    currentMidiFileName,
    octaveOffset,
    resetSettings,
    resetGroup,
    updateSetting,
  };
});
