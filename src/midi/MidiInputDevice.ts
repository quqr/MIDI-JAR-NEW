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
 * MIDI 输入设备事件接口声明
 * 支持 "message" 和 "latency" 两种事件
 */
export declare interface MidiInputDevice {
  on(event: "message", listener: MidiMessageHandler): this;
  on(event: "latency", listener: (latency: number, name: string) => void): this;
}

/**
 * MIDI 输入设备类
 * 继承 EventEmitter，负责与系统 MIDI 输入设备建立连接
 * 接收 MIDI 消息并分发给已注册的处理器
 */
export class MidiInputDevice extends EventEmitter {
  // 设备名称
  name: string;
  // 设备连接状态
  connected: boolean;
  // JZZ MIDI 端口实例
  private port: any = null;
  // 已注册的自定义消息处理器列表
  private handlers: MidiMessageHandler[] = [];
  // 上次接收到消息的时间戳，用于计算延迟
  private lastMessageTime: number = 0;

  /**
   * 创建 MIDI 输入设备实例
   * @param name - 设备名称
   * @param connected - 初始连接状态，默认为 true
   */
  constructor(name: string, connected: boolean = true) {
    super();
    this.name = name;
    this.connected = connected;
  }

  /**
   * 打开 MIDI 输入端口
   * 使用 JZZ 库建立与物理设备的连接
   * @returns 打开操作完成的 Promise
   */
  async open(): Promise<void> {
    // 如果端口已打开，直接返回
    if (this.port) return;

    return new Promise((resolve, reject) => {
      jzz()
        .openMidiIn(this.name)
        // 打开失败的回调
        .or(() => reject(new Error("Cannot open MIDI input")))
        // 打开成功的回调
        .and((port: any) => {
          this.port = port;
          this.connected = true;

          // 注册消息接收回调
          this.port.connect((msg: any) => {
            // 将 MIDI 消息转换为数组格式
            const message = Array.from(msg) as number[];
            const now = Date.now();
            // 计算与上次消息的时间间隔（延迟）
            const latency = now - this.lastMessageTime;
            this.lastMessageTime = now;

            // 触发延迟事件和消息事件
            this.emit("latency", latency, this.name);
            this.emit("message", message, now, this.name);

            // 调用所有已注册的自定义处理器
            for (const handler of this.handlers) {
              handler(message, now, this.name);
            }
          });

          resolve();
        });
    });
  }

  /**
   * 关闭 MIDI 输入端口
   * 释放设备资源并更新连接状态
   */
  close(): void {
    if (this.port) {
      this.port.close();
      this.port = null;
      this.connected = false;
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
    opened: boolean;
    connected: boolean;
    error: boolean;
  } {
    return {
      name: this.name,
      opened: !!this.port,
      connected: this.connected,
      error: false,
    };
  }
}
