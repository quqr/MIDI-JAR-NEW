/**
 * Web MIDI API 后端实现
 *
 * 使用浏览器原生 Web MIDI API 实现设备发现、消息收发。
 * 仅在支持 navigator.requestMIDIAccess 的浏览器中可用（Chrome、Edge、Firefox 108+）。
 */

import type {
  IMidiBackend,
  MidiInputInfo,
  MidiOutputInfo,
  MidiMessageCallback,
  DeviceChangeCallback,
  UnlistenFn,
} from "./IMidiBackend";
import { createLogger } from "@/utils/logger";

const logger = createLogger("WebMidiBackend");

export class WebMidiBackend implements IMidiBackend {
  private midiAccess: MIDIAccess | null = null;
  private deviceChangeCallbacks: DeviceChangeCallback[] = [];
  private messageCallbacks: Map<string, MidiMessageCallback[]> = new Map();
  private openedInputs: Map<string, MIDIInput> = new Map();

  async initialize(): Promise<void> {
    if (!this.isSupported()) {
      logger.warn("Web MIDI API not supported in this browser");
      return;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess();
      this.midiAccess.onstatechange = () => {
        logger.info("MIDI device state changed");
        for (const cb of this.deviceChangeCallbacks) cb();
      };
      logger.info(
        `WebMidiBackend initialized: ${this.midiAccess.inputs.size} inputs, ${this.midiAccess.outputs.size} outputs`,
      );
    } catch (e) {
      logger.error(`Web MIDI API initialization failed: ${e}`);
    }
  }

  isSupported(): boolean {
    return typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;
  }

  async getInputs(): Promise<MidiInputInfo[]> {
    if (!this.midiAccess) return [];
    const result: MidiInputInfo[] = [];
    for (const input of this.midiAccess.inputs.values()) {
      result.push({
        name: input.name ?? input.id,
        opened: input.connection === "open",
        connected: input.state === "connected",
        error: false,
      });
    }
    return result;
  }

  async getOutputs(): Promise<MidiOutputInfo[]> {
    if (!this.midiAccess) return [];
    const result: MidiOutputInfo[] = [];
    for (const output of this.midiAccess.outputs.values()) {
      result.push({
        name: output.name ?? output.id,
        type: "physical",
        opened: output.connection === "open",
        connected: output.state === "connected",
        error: false,
      });
    }
    return result;
  }

  async onMidiMessage(
    namespace: string,
    callback: MidiMessageCallback,
  ): Promise<UnlistenFn> {
    if (!this.midiAccess) return () => {};

    const callbacks = this.messageCallbacks.get(namespace) || [];
    callbacks.push(callback);
    this.messageCallbacks.set(namespace, callbacks);

    if (namespace !== "internal") {
      await this.openAllInputs(namespace);
    }

    return () => {
      const cbs = this.messageCallbacks.get(namespace);
      if (cbs) {
        const idx = cbs.indexOf(callback);
        if (idx >= 0) cbs.splice(idx, 1);
        if (cbs.length === 0) {
          this.messageCallbacks.delete(namespace);
        }
      }
    };
  }

  onInputsChange(callback: DeviceChangeCallback): UnlistenFn {
    this.deviceChangeCallbacks.push(callback);
    return () => {
      const idx = this.deviceChangeCallbacks.indexOf(callback);
      if (idx >= 0) this.deviceChangeCallbacks.splice(idx, 1);
    };
  }

  onOutputsChange(callback: DeviceChangeCallback): UnlistenFn {
    this.deviceChangeCallbacks.push(callback);
    return () => {
      const idx = this.deviceChangeCallbacks.indexOf(callback);
      if (idx >= 0) this.deviceChangeCallbacks.splice(idx, 1);
    };
  }

  async refreshDevices(): Promise<void> {
    // Web MIDI API 通过 onstatechange 自动更新
  }

  isVirtualPortSupported(): boolean {
    return false;
  }

  async createVirtualInput(_name: string): Promise<void> {
    logger.warn("Virtual ports not supported in Web MIDI API");
  }

  async createVirtualOutput(_name: string): Promise<void> {
    logger.warn("Virtual ports not supported in Web MIDI API");
  }

  async deleteVirtualInput(_name: string): Promise<void> {
    logger.warn("Virtual ports not supported in Web MIDI API");
  }

  async deleteVirtualOutput(_name: string): Promise<void> {
    logger.warn("Virtual ports not supported in Web MIDI API");
  }

  dispose(): void {
    for (const input of this.openedInputs.values()) {
      input.onmidimessage = null;
      input.close().catch(() => {});
    }
    this.openedInputs.clear();

    if (this.midiAccess) {
      this.midiAccess.onstatechange = null;
      this.midiAccess = null;
    }

    this.deviceChangeCallbacks = [];
    this.messageCallbacks.clear();
    logger.info("WebMidiBackend disposed");
  }

  private async openAllInputs(namespace: string): Promise<void> {
    if (!this.midiAccess) return;

    for (const [id, input] of this.midiAccess.inputs) {
      if (input.state !== "connected" || this.openedInputs.has(id)) continue;

      try {
        input.onmidimessage = (e: MIDIMessageEvent) => {
          if (!e.data) return;
          const message = Array.from(e.data as Uint8Array);
          const timestamp = e.timeStamp;
          const midiTarget = e.target as MIDIInput | null;
          const device = midiTarget?.name ?? midiTarget?.id ?? "unknown";

          const callbacks = this.messageCallbacks.get(namespace);
          if (callbacks) {
            for (const cb of callbacks) {
              cb(message, timestamp, device);
            }
          }
        };

        await input.open();
        this.openedInputs.set(id, input);
      } catch (e) {
        logger.error(`Failed to open MIDI input ${input.name}: ${e}`);
      }
    }
  }
}
