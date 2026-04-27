import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { WindowState, defaultWindowState } from "@/types";

const STORAGE_KEY = "midi-jar-window-state";

function loadWindowState(): WindowState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...defaultWindowState,
        ...parsed,
      };
    }
  } catch {
    // ignore parse errors
  }
  return { ...defaultWindowState };
}

function saveWindowState(state: WindowState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore write errors
  }
}

export const useWindowStateStore = defineStore("windowState", () => {
  const windowState = ref<WindowState>(loadWindowState());

  // Web 版本不需要 Electron 的 maximize/unmaximize/minimize/close 等功能
  // 仅保留与 Web 相关的状态和动作

  function setAlwaysOnTop(flag: boolean): void {
    windowState.value.alwaysOnTop = flag;
  }

  function dismissChangelog(): void {
    windowState.value.changelogDismissed = "1.0.0";
  }

  function dismissUpdate(version: string): void {
    windowState.value.updateDismissed = version;
  }

  function navigate(path: string): void {
    windowState.value.path = path;
  }

  function updateWindowState(updates: Partial<WindowState>): void {
    windowState.value = { ...windowState.value, ...updates };
  }

  watch(
    windowState,
    (newState) => {
      saveWindowState(newState);
    },
    { deep: true },
  );

  return {
    windowState,
    setAlwaysOnTop,
    dismissChangelog,
    dismissUpdate,
    navigate,
    updateWindowState,
  };
});
