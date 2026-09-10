import type { UnlistenFn } from "@tauri-apps/api/event";
import type {
  ApiMidiRoute,
  ApiMidiInput,
  ApiMidiOutput,
  ApiMidiWire,
} from "./index";
import type {
  VstScanCache,
  VstScanProgress,
  VstSnapshot,
  VstStatusPayload,
} from "./vst";

export interface TauriAPI {
  on: (channel: string, callback: (data?: any) => void) => void;
  app: {
    quit: () => void;
    getVersion: () => Promise<string>;
    getPlatform: () => Promise<string>;
  };
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean | undefined>;
    getWindowState: () => Promise<any>;
    setAlwaysOnTop: (flag: boolean) => Promise<boolean>;
    onStateChanged: (callback: (state: any) => void) => void;
    onMaximizedChanged: (callback: (maximized: boolean) => void) => void;
    startDrag: () => Promise<void>;
    setIgnoreMouseEvents: (
      ignore: boolean,
      options?: { forward: boolean },
    ) => void;
  };
  fileSystem: {
    openFileDialog: () => Promise<any>;
    openDirectoryDialog: () => Promise<string | null>;
    readFile: (
      filePath: string,
    ) => Promise<{ success: boolean; content?: string; error?: string }>;
    writeFile: (
      filePath: string,
      content: string,
    ) => Promise<{ success: boolean; error?: string }>;
    saveFileDialog: () => Promise<any>;
  };
  midi: {
    refreshDevices: () => Promise<void>;
    clearRoutes: () => Promise<void>;
    addRoute: (route: ApiMidiRoute) => Promise<void>;
    deleteRoute: (route: ApiMidiRoute) => Promise<void>;
    syncRoutes: (routes: ApiMidiRoute[]) => Promise<void>;
    getInputs: () => Promise<ApiMidiInput[]>;
    onInputs: (
      callback: (inputs: ApiMidiInput[]) => void,
    ) => Promise<UnlistenFn>;
    getOutputs: () => Promise<ApiMidiOutput[]>;
    onOutputs: (
      callback: (outputs: ApiMidiOutput[]) => void,
    ) => Promise<UnlistenFn>;
    getWires: () => Promise<ApiMidiWire[]>;
    onWires: (callback: (wires: ApiMidiWire[]) => void) => Promise<UnlistenFn>;
    onLatency: (
      callback: (latency: number, device: string) => void,
    ) => Promise<UnlistenFn>;
    onMidiMessage: (
      namespace: string,
      callback: (message: number[], timestamp: number, device: string) => void,
    ) => Promise<UnlistenFn>;
    // Virtual port methods
    isVirtualPortSupported: () => Promise<boolean>;
    createVirtualInput: (name: string) => Promise<void>;
    createVirtualOutput: (name: string) => Promise<void>;
    deleteVirtualInput: (name: string) => Promise<void>;
    deleteVirtualOutput: (name: string) => Promise<void>;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  vst: {
    scan: () => Promise<VstScanCache>;
    getScanCache: () => Promise<VstScanCache | null>;
    addScanPath: (path: string) => Promise<string[]>;
    removeScanPath: (path: string) => Promise<string[]>;
    restoreScanPaths: (paths: string[]) => Promise<string[]>;
    load: (path: string, openEditor?: boolean) => Promise<void>;
    unload: () => Promise<void>;
    sendMidi: (bytes: number[]) => Promise<void>;
    openEditor: () => Promise<void>;
    closeEditor: () => Promise<void>;
    getStatus: () => Promise<VstSnapshot>;
    onStatus: (
      callback: (status: VstStatusPayload) => void,
    ) => Promise<UnlistenFn>;
    onScanProgress: (
      callback: (progress: VstScanProgress) => void,
    ) => Promise<UnlistenFn>;
  };
}

declare global {
  interface Window {
    tauriAPI: TauriAPI;
  }
}
