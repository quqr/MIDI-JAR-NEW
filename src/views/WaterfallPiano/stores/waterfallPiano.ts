import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { loadFromStorage, saveToStorage } from "@/helpers/storage";
import { debounce } from "@/helpers/debounce";
import { defaultWaterfallSettings, STORAGE_KEY } from "../constants";
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
      },
      keyboard: { ...defaultWaterfallSettings.keyboard, ...stored.keyboard },
      audio: { ...defaultWaterfallSettings.audio, ...stored.audio },
      midiFile: { ...defaultWaterfallSettings.midiFile, ...stored.midiFile },
      performance: {
        ...defaultWaterfallSettings.performance,
        ...stored.performance,
      },
    };
  }
  return { ...defaultWaterfallSettings };
}

export const useWaterfallPianoStore = defineStore(
  "waterfallPiano",
  () => {
    const settings = ref<WaterfallPianoSettings>(loadSettings());
    const recordedNotes = ref<RecordedNote[]>([]);
    const isRecording = ref(false);
    const isPlaying = ref(false);
    const currentMidiFileName = ref<string>("");
    const octaveOffset = ref(0); // for Z/X octave shift

    function resetSettings() {
      settings.value = { ...defaultWaterfallSettings };
    }

    function updateSetting<K extends keyof WaterfallPianoSettings>(
      section: K,
      key: keyof WaterfallPianoSettings[K],
      value: unknown,
    ) {
      (settings.value[section] as Record<string, unknown>)[key as string] =
        value;
    }

    const debouncedSave = debounce(
      (...args: unknown[]) => {
        saveToStorage(STORAGE_KEY, args[0] as WaterfallPianoSettings);
      },
      300,
    ) as (s: WaterfallPianoSettings) => void;

    watch(settings, (s) => debouncedSave(s), { deep: true });

    return {
      settings,
      recordedNotes,
      isRecording,
      isPlaying,
      currentMidiFileName,
      octaveOffset,
      resetSettings,
      updateSetting,
    };
  },
);
