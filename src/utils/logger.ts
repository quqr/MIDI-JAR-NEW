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
  private maxLogs = 500;

  // 保存原始 console 方法引用，避免 interceptConsole 后 addLog 调用 console.log 形成无限递归
  private originalLog: typeof console.log = console.log;
  private originalWarn: typeof console.warn = console.warn;
  private originalError: typeof console.error = console.error;
  private originalInfo: typeof console.info = console.info;
  // 防递归守卫：interceptConsole 拦截到的日志在 addLog 内部不应再次触发拦截
  private isAddingFromInterceptor = false;

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
    const logEntry: LogEntry = {
      id: this.nextId++,
      timestamp: this.formatTimestamp(),
      type,
      message,
    };
    if (this.logs.value.length > this.maxLogs) {
      this.logs.value.splice(0, this.logs.value.length - this.maxLogs);
    }
    this.logs.value.push(logEntry);

    // 使用原始 console 方法输出，避免与 interceptConsole 形成无限递归
    if (!this.isAddingFromInterceptor) {
      switch (type) {
        case "warn":
          this.originalWarn(logEntry);
          break;
        case "error":
          this.originalError(logEntry);
          break;
        case "success":
          this.originalLog(logEntry);
          break;
        default:
          this.originalInfo(logEntry);
      }
    }
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

    // 保存原始方法到实例属性，addLog 中使用这些引用避免递归
    this.originalLog = console.log;
    this.originalWarn = console.warn;
    this.originalError = console.error;
    this.originalInfo = console.info;

    console.log = (...args: any[]) => {
      this.originalLog.apply(console, args);
      this.isAddingFromInterceptor = true;
      this.addLog("info", args.map(this.formatArg).join(" "));
      this.isAddingFromInterceptor = false;
    };

    console.warn = (...args: any[]) => {
      this.originalWarn.apply(console, args);
      this.isAddingFromInterceptor = true;
      this.addLog("warn", args.map(this.formatArg).join(" "));
      this.isAddingFromInterceptor = false;
    };

    console.error = (...args: any[]) => {
      this.originalError.apply(console, args);
      this.isAddingFromInterceptor = true;
      this.addLog("error", args.map(this.formatArg).join(" "));
      this.isAddingFromInterceptor = false;
    };

    console.info = (...args: any[]) => {
      this.originalInfo.apply(console, args);
      this.isAddingFromInterceptor = true;
      this.addLog("info", args.map(this.formatArg).join(" "));
      this.isAddingFromInterceptor = false;
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
