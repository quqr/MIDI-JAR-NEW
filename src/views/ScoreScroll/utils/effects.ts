import type { ScoreEffectSettings } from "../types";

/** 映射后的实际特效参数（渲染用） */
export interface MappedEffectParams {
  /** 高光框基础缩放（相对音符外接矩形） */
  highlightScale: number;
  /** 高光框向外扩展（px） */
  highlightExpand: number;
  /** 高光最大不透明度 */
  highlightIntensity: number;
  /** 粒子飞散距离（px） */
  scatterDistance: number;
  /** 粒子间 stagger 延迟（ms） */
  fragmentStagger: number;
  /** 粒子数量 */
  fragmentCount: number;
  /** 谱面飘入距离（px） */
  driftInDistance: number;
}

/**
 * 将 0-100 的特效参数换算为实际渲染值。
 * 纯函数，便于单元测试与调参。
 */
export function mapEffectParams(e: ScoreEffectSettings): MappedEffectParams {
  const pct = e.highlightSize / 100;
  return {
    highlightScale: 0.6 + pct * 1.4, // 0.6x - 2.0x
    highlightExpand: (e.highlightRange / 100) * 40, // 0 - 40px
    highlightIntensity: 0.2 + (e.highlightIntensity / 100) * 0.8, // 0.2 - 1
    scatterDistance: 20 + (e.scatterRange / 100) * 180, // 20 - 200px
    fragmentStagger: (e.fragmentDelay / 100) * 60, // 0 - 60ms
    fragmentCount: 8 + Math.round((e.highlightSize / 100) * 4), // 8 - 12
    driftInDistance: (e.driftInDistance / 100) * 120, // 0 - 120px
  };
}
