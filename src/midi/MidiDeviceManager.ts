import { MidiInputDevice, ApiMidiInput } from "./MidiInputDevice";
import { MidiOutputDevice, ApiMidiOutput } from "./MidiOutputDevice";
import { isElectron } from "@/utils/electron";
import { logger } from "@/utils/logger";

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
  private offInputs: (() => void) | null = null;
  private offOutputs: (() => void) | null = null;
  private offWires: (() => void) | null = null;

  async initialize(): Promise<void> {
    logger.info("MidiDeviceManager: 初始化...");

    if (isElectron()) {
      window.electronAPI.midi.getInputs();
      window.electronAPI.midi.getOutputs();

      this.offInputs = window.electronAPI.midi.onInputs((inputs) => {
        this.updateInputs(inputs);
      });

      this.offOutputs = window.electronAPI.midi.onOutputs((outputs) => {
        this.updateOutputs(outputs);
      });
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
    if (isElectron()) {
      window.electronAPI.midi.refreshDevices();
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
