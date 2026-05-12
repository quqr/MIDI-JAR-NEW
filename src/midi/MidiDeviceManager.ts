import { MidiInputDevice, ApiMidiInput } from "./MidiInputDevice";
import { MidiOutputDevice, ApiMidiOutput } from "./MidiOutputDevice";
import { isTauri } from "@/utils/tauri";
import { logger } from "@/utils/logger";
import type { UnlistenFn } from "@tauri-apps/api/event";

const MODULE_OUTPUTS = [
  "chord-dictionary",
  "chord-display/default",
  "chord-quiz",
  "circle-of-fifths",
  "debugger",
];

export class MidiDeviceManager {
  private inputs: Map<string, MidiInputDevice> = new Map();
  private outputs: Map<string, MidiOutputDevice> = new Map();
  private offInputs: UnlistenFn | null = null;
  private offOutputs: UnlistenFn | null = null;
  private offWires: UnlistenFn | null = null;

  async initialize(): Promise<void> {
    logger.info("MidiDeviceManager: 初始化...");

    if (isTauri()) {
      const [inputsUnlisten, outputsUnlisten] = await Promise.all([
        window.tauriAPI.midi.onInputs((inputs) => {
          this.updateInputs(inputs);
        }),
        window.tauriAPI.midi.onOutputs((outputs) => {
          this.updateOutputs(outputs);
        }),
      ]);

      this.offInputs = inputsUnlisten;
      this.offOutputs = outputsUnlisten;

      const [inputs, outputs] = await Promise.all([
        window.tauriAPI.midi.getInputs(),
        window.tauriAPI.midi.getOutputs(),
      ]);

      this.updateInputs(inputs);
      this.updateOutputs(outputs);
    }

    logger.success("MidiDeviceManager: 初始化完成");
  }

  private updateInputs(apiInputs: ApiMidiInput[]): void {
    this.inputs.clear();
    for (const apiInput of apiInputs) {
      this.inputs.set(apiInput.name, new MidiInputDevice(apiInput));
    }
  }

  private updateOutputs(apiOutputs: ApiMidiOutput[]): void {
    this.outputs.clear();
    for (const apiOutput of apiOutputs) {
      this.outputs.set(apiOutput.name, new MidiOutputDevice(apiOutput));
    }
  }

  async refreshDevices(): Promise<void> {
    if (isTauri()) {
      await window.tauriAPI.midi.refreshDevices();
    }
  }

  getInputs(): ApiMidiInput[] {
    return Array.from(this.inputs.values()).map((i) => i.toApi());
  }

  getOutputs(): ApiMidiOutput[] {
    const result: ApiMidiOutput[] = [];

    const hasInternal = MODULE_OUTPUTS.some((name) => this.outputs.has(name));
    if (hasInternal) {
      result.push({
        name: "internal",
        type: "internal",
        opened: true,
        connected: true,
        error: false,
      });
    }

    for (const [, output] of this.outputs) {
      if (output.type === "physical") {
        result.push(output.toApi());
      }
    }

    return result;
  }

  cleanup(): void {
    if (this.offInputs) {
      this.offInputs();
      this.offInputs = null;
    }
    if (this.offOutputs) {
      this.offOutputs();
      this.offOutputs = null;
    }
    if (this.offWires) {
      this.offWires();
      this.offWires = null;
    }
    this.inputs.clear();
    this.outputs.clear();
  }
}
