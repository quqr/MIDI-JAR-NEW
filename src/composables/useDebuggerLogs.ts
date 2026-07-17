/**
 * Debugger 日志系统 - 统一管理所有日志源
 *
 * 支持：
 * 1. 前端 Pino 日志（浏览器和 Tauri）
 * 2. Rust 日志（仅 Tauri 环境，通过事件传递）
 * 3. MIDI 消息流（通过 midiMessages store）
 */

import { onMounted, onUnmounted } from "vue";
import { debuggerLogger } from "@/views/Settings/Debugger/debugger-logger";
import { isTauri } from "@/utils/tauri";

/**
 * 监听前端 Pino 日志
 * 通过拦截 console 输出，将 Pino 日志转发到 Debugger
 */
function setupPinoLogInterceptor() {
  // 保存原始的 console 方法
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
    trace: console.trace,
  };

  // 判断是否是 Pino 日志（通过检查参数格式）
  function isPinoLog(args: unknown[]): boolean {
    if (args.length === 0) return false;

    // Pino 日志格式：[日志对象] 或带标签的字符串
    const firstArg = args[0];
    if (typeof firstArg === "object" && firstArg !== null) {
      // Pino 对象日志（如 { level: 30, time: ..., msg: ... }）
      return "level" in firstArg || "msg" in firstArg || "tag" in firstArg;
    }

    // 字符串日志，检查是否包含 [模块名] 标签
    if (typeof firstArg === "string") {
      return /^\[.*?\]/.test(firstArg);
    }

    return false;
  }

  // 提取日志消息
  function extractMessage(args: unknown[]): string {
    return args
      .map((arg) => {
        if (typeof arg === "string") return arg;
        if (typeof arg === "number" || typeof arg === "boolean") {
          return String(arg);
        }
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      })
      .join(" ");
  }

  // 拦截 console.log
  console.log = (...args: unknown[]) => {
    originalConsole.log(...args);
    if (isPinoLog(args)) {
      debuggerLogger.info(extractMessage(args));
    }
  };

  // 拦截 console.info
  console.info = (...args: unknown[]) => {
    originalConsole.info(...args);
    if (isPinoLog(args)) {
      debuggerLogger.info(extractMessage(args));
    }
  };

  // 拦截 console.warn
  console.warn = (...args: unknown[]) => {
    originalConsole.warn(...args);
    if (isPinoLog(args)) {
      debuggerLogger.warn(extractMessage(args));
    }
  };

  // 拦截 console.error
  console.error = (...args: unknown[]) => {
    originalConsole.error(...args);
    if (isPinoLog(args)) {
      debuggerLogger.error(extractMessage(args));
    }
  };

  // 拦截 console.debug
  console.debug = (...args: unknown[]) => {
    originalConsole.debug(...args);
    if (isPinoLog(args)) {
      debuggerLogger.info(extractMessage(args));
    }
  };

  // 拦截 console.trace
  console.trace = (...args: unknown[]) => {
    originalConsole.trace(...args);
    if (isPinoLog(args)) {
      debuggerLogger.info(extractMessage(args));
    }
  };

  // 返回清理函数
  return () => {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
    console.trace = originalConsole.trace;
  };
}

/**
 * 监听 Rust 日志（仅 Tauri 环境）
 * 通过 Tauri 事件监听 Rust 端的日志输出
 */
async function setupRustLogListener() {
  if (!isTauri()) {
    return () => {};
  }

  const { listen } = await import("@tauri-apps/api/event");

  // 监听 Rust 端的日志事件
  const unlisten = await listen<string>("rust:log", (event) => {
    try {
      const logData = JSON.parse(event.payload);
      const { level, message, module } = logData;

      // 格式化消息，添加模块标签
      const formattedMessage = module
        ? `[${module}] ${message}`
        : message;

      // 根据级别转发到对应的 logger 方法
      switch (level.toLowerCase()) {
        case "error":
          debuggerLogger.error(formattedMessage);
          break;
        case "warn":
          debuggerLogger.warn(formattedMessage);
          break;
        case "info":
          debuggerLogger.info(formattedMessage);
          break;
        case "debug":
          debuggerLogger.info(formattedMessage);
          break;
        case "trace":
          debuggerLogger.info(formattedMessage);
          break;
        default:
          debuggerLogger.info(formattedMessage);
      }
    } catch (e) {
      // 如果解析失败，直接记录原始消息
      debuggerLogger.info(event.payload);
    }
  });

  return unlisten;
}

/**
 * 组合式函数：监听所有日志源
 *
 * 在 Debugger 页面挂载时自动启动监听，卸载时自动清理
 */
export function useDebuggerLogs() {
  let cleanupPino: (() => void) | null = null;
  let cleanupRust: (() => void) | null = null;

  onMounted(async () => {
    // 启动 Pino 日志拦截
    cleanupPino = setupPinoLogInterceptor();

    // 启动 Rust 日志监听（仅 Tauri 环境）
    cleanupRust = await setupRustLogListener();
  });

  onUnmounted(() => {
    // 清理 Pino 日志拦截
    if (cleanupPino) {
      cleanupPino();
      cleanupPino = null;
    }

    // 清理 Rust 日志监听
    if (cleanupRust) {
      cleanupRust();
      cleanupRust = null;
    }
  });
}