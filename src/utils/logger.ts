import { ref } from "vue";

export type LogType = "info" | "warn" | "error" | "success";

export interface LogEntry {
  id: number;
  timestamp: string;
  type: LogType;
  message: string;
}

class Logger {
  private logs = ref<LogEntry[]>([]);
  private nextId = 0;

  private formatTimestamp(): string {
    const now = new Date();
    return now.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    } as Intl.DateTimeFormatOptions);
  }

  private addLog(type: LogType, message: string): void {
    this.logs.value.push({
      id: this.nextId++,
      timestamp: this.formatTimestamp(),
      type,
      message,
    });
  }

  info(message: string): void {
    this.addLog("info", message);
  }

  warn(message: string): void {
    this.addLog("warn", message);
  }

  error(message: string): void {
    this.addLog("error", message);
  }

  success(message: string): void {
    this.addLog("success", message);
  }

  getLogs(): LogEntry[] {
    return this.logs.value;
  }

  getLogsRef() {
    return this.logs;
  }

  clearLogs(): void {
    this.logs.value = [];
  }

  filterByType(type: LogType | "all"): LogEntry[] {
    if (type === "all") {
      return this.logs.value;
    }
    return this.logs.value.filter((log) => log.type === type);
  }
}

export const logger = new Logger();
