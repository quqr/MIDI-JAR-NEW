import { defineStore } from "pinia";
import { ref, watch, computed } from "vue";
import { Settings, defaultSettings } from "@/types";
import { mergeDeep } from "@/helpers";
import { logger } from "@/utils/logger";

const STORAGE_KEY = "midi-jar-settings";

function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return mergeDeep(defaultSettings, JSON.parse(stored));
    }
  } catch (e) {
    logger.warn(`Failed to load settings: ${e}`);
  }
  return { ...defaultSettings };
}

function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    logger.warn(`Failed to save settings: ${e}`);
  }
}

export const useSettingsStore = defineStore("settings", () => {
  const settings = ref<Settings>(loadSettings());
  const inited = ref(false);

  function setValueByPath(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const parts = path.split(".");
    let current: Record<string, unknown> = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
  }

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
    const cloned = { ...defaultSettings, ...settings.value };
    delete cloned[key];
    settings.value = mergeDeep({ ...defaultSettings }, cloned);
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

  if (!localStorage.getItem(STORAGE_KEY)) {
    saveSettings(settings.value);
  }
  inited.value = true;

  watch(
    settings,
    (newSettings) => {
      saveSettings(newSettings);
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
