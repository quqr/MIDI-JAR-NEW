/**
 * MIDI 后端抽象接口
 *
 * 统一 Tauri IPC 和 Web MIDI API 两种 MIDI 访问方式，
 * 使上层代码（MidiDeviceManager、MidiMessageManager、midiRouting store）
 * 不直接依赖特定后端实现。
 */

/** MIDI 输入设备信息 */
export interface MidiInputInfo {
  name: string;
  opened: boolean;
  connected: boolean;
  error: boolean;
}

/** MIDI 输出设备信息 */
export interface MidiOutputInfo {
  name: string;
  type: string;
  opened: boolean;
  connected: boolean;
  error: boolean;
}

/** MIDI 消息回调 */
export type MidiMessageCallback = (
  message: number[],
  timestamp: number,
  device: string,
) => void;

/** 设备变更回调 */
export type DeviceChangeCallback = () => void;

/** 取消监听函数 */
export type UnlistenFn = () => void;

/**
 * MIDI 后端接口
 *
 * 定义了 MIDI 设备管理、消息收发、虚拟端口等核心能力。
 * TauriMidiBackend 通过 IPC 调用 Rust 后端，
 * WebMidiBackend 通过原生 Web MIDI API 实现。
 */
export interface IMidiBackend {
  /** 初始化后端连接，在应用启动时调用 */
  initialize(): Promise<void>;

  /** 检测当前环境是否支持 MIDI 硬件访问 */
  isSupported(): boolean;

  /** 获取当前所有输入设备 */
  getInputs(): Promise<MidiInputInfo[]>;

  /** 获取当前所有输出设备 */
  getOutputs(): Promise<MidiOutputInfo[]>;

  /**
   * 监听指定命名空间的 MIDI 消息
   * @returns 取消监听函数
   */
  onMidiMessage(
    namespace: string,
    callback: MidiMessageCallback,
  ): Promise<UnlistenFn>;

  /**
   * 监听输入设备列表变更
   * @returns 取消监听函数
   */
  onInputsChange(callback: DeviceChangeCallback): UnlistenFn;

  /**
   * 监听输出设备列表变更
   * @returns 取消监听函数
   */
  onOutputsChange(callback: DeviceChangeCallback): UnlistenFn;

  /** 请求后端刷新设备列表 */
  refreshDevices(): Promise<void>;

  /** 当前环境是否支持虚拟端口 */
  isVirtualPortSupported(): boolean;

  /** 创建虚拟输入端口 */
  createVirtualInput(name: string): Promise<void>;

  /** 创建虚拟输出端口 */
  createVirtualOutput(name: string): Promise<void>;

  /** 删除虚拟输入端口 */
  deleteVirtualInput(name: string): Promise<void>;

  /** 删除虚拟输出端口 */
  deleteVirtualOutput(name: string): Promise<void>;

  /** 释放所有资源 */
  dispose(): void;
}
