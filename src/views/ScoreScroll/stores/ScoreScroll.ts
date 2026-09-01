import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { loadFromStorage, saveToStorage } from "@/helpers/storage";
import { debounce } from "@/helpers/debounce";
import { deepClone } from "@/helpers/object";
import {
  defaultScoreScrollSettings,
  STORAGE_KEY,
  SETTINGS_VERSION,
} from "../constants";
import type { ScoreScrollSettings } from "../types";

/** 深合并一个配置段：默认值 + 用户存储值 */
function mergeSection<T extends object>(
  defaults: T,
  stored: Partial<T> | undefined,
): T {
  if (!stored) return deepClone(defaults);
  return { ...deepClone(defaults), ...stored };
}

/** 从 localStorage 读取并合并默认值（含版本迁移） */
function loadSettings(): ScoreScrollSettings {
  const stored = loadFromStorage<{
    version?: number;
    settings?: Partial<ScoreScrollSettings>;
  }>({ key: STORAGE_KEY, defaultValue: {} });
  const raw = stored?.settings;
  if (!raw) return deepClone(defaultScoreScrollSettings);
  return {
    effects: mergeSection(defaultScoreScrollSettings.effects, raw.effects),
    appearance: mergeSection(
      defaultScoreScrollSettings.appearance,
      raw.appearance,
    ),
  };
}

/**
 * 乐谱滚动模块 store：持有持久化设置（特效参数 + 外观）。
 * 播放状态等瞬态数据由 composables 管理，不进入 store。
 */
export const useScoreScrollStore = defineStore("scoreScroll", () => {
  const settings = ref<ScoreScrollSettings>(loadSettings());

  const persist = debounce((value: ScoreScrollSettings) => {
    saveToStorage(STORAGE_KEY, { version: SETTINGS_VERSION, settings: value });
  }, 300);

  watch(settings, (value) => persist(value), { deep: true });

  function updateEffects<K extends keyof ScoreScrollSettings["effects"]>(
    key: K,
    value: ScoreScrollSettings["effects"][K],
  ): void {
    settings.value.effects[key] = value;
  }

  function updateAppearance<K extends keyof ScoreScrollSettings["appearance"]>(
    key: K,
    value: ScoreScrollSettings["appearance"][K],
  ): void {
    settings.value.appearance[key] = value;
  }

  function resetSettings(): void {
    settings.value = deepClone(defaultScoreScrollSettings);
  }

  return {
    settings,
    updateEffects,
    updateAppearance,
    resetSettings,
  };
});
