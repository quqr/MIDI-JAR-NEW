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
  private offListener: (() => void) | null = null;

  constructor(namespace: string) {
    super(namespace);
    if (typeof window !== "undefined" && window.electronAPI?.midi) {
      this.offListener = window.electronAPI.midi.onMidiMessage(
        this.namespace,
        this.handleMessage.bind(this),
      );
    }
  }

  private handleMessage(message: number[], timestamp: number, device: string) {
    this.dispatchEvent(
      new MidiMessageEvent("message", message, timestamp, device),
    );
  }

  public dispose() {
    if (this.offListener) {
      this.offListener();
      this.offListener = null;
    }
  }
}

export default MidiMessageManager;
