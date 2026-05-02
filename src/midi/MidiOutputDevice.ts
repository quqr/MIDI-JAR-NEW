import { EventEmitter } from "./EventEmitter";
import { logger } from "@/utils/logger";
import jzz from "jzz";

export type MidiMessageHandler = (
  message: number[],
  timestamp: number,
  device: string,
) => void;

export declare interface MidiOutputDevice {
  on(event: "message", listener: MidiMessageHandler): this;
}

export class MidiOutputDevice extends EventEmitter {
  name: string;
  type: "physical" | "internal" | "websocket";
  connected: boolean;
  protected port: any = null;
  protected portType: "jzz" | "webmidi" | null = null;
  protected handlers: MidiMessageHandler[] = [];

  constructor(
    name: string,
    type: "physical" | "internal" | "websocket",
    connected: boolean = true,
  ) {
    super();
    this.name = name;
    this.type = type;
    this.connected = connected;
  }

  async open(): Promise<void> {
    if (this.port) return;
    if (this.type !== "physical") return;

    try {
      await this.openViaJZZ(this.name);
      return;
    } catch (e) {
      logger.warn(`MidiOutputDevice: JZZ openMidiOut("${this.name}") 失败（${e}），尝试默认端口...`);
    }

    try {
      await this.openViaJZZ();
      return;
    } catch (e) {
      logger.warn(`MidiOutputDevice: JZZ 默认端口也失败（${e}），尝试 Web MIDI API...`);
    }

    try {
      await this.openViaWebMIDI(false);
      return;
    } catch (e) {
      logger.warn(`MidiOutputDevice: Web MIDI API (sysex) 失败（${e}），尝试无 sysex...`);
    }

    try {
      await this.openViaWebMIDI(true);
      return;
    } catch (e) {
      throw new Error(
        `Cannot open MIDI output：${this.name}（所有方式均失败）`,
      );
    }
  }

  private openViaJZZ(name?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const self = this;
      jzz()
        .openMidiOut(name || undefined)
        .or(function () {
          reject(new Error(this._err ? this._err() : "Unknown JZZ error"));
        })
        .and(function () {
          self.port = this;
          self.portType = "jzz";
          self.connected = true;
          resolve();
        });
    });
  }

  private async openViaWebMIDI(noSysex: boolean): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.requestMIDIAccess) {
      throw new Error("Web MIDI API 不可用");
    }

    const access = await navigator.requestMIDIAccess(noSysex ? {} : { sysex: true });

    const outputs = Array.from(access.outputs.values());
    const midiOutput = outputs.find((output) => output.name === this.name) || null;

    if (!midiOutput) {
      throw new Error(`设备 "${this.name}" 未找到`);
    }

    if (midiOutput.state === "connected" && midiOutput.connection !== "open") {
      await midiOutput.open();
    }

    this.port = midiOutput;
    this.portType = "webmidi";
    this.connected = true;
  }

  close(): void {
    if (this.port && this.type === "physical") {
      this.port.close();
      this.port = null;
      this.portType = null;
      this.connected = false;
    }
  }

  send(
    message: number[],
    timestamp: number = Date.now(),
    device: string = "",
  ): void {
    if (this.port) {
      this.port.send(message);
    }

    this.emit("message", message, timestamp, device);
    for (const handler of this.handlers) {
      handler(message, timestamp, device);
    }
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
    type: string;
    opened: boolean;
    connected: boolean;
    error: boolean;
  } {
    return {
      name: this.name,
      type: this.type,
      opened: !!this.port,
      connected: this.connected,
      error: false,
    };
  }
}
