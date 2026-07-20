import { ref, shallowRef, onUnmounted } from "vue";
import { createLogger } from "@/utils/logger";
import type { NoteBlockMode } from "../engine/NoteBlockSystem";
import type { WaterfallEngine } from "../engine/WaterfallEngine";
import type { PlayerStateMachine } from "../state/PlayerStateMachine";
import type { PlaybackStrategy } from "../strategies/modeStrategies";
import { useVisibilityRefresh } from "./useVisibilityRefresh";

const logger = createLogger("WaterfallEngine");

export interface UseWaterfallEngineOptions {
  stateMachine: PlayerStateMachine;
  /** 获取当前播放策略（用于驱动 frameCallback），无可用源时返回 null */
  getStrategy: () => PlaybackStrategy | null;
  /** 引擎就绪后的额外初始化（如恢复本地录音缓存），在 frameCallback 设置完成后调用 */
  onEngineInit?: () => void;
}

/**
 * 瀑布流引擎生命周期管理 composable
 *
 * 负责引擎实例引用、音符块显示模式切换与窗口可见性刷新。
 *
 * frameCallback 不再通过 if/else 判断 contentType 选择 tick 目标，
 * 而是统一委托给外部传入的 {@link PlaybackStrategy}，由策略工厂按内容类型创建。
 *
 * 不持有 player/recorder 引用，保持引擎层与 MIDI 层的解耦。
 */
export function useWaterfallEngine(options: UseWaterfallEngineOptions) {
  const { stateMachine, getStrategy, onEngineInit } = options;

  const engineRef = shallowRef<WaterfallEngine | null>(null);
  const mode = ref<NoteBlockMode>("realtime");

  // ── 窗口可见性刷新 ──
  useVisibilityRefresh({
    forceRedraw: () => engineRef.value?.forceRedraw(),
  });

  /**
   * 切换音符块显示模式（严格限制：仅 idle/ready 时允许切换）
   *
   * canSwitchMode 已保证 playing/paused 时无法切换，无需额外检查 contentType
   * @param m - 目标模式（realtime / synthesia）
   */
  function onModeChange(m: NoteBlockMode): void {
    if (!stateMachine.canSwitchMode) {
      logger.warn(`Cannot switch mode in state: ${stateMachine.getState()}`);
      return;
    }
    mode.value = m;
    engineRef.value?.setMode(m);
  }

  /**
   * 引擎初始化完成回调
   *
   * 设置每帧驱动逻辑：通过播放策略的 tick() 推进播放进度，
   * 替代原先基于 contentType 的 if/else 分支。
   * 随后触发外部 onEngineInit 以完成录音缓存恢复等业务初始化。
   * @param engine - Waterfall 引擎实例
   */
  function onEngineReady(engine: WaterfallEngine): void {
    engineRef.value = engine;
    engine.frameCallback = () => {
      // 状态机是播放状态的唯一真相源
      if (!stateMachine.isPlaying) return;
      getStrategy()?.tick();
    };
    onEngineInit?.();
  }

  onUnmounted(() => {
    engineRef.value?.dispose();
    engineRef.value = null;
  });

  return {
    engineRef,
    mode,
    onModeChange,
    onEngineReady,
  };
}
