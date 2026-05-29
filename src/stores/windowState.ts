import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { WindowState, defaultWindowState } from "@/types";
import { isTauri, getTauriAPI } from "@/utils/tauri";
import { loadFromStorage, saveToStorage } from "@/helpers";

const STORAGE_KEY = "midi-jar-window-state";

function loadWindowState(): WindowState {
  return loadFromStorage<WindowState>({
    key: STORAGE_KEY,
    defaultValue: defaultWindowState,
    mergeWithDefault: true,
  });
}

function saveWindowState(state: WindowState) {
  saveToStorage(STORAGE_KEY, state);
}

export const useWindowStateStore = defineStore("windowState", () => {
  const windowState = ref<WindowState>(loadWindowState());

  function setAlwaysOnTop(flag: boolean): void {
    if (isTauri()) {
      getTauriAPI().window.setAlwaysOnTop(flag);
    }
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

  async function getWindowState(): Promise<WindowState | null> {
    if (isTauri()) {
      return await getTauriAPI().window.getWindowState();
    }
    return windowState.value;
  }

  async function setWindowState(updates: Partial<WindowState>): Promise<void> {
    updateWindowState(updates);
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
    getWindowState,
    setWindowState,
  };
});
