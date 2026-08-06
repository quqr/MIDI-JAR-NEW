// ─── 流体渲染管线封装：Program 绑定 + Uniform 上传 + Blit ───
// 消除 step() 中重复的 bind/uniform/blit 样板代码

import type { Program, UniformMap } from "./GLUtils";
import type { FBO } from "./FramebufferManager";

export class FluidRenderer {
  constructor(
    private blit: (target: FBO | null, clear?: boolean) => void,
  ) {}

  /**
   * 执行单次渲染 pass：绑定 program → 调用 uniformSetter 上传 uniform → blit 到 target。
   * 注意：不负责 ping-pong swap（swap 属物理状态推进，由调用方控制）。
   * @returns 该 pass 耗时（ms）
   */
  executePass(
    program: Program,
    target: FBO | null,
    uniformSetter: (u: UniformMap) => void,
  ): number {
    const t0 = performance.now();
    program.bind();
    uniformSetter(program.uniforms);
    this.blit(target);
    return performance.now() - t0;
  }

  /** 仅绑定 program（供 pressure Jacobi 循环等需要手动 blit 的场景） */
  bind(program: Program): void {
    program.bind();
  }

  /** 暴露 blit（供循环场景） */
  drawTo(target: FBO | null): void {
    this.blit(target);
  }
}
