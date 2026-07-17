/**
 * Debugger 日志系统 - 统一管理所有日志源
 *
 * 日志来源：
 * 1. 前端日志 — createLogger() 在 logger.ts 中直接写入 debuggerLogger（全局生效，始终收集）
 * 2. Rust 日志 — initRustLogListener() 在 main.ts 中全局注册（应用启动即生效）
 * 3. MIDI 消息 — Debugger.vue 中 useMidiMessages 直接写入 debuggerLogger
 *
 * 兼容性：
 * - 浏览器环境：isTauri() 返回 false，initRustLogListener() 无操作
 * - Tauri 环境：监听 "rust:log" 事件，应用启动时即开始收集
 */

import { debuggerLogger } from "@/views/Settings/Debugger/debugger-logger";
import { isTauri } from "@/utils/tauri";

/**
 * 全局初始化 Rust 日志监听器
 *
 * 在 main.ts 应用启动时调用一次，保证从启动开始所有 Rust 日志都被收集。
 *
 * - 浏览器环境：直接返回，不做任何操作
 * - Tauri 环境：监听 "rust:log" 事件，格式化后写入 debuggerLogger
 * - 清理通过 window.beforeunload 自动执行
 */
export async function initRustLogListener(): Promise<void> {
  if (!isTauri()) {
    return;
  }

  const { listen } = await import("@tauri-apps/api/event");

  const unlisten = await listen<string>("rust:log", (event) => {
    try {
      const logData = JSON.parse(event.payload);
      const { level, message, module } = logData;

      const formattedMessage = module
        ? `[Rust/${module}] ${message}`
        : `[Rust] ${message}`;

      switch (level.toLowerCase()) {
        case "error":
          debuggerLogger.error(formattedMessage);
          break;
        case "warn":
          debuggerLogger.warn(formattedMessage);
          break;
        default:
          debuggerLogger.info(formattedMessage);
      }
    } catch {
      debuggerLogger.info(`[Rust] ${event.payload}`);
    }
  });

  // 应用关闭时清理监听器
  window.addEventListener("beforeunload", () => {
    unlisten();
  });
}
