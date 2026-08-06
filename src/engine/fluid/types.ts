// ─── 流体模块公共类型 ───
// 集中 RGBColor 等类型定义；诊断类型自 diagnostics.ts re-export，避免搬运破坏现有引用

import type { SolverStepTimings, TextureSample } from "./diagnostics";

export type { SolverStepTimings, TextureSample };

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}
