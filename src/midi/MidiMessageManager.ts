import type { UnlistenFn } from "@tauri-apps/api/event";

function debugLog(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
}

/**
 * MIDI 消息事件，封装单条 MIDI 消息及其元信息
 */
export class MidiMessageEvent extends Event {
  message: number[];
  timestamp: number;
  device: string;

  constructor(
    type: "message",
    message: number[],
    timestamp: number,
    device: string,
  ) {
    super(type);
    this.message = message;
    this.timestamp = timestamp;
    this.device = device;
  }
}

/**
 * MidiMessageManager 的类型接口，扩展 EventTarget 以提供类型安全的 MIDI 消息事件监听
 */
interface MidiMessageManager extends EventTarget {
  addEventListener(
    type: "message",
    listener: (ev: MidiMessageEvent) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: "message",
    listener: (ev: MidiMessageEvent) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
  dispose(): void;
}

/**
 * MIDI 消息管理器基类，基于命名空间隔离不同来源的 MIDI 消息流
 */
class MidiMessageManager extends EventTarget {
  namespace: string;

  constructor(namespace: string) {
    super();
    this.namespace = namespace;
  }
}

/**
 * 内部 MIDI 消息管理器，负责从 Tauri 后端接收指定命名空间的 MIDI 消息并转发为 DOM 事件
 * 内置并发初始化保护与异步释放安全处理
 */
export class InternalMidiMessages extends MidiMessageManager {
  private offListener: UnlistenFn | null = null;
  private initialized = false;
  private initializing = false;
  private disposed = false;
  private pendingUnlisten: Promise<UnlistenFn> | null = null;

  constructor(namespace: string) {
    super(namespace);
  }

  public isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * 初始化消息监听，注册 Tauri 端的 MIDI 消息回调
   * 具有并发保护：重复调用或已在初始化中时会被忽略
   * 若在初始化完成前调用 dispose，会自动清理已注册的监听器
   */
  public async initialize(): Promise<void> {
    if (this.initialized || this.disposed) {
      return;
    }

    if (this.initializing) {
      return;
    }

    this.initializing = true;

    if (typeof window === "undefined" || !window.tauriAPI?.midi) {
      debugLog(
        `MidiMessageManager: tauriAPI not available for '${this.namespace}'`,
      );
      this.initializing = false;
      return;
    }

    try {
      const unlistenPromise = window.tauriAPI.midi.onMidiMessage(
        this.namespace,
        this.handleMessage.bind(this),
      );

      this.pendingUnlisten = unlistenPromise;

      const unlisten = await unlistenPromise;

      if (this.disposed) {
        unlisten();
        this.pendingUnlisten = null;
        return;
      }

      this.offListener = unlisten;
      this.initialized = true;
    } catch (error) {
      debugLog(
        `MidiMessageManager: failed to register listener for '${this.namespace}'`,
        error,
      );
    } finally {
      this.pendingUnlisten = null;
      this.initializing = false;
    }
  }

  /**
   * 将后端推送的 MIDI 消息转换为 MidiMessageEvent 并派发
   * @param message - MIDI 消息的字节数组
   * @param timestamp - 消息时间戳
   * @param device - 来源设备名称
   */
  private handleMessage(message: number[], timestamp: number, device: string) {
    this.dispatchEvent(
      new MidiMessageEvent("message", message, timestamp, device),
    );
  }

  public dispose() {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    if (this.offListener) {
      this.offListener();
      this.offListener = null;
    }

    if (this.pendingUnlisten) {
      this.pendingUnlisten.then((unlisten) => unlisten());
      this.pendingUnlisten = null;
    }
  }
}

export default MidiMessageManager;
