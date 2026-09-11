import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { loadFromStorage, saveToStorage } from "@/helpers/storage";
import { debounce } from "@/helpers/debounce";
import { deepClone } from "@/helpers/object";
import {
  BACKGROUND_STYLES,
  DEFAULT_CUSTOM_BACKGROUND,
  defaultScoreScrollSettings,
  STORAGE_KEY,
  SETTINGS_VERSION,
} from "../constants";
import type { ScoreScrollSettings } from "../types";

/** hex 颜色校验（#RGB / #RRGGBB / #RRGGBBAA） */
function isHexColor(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)
  );
}

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
  const appearance = mergeSection(
    defaultScoreScrollSettings.appearance,
    raw.appearance,
  );
  // 旧版本可能存有已移除的取值（如 gradient / black 背景）：
  // black → custom + 黑色（保留旧观感）；其余非法值回落默认
  if (!BACKGROUND_STYLES.some((b) => b.value === appearance.background)) {
    appearance.background =
      (appearance as { background?: string }).background === "black"
        ? "custom"
        : defaultScoreScrollSettings.appearance.background;
    if (appearance.background === "custom") {
      appearance.customColor = DEFAULT_CUSTOM_BACKGROUND;
    }
  }
  // customColor 非法（缺失/非 hex）回落默认
  if (!isHexColor(appearance.customColor)) {
    appearance.customColor = defaultScoreScrollSettings.appearance.customColor;
  }
  return {
    display: mergeSection(defaultScoreScrollSettings.display, raw.display),
    appearance,
  };
}

/**
 * 乐谱滚动模块 store：持有持久化设置（显示参数 + 外观）。
 * 播放状态等瞬态数据由 composables 管理，不进入 store。
 */
export const useScoreScrollStore = defineStore("scoreScroll", () => {
  const settings = ref<ScoreScrollSettings>(loadSettings());

  const persist = debounce((value: ScoreScrollSettings) => {
    saveToStorage(STORAGE_KEY, { version: SETTINGS_VERSION, settings: value });
  }, 300);

  watch(settings, (value) => persist(value), { deep: true });

  function updateDisplay<K extends keyof ScoreScrollSettings["display"]>(
    key: K,
    value: ScoreScrollSettings["display"][K],
  ): void {
    settings.value.display[key] = value;
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
    updateDisplay,
    updateAppearance,
    resetSettings,
  };
});
