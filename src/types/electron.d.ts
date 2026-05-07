export interface ElectronAPI {
  on: (channel: string, callback: (data?: any) => void) => void;
  app: {
    quit: () => void;
    getVersion: () => Promise<string>;
    getPlatform: () => Promise<NodeJS.Platform>;
  };
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    isMaximized: () => Promise<boolean>;
    getWindowState: () => Promise<any>;
    setAlwaysOnTop: (flag: boolean) => Promise<boolean>;
    onStateChanged: (callback: (state: any) => void) => void;
    onMaximizedChanged: (callback: (maximized: boolean) => void) => void;
    startDrag: () => void;
    setIgnoreMouseEvents: (
      ignore: boolean,
      options?: { forward: boolean },
    ) => void;
  };
  fileSystem: {
    openFileDialog: (
      options?: Electron.OpenDialogOptions,
    ) => Promise<Electron.OpenDialogReturnValue>;
    readFile: (
      filePath: string,
    ) => Promise<{ success: boolean; content?: string; error?: string }>;
    writeFile: (
      filePath: string,
      content: string,
    ) => Promise<{ success: boolean; error?: string }>;
    saveFileDialog: (
      options?: Electron.SaveDialogOptions,
    ) => Promise<Electron.SaveDialogReturnValue>;
  };
  midi: {
    refreshDevices: () => void;
    clearRoutes: () => void;
    addRoute: (route: {
      input: string;
      output: string;
      type: "physical" | "internal";
      enabled: boolean;
    }) => void;
    deleteRoute: (route: {
      input: string;
      output: string;
      type: "physical" | "internal";
      enabled: boolean;
    }) => void;
    getInputs: () => void;
    onInputs: (
      callback: (
        inputs: {
          name: string;
          opened: boolean;
          connected: boolean;
          error: boolean;
        }[],
      ) => void,
    ) => () => void;
    getOutputs: () => void;
    onOutputs: (
      callback: (
        outputs: {
          name: string;
          type: string;
          opened: boolean;
          connected: boolean;
          error: boolean;
        }[],
      ) => void,
    ) => () => void;
    getWires: () => void;
    onWires: (
      callback: (
        wires: {
          route: {
            input: string;
            output: string;
            type: "physical" | "internal";
            enabled: boolean;
          };
          connected: boolean;
        }[],
      ) => void,
    ) => () => void;
    onLatency: (
      callback: (latency: number, device: string) => void,
    ) => () => void;
    onMidiMessage: (
      namespace: string,
      callback: (message: number[], timestamp: number, device: string) => void,
    ) => () => void;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
