/**
 * Tauri MIDI 后端实现
 *
 * 封装现有 tauriAPI.midi 调用，实现 IMidiBackend 接口。
 * 所有 MIDI 操作通过 Tauri IPC 代理到 Rust 后端。
 */

import type {
  IMidiBackend,
  MidiInputInfo,
  MidiOutputInfo,
  MidiMessageCallback,
  DeviceChangeCallback,
  UnlistenFn,
} from "./IMidiBackend";
import { isTauri, getTauriAPI } from "@/utils/tauri";
import { createLogger } from "@/utils/logger";

const logger = createLogger("TauriMidiBackend");

export class TauriMidiBackend implements IMidiBackend {
  private inputListeners: UnlistenFn[] = [];
  private outputListeners: UnlistenFn[] = [];
  private messageListeners: UnlistenFn[] = [];

  async initialize(): Promise<void> {
    if (!isTauri()) {
      logger.warn("Not in Tauri environment, initialization skipped");
      return;
    }
    logger.info("TauriMidiBackend initialized");
  }

  isSupported(): boolean {
    return isTauri();
  }

  async getInputs(): Promise<MidiInputInfo[]> {
    if (!isTauri()) return [];
    return await getTauriAPI().midi.getInputs();
  }

  async getOutputs(): Promise<MidiOutputInfo[]> {
    if (!isTauri()) return [];
    return await getTauriAPI().midi.getOutputs();
  }

  async onMidiMessage(
    namespace: string,
    callback: MidiMessageCallback,
  ): Promise<UnlistenFn> {
    if (!isTauri()) {
      return () => {};
    }
    const unlisten = await getTauriAPI().midi.onMidiMessage(
      namespace,
      callback,
    );
    this.messageListeners.push(unlisten);
    return unlisten;
  }

  onInputsChange(callback: DeviceChangeCallback): UnlistenFn {
    if (!isTauri()) return () => {};
    const unlistenPromise = getTauriAPI().midi.onInputs(() => callback());
    const wrapper = () => {
      unlistenPromise.then((fn) => fn());
    };
    this.inputListeners.push(wrapper);
    return wrapper;
  }

  onOutputsChange(callback: DeviceChangeCallback): UnlistenFn {
    if (!isTauri()) return () => {};
    const unlistenPromise = getTauriAPI().midi.onOutputs(() => callback());
    const wrapper = () => {
      unlistenPromise.then((fn) => fn());
    };
    this.outputListeners.push(wrapper);
    return wrapper;
  }

  async refreshDevices(): Promise<void> {
    if (!isTauri()) return;
    await getTauriAPI().midi.refreshDevices();
  }

  isVirtualPortSupported(): boolean {
    if (!isTauri()) return false;
    // 同步返回，Tauri 环境默认支持虚拟端口
    return true;
  }

  async createVirtualInput(name: string): Promise<void> {
    if (!isTauri()) return;
    await getTauriAPI().midi.createVirtualInput(name);
  }

  async createVirtualOutput(name: string): Promise<void> {
    if (!isTauri()) return;
    await getTauriAPI().midi.createVirtualOutput(name);
  }

  async deleteVirtualInput(name: string): Promise<void> {
    if (!isTauri()) return;
    await getTauriAPI().midi.deleteVirtualInput(name);
  }

  async deleteVirtualOutput(name: string): Promise<void> {
    if (!isTauri()) return;
    await getTauriAPI().midi.deleteVirtualOutput(name);
  }

  dispose(): void {
    for (const fn of this.inputListeners) fn();
    for (const fn of this.outputListeners) fn();
    for (const fn of this.messageListeners) fn();
    this.inputListeners = [];
    this.outputListeners = [];
    this.messageListeners = [];
    logger.info("TauriMidiBackend disposed");
  }
}
