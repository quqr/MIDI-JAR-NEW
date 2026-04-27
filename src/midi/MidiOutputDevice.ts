import jzz from "jzz";
import { EventEmitter } from "./EventEmitter";

/**
 * MIDI 消息处理器类型
 * @param message - MIDI 消息字节数组
 * @param timestamp - 消息时间戳（毫秒）
 * @param device - 设备名称
 */
export type MidiMessageHandler = (
  message: number[],
  timestamp: number,
  device: string,
) => void;

/**
 * MIDI 输出设备事件接口声明
 * 支持 "message" 事件
 */
export declare interface MidiOutputDevice {
  on(event: "message", listener: MidiMessageHandler): this;
}

/**
 * MIDI 输出设备类
 * 继承 EventEmitter，负责向物理或内部 MIDI 设备发送消息
 * 支持物理 MIDI 端口和内部虚拟输出
 */
export class MidiOutputDevice extends EventEmitter {
  // 设备名称
  name: string;
  // 设备类型：physical（物理设备）、internal（内部虚拟设备）、websocket（网络）
  type: "physical" | "internal" | "websocket";
  // 设备连接状态
  connected: boolean;
  // JZZ MIDI 端口实例（受保护，子类可访问）
  protected port: any = null;
  // 已注册的消息处理器列表（受保护，子类可访问）
  protected handlers: MidiMessageHandler[] = [];

  /**
   * 创建 MIDI 输出设备实例
   * @param name - 设备名称
   * @param type - 设备类型
   * @param connected - 初始连接状态，默认为 true
   */
  constructor(
    name: string,
    type: "physical" | "internal" | "websocket",
    connected: boolean = true,
  ) {
    super();
    this.name = name;
    this.type = type;
    this.connected = connected;
  }

  /**
   * 打开 MIDI 输出端口
   * 仅对物理设备类型有效
   * @returns 打开操作完成的 Promise
   */
  async open(): Promise<void> {
    // 如果端口已打开，直接返回
    if (this.port) return;
    // 只有物理设备才能打开
    if (this.type !== "physical") return;

    return new Promise((resolve, reject) => {
      jzz()
        .openMidiOut(this.name)
        // 打开失败的回调
        .or(() => reject(new Error("Cannot open MIDI output")))
        // 打开成功的回调
        .and((port: any) => {
          this.port = port;
          this.connected = true;
          resolve();
        });
    });
  }

  /**
   * 关闭 MIDI 输出端口
   * 仅对物理设备类型有效
   */
  close(): void {
    if (this.port && this.type === "physical") {
      this.port.close();
      this.port = null;
      this.connected = false;
    }
  }

  /**
   * 发送 MIDI 消息
   * @param message - MIDI 消息字节数组
   * @param timestamp - 时间戳，默认为当前时间
   * @param device - 源设备名称，默认为空字符串
   */
  send(
    message: number[],
    timestamp: number = Date.now(),
    device: string = "",
  ): void {
    // 如果有物理端口，实际发送到 MIDI 设备
    if (this.port) {
      this.port.send(message);
    }

    // 触发消息事件，通知监听器
    this.emit("message", message, timestamp, device);
    // 调用所有已注册的自定义处理器
    for (const handler of this.handlers) {
      handler(message, timestamp, device);
    }
  }

  /**
   * 注册消息处理器
   * @param handler - 要注册的消息处理函数
   */
  register(handler: MidiMessageHandler): void {
    // 确保处理器有效且未重复注册
    if (handler && !this.handlers.includes(handler)) {
      this.handlers.push(handler);
    }
  }

  /**
   * 注销消息处理器
   * @param handler - 要注销的消息处理函数
   */
  unregister(handler: MidiMessageHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index >= 0) {
      this.handlers.splice(index, 1);
    }
  }

  /**
   * 将设备信息转换为 API 格式
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
      type: this.type,
      opened: !!this.port,
      connected: this.connected,
      error: false,
    };
  }
}
