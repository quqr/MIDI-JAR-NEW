import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { loadFromStorage, saveToStorage } from "@/helpers/storage";
import { debounce } from "@/helpers/debounce";
import { defaultWaterfallSettings, defaultPhysicalPianoConfig, STORAGE_KEY } from "../constants";
import type { WaterfallPianoSettings, RecordedNote } from "../types";

function loadSettings(): WaterfallPianoSettings {
  const stored = loadFromStorage<Partial<WaterfallPianoSettings>>({
    key: STORAGE_KEY,
    defaultValue: {},
  });
  if (Object.keys(stored).length > 0) {
    return {
      particles: { ...defaultWaterfallSettings.particles, ...stored.particles },
      background: {
        ...defaultWaterfallSettings.background,
        ...stored.background,
        fluidParams: {
          ...defaultWaterfallSettings.background.fluidParams,
          ...stored.background?.fluidParams,
        },
      },
      keyboard: { ...defaultWaterfallSettings.keyboard, ...stored.keyboard },
      audio: { ...defaultWaterfallSettings.audio, ...stored.audio },
      physicalPiano: {
        ...defaultPhysicalPianoConfig,
        ...stored.physicalPiano,
      },
      midiFile: { ...defaultWaterfallSettings.midiFile, ...stored.midiFile },
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
  const octaveOffset = ref(0); // for Z/X octave shift

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
    // 表单值（string | number）需要运行时写入，类型擦除不可避免
    (settings.value[section] as Record<string, unknown>)[key as string] = value;
  }

  // debounce 泛型约束为 (...args: unknown[]) => unknown，回调需保持兼容
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
