import { MidiInputDevice, ApiMidiInput } from "./MidiInputDevice";
import { MidiOutputDevice, ApiMidiOutput } from "./MidiOutputDevice";
import { isTauri } from "@/utils/tauri";
import { logger } from "@/utils/logger";
import type { UnlistenFn } from "@tauri-apps/api/event";

/** 内部模块输出设备的名称列表，这些设备会被合并展示为单个 "internal" 输出 */
const MODULE_OUTPUTS = [
  "chord-dictionary",
  "chord-display/default",
  "debugger",
];

/**
 * MIDI 设备管理器
 * 负责监听和管理局域内所有 MIDI 输入/输出设备的热插拔与状态同步
 */
export class MidiDeviceManager {
  private inputs: Map<string, MidiInputDevice> = new Map();
  private outputs: Map<string, MidiOutputDevice> = new Map();
  private offInputs: UnlistenFn | null = null;
  private offOutputs: UnlistenFn | null = null;
  private offWires: UnlistenFn | null = null;

  /**
   * 初始化设备管理器，注册 Tauri 端的设备变更监听并拉取当前设备列表
   */
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

  /**
   * 根据后端返回的设备列表重建输入设备映射
   * @param apiInputs - 后端返回的原始输入设备数据
   */
  private updateInputs(apiInputs: ApiMidiInput[]): void {
    this.inputs.clear();
    for (const apiInput of apiInputs) {
      this.inputs.set(apiInput.name, new MidiInputDevice(apiInput));
    }
  }

  /**
   * 根据后端返回的设备列表重建输出设备映射
   * @param apiOutputs - 后端返回的原始输出设备数据
   */
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

  /**
   * 获取输出设备列表，将内部模块输出合并为单个 "internal" 项，仅包含物理输出设备
   * @returns 去重后的输出设备 API 数据数组
   */
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
