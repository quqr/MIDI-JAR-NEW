import { defineStore } from "pinia";
import { ref } from "vue";
import type { WidgetState, WidgetType } from "@/types/widget";
import { WIDGET_DEFAULT_SIZES } from "@/types/widget";
import { isTauri } from "@/utils/tauri";

export const useWidgetStore = defineStore("widget", () => {
  const widgets = ref<Map<string, WidgetState>>(new Map());

  function generateId(type: WidgetType, moduleId: string): string {
    return `${type}-${moduleId}`;
  }

  function generateLabel(id: string): string {
    return `widget-${id}`;
  }

  function addWidget(state: WidgetState) {
    widgets.value.set(state.id, state);
  }

  function removeWidget(id: string) {
    widgets.value.delete(id);
  }

  function updateWidget(id: string, updates: Partial<WidgetState>) {
    const existing = widgets.value.get(id);
    if (existing) {
      widgets.value.set(id, { ...existing, ...updates });
    }
  }

  function getWidget(id: string): WidgetState | undefined {
    return widgets.value.get(id);
  }

  function isWidgetPoppedOut(type: WidgetType, moduleId: string): boolean {
    const id = generateId(type, moduleId);
    return widgets.value.has(id);
  }

  async function saveLayout() {
    if (!isTauri()) return;
    const states = Array.from(widgets.value.values());
    const { getTauriAPI } = await import("@/utils/tauri");
    const api = getTauriAPI();
    await api.widget.saveStates(states);
  }

  async function loadLayout() {
    if (!isTauri()) return;
    const { getTauriAPI } = await import("@/utils/tauri");
    const api = getTauriAPI();
    const states = await api.widget.getStates();
    if (states) {
      widgets.value.clear();
      for (const state of states) {
        widgets.value.set(state.id, state as WidgetState);
      }
    }
  }

  async function popOutWidget(type: WidgetType, moduleId: string) {
    if (!isTauri()) return;

    const id = generateId(type, moduleId);
    if (widgets.value.has(id)) return;

    const label = generateLabel(id);
    const defaults = WIDGET_DEFAULT_SIZES[type];
    const { getTauriAPI } = await import("@/utils/tauri");
    const api = getTauriAPI();

    const mainWindow = await api.window.getWindowState();
    const offsetX = widgets.value.size * 30;
    const offsetY = widgets.value.size * 30;
    const x = (mainWindow?.x ?? 100) + 50 + offsetX;
    const y = (mainWindow?.y ?? 100) + 50 + offsetY;

    const state: WidgetState = {
      id,
      type,
      moduleId,
      label,
      x,
      y,
      width: defaults.width,
      height: defaults.height,
      isMaximized: false,
      opacity: 1,
      alwaysOnTop: true,
      autoHide: false,
      positionLocked: false,
    };

    await api.widget.createWindow({
      label,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} - MIDI-JAR`,
      url: `/widget/${type}/${moduleId}`,
      width: defaults.width,
      height: defaults.height,
      x,
      y,
      alwaysOnTop: true,
    });

    addWidget(state);
    await saveLayout();
  }

  async function closeWidget(id: string) {
    if (!isTauri()) return;

    const state = widgets.value.get(id);
    if (!state) return;

    const { getTauriAPI } = await import("@/utils/tauri");
    const api = getTauriAPI();
    await api.widget.closeWindow(state.label);
    removeWidget(id);
    await saveLayout();
  }

  async function setWidgetOpacity(id: string, opacity: number) {
    const state = widgets.value.get(id);
    if (!state) return;
    updateWidget(id, { opacity });
  }

  async function setWidgetAlwaysOnTop(id: string, alwaysOnTop: boolean) {
    if (!isTauri()) return;

    const state = widgets.value.get(id);
    if (!state) return;

    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const win = await WebviewWindow.getByLabel(state.label);
      if (win) {
        await win.setAlwaysOnTop(alwaysOnTop);
      }
    } catch (e) {
      console.error("[widgetStore] setWidgetAlwaysOnTop failed:", e);
    }
    updateWidget(id, { alwaysOnTop });
  }

  return {
    widgets,
    addWidget,
    removeWidget,
    updateWidget,
    getWidget,
    isWidgetPoppedOut,
    saveLayout,
    loadLayout,
    popOutWidget,
    closeWidget,
    setWidgetOpacity,
    setWidgetAlwaysOnTop,
    generateId,
    generateLabel,
  };
});
