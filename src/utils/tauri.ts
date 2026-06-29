import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

let appWindow: ReturnType<typeof getCurrentWindow> | null = null;

function win(): ReturnType<typeof getCurrentWindow> {
  if (!appWindow) {
    appWindow = getCurrentWindow();
  }
  return appWindow;
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

export function getTauriAPI(): NonNullable<Window["tauriAPI"]> {
  if (!isTauri()) {
    throw new Error("Not running in Tauri environment");
  }
  return window.tauriAPI!;
}

export function runInTauri<T>(fn: () => T, fallback?: T): T | undefined {
  if (isTauri()) {
    return fn();
  }
  return fallback;
}

async function safeWindowAction<T>(
  action: string,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[tauriAPI] window.${action} failed:`, e);
    return undefined;
  }
}

const tauriAPI = {
  on: (channel: string, callback: (data?: any) => void) => {
    listen(channel, (event) => {
      callback(event.payload as any);
    });
  },
  app: {
    quit: () => {
      safeWindowAction("close", () => win().close());
    },
    getVersion: () => invoke<string>("get_app_version"),
    getPlatform: () => invoke<string>("get_platform"),
  },
  window: {
    minimize: () => safeWindowAction("minimize", () => win().minimize()),
    maximize: () =>
      safeWindowAction("toggleMaximize", () => win().toggleMaximize()),
    close: () => safeWindowAction("close", () => win().close()),
    isMaximized: () =>
      safeWindowAction("isMaximized", () => win().isMaximized()) as Promise<
        boolean | undefined
      >,
    getWindowState: () => invoke<any>("get_window_state"),
    setAlwaysOnTop: (flag: boolean) =>
      invoke<boolean>("set_always_on_top", { flag }),
    onStateChanged: (callback: (state: any) => void) => {
      listen("window:on-state-changed", (event) =>
        callback(event.payload as any),
      );
    },
    onMaximizedChanged: (callback: (maximized: boolean) => void) => {
      listen("window:on-maximized-changed", (event) =>
        callback(event.payload as boolean),
      );
    },
    startDrag: () =>
      safeWindowAction("startDragging", () => win().startDragging()),
    setIgnoreMouseEvents: (
      ignore: boolean,
      _options?: { forward: boolean },
    ) => {
      win().setIgnoreCursorEvents(ignore);
    },
  },
  fileSystem: {
    openFileDialog: () => invoke<any>("open_file_dialog"),
    readFile: (filePath: string) =>
      invoke<{ success: boolean; content?: string; error?: string }>(
        "read_file",
        { filePath },
      ),
    writeFile: (filePath: string, content: string) =>
      invoke<{ success: boolean; error?: string }>("write_file", {
        filePath,
        content,
      }),
    saveFileDialog: () => invoke<any>("save_file_dialog"),
  },
  midi: {
    refreshDevices: () => {
      return invoke<void>("refresh_devices");
    },
    clearRoutes: () => {
      return invoke<void>("clear_routes");
    },
    addRoute: (route: any) => {
      return invoke<void>("add_route", { route });
    },
    deleteRoute: (route: any) => {
      return invoke<void>("delete_route", { route });
    },
    syncRoutes: (routes: any[]) => {
      return invoke<void>("sync_routes", { routes });
    },
    getInputs: () => {
      return invoke<any[]>("get_inputs");
    },
    onInputs: (callback: (inputs: any[]) => void) => {
      return listen<any[]>("midi:inputs", (event) => {
        callback(event.payload as any[]);
      });
    },
    getOutputs: () => {
      return invoke<any[]>("get_outputs");
    },
    onOutputs: (callback: (outputs: any[]) => void) => {
      return listen<any[]>("midi:outputs", (event) => {
        callback(event.payload as any[]);
      });
    },
    getWires: () => {
      return invoke<any[]>("get_wires");
    },
    onWires: (callback: (wires: any[]) => void) => {
      return listen<any[]>("midi:wires", (event) => {
        callback(event.payload as any[]);
      });
    },
    onLatency: (callback: (latency: number, device: string) => void) => {
      return listen<any>("midi:activity", (event) => {
        const payload = event.payload as any;
        callback(payload.latency, payload.device);
      });
    },
    onMidiMessage: (
      namespace: string,
      callback: (message: number[], timestamp: number, device: string) => void,
    ) => {
      return listen<any>(`midi:message:${namespace}`, (event) => {
        const payload = event.payload as any;
        callback(payload.message, payload.timestamp, payload.device);
      });
    },
  },
  shell: {
    openExternal: (url: string) => invoke<void>("open_external", { url }),
  },
};

if (isTauri()) {
  window.tauriAPI = tauriAPI;
}

export default tauriAPI;
