import { defineStore } from "pinia";
import { ref, watch, computed } from "vue";
import { Settings, defaultSettings } from "@/types";
import {
  mergeDeep,
  setValueByPath,
  loadFromStorage,
  saveToStorage,
} from "@/helpers";
import { debounce } from "@/helpers/debounce";

const STORAGE_KEY = "midi-jar-settings";

/**
 * 从 localStorage 加载设置，并与默认值深度合并。
 * 包含旧版 "zh-CN" 语言值到 "zh" 的迁移逻辑
 * @returns 合并后的完整 Settings 对象
 */
function loadSettings(): Settings {
  const stored = loadFromStorage<Partial<Settings>>({
    key: STORAGE_KEY,
    defaultValue: {},
  });
  if (Object.keys(stored).length > 0) {
    const merged = mergeDeep(defaultSettings, stored) as Settings;
    // 迁移：将旧的 "zh-CN" 语言值统一为 "zh"
    if (merged.general?.language === ("zh-CN" as unknown)) {
      merged.general.language = "zh";
    }
    return merged;
  }
  return { ...defaultSettings };
}

function saveSettings(settings: Settings) {
  saveToStorage(STORAGE_KEY, settings);
}

export const useSettingsStore = defineStore("settings", () => {
  const settings = ref<Settings>(loadSettings());
  const inited = ref(false);

  /**
   * 通过 "." 分隔的路径更新单个设置项（如 "notation.staffClef"）
   * @param key - 设置项的路径字符串
   * @param value - 新值
   */
  function updateSetting(key: string, value: unknown): Promise<void> {
    // setValueByPath 接受动态的 "." 分隔路径（如 "notation.staffClef"），
    // 需要转成 Record<string, unknown> 运行时访问。这是已知的类型擦除场景。
    setValueByPath(
      settings.value as unknown as Record<string, unknown>,
      key,
      value,
    );
    return Promise.resolve();
  }

  /**
   * 将传入的设置与默认值深度合并后替换当前设置
   * @param value - 部分或完整的 Settings 对象
   */
  function updateSettings(value: Settings): Promise<void> {
    settings.value = mergeDeep(defaultSettings, value);
    return Promise.resolve();
  }

  function resetSetting(key: keyof Settings): Promise<void> {
    settings.value = {
      ...settings.value,
      [key]: structuredClone(defaultSettings[key]),
    };
    return Promise.resolve();
  }

  function resetSettings(): Promise<void> {
    settings.value = structuredClone(defaultSettings);
    return Promise.resolve();
  }

  /**
   * 添加一个新的和弦显示模块，使用默认配置并指定 ID
   * @param id - 新模块的唯一标识符
   */
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

  const debouncedSaveSettings = debounce(
    saveSettings as (...args: unknown[]) => unknown,
    300,
  );

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
