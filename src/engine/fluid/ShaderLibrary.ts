// ─── Shader 程序库：FluidSolver 所需的 9 个 Program 容器接口 ───
// 用于依赖注入，替代 FluidSolver 构造函数的 9 个独立 Program 参数

import type { Program } from "./GLUtils";

export interface ShaderLibrary {
  copy: Program;
  clear: Program;
  splat: Program;
  advection: Program;
  divergence: Program;
  curl: Program;
  vorticity: Program;
  pressure: Program;
  gradientSubtract: Program;
}
