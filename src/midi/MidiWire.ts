import { MidiInputDevice, MidiMessageHandler } from "./MidiInputDevice";
import { MidiOutputDevice } from "./MidiOutputDevice";
import { MidiRoute } from "@/types/midi";

/**
 * MIDI 连接线类
 * 负责在 MIDI 输入设备和输出设备之间建立连接
 * 是 MIDI 路由系统的核心组件，实现消息的转发功能
 */
export class MidiWire {
  // 当前连接的路由配置
  route: MidiRoute;
  // 连接是否已建立
  connected: boolean = false;
  // 输入设备引用
  private input: MidiInputDevice | null = null;
  // 输出设备引用
  private output: MidiOutputDevice | null = null;
  // 消息转发处理器（绑定到 this）
  private forwardHandler: MidiMessageHandler;

  /**
   * 创建 MIDI 连接线实例
   * @param route - 路由配置信息
   */
  constructor(route: MidiRoute) {
    this.route = route;
    // 绑定转发消息方法到当前实例
    this.forwardHandler = this.forwardMessage.bind(this);
  }

  /**
   * 连接输入和输出设备
   * 注册消息转发处理器到输入设备
   * @param input - MIDI 输入设备
   * @param output - MIDI 输出设备
   */
  plug(input: MidiInputDevice, output: MidiOutputDevice): void {
    this.input = input;
    this.output = output;

    if (this.input && this.output) {
      // 注册消息转发处理器
      this.input.register(this.forwardHandler);
      this.connected = true;
    } else {
      this.connected = false;
    }
  }

  /**
   * 断开连接
   * 注销消息转发处理器，清空设备引用
   */
  unplug(): void {
    if (this.input) {
      // 从输入设备注销转发处理器
      this.input.unregister(this.forwardHandler);
    }
    this.connected = false;
    this.input = null;
    this.output = null;
  }

  /**
   * 转发 MIDI 消息
   * 将输入设备收到的消息发送到输出设备
   * @param message - MIDI 消息字节数组
   * @param timestamp - 消息时间戳
   * @param device - 源设备名称
   */
  private forwardMessage(
    message: number[],
    timestamp: number,
    device: string,
  ): void {
    if (this.output) {
      this.output.send(message, timestamp, device);
    }
  }

  /**
   * 将连接线信息转换为 API 格式
   * @returns 包含路由配置和连接状态的对象
   */
  toApi(): { route: MidiRoute; connected: boolean } {
    return { route: this.route, connected: this.connected };
  }
}
