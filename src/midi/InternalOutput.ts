import { MidiOutputDevice } from "./MidiOutputDevice";

/**
 * 内部输出设备类
 * 继承 MidiOutputDevice，用于应用内部模块之间的消息传递
 * 不依赖物理 MIDI 设备，直接通过事件系统分发消息
 */
export class InternalOutput extends MidiOutputDevice {
  // 命名空间路径数组，由设备名称按 "/" 分割得到
  namespace: string[];

  /**
   * 创建内部输出设备实例
   * @param name - 设备名称，通常包含模块路径（如 "chord-display/1"）
   */
  constructor(name: string) {
    // 调用父类构造函数，标记为 internal 类型且默认连接
    super(name, "internal", true);
    // 将设备名称按 "/" 分割为命名空间数组
    this.namespace = name.split("/");
  }

  /**
   * 发送 MIDI 消息
   * 内部输出不发送到物理设备，只通过事件系统分发
   * @param message - MIDI 消息字节数组
   * @param timestamp - 时间戳，默认为当前时间
   * @param device - 源设备名称，默认为空字符串
   */
  send(
    message: number[],
    timestamp: number = Date.now(),
    device: string = "",
  ): void {
    // 触发消息事件
    this.emit("message", message, timestamp, device);
    // 调用所有已注册的处理器
    for (const handler of this.handlers) {
      handler(message, timestamp, device);
    }
  }

  /**
   * 将设备信息转换为 API 格式
   * 内部设备始终显示为打开和连接状态
   * @returns 设备信息对象
   */
  toApi(): {
    name: string;
    type: string;
    opened: boolean;
    connected: boolean;
    error: boolean;
  } {
    return {
      name: this.name,
      type: "internal",
      opened: true,
      connected: true,
      error: false,
    };
  }
}
