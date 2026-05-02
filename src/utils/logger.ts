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
  private isIntercepting = false;

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

  interceptConsole(): void {
    if (this.isIntercepting) return;
    this.isIntercepting = true;

    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
    };

    console.log = (...args: any[]) => {
      originalConsole.log.apply(console, args);
      this.addLog("info", args.map(this.formatArg).join(" "));
    };

    console.warn = (...args: any[]) => {
      originalConsole.warn.apply(console, args);
      this.addLog("warn", args.map(this.formatArg).join(" "));
    };

    console.error = (...args: any[]) => {
      originalConsole.error.apply(console, args);
      this.addLog("error", args.map(this.formatArg).join(" "));
    };

    console.info = (...args: any[]) => {
      originalConsole.info.apply(console, args);
      this.addLog("info", args.map(this.formatArg).join(" "));
    };
  }

  private formatArg(arg: any): string {
    if (typeof arg === "string") return arg;
    if (arg instanceof Error) return arg.stack || arg.message;
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }
}

export const logger = new Logger();
