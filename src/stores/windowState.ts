import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { WindowState, defaultWindowState } from "@/types";
import { isElectron, getElectronAPI } from "@/utils/electron";

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

  function setAlwaysOnTop(flag: boolean): void {
    if (isElectron()) {
      getElectronAPI().window.setAlwaysOnTop(flag);
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
    if (isElectron()) {
      return await getElectronAPI().window.getWindowState();
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
