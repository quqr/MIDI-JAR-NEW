import { logger } from "@/utils/logger";
import jzz from "jzz";

export class JZZEngine {
  private static instance: JZZEngine | null = null;
  private jzzInstance: any = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): JZZEngine {
    if (!JZZEngine.instance) {
      JZZEngine.instance = new JZZEngine();
    }
    return JZZEngine.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      jzz()
        .or(() => reject(new Error("Cannot start MIDI engine!")))
        .and(() => {
          this.jzzInstance = jzz();
          this.initialized = true;
          resolve();
        });
    });

    return this.initPromise;
  }

  getJZZ(): any {
    if (!this.jzzInstance) throw new Error("JZZ not initialized");
    return this.jzzInstance;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getInputs(): string[] {
    if (!this.jzzInstance) return [];
    const inputs: string[] = [];
    for (let i = 0; i < this.jzzInstance.info().inputs.length; i++) {
      inputs.push(this.jzzInstance.info().inputs[i].name);
    }
    return inputs;
  }

  getOutputs(): string[] {
    if (!this.jzzInstance) return [];
    const outputs: string[] = [];
    for (let i = 0; i < this.jzzInstance.info().outputs.length; i++) {
      outputs.push(this.jzzInstance.info().outputs[i].name);
    }
    return outputs;
  }

  async refresh(): Promise<void> {
    if (!this.jzzInstance) return;
    if (typeof this.jzzInstance.refreshMIDI === "function") {
      try {
        this.jzzInstance.refreshMIDI();
      } catch (error) {
        logger.error(`刷新 MIDI 设备列表失败: ${error}`);
      }
    }
  }
}
