import { JZZEngine } from "./JZZEngine";
import { MidiInputDevice } from "./MidiInputDevice";
import { MidiOutputDevice } from "./MidiOutputDevice";
import { InternalOutput } from "./InternalOutput";
import { MidiWire } from "./MidiWire";
import { MidiMessageManager } from "./MidiMessageManager";
import { MidiRoute } from "@/types/midi";
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
  private wires: MidiWire[] = [];
  private onDeviceChange: (() => Promise<void>) | null = null;
  private onChangeCallback: (() => void) | null = null;

  constructor() {}

  setOnDeviceChange(callback: (() => Promise<void>) | null): void {
    this.onDeviceChange = callback;
  }

  async initialize(): Promise<void> {
    logger.info("MidiDeviceManager: 初始化 JZZ 引擎...");
    await JZZEngine.getInstance().initialize();
    this.refreshInternalOutputs();
    await this.refreshDevices();

    const jzz = JZZEngine.getInstance().getJZZ();
    if (typeof jzz.onChange === "function") {
      this.onChangeCallback = () => {
        this.refreshDevices();
      };
      jzz.onChange(this.onChangeCallback);
    }

    logger.success("MidiDeviceManager: 初始化完成");
  }

  async refreshDevices(): Promise<boolean> {
    let changed = false;
    changed = this.refreshInputs() || changed;
    changed = this.refreshOutputs() || changed;

    if (changed && this.onDeviceChange) {
      await this.onDeviceChange();
    }

    return changed;
  }

  private refreshInputs(): boolean {
    let changed = false;
    const jzz = JZZEngine.getInstance().getJZZ();
    const info = jzz.info();
    const currentInputs = info.inputs.map((i: any) => i.name);

    for (const name of currentInputs) {
      if (!this.inputs.has(name)) {
        const input = new MidiInputDevice(name, true);
        this.inputs.set(name, input);
        changed = true;
        logger.info(`MidiDeviceManager: 发现新输入设备 "${name}"`);
      } else {
        const input = this.inputs.get(name)!;
        if (!input.connected) {
          input.connected = true;
          changed = true;
          logger.info(`MidiDeviceManager: 输入设备 "${name}" 已重新连接`);
        }
      }
    }

    for (const [name, input] of this.inputs) {
      if (!currentInputs.includes(name) && input.connected) {
        input.connected = false;
        input.close();
        changed = true;
        logger.warn(`MidiDeviceManager: 输入设备 "${name}" 已断开连接`);
      }
    }

    return changed;
  }

  private refreshOutputs(): boolean {
    let changed = false;
    const jzz = JZZEngine.getInstance().getJZZ();
    const info = jzz.info();
    const currentOutputs = info.outputs.map((o: any) => o.name);

    for (const name of currentOutputs) {
      if (!this.outputs.has(name)) {
        const output = new MidiOutputDevice(name, "physical", true);
        this.outputs.set(name, output);
        changed = true;
        logger.info(`MidiDeviceManager: 发现新输出设备 "${name}"`);
      } else {
        const output = this.outputs.get(name)!;
        if (output.type === "physical" && !output.connected) {
          output.connected = true;
          changed = true;
          logger.info(`MidiDeviceManager: 输出设备 "${name}" 已重新连接`);
        }
      }
    }

    for (const [name, output] of this.outputs) {
      if (
        !currentOutputs.includes(name) &&
        output.type === "physical" &&
        output.connected
      ) {
        output.connected = false;
        output.close();
        changed = true;
        logger.warn(`MidiDeviceManager: 输出设备 "${name}" 已断开连接`);
      }
    }

    return changed;
  }

  private refreshInternalOutputs(): void {
    const messageManager = MidiMessageManager.getInstance();
    for (const name of MODULE_OUTPUTS) {
      if (!this.outputs.has(name)) {
        const output = new InternalOutput(name);
        this.outputs.set(name, output);
        messageManager.registerOutput(name, output);
      }
    }
  }

  addChordDisplayOutput(moduleId: string): void {
    const name = `chord-display/${moduleId}`;
    if (!this.outputs.has(name)) {
      const output = new InternalOutput(name);
      this.outputs.set(name, output);
      const messageManager = MidiMessageManager.getInstance();
      messageManager.registerOutput(name, output);
    }
  }

  async routeMidi(routes: MidiRoute[]): Promise<void> {
    for (const wire of this.wires) {
      wire.unplug();
    }
    this.wires = [];

    const usedInputNames = new Set<string>();
    for (const route of routes) {
      if (route.enabled) {
        usedInputNames.add(route.input);
      }
    }

    for (const [name, input] of this.inputs) {
      if (!usedInputNames.has(name)) {
        input.close();
      }
    }
    for (const [name, output] of this.outputs) {
      if (output.type === "physical") {
        const isUsed = routes.some((r) => r.enabled && r.output === name);
        if (!isUsed) {
          output.close();
        }
      }
    }

    for (const route of routes) {
      if (!route.enabled) continue;

      const input = this.getOrCreateInput(route.input);
      if (!input) continue;

      try {
        await input.open();
        logger.info(`MidiDeviceManager: 已打开输入设备 "${input.name}"`);
      } catch (e) {
        logger.error(`MidiDeviceManager: 打开输入设备 "${input.name}" 失败，错误信息：${e}`);
      }



      if (route.output === "internal") {
        let pluggedCount = 0;
        for (const moduleName of MODULE_OUTPUTS) {
          const moduleOutput = this.outputs.get(moduleName);
          if (moduleOutput) {
            const wire = new MidiWire({
              input: route.input,
              output: moduleName,
              type: "internal",
              enabled: true,
            });
            wire.plug(input, moduleOutput);
            this.wires.push(wire);
            pluggedCount++;
          }
        }
        logger.info(
          `MidiDeviceManager: 路由 ${route.input} → internal, 已连接 ${pluggedCount} 个内部模块`,
        );
      } else {
        const output = this.getOrCreateOutput(route.output, route.type);
        if (output) {
          if (output.type === "physical") {
            try {
              await output.open();
            } catch (e) {
              logger.error(
                `MidiDeviceManager: 打开输出设备 "${output.name}" 失败，错误信息：${e}`,
              );
            }
          }

          const wire = new MidiWire(route);
          wire.plug(input, output);
          this.wires.push(wire);
          logger.info(
            `MidiDeviceManager: 路由 ${route.input} → ${route.output}`,
          );
        }
      }
    }
  }

  private getOrCreateInput(name: string): MidiInputDevice | null {
    if (!this.inputs.has(name)) {
      const input = new MidiInputDevice(name, false);
      this.inputs.set(name, input);
    }
    return this.inputs.get(name) || null;
  }

  private getOrCreateOutput(
    name: string,
    type: "physical" | "internal",
  ): MidiOutputDevice | null {
    if (!this.outputs.has(name)) {
      if (type === "internal") {
        const output = new InternalOutput(name);
        this.outputs.set(name, output);
      } else {
        const output = new MidiOutputDevice(name, "physical", false);
        this.outputs.set(name, output);
      }
    }
    return this.outputs.get(name) || null;
  }

  getInputs(): {
    name: string;
    opened: boolean;
    connected: boolean;
    error: boolean;
  }[] {
    return Array.from(this.inputs.values()).map((i) => i.toApi());
  }

  getOutputs(): {
    name: string;
    type: string;
    opened: boolean;
    connected: boolean;
    error: boolean;
  }[] {
    const result: {
      name: string;
      type: string;
      opened: boolean;
      connected: boolean;
      error: boolean;
    }[] = [];

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

  getWires(): { route: MidiRoute; connected: boolean }[] {
    return this.wires.map((w) => w.toApi());
  }

  getOutputByName(name: string): MidiOutputDevice | null {
    return this.outputs.get(name) || null;
  }

  getInternalOutput(name: string): InternalOutput | null {
    const output = this.outputs.get(name);
    if (output instanceof InternalOutput) return output;
    return null;
  }

  cleanup(): void {
    if (this.onChangeCallback) {
      try {
        const jzz = JZZEngine.getInstance().getJZZ();
        jzz.onChange(() => {});
      } catch {}
      this.onChangeCallback = null;
    }

    for (const input of this.inputs.values()) {
      input.close();
    }
    for (const output of this.outputs.values()) {
      output.close();
    }

    const messageManager = MidiMessageManager.getInstance();
    for (const [name, output] of this.outputs) {
      if (output instanceof InternalOutput) {
        messageManager.clearNamespace(name);
      }
    }
    messageManager.cleanup();

    this.inputs.clear();
    this.outputs.clear();
    this.wires = [];
  }
}
