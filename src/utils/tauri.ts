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
    console.log(`[MIDI_DEBUG] tauri.on: registering listener for '${channel}'`);
    listen(channel, (event) => {
      console.log(
        `[MIDI_DEBUG] tauri.on: received event '${channel}'`,
        event.payload,
      );
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
      console.log("[MIDI_DEBUG] calling refreshDevices");
      return invoke<void>("refresh_devices");
    },
    clearRoutes: () => {
      console.log("[MIDI_DEBUG] calling clearRoutes");
      return invoke<void>("clear_routes");
    },
    addRoute: (route: any) => {
      console.log("[MIDI_DEBUG] calling addRoute", route);
      return invoke<void>("add_route", { route });
    },
    deleteRoute: (route: any) => {
      console.log("[MIDI_DEBUG] calling deleteRoute", route);
      return invoke<void>("delete_route", { route });
    },
    syncRoutes: (routes: any[]) => {
      console.log(
        `[MIDI_DEBUG] calling syncRoutes with ${routes.length} routes`,
        JSON.stringify(routes),
      );
      return invoke<void>("sync_routes", { routes });
    },
    getInputs: () => {
      console.log("[MIDI_DEBUG] calling getInputs");
      return invoke<any[]>("get_inputs");
    },
    onInputs: (callback: (inputs: any[]) => void) => {
      console.log("[MIDI_DEBUG] registering onInputs listener");
      return listen<any[]>("midi:inputs", (event) => {
        console.log("[MIDI_DEBUG] received midi:inputs event", event.payload);
        callback(event.payload as any[]);
      });
    },
    getOutputs: () => {
      console.log("[MIDI_DEBUG] calling getOutputs");
      return invoke<any[]>("get_outputs");
    },
    onOutputs: (callback: (outputs: any[]) => void) => {
      console.log("[MIDI_DEBUG] registering onOutputs listener");
      return listen<any[]>("midi:outputs", (event) => {
        console.log("[MIDI_DEBUG] received midi:outputs event", event.payload);
        callback(event.payload as any[]);
      });
    },
    getWires: () => {
      console.log("[MIDI_DEBUG] calling getWires");
      return invoke<any[]>("get_wires");
    },
    onWires: (callback: (wires: any[]) => void) => {
      console.log("[MIDI_DEBUG] registering onWires listener");
      return listen<any[]>("midi:wires", (event) => {
        console.log("[MIDI_DEBUG] received midi:wires event", event.payload);
        callback(event.payload as any[]);
      });
    },
    onLatency: (callback: (latency: number, device: string) => void) => {
      console.log("[MIDI_DEBUG] registering onLatency listener");
      return listen<any>("midi:activity", (event) => {
        const payload = event.payload as any;
        console.log("[MIDI_DEBUG] received midi:activity event", payload);
        callback(payload.latency, payload.device);
      });
    },
    onMidiMessage: (
      namespace: string,
      callback: (message: number[], timestamp: number, device: string) => void,
    ) => {
      console.log(
        `[MIDI_DEBUG] registering onMidiMessage listener for 'midi:message:${namespace}'`,
      );
      return listen<any>(`midi:message:${namespace}`, (event) => {
        const payload = event.payload as any;
        console.log(
          `[MIDI_DEBUG] received 'midi:message:${namespace}' event`,
          JSON.stringify(payload),
        );
        callback(payload.message, payload.timestamp, payload.device);
      });
    },
  },
  shell: {
    openExternal: (url: string) => invoke<void>("open_external", { url }),
  },
  widget: {
    createWindow: (options: {
      label: string;
      title: string;
      url: string;
      width: number;
      height: number;
      x: number;
      y: number;
      alwaysOnTop: boolean;
    }) => invoke<void>("create_widget_window", options),
    closeWindow: (label: string) =>
      invoke<void>("close_widget_window", { label }),
    getStates: () => invoke<any[]>("get_widget_states"),
    saveStates: (states: any[]) =>
      invoke<void>("save_widget_states_cmd", { states }),
    getAllWindows: () => invoke<string[]>("get_all_widget_windows"),
    onWindowClosed: (callback: (label: string) => void) => {
      return listen<string>("widget:closed", (event) => {
        callback(event.payload);
      });
    },
  },
};

if (typeof window !== "undefined") {
  (window as any).tauriAPI = tauriAPI;
}
