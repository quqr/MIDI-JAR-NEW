import jzz from "jzz";

/**
 * JZZ MIDI 引擎封装类
 * 单例模式，负责初始化和提供 MIDI 设备信息
 * JZZ 是一个跨平台的 Web MIDI API 库
 */
export class JZZEngine {
  // 单例实例
  private static instance: JZZEngine | null = null;
  // JZZ 实例
  private jzzInstance: any = null;
  // 初始化状态标志
  private initialized = false;
  // 初始化 Promise，防止重复初始化
  private initPromise: Promise<void> | null = null;

  // 私有构造函数，防止外部实例化
  private constructor() {}

  /**
   * 获取 JZZEngine 单例实例
   * @returns JZZEngine 实例
   */
  static getInstance(): JZZEngine {
    if (!JZZEngine.instance) {
      JZZEngine.instance = new JZZEngine();
    }
    return JZZEngine.instance;
  }

  /**
   * 初始化 JZZ MIDI 引擎
   * 使用 Promise 缓存机制，确保只初始化一次
   * @returns 初始化完成的 Promise
   */
  async initialize(): Promise<void> {
    // 如果已经初始化，直接返回
    if (this.initialized) return;
    // 如果正在初始化，返回已有的 Promise
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      jzz()
        // MIDI 初始化失败的回调
        .or(() => reject(new Error("Cannot start MIDI engine!")))
        // MIDI 初始化成功的回调
        .and(() => {
          this.jzzInstance = jzz();
          this.initialized = true;
          resolve();
        });
    });

    return this.initPromise;
  }

  /**
   * 获取 JZZ 实例
   * @returns JZZ 实例，如果未初始化则抛出错误
   */
  getJZZ(): any {
    if (!this.jzzInstance) throw new Error("JZZ not initialized");
    return this.jzzInstance;
  }

  /**
   * 检查 JZZ 引擎是否已初始化
   * @returns 初始化状态
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 获取所有 MIDI 输入设备名称列表
   * @returns 输入设备名称数组
   */
  getInputs(): string[] {
    if (!this.jzzInstance) return [];
    const inputs: string[] = [];
    for (let i = 0; i < this.jzzInstance.info().inputs.length; i++) {
      inputs.push(this.jzzInstance.info().inputs[i].name);
    }
    return inputs;
  }

  /**
   * 获取所有 MIDI 输出设备名称列表
   * @returns 输出设备名称数组
   */
  getOutputs(): string[] {
    if (!this.jzzInstance) return [];
    const outputs: string[] = [];
    for (let i = 0; i < this.jzzInstance.info().outputs.length; i++) {
      outputs.push(this.jzzInstance.info().outputs[i].name);
    }
    return outputs;
  }

  /**
   * 刷新 MIDI 设备列表
   * 用于检测新连接或断开的设备
   */
  async refresh(): Promise<void> {
    if (!this.jzzInstance) return;
    await this.jzzInstance.refreshMIDI();
  }
}
