import { app, BrowserWindow, Tray, Menu, screen, dialog, shell } from "electron";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { IPC_CHANNELS } from "./ipc";
import { setupApplicationMenu } from "./menu";
import { secureHandle, secureOn } from "./security";
import * as midi from "./midi";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WINDOW_STATE_FILE = "app-data/window-state.json";
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;
const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;

interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function getWindowStatePath(): string {
  const userDataPath = app.getPath("userData");
  const appDataDir = join(userDataPath, "app-data");
  if (!existsSync(appDataDir)) {
    mkdirSync(appDataDir, { recursive: true });
  }
  return join(appDataDir, WINDOW_STATE_FILE);
}

function loadWindowState(): Partial<WindowState> {
  try {
    const statePath = getWindowStatePath();
    if (!existsSync(statePath)) {
      return {};
    }
    const raw = readFileSync(statePath, "utf-8");
    const state: WindowState = JSON.parse(raw);

    if (
      typeof state.width !== "number" ||
      typeof state.height !== "number" ||
      state.width < MIN_WIDTH ||
      state.height < MIN_HEIGHT
    ) {
      return {};
    }

    if (typeof state.x === "number" && typeof state.y === "number") {
      const displays = screen.getAllDisplays();
      const isValidPosition = displays.some((display) => {
        const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
        return (
          state.x >= dx &&
          state.x < dx + dw &&
          state.y >= dy &&
          state.y < dy + dh
        );
      });
      if (!isValidPosition) {
        return {
          width: state.width,
          height: state.height,
        };
      }
    }

    return state;
  } catch {
    return {};
  }
}

function saveWindowState(state: WindowState): void {
  try {
    const statePath = getWindowStatePath();
    writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
  } catch {
    // silently ignore
  }
}

function getWindowState(): WindowState | null {
  if (!mainWindow) return null;
  const bounds = mainWindow.getBounds();
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: mainWindow.isMaximized(),
  };
}

function createTray(): void {
  try {
    const iconPath = join(__dirname, "../public/icon.png");
    if (existsSync(iconPath)) {
      tray = new Tray(iconPath);
      const contextMenu = Menu.buildFromTemplate([
        {
          label: "显示窗口",
          click: () => {
            mainWindow?.show();
          },
        },
        {
          label: "隐藏窗口",
          click: () => {
            mainWindow?.hide();
          },
        },
        { type: "separator" },
        {
          label: "退出",
          click: () => {
            app.quit();
          },
        },
      ]);
      tray.setContextMenu(contextMenu);
      tray.setToolTip("MIDI-JAR");
      tray.on("click", () => {
        mainWindow?.show();
      });
    }
  } catch {
    // tray not supported
  }
}

function createWindow() {
  const savedState = loadWindowState();

  const isMac = process.platform === "darwin";

  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    x: savedState.x,
    y: savedState.y,
    width: savedState.width ?? DEFAULT_WIDTH,
    height: savedState.height ?? DEFAULT_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    frame: false,
    backgroundColor: "#1a1a1a",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      enableRemoteModule: false,
    },
  };

  if (isMac) {
    windowOptions.titleBarStyle = "hiddenInset";
    delete windowOptions.frame;
  }

  mainWindow = new BrowserWindow(windowOptions);
  mainWindow.webContents.openDevTools();
  if (savedState.isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }

  mainWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self'; " +
              "script-src 'self'; " +
              "style-src 'self' 'unsafe-inline'; " +
              "img-src 'self' data: blob:; " +
              "font-src 'self' data:; " +
              "connect-src 'self'; " +
              "media-src 'self'; " +
              "worker-src 'self' blob:;",
          ],
        },
      });
    },
  );

  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      const allowedPermissions = ["midi", "midiSysex"];
      callback(allowedPermissions.includes(permission));
    },
  );

  mainWindow.on("resize", () => {
    if (mainWindow && !mainWindow.isMaximized()) {
      const state = getWindowState();
      if (state) saveWindowState(state);
    }
  });

  mainWindow.on("move", () => {
    const state = getWindowState();
    if (state) saveWindowState(state);
  });

  mainWindow.on("maximize", () => {
    const state = getWindowState();
    if (state) saveWindowState(state);
    mainWindow?.webContents.send(
      IPC_CHANNELS.WINDOW.ON_MAXIMIZED_CHANGED,
      true,
    );
  });

  mainWindow.on("unmaximize", () => {
    const state = getWindowState();
    if (state) saveWindowState(state);
    mainWindow?.webContents.send(
      IPC_CHANNELS.WINDOW.ON_MAXIMIZED_CHANGED,
      false,
    );
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

secureHandle(IPC_CHANNELS.APP.GET_VERSION, () => {
  return app.getVersion();
});

secureHandle(IPC_CHANNELS.APP.GET_PLATFORM, () => {
  return process.platform;
});

secureOn(IPC_CHANNELS.APP.QUIT, () => {
  app.quit();
});

secureOn(IPC_CHANNELS.WINDOW.MINIMIZE, () => {
  mainWindow?.minimize();
});

secureOn(IPC_CHANNELS.WINDOW.MAXIMIZE, () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

secureOn(IPC_CHANNELS.WINDOW.CLOSE, () => {
  mainWindow?.close();
});

secureHandle(IPC_CHANNELS.WINDOW.IS_MAXIMIZED, () => {
  return mainWindow?.isMaximized() ?? false;
});

secureHandle(IPC_CHANNELS.WINDOW.GET_STATE, () => {
  return getWindowState();
});

secureHandle(IPC_CHANNELS.WINDOW.SET_ALWAYS_ON_TOP, (_event, flag: boolean) => {
  mainWindow?.setAlwaysOnTop(flag);
  return mainWindow?.isAlwaysOnTop() ?? false;
});

secureOn(IPC_CHANNELS.WINDOW.START_DRAG, () => {
  mainWindow?.startDragging();
});

secureOn(
  IPC_CHANNELS.WINDOW.SET_IGNORE_MOUSE_EVENTS,
  (_event, ignore: boolean, options?: { forward: boolean }) => {
    mainWindow?.setIgnoreMouseEvents(ignore, options);
  },
);

secureHandle(
  IPC_CHANNELS.FILE_SYSTEM.OPEN_FILE_DIALOG,
  async (_event, options?: Electron.OpenDialogOptions) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openFile"],
      filters: [
        { name: "MIDI Files", extensions: ["mid", "midi"] },
        { name: "All Files", extensions: ["*"] },
      ],
      ...options,
    });
    return result;
  },
);

secureHandle(
  IPC_CHANNELS.FILE_SYSTEM.SAVE_FILE_DIALOG,
  async (_event, options?: Electron.SaveDialogOptions) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: "untitled.mid",
      filters: [{ name: "MIDI Files", extensions: ["mid", "midi"] }],
      ...options,
    });
    return result;
  },
);

secureHandle(
  IPC_CHANNELS.FILE_SYSTEM.READ_FILE,
  async (_event, filePath: string) => {
    try {
      const content = readFileSync(filePath, "utf-8");
      return { success: true, content };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
);

secureHandle(
  IPC_CHANNELS.FILE_SYSTEM.WRITE_FILE,
  async (_event, filePath: string, content: string) => {
    try {
      writeFileSync(filePath, content, "utf-8");
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
);

secureHandle(
  IPC_CHANNELS.SHELL.OPEN_EXTERNAL,
  async (_event, url: string) => {
    try {
      await shell.openExternal(url);
    } catch (error) {
      console.error(`Failed to open URL: ${url}`, error);
    }
  },
);

function sendToAll(channel: string, ...args: unknown[]) {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach((window) => {
    window.webContents.send(channel, ...args);
  });
}

secureOn(IPC_CHANNELS.MIDI.REFRESH_DEVICES, () => {
  midi.refreshDevices(true);
});

secureOn(IPC_CHANNELS.MIDI.CLEAR_ROUTES, () => {
  midi.clearRoutes();
});

secureOn(IPC_CHANNELS.MIDI.ADD_ROUTE, (_event, route) => {
  midi.addRoute(route);
});

secureOn(IPC_CHANNELS.MIDI.DELETE_ROUTE, (_event, route) => {
  midi.deleteRoute(route);
});

secureOn(IPC_CHANNELS.MIDI.GET_INPUTS, (event) => {
  const inputs = midi.getInputs();
  event.reply(IPC_CHANNELS.MIDI.ON_INPUTS, inputs);
});

secureOn(IPC_CHANNELS.MIDI.GET_OUTPUTS, (event) => {
  const outputs = midi.getOutputs();
  event.reply(IPC_CHANNELS.MIDI.ON_OUTPUTS, outputs);
});

secureOn(IPC_CHANNELS.MIDI.GET_WIRES, (event) => {
  const wires = midi.getWires();
  event.reply(IPC_CHANNELS.MIDI.ON_WIRES, wires);
});

midi.manager.addListener("refreshed", () => {
  sendToAll(IPC_CHANNELS.MIDI.ON_INPUTS, midi.getInputs());
  sendToAll(IPC_CHANNELS.MIDI.ON_OUTPUTS, midi.getOutputs());
  sendToAll(IPC_CHANNELS.MIDI.ON_WIRES, midi.getWires());
});

midi.manager.addListener(
  "midi",
  (namespace: string, message: number[], timestamp: number, device: string) => {
    sendToAll(
      `${IPC_CHANNELS.MIDI.ON_MIDI_MESSAGE}:*`,
      message,
      timestamp,
      device,
    );
    sendToAll(
      `${IPC_CHANNELS.MIDI.ON_MIDI_MESSAGE}:${namespace}`,
      message,
      timestamp,
      device,
    );
    if (namespace === "internal") {
      const moduleOutputs = midi.getModuleOutputs();
      for (const mod of moduleOutputs) {
        sendToAll(
          `${IPC_CHANNELS.MIDI.ON_MIDI_MESSAGE}:${mod}`,
          message,
          timestamp,
          device,
        );
      }
    }
  },
);

midi.manager.addListener("activity", (latency: number, device: string) => {
  sendToAll(IPC_CHANNELS.MIDI.ON_ACTIVITY, latency, device);
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  midi.startRefreshLoop();

  if (mainWindow) {
    setupApplicationMenu(mainWindow);
    mainWindow.webContents.send(IPC_CHANNELS.APP.ON_READY);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  const state = getWindowState();
  if (state) saveWindowState(state);
  midi.stopRefreshLoop();
  if (mainWindow) {
    mainWindow.webContents.send(IPC_CHANNELS.APP.ON_BEFORE_QUIT);
  }
});
