// ─── 流体模拟统一接口：供 FluidSplatManager 和 WaterfallEngine 使用，解耦具体实现 ───

import type { FluidSimulationConfig } from "./FluidConfig";

/**
 * 流体模拟统一接口
 * 供 FluidSplatManager 和 WaterfallEngine 使用，解耦具体实现
 */
export interface IFluidSimulation {
  /** 注入一个流体 splat */
  splat(
    x: number,
    y: number,
    dx: number,
    dy: number,
    color: { r: number; g: number; b: number },
  ): void;

  /** 注入随机 splats */
  multipleSplats(amount: number): void;

  /** 外部驱动的更新方法 */
  update(): void;

  /** 销毁所有 GPU 资源 */
  destroy(): void;

  /** 初始化 */
  start(): void;

  /** 是否已初始化 */
  isInitialized(): boolean;

  /** 更新配置 */
  updateConfig(config: Partial<FluidSimulationConfig>): void;

  /** 获取当前配置 */
  getConfig(): FluidSimulationConfig;

  /** 暂停/恢复 */
  setPaused(paused: boolean): void;

  /** 是否暂停 */
  isPaused(): boolean;

  /** 适配屏幕尺寸 */
  resize(): void;
}
