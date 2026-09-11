import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { loadFromStorage, saveToStorage } from "@/helpers/storage";
import { debounce } from "@/helpers/debounce";
import { DEFAULT_BACKGROUND, SCORE3D_STORAGE_KEY } from "../constants";

/** hex 颜色校验（#RGB / #RRGGBB / #RRGGBBAA） */
function isHexColor(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)
  );
}

function loadBackgroundColor(): string {
  const stored = loadFromStorage<{ backgroundColor?: string }>({
    key: SCORE3D_STORAGE_KEY,
    defaultValue: {},
  });
  return isHexColor(stored?.backgroundColor)
    ? stored.backgroundColor
    : DEFAULT_BACKGROUND;
}

/**
 * 三维乐谱模块 store：持有持久化外观设置（当前仅背景颜色）。
 * 播放状态等瞬态数据由 composables 管理，不进入 store。
 */
export const useScore3dStore = defineStore("score3d", () => {
  const backgroundColor = ref<string>(loadBackgroundColor());

  const persist = debounce((value: string) => {
    saveToStorage(SCORE3D_STORAGE_KEY, { backgroundColor: value });
  }, 300);

  watch(backgroundColor, (value) => persist(value));

  function setBackgroundColor(value: string): void {
    backgroundColor.value = value;
  }

  return {
    backgroundColor,
    setBackgroundColor,
  };
});
