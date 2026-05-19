import type { UnlistenFn } from "@tauri-apps/api/event";

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
    addRoute: (route: any) => Promise<void>;
    deleteRoute: (route: any) => Promise<void>;
    syncRoutes: (routes: any[]) => Promise<void>;
    getInputs: () => Promise<any[]>;
    onInputs: (callback: (inputs: any[]) => void) => Promise<UnlistenFn>;
    getOutputs: () => Promise<any[]>;
    onOutputs: (callback: (outputs: any[]) => void) => Promise<UnlistenFn>;
    getWires: () => Promise<any[]>;
    onWires: (callback: (wires: any[]) => void) => Promise<UnlistenFn>;
    onLatency: (
      callback: (latency: number, device: string) => void,
    ) => Promise<UnlistenFn>;
    onMidiMessage: (
      namespace: string,
      callback: (message: number[], timestamp: number, device: string) => void,
    ) => Promise<UnlistenFn>;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
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
    }) => Promise<void>;
    closeWindow: (label: string) => Promise<void>;
    getStates: () => Promise<any[]>;
    saveStates: (states: any[]) => Promise<void>;
    getAllWindows: () => Promise<string[]>;
    onWindowClosed: (callback: (label: string) => void) => Promise<UnlistenFn>;
  };
}

declare global {
  interface Window {
    tauriAPI: TauriAPI;
  }
}

export {};
