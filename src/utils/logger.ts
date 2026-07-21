/**
 * Pino 日志系统 - 统一的日志管理工具
 *
 * 仅控制台输出，不实现文件持久化。
 * 开发环境使用 pino-pretty 格式化输出，生产环境仅输出 warn 及以上级别。
 *
 * 使用方式：
 *   import { createLogger } from '@/utils/logger';
 *   const logger = createLogger('MidiFilePlayer');
 *   logger.debug('Loading file:', filename);
 *   logger.info('File loaded successfully');
 *   logger.warn('Block pool running low');
 *   logger.error('Failed to load file:', error);
 */

import pino from "pino";
import { debuggerLogger } from "@/views/Settings/Debugger/debugger-logger";

const logger = pino({
  level: import.meta.env.DEV ? "debug" : "warn",
  browser: { asObject: false },
});

/**
 * 将任意参数格式化为字符串
 */
function stringifyArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === "string") return a;
      if (a instanceof Error) return a.message || a.toString();
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ");
}

/**
 * 日志级别 → debuggerLogger 方法映射
 */
type DebuggerMethod = "info" | "warn" | "error";
const LEVEL_TO_DEBUGGER: Record<string, DebuggerMethod> = {
  debug: "info",
  trace: "info",
  info: "info",
  warn: "warn",
  error: "error",
  fatal: "error",
};

/**
 * 创建带标签的子 logger，同时将日志路由到调试器面板
 *
 * Pino 10 在初始化时通过闭包缓存 console.log 引用，
 * 运行时替换 console.log 无法拦截 Pino 输出。
 * 因此在这里直接从 logger 层面将日志转发到 debuggerLogger。
 *
 * @param tag - 模块标签，用于区分日志来源
 * @returns pino 子 logger 实例（带有调试器路由）
 */
export function createLogger(tag: string) {
  const child = logger.child({ tag });

  // 在 Pino 日志方法上挂载调试器转发
  const logMethods = ["debug", "trace", "info", "warn", "error", "fatal"];
  for (const method of logMethods) {
    const original = child[method as keyof typeof child] as (
      ...args: unknown[]
    ) => void;
    if (typeof original !== "function") continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (child as any)[method] = (...args: unknown[]) => {
      // 先调用原始 Pino 方法（输出到控制台）
      original.apply(child, args);

      // 转发到调试器面板
      const message = `[${tag}] ${stringifyArgs(args)}`;
      const debugMethod = LEVEL_TO_DEBUGGER[method] || "info";
      debuggerLogger[debugMethod](message);
    };
  }

  return child;
}

export default logger;
