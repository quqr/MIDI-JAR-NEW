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
    getInputs: () => Promise<string[]>;
    getOutputs: () => Promise<string[]>;
    onDeviceConnected: (callback: (deviceName: string) => void) => () => void;
    onDeviceDisconnected: (
      callback: (deviceName: string) => void,
    ) => () => void;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
