/**
 * Debugger Logger - 用于 Debugger UI 的内存日志存储
 *
 * 提供日志存储、过滤和清除功能，专门用于 Debugger 组件的 UI 显示。
 */

export type LogType = "info" | "warn" | "error" | "success";

export interface LogEntry {
  id: number;
  type: LogType;
  message: string;
  timestamp: string;
}

/**
 * Debugger 日志存储类
 * 在内存中存储日志，支持按类型过滤和清除
 */
export class DebuggerLogger {
  private logs: LogEntry[] = [];
  private nextId = 0;
  private maxLogs = 1000; // 最大日志数量，防止内存溢出

  /**
   * 添加一条日志
   */
  private addLog(type: LogType, message: string): void {
    const entry: LogEntry = {
      id: this.nextId++,
      type,
      message,
      timestamp: new Date().toLocaleTimeString(),
    };

    this.logs.push(entry);

    // 超过最大数量时，删除旧日志
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  /**
   * 添加信息日志
   */
  info(message: string): void {
    this.addLog("info", message);
  }

  /**
   * 添加警告日志
   */
  warn(message: string): void {
    this.addLog("warn", message);
  }

  /**
   * 添加错误日志
   */
  error(message: string): void {
    this.addLog("error", message);
  }

  /**
   * 添加成功日志
   */
  success(message: string): void {
    this.addLog("success", message);
  }

  /**
   * 按类型过滤日志
   */
  filterByType(type: LogType | "all"): LogEntry[] {
    if (type === "all") {
      return [...this.logs];
    }
    return this.logs.filter((log) => log.type === type);
  }

  /**
   * 清除所有日志
   */
  clearLogs(): void {
    this.logs = [];
    this.nextId = 0;
  }

  /**
   * 获取所有日志
   */
  getAllLogs(): LogEntry[] {
    return [...this.logs];
  }
}

// 创建全局单例
export const debuggerLogger = new DebuggerLogger();