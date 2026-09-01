import { type Ref } from "vue";
import type { ScoreEffectSettings, ScoreNoteInfo } from "../types";

/** EffectLayer 组件暴露的接口 */
export interface EffectLayerExposed {
  playHit: (notes: ScoreNoteInfo[], settings: ScoreEffectSettings) => void;
  playDriftIn: (target: HTMLElement, settings: ScoreEffectSettings) => void;
}

export interface UseScoreEffectsOptions {
  /** 特效层实例（挂载后由调用方赋值） */
  layer: Ref<EffectLayerExposed | null>;
  /** 特效参数快照（每次调用时取最新值） */
  getSettings: () => ScoreEffectSettings;
}

/**
 * 音符命中特效编排：连接播放同步（音符命中事件）与特效覆盖层。
 */
export function useScoreEffects(options: UseScoreEffectsOptions) {
  const { layer, getSettings } = options;

  /** 播放同步的 onNoteHit 回调入口 */
  function onNoteHit(notes: ScoreNoteInfo[]): void {
    layer.value?.playHit(notes, getSettings());
  }

  /** 乐谱加载完成后的飘入动画 */
  function onScoreReady(target: HTMLElement): void {
    layer.value?.playDriftIn(target, getSettings());
  }

  return { onNoteHit, onScoreReady };
}
