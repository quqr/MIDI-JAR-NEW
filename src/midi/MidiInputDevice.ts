import { EventEmitter } from "./EventEmitter";
import { logger } from "@/utils/logger";
import jzz from "jzz";

export type MidiMessageHandler = (
  message: number[],
  timestamp: number,
  device: string,
) => void;

export declare interface MidiInputDevice {
  on(event: "message", listener: MidiMessageHandler): this;
  on(event: "latency", listener: (latency: number, name: string) => void): this;
}

export class MidiInputDevice extends EventEmitter {
  name: string;
  connected: boolean;
  private port: any = null;
  private portType: "jzz" | "webmidi" | null = null;
  private handlers: MidiMessageHandler[] = [];
  private lastMessageTime: number = 0;

  constructor(name: string, connected: boolean = true) {
    super();
    this.name = name;
    this.connected = connected;
  }

  async open(): Promise<void> {
    if (this.port) return;

    try {
      await this.openViaJZZ(this.name);
      return;
    } catch (e) {
      logger.warn(`MidiInputDevice: JZZ openMidiIn("${this.name}") 失败（${e}），尝试默认端口...`);
    }

    try {
      await this.openViaJZZ();
      return;
    } catch (e) {
      logger.warn(`MidiInputDevice: JZZ 默认端口也失败（${e}），尝试 Web MIDI API...`);
    }

    try {
      await this.openViaWebMIDI(false);
      return;
    } catch (e) {
      logger.warn(`MidiInputDevice: Web MIDI API (sysex) 失败（${e}），尝试无 sysex...`);
    }

    try {
      await this.openViaWebMIDI(true);
      return;
    } catch (e) {
      throw new Error(
        `Cannot open MIDI input：${this.name}（所有方式均失败）`,
      );
    }
  }

  private openViaJZZ(name?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const self = this;
      jzz()
        .openMidiIn(name || undefined)
        .or(function () {
          reject(new Error(this._err ? this._err() : "Unknown JZZ error"));
        })
        .and(function () {
          self.port = this;
          self.portType = "jzz";
          self.connected = true;

          self.port.connect(function (msg: any) {
            self.handleMessage(Array.from(msg) as number[]);
          });

          resolve();
        });
    });
  }

  private async openViaWebMIDI(noSysex: boolean): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.requestMIDIAccess) {
      throw new Error("Web MIDI API 不可用");
    }

    const access = await navigator.requestMIDIAccess(noSysex ? {} : { sysex: true });

    const inputs = Array.from(access.inputs.values());
    const midiInput = inputs.find((input) => input.name === this.name) || null;

    if (!midiInput) {
      throw new Error(`设备 "${this.name}" 未找到`);
    }

    if (midiInput.state === "connected" && midiInput.connection !== "open") {
      await midiInput.open();
    }

    const self = this;
    midiInput.onmidimessage = function (event: MIDIMessageEvent) {
      if (event.data) {
        self.handleMessage(Array.from(event.data) as number[]);
      }
    };

    this.port = midiInput;
    this.portType = "webmidi";
    this.connected = true;
  }

  private handleMessage(message: number[]): void {
    const now = Date.now();
    const latency = now - this.lastMessageTime;
    this.lastMessageTime = now;

    this.emit("latency", latency, this.name);
    this.emit("message", message, now, this.name);

    for (const handler of this.handlers) {
      handler(message, now, this.name);
    }
  }

  close(): void {
    if (!this.port) return;

    if (this.portType === "webmidi") {
      this.port.onmidimessage = null;
      this.port.close();
    } else {
      this.port.close();
    }

    this.port = null;
    this.portType = null;
    this.connected = false;
  }

  register(handler: MidiMessageHandler): void {
    if (handler && !this.handlers.includes(handler)) {
      this.handlers.push(handler);
    }
  }

  unregister(handler: MidiMessageHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index >= 0) {
      this.handlers.splice(index, 1);
    }
  }

  toApi(): {
    name: string;
    opened: boolean;
    connected: boolean;
    error: boolean;
  } {
    return {
      name: this.name,
      opened: !!this.port,
      connected: this.connected,
      error: false,
    };
  }
}
