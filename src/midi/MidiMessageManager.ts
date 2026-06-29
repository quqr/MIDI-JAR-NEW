import type { UnlistenFn } from "@tauri-apps/api/event";

function debugLog(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
}

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

class MidiMessageManager extends EventTarget {
  namespace: string;

  constructor(namespace: string) {
    super();
    this.namespace = namespace;
  }
}

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
