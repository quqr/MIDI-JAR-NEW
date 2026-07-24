// 流体对比测试页面类型定义

import type { FluidSimulationConfig } from "@/engine/fluid/FluidConfig";
import type { FluidDiagnostics } from "./diagnostics";

/** 单侧流体面板的每帧统计指标 */
export interface FluidFrameStats {
  fps: number;
  dt: number;
  splatCount: number;
  dyeResolution: number;
  simResolution: number;
  /** 深度诊断数据（每 30 帧采样一次） */
  diagnostics?: FluidDiagnostics;
}

/** RGB 颜色（0-1 归一化） */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Splat 事件记录 */
export interface SplatEvent {
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: RGB;
  side: "webgl" | "pixi" | "both";
}

/** 单条对比日志（两侧指标合并后） */
export interface FluidCompareLog {
  timestamp: number;
  webgl: FluidFrameStats;
  pixi: FluidFrameStats;
  diff: {
    fpsDelta: number;
    dtDelta: number;
    splatCountDelta: number;
    /** solver 总耗时差异（ms），仅当两侧都有 diagnostics 时填充 */
    solverTotalDelta?: number;
    /** dye 中心像素 RGB 差异 */
    dyeSampleDelta?: { r: number; g: number; b: number };
  };
  splatEvent?: SplatEvent;
}

/** 两侧流体模拟共享的配置（响应式） */
export type SharedFluidConfig = FluidSimulationConfig;

/** 日志面板侧标识 */
export type FluidSide = "webgl" | "pixi";
