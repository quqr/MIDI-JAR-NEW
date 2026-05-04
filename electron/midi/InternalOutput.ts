import { EventEmitter } from "events";

export type MidiMessageHandler = (
  message: number[],
  timestamp: number,
  device: string,
) => void;

export interface ApiMidiOutput {
  name: string;
  type: string;
  opened: boolean;
  connected: boolean;
  error: boolean;
}

export declare interface InternalOutput {
  on(
    event: "message",
    listener: (message: number[], timestamp: number, device: string) => void,
  ): this;
}

export class InternalOutput extends EventEmitter {
  name: string;
  namespace: string[];
  handlers: MidiMessageHandler[];

  constructor(name: string) {
    super();
    this.name = name;
    this.namespace = name.split("/");
    this.handlers = [];
  }

  send(message: number[], timestamp: number, device: string) {
    process.nextTick(() => {
      this.emit("message", message, timestamp, device);
      for (let i = 0; i < this.handlers.length; i += 1) {
        this.handlers[i](message, timestamp, device);
      }
    });
  }

  register(handler: MidiMessageHandler) {
    if (handler) {
      this.handlers.push(handler);
    }
  }

  unregister(handler: MidiMessageHandler) {
    if (handler) {
      const i = this.handlers.indexOf(handler);
      if (i >= 0) {
        this.handlers.splice(i, 1);
      }
    }
  }

  toApi(): ApiMidiOutput {
    return {
      name: this.name,
      type: "internal",
      opened: true,
      connected: true,
      error: false,
    };
  }
}
