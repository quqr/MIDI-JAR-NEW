import { defineStore } from "pinia";
import { ref, watch, computed } from "vue";
import { Settings, defaultSettings } from "@/types";
import { mergeDeep, setValueByPath, loadFromStorage, saveToStorage } from "@/helpers";
import { debounce } from "@/helpers/debounce";

const STORAGE_KEY = "midi-jar-settings";

function loadSettings(): Settings {
  const stored = loadFromStorage<Partial<Settings>>({
    key: STORAGE_KEY,
    defaultValue: {},
  });
  if (Object.keys(stored).length > 0) {
    return mergeDeep(defaultSettings, stored) as Settings;
  }
  return { ...defaultSettings };
}

function saveSettings(settings: Settings) {
  saveToStorage(STORAGE_KEY, settings);
}

export const useSettingsStore = defineStore("settings", () => {
  const settings = ref<Settings>(loadSettings());
  const inited = ref(false);

  function updateSetting(key: string, value: unknown): Promise<void> {
    setValueByPath(
      settings.value as unknown as Record<string, unknown>,
      key,
      value,
    );
    return Promise.resolve();
  }

  function updateSettings(value: Settings): Promise<void> {
    settings.value = mergeDeep(defaultSettings, value);
    return Promise.resolve();
  }

  function resetSetting(key: keyof Settings): Promise<void> {
    settings.value = {
      ...settings.value,
      [key]: JSON.parse(JSON.stringify(defaultSettings[key])),
    };
    return Promise.resolve();
  }

  function resetSettings(): Promise<void> {
    settings.value = { ...defaultSettings };
    return Promise.resolve();
  }

  function addChordDisplayModule(id: string): void {
    settings.value.chordDisplay.push({
      ...defaultSettings.chordDisplay[0],
      id,
    });
  }

  function removeChordDisplayModule(id: string): void {
    settings.value.chordDisplay = settings.value.chordDisplay.filter(
      (module) => module.id !== id,
    );
  }

  const stored = loadFromStorage<Partial<Settings>>({
    key: STORAGE_KEY,
    defaultValue: {},
  });
  if (Object.keys(stored).length === 0) {
    saveSettings(settings.value);
  }
  inited.value = true;

  const debouncedSaveSettings = debounce(saveSettings, 300);

  watch(
    settings,
    (newSettings) => {
      debouncedSaveSettings(newSettings);
    },
    { deep: true },
  );

  const chordDisplayModules = computed(() => settings.value.chordDisplay);

  return {
    settings,
    inited,
    updateSetting,
    updateSettings,
    resetSetting,
    resetSettings,
    addChordDisplayModule,
    removeChordDisplayModule,
    chordDisplayModules,
  };
});
