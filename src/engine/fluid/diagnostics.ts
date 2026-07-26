// 流体模拟深度诊断类型定义
// 用于 FluidSolver / FluidSimulation 内部插桩，定位渲染异常

/** Solver 各步骤耗时（ms） */
export interface SolverStepTimings {
  curl: number;
  vorticity: number;
  divergence: number;
  clearPressure: number;
  pressure: number;
  gradientSubtract: number;
  advectVelocity: number;
  advectDye: number;
  total: number;
}

/** 纹理像素采样（dye 纹理中心像素 RGBA，0-1） */
export interface TextureSample {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** 后处理 pass 状态 */
export interface PassStatus {
  bloom: {
    enabled: boolean;
    iterations: number;
    outputSize?: { w: number; h: number };
  };
  sunrays: {
    enabled: boolean;
    weight: number;
    outputSize?: { w: number; h: number };
  };
  display: { outputFormat: string };
}

/** Splat 参数链路追踪 */
export interface SplatTrace {
  input: { x: number; y: number; dx: number; dy: number };
  color: { r: number; g: number; b: number };
}

/** 完整诊断数据 */
export interface FluidDiagnostics {
  stepTimings: SolverStepTimings;
  dyeSample: TextureSample;
  passes: PassStatus;
  lastSplat?: SplatTrace;
}

/** 空计时模板，用于初始化 */
export const EMPTY_TIMINGS: SolverStepTimings = {
  curl: 0,
  vorticity: 0,
  divergence: 0,
  clearPressure: 0,
  pressure: 0,
  gradientSubtract: 0,
  advectVelocity: 0,
  advectDye: 0,
  total: 0,
};

/** 空采样模板 */
export const EMPTY_SAMPLE: TextureSample = { r: 0, g: 0, b: 0, a: 0 };
