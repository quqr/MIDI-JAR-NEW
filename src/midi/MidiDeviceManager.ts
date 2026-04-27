import { JZZEngine } from "./JZZEngine";
import { MidiInputDevice } from "./MidiInputDevice";
import { MidiOutputDevice } from "./MidiOutputDevice";
import { InternalOutput } from "./InternalOutput";
import { MidiWire } from "./MidiWire";
import { MidiRoute } from "@/types/midi";
import { logger } from "@/utils/logger";

// 内置模块输出设备名称列表
const MODULE_OUTPUTS = [
  "chord-dictionary",
  "chord-quiz",
  "circle-of-fifths",
  "debugger",
];

/**
 * MIDI 设备管理器
 * 负责管理所有 MIDI 输入/输出设备的生命周期
 * 包括设备发现、连接状态维护、路由配置等功能
 */
export class MidiDeviceManager {
  // MIDI 输入设备映射表，key 为设备名称
  private inputs: Map<string, MidiInputDevice> = new Map();
  // MIDI 输出设备映射表，key 为设备名称
  private outputs: Map<string, MidiOutputDevice> = new Map();
  // MIDI 连接线列表
  private wires: MidiWire[] = [];
  // 设备刷新定时器
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {}

  /**
   * 初始化设备管理器
   * 初始化 JZZ 引擎，刷新设备列表，并启动定时刷新循环
   */
  async initialize(): Promise<void> {
    logger.info("MidiDeviceManager: 初始化 JZZ 引擎...");
    await JZZEngine.getInstance().initialize();
    // 刷新内部输出设备
    this.refreshInternalOutputs();
    await this.refreshDevices();
    // 启动每秒刷新一次的定时任务
    this.startRefreshLoop();
    logger.success("MidiDeviceManager: 初始化完成");
  }

  /**
   * 刷新 MIDI 设备列表
   * 检测新设备或断开的设备
   * @returns 设备列表是否有变化
   */
  async refreshDevices(): Promise<boolean> {
    await JZZEngine.getInstance().refresh();

    let changed = false;
    changed = this.refreshInputs() || changed;
    changed = this.refreshOutputs() || changed;

    return changed;
  }

  /**
   * 刷新输入设备列表
   * 对比当前系统输入设备和已管理的设备，处理新增和断开的设备
   * @returns 设备列表是否有变化
   */
  private refreshInputs(): boolean {
    let changed = false;
    const jzz = JZZEngine.getInstance().getJZZ();
    const info = jzz.info();
    const currentInputs = info.inputs.map((i: any) => i.name);

    // 处理新增或重新连接的输入设备
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

    // 处理断开的输入设备
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

  /**
   * 刷新输出设备列表
   * 对比当前系统输出设备和已管理的设备，处理新增和断开的设备
   * 注意：只处理物理输出设备，内部输出设备不受影响
   * @returns 设备列表是否有变化
   */
  private refreshOutputs(): boolean {
    let changed = false;
    const jzz = JZZEngine.getInstance().getJZZ();
    const info = jzz.info();
    const currentOutputs = info.outputs.map((o: any) => o.name);

    // 处理新增或重新连接的输出设备
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

    // 处理断开的物理输出设备
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

  /**
   * 刷新内部输出设备
   * 为每个预定义的模块输出创建 InternalOutput 实例
   */
  private refreshInternalOutputs(): void {
    for (const name of MODULE_OUTPUTS) {
      if (!this.outputs.has(name)) {
        const output = new InternalOutput(name);
        this.outputs.set(name, output);
      }
    }
  }

  /**
   * 添加和弦显示模块的输出设备
   * @param moduleId - 模块 ID，用于区分多个和弦显示实例
   */
  addChordDisplayOutput(moduleId: string): void {
    const name = `chord-display/${moduleId}`;
    if (!this.outputs.has(name)) {
      const output = new InternalOutput(name);
      this.outputs.set(name, output);
    }
  }

  /**
   * 配置 MIDI 路由
   * 根据传入的路由配置，重新建立所有 MIDI 连接
   * @param routes - MIDI 路由配置数组
   */
  routeMidi(routes: MidiRoute[]): void {
    // 先断开所有现有连接
    for (const wire of this.wires) {
      wire.unplug();
    }
    this.wires = [];

    // 根据新配置重新建立连接
    for (const route of routes) {
      if (!route.enabled) continue;

      const input = this.getOrCreateInput(route.input);
      const output = this.getOrCreateOutput(route.output, route.type);

      if (input && output) {
        const wire = new MidiWire(route);
        wire.plug(input, output);
        this.wires.push(wire);
      }
    }
  }

  /**
   * 获取或创建输入设备
   * 当设备不存在时自动创建，但不主动打开连接
   * @param name - 设备名称
   * @returns 输入设备实例，如果获取失败返回 null
   */
  private getOrCreateInput(name: string): MidiInputDevice | null {
    if (!this.inputs.has(name)) {
      const input = new MidiInputDevice(name, false);
      this.inputs.set(name, input);
    }
    return this.inputs.get(name) || null;
  }

  /**
   * 获取或创建输出设备
   * 根据类型创建 InternalOutput 或 MidiOutputDevice
   * @param name - 设备名称
   * @param type - 设备类型（physical 或 internal）
   * @returns 输出设备实例，如果获取失败返回 null
   */
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

  /**
   * 获取所有输入设备的 API 信息
   * @returns 输入设备信息数组
   */
  getInputs(): {
    name: string;
    opened: boolean;
    connected: boolean;
    error: boolean;
  }[] {
    return Array.from(this.inputs.values()).map((i) => i.toApi());
  }

  /**
   * 获取所有输出设备的 API 信息
   * 排序规则：内部输出设备优先，其余按名称字母排序
   * @returns 输出设备信息数组
   */
  getOutputs(): {
    name: string;
    type: string;
    opened: boolean;
    connected: boolean;
    error: boolean;
  }[] {
    return Array.from(this.outputs.values())
      .sort((a, b) => {
        if (a instanceof InternalOutput && !(b instanceof InternalOutput))
          return -1;
        if (!(a instanceof InternalOutput) && b instanceof InternalOutput)
          return 1;
        return a.name.localeCompare(b.name);
      })
      .map((o) => o.toApi());
  }

  /**
   * 获取所有 MIDI 连接线的状态信息
   * @returns 连接线信息数组
   */
  getWires(): { route: MidiRoute; connected: boolean }[] {
    return this.wires.map((w) => w.toApi());
  }

  /**
   * 根据名称获取输出设备
   * @param name - 设备名称
   * @returns 输出设备实例，如果不存在返回 null
   */
  getOutputByName(name: string): MidiOutputDevice | null {
    return this.outputs.get(name) || null;
  }

  /**
   * 启动设备刷新循环
   * 每秒检查一次设备连接状态，自动检测热插拔
   */
  private startRefreshLoop(): void {
    this.refreshInterval = setInterval(async () => {
      const changed = await this.refreshDevices();
      if (changed) {
        // 设备变化时，路由将由 store 的 routeMidi 调用重新应用
      }
    }, 1000);
  }

  /**
   * 停止设备刷新循环
   */
  stopRefreshLoop(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * 清理所有资源
   * 停止刷新循环，关闭所有设备，清空设备列表和连接线
   */
  cleanup(): void {
    this.stopRefreshLoop();
    for (const input of this.inputs.values()) {
      input.close();
    }
    for (const output of this.outputs.values()) {
      output.close();
    }
    this.inputs.clear();
    this.outputs.clear();
    this.wires = [];
  }
}
