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
    debugLog(
      `[MIDI_DEBUG] InternalMidiMessages constructor: namespace='${namespace}'`,
    );
  }

  public async initialize(): Promise<void> {
    if (this.initialized || this.disposed) {
      return;
    }

    if (this.initializing) {
      return;
    }

    this.initializing = true;
    debugLog(
      `[MIDI_DEBUG] InternalMidiMessages: initializing listener for '${this.namespace}'`,
    );

    if (typeof window === "undefined" || !window.tauriAPI?.midi) {
      console.warn(
        `[MIDI_DEBUG] InternalMidiMessages: tauriAPI not available for '${this.namespace}'`,
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
        debugLog(
          `[MIDI_DEBUG] InternalMidiMessages: disposed during initialization for '${this.namespace}', cleaning up`,
        );
        unlisten();
        this.pendingUnlisten = null;
        return;
      }

      debugLog(
        `[MIDI_DEBUG] InternalMidiMessages: listener registered for '${this.namespace}'`,
      );
      this.offListener = unlisten;
      this.initialized = true;
    } catch (error) {
      console.error(
        `[MIDI_DEBUG] InternalMidiMessages: failed to register listener for '${this.namespace}'`,
        error,
      );
    } finally {
      this.pendingUnlisten = null;
      this.initializing = false;
    }
  }

  private handleMessage(message: number[], timestamp: number, device: string) {
    debugLog(
      `[MIDI_DEBUG] InternalMidiMessages.handleMessage: namespace='${this.namespace}' message=${JSON.stringify(message)} device='${device}'`,
    );
    this.dispatchEvent(
      new MidiMessageEvent("message", message, timestamp, device),
    );
  }

  public dispose() {
    this.disposed = true;

    if (this.offListener) {
      this.offListener();
      this.offListener = null;
      debugLog(
        `[MIDI_DEBUG] InternalMidiMessages: listener disposed for '${this.namespace}'`,
      );
    }
  }
}

export default MidiMessageManager;
