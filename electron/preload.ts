import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "./ipc";

// IMPORTANT: Keep this preload script minimal.
// The preload script runs before the page loads and should only expose
// the minimum required APIs to the renderer process via contextBridge.
// Adding heavy logic here will increase startup time.
// All heavy operations should be done in the main process.

contextBridge.exposeInMainWorld("electronAPI", {
  on: (channel: string, callback: (data?: any) => void) => {
    ipcRenderer.on(channel, (_event, data) => callback(data));
  },
  app: {
    quit: () => ipcRenderer.send(IPC_CHANNELS.APP.QUIT),
    getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP.GET_VERSION),
    getPlatform: () => ipcRenderer.invoke(IPC_CHANNELS.APP.GET_PLATFORM),
  },
  window: {
    minimize: () => ipcRenderer.send(IPC_CHANNELS.WINDOW.MINIMIZE),
    maximize: () => ipcRenderer.send(IPC_CHANNELS.WINDOW.MAXIMIZE),
    close: () => ipcRenderer.send(IPC_CHANNELS.WINDOW.CLOSE),
    isMaximized: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW.IS_MAXIMIZED),
    getWindowState: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW.GET_STATE),
    setAlwaysOnTop: (flag: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOW.SET_ALWAYS_ON_TOP, flag),
    onStateChanged: (callback: (state: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.WINDOW.ON_STATE_CHANGED, (_event, state) =>
        callback(state),
      );
    },
    onMaximizedChanged: (callback: (maximized: boolean) => void) => {
      ipcRenderer.on(
        IPC_CHANNELS.WINDOW.ON_MAXIMIZED_CHANGED,
        (_event, maximized: boolean) => callback(maximized),
      );
    },
    startDrag: () => {
      ipcRenderer.send(IPC_CHANNELS.WINDOW.START_DRAG);
    },
    setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => {
      ipcRenderer.send(
        IPC_CHANNELS.WINDOW.SET_IGNORE_MOUSE_EVENTS,
        ignore,
        options,
      );
    },
  },
  fileSystem: {
    openFileDialog: (options?: Electron.OpenDialogOptions) =>
      ipcRenderer.invoke(IPC_CHANNELS.FILE_SYSTEM.OPEN_FILE_DIALOG, options),
    readFile: (filePath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.FILE_SYSTEM.READ_FILE, filePath),
    writeFile: (filePath: string, content: string) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.FILE_SYSTEM.WRITE_FILE,
        filePath,
        content,
      ),
    saveFileDialog: (options?: Electron.SaveDialogOptions) =>
      ipcRenderer.invoke(IPC_CHANNELS.FILE_SYSTEM.SAVE_FILE_DIALOG, options),
  },
  midi: {
    refreshDevices: () => ipcRenderer.send(IPC_CHANNELS.MIDI.REFRESH_DEVICES),
    clearRoutes: () => ipcRenderer.send(IPC_CHANNELS.MIDI.CLEAR_ROUTES),
    addRoute: (route: any) =>
      ipcRenderer.send(IPC_CHANNELS.MIDI.ADD_ROUTE, route),
    deleteRoute: (route: any) =>
      ipcRenderer.send(IPC_CHANNELS.MIDI.DELETE_ROUTE, route),
    getInputs: () => ipcRenderer.send(IPC_CHANNELS.MIDI.GET_INPUTS),
    onInputs: (callback: (inputs: any[]) => void) => {
      const listener = (_event: any, inputs: any[]) => callback(inputs);
      ipcRenderer.on(IPC_CHANNELS.MIDI.ON_INPUTS, listener);
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.MIDI.ON_INPUTS, listener);
    },
    getOutputs: () => ipcRenderer.send(IPC_CHANNELS.MIDI.GET_OUTPUTS),
    onOutputs: (callback: (outputs: any[]) => void) => {
      const listener = (_event: any, outputs: any[]) => callback(outputs);
      ipcRenderer.on(IPC_CHANNELS.MIDI.ON_OUTPUTS, listener);
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.MIDI.ON_OUTPUTS, listener);
    },
    getWires: () => ipcRenderer.send(IPC_CHANNELS.MIDI.GET_WIRES),
    onWires: (callback: (wires: any[]) => void) => {
      const listener = (_event: any, wires: any[]) => callback(wires);
      ipcRenderer.on(IPC_CHANNELS.MIDI.ON_WIRES, listener);
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.MIDI.ON_WIRES, listener);
    },
    onLatency: (callback: (latency: number, device: string) => void) => {
      const listener = (_event: any, latency: number, device: string) =>
        callback(latency, device);
      ipcRenderer.on(IPC_CHANNELS.MIDI.ON_ACTIVITY, listener);
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.MIDI.ON_ACTIVITY, listener);
    },
    onMidiMessage: (
      namespace: string,
      callback: (message: number[], timestamp: number, device: string) => void,
    ) => {
      const channel = `${IPC_CHANNELS.MIDI.ON_MIDI_MESSAGE}:${namespace}`;
      const listener = (
        _event: any,
        message: number[],
        timestamp: number,
        device: string,
      ) => callback(message, timestamp, device);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
  },
});
