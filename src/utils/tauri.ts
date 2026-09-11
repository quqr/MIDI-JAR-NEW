import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type {
  VstScanCache,
  VstScanProgress,
  VstSnapshot,
  VstStatusPayload,
} from "@/types/vst";
import type { DialogFilter } from "@/types/tauri";

let appWindow: ReturnType<typeof getCurrentWindow> | null = null;

/**
 * 懒加载获取当前 Tauri 窗口实例
 * @returns Tauri 窗口对象
 */
function win(): ReturnType<typeof getCurrentWindow> {
  if (!appWindow) {
    appWindow = getCurrentWindow();
  }
  return appWindow;
}

/**
 * 判断当前是否运行在 Tauri 环境中
 * 通过检测 __TAURI_INTERNALS__（Tauri 2.0）或 __TAURI__（Tauri 1.x）全局变量
 * @returns 是否为 Tauri 环境
 */
export function isTauri(): boolean {
  const hasWindow = typeof window !== "undefined";
  // Tauri 2.0 使用 __TAURI_INTERNALS__ 而不是 __TAURI__
  const hasTauriInternals = hasWindow && "__TAURI_INTERNALS__" in window;
  const hasTauriGlobal = hasWindow && "__TAURI__" in window;
  return hasTauriInternals || hasTauriGlobal;
}

/**
 * 获取挂载在 window 上的 tauriAPI 对象，非 Tauri 环境下抛出异常
 * @returns tauriAPI 对象
 * @throws 未运行在 Tauri 环境或 tauriAPI 未就绪时抛出错误
 */
export function getTauriAPI(): NonNullable<Window["tauriAPI"]> {
  if (!isTauri()) {
    throw new Error("Not running in Tauri environment");
  }
  if (!window.tauriAPI) {
    throw new Error("tauriAPI is not available despite Tauri environment");
  }
  return window.tauriAPI;
}

/**
 * 在 Tauri 环境中执行函数，否则返回 fallback 值
 * @param fn - 需要在 Tauri 环境中执行的函数
 * @param fallback - 非 Tauri 环境时的返回值
 * @returns fn 的返回值或 fallback
 */
export function runInTauri<T>(fn: () => T, fallback?: T): T | undefined {
  if (isTauri()) {
    return fn();
  }
  return fallback;
}

/**
 * 安全执行窗口操作，捕获异常并输出错误日志
 * @param action - 操作名称，用于错误日志标识
 * @param fn - 实际执行的异步操作
 * @returns 操作结果，失败时返回 undefined
 */
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

/**
 * Tauri API 封装，涵盖事件监听、应用控制、窗口管理、文件系统、MIDI 和 Shell 操作
 */
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
    openFileDialog: (filters?: DialogFilter[]) =>
      invoke<any>("open_file_dialog", { filters: filters ?? null }),
    /** 选择单个目录（用于 VST 扫描目录等）；取消返回 null */
    openDirectoryDialog: () => invoke<string | null>("open_directory_dialog"),
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
    saveFileDialog: (fileName?: string, filters?: DialogFilter[]) =>
      invoke<any>("save_file_dialog", {
        fileName: fileName ?? null,
        filters: filters ?? null,
      }),
    /** 原始字节写入系统临时文件（大文件免 base64/JSON 编码），返回临时绝对路径 */
    writeTempFile: (data: ArrayBuffer | Uint8Array) =>
      invoke<string>("write_temp_file", new Uint8Array(data)),
    /** 移动文件到目标绝对路径（保存对话框返回的路径） */
    moveFile: (from: string, to: string) =>
      invoke<void>("move_file", { from, to }),
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
    // Virtual port methods
    isVirtualPortSupported: () => {
      return invoke<boolean>("is_virtual_port_supported");
    },
    createVirtualInput: (name: string) => {
      return invoke<void>("create_virtual_input", { name });
    },
    createVirtualOutput: (name: string) => {
      return invoke<void>("create_virtual_output", { name });
    },
    deleteVirtualInput: (name: string) => {
      return invoke<void>("delete_virtual_input", { name });
    },
    deleteVirtualOutput: (name: string) => {
      return invoke<void>("delete_virtual_output", { name });
    },
  },
  shell: {
    openExternal: (url: string) => invoke<void>("open_external", { url }),
  },
  vst: {
    /** 扫描全部 VST3 插件并刷新后端缓存（重活，耗时数秒） */
    scan: () => invoke<VstScanCache>("scan_vst_plugins"),
    /** 读取上一次扫描的缓存结果；从未扫描过返回 null */
    getScanCache: () => invoke<VstScanCache | null>("get_vst_scan_cache"),
    /** 添加自定义扫描目录，返回添加后的完整目录列表 */
    addScanPath: (path: string) =>
      invoke<string[]>("add_vst_scan_path", { path }),
    /** 移除自定义扫描目录，返回移除后的完整目录列表 */
    removeScanPath: (path: string) =>
      invoke<string[]>("remove_vst_scan_path", { path }),
    /** 用持久化的自定义目录初始化后端（启动时调用一次），返回生效目录列表 */
    restoreScanPaths: (paths: string[]) =>
      invoke<string[]>("restore_vst_scan_paths", { paths }),
    /**
     * 加载插件。`openEditor` 由 Tauri 自动映射到 Rust 侧 `open_editor`。
     * 失败时后端进入 error 态并广播 `vst:status`，同时把同一错误抛给调用方。
     */
    load: (path: string, openEditor = true) =>
      invoke<void>("load_vst_plugin", { path, openEditor }),
    /** 卸载当前插件（停止音频、关闭编辑器） */
    unload: () => invoke<void>("unload_vst_plugin"),
    /** 转发一批原始 MIDI 字节到当前插件 */
    sendMidi: (bytes: number[]) =>
      invoke<void>("send_vst_midi", { bytes: Array.from(bytes) }),
    /** 打开插件编辑器窗口 */
    openEditor: () => invoke<void>("open_vst_editor"),
    /** 关闭插件编辑器窗口（插件保活） */
    closeEditor: () => invoke<void>("close_vst_editor"),
    /** 查询当前 VST 状态（状态机 + 已加载插件信息） */
    getStatus: () => invoke<VstSnapshot>("get_vst_status"),
    /** 订阅状态变化（加载/卸载/错误） */
    onStatus: (callback: (status: VstStatusPayload) => void) => {
      return listen<VstStatusPayload>("vst:status", (event) => {
        callback(event.payload);
      });
    },
    /** 订阅扫描进度（started / done 两相，无细粒度进度） */
    onScanProgress: (callback: (progress: VstScanProgress) => void) => {
      return listen<VstScanProgress>("vst:scan-progress", (event) => {
        callback(event.payload);
      });
    },
  },
};

let initialized = false;

/**
 * 确保在 Tauri 环境中将 tauriAPI 挂载到 window 上，仅执行一次
 */
function ensureInitialized(): void {
  if (initialized) return;
  initialized = true;

  if (isTauri() && !window.tauriAPI) {
    window.tauriAPI = tauriAPI;
  }
}

// 在 DOMContentLoaded 后自动初始化，确保 __TAURI_INTERNALS__ 已注入
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureInitialized);
  } else {
    // DOM 已加载，立即初始化
    ensureInitialized();
  }
}

export default tauriAPI;
