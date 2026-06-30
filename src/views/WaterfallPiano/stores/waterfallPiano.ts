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
      postProcessing: {
        ...defaultWaterfallSettings.postProcessing,
        ...stored.postProcessing,
        bloom: {
          ...defaultWaterfallSettings.postProcessing.bloom,
          ...stored.postProcessing?.bloom,
        },
        motionBlur: {
          ...defaultWaterfallSettings.postProcessing.motionBlur,
          ...stored.postProcessing?.motionBlur,
        },
        chromaticAberration: {
          ...defaultWaterfallSettings.postProcessing.chromaticAberration,
          ...stored.postProcessing?.chromaticAberration,
        },
        vignette: {
          ...defaultWaterfallSettings.postProcessing.vignette,
          ...stored.postProcessing?.vignette,
        },
      },
      noteTexture: {
        ...defaultWaterfallSettings.noteTexture,
        ...stored.noteTexture,
      },
      noteBlockParticles: {
        ...defaultWaterfallSettings.noteBlockParticles,
        ...stored.noteBlockParticles,
        surfaceEmission: {
          ...defaultWaterfallSettings.noteBlockParticles.surfaceEmission,
          ...stored.noteBlockParticles?.surfaceEmission,
        },
        hitExplosion: {
          ...defaultWaterfallSettings.noteBlockParticles.hitExplosion,
          ...stored.noteBlockParticles?.hitExplosion,
        },
        orbiting: {
          ...defaultWaterfallSettings.noteBlockParticles.orbiting,
          ...stored.noteBlockParticles?.orbiting,
        },
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
  const octaveOffset = ref(0); // for Z/X octave shift

  function resetSettings() {
    settings.value = { ...defaultWaterfallSettings };
  }

  function resetGroup<K extends keyof WaterfallPianoSettings>(group: K) {
    (settings.value[group] as Record<string, unknown>) = {
      ...defaultWaterfallSettings[group],
    };
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
