// ─── 流体诊断：性能耗时采集 + dye 纹理像素采样 ───
// 从 FluidSolver.ts 分离，保持核心求解器纯净

import type { DoubleFBO } from "./FramebufferManager";
import type { SolverStepTimings, TextureSample } from "./diagnostics";
import { EMPTY_TIMINGS, EMPTY_SAMPLE } from "./diagnostics";

/**
 * 性能采集器：记录单次 step() 各子步骤耗时。
 * 作为单例使用，FluidSolver 每帧 resetStep → 多次 record → finishStep。
 */
export class PerformanceTracker {
  private timings: SolverStepTimings = { ...EMPTY_TIMINGS };
  private stepStart = 0;

  /** 开始新的一帧计时，清空历史 */
  resetStep(): void {
    this.timings = { ...EMPTY_TIMINGS };
    this.stepStart = performance.now();
  }

  /** 记录某个子步骤耗时（ms） */
  record(phase: keyof Omit<SolverStepTimings, "total">, ms: number): void {
    this.timings[phase] = ms;
  }

  /** 结束当前帧，写入 total */
  finishStep(): void {
    this.timings.total = performance.now() - this.stepStart;
  }

  getTimings(): SolverStepTimings {
    return this.timings;
  }
}

/** 全局单例：当前应用仅运行一个 FluidSimulation 实例 */
export const fluidPerformanceTracker = new PerformanceTracker();

/**
 * 采样 dye 纹理中心像素（用于诊断；非主流程，静默失败）
 * 原 FluidSolver.sampleDyeCenter 实现，签名改为接收 gl + dye 参数。
 */
export function sampleDyeCenter(
  gl: WebGLRenderingContext,
  dye: DoubleFBO | null,
): TextureSample {
  if (!dye) return { ...EMPTY_SAMPLE };
  const wgl2 = gl as WebGL2RenderingContext;
  const read = dye.read;
  try {
    gl.bindFramebuffer(gl.FRAMEBUFFER, read.fbo);
    gl.viewport(0, 0, read.width, read.height);
    const px = Math.floor(read.width / 2);
    const py = Math.floor(read.height / 2);
    const buf = new Uint16Array(4);
    wgl2.readPixels(px, py, 1, 1, wgl2.RGBA, wgl2.HALF_FLOAT, buf);
    const decode = (h: number): number => {
      const s = (h & 0x8000) >> 15;
      const e = (h & 0x7c00) >> 10;
      const f = h & 0x03ff;
      if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
      if (e === 0x1f) return f ? NaN : s ? -Infinity : Infinity;
      return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
    };
    return {
      r: decode(buf[0]),
      g: decode(buf[1]),
      b: decode(buf[2]),
      a: decode(buf[3]),
    };
  } catch {
    return { ...EMPTY_SAMPLE };
  }
}
