import { ref, computed, onMounted } from "vue";
import type { PlayerState } from "../state/PlayerStateMachine";
import type { PlayerStateMachine } from "../state/PlayerStateMachine";

/**
 * UI 状态管理 composable
 *
 * 集中管理纯 UI 层面的响应式状态：面板开关、FPS 显示、错误信息，
 * 以及从状态机派生的播放状态计算属性。
 *
 * 不涉及引擎或 MIDI 播放逻辑，仅提供视图层所需的状态与简单 UI 事件处理。
 */
export function useWaterfallUi(stateMachine: PlayerStateMachine) {
  // ── 状态机状态镜像（驱动 Vue 响应式 computed） ──
  // PlayerStateMachine.state 是普通属性，Vue computed 无法追踪其变化，
  // 因此通过 onStateChange 将状态同步到 ref，作为响应式桥接。
  const playerState = ref<PlayerState>(stateMachine.getState());

  // ── UI 开关状态 ──
  const settingsOpen = ref(false);
  const midiDrawerOpen = ref(false);
  const showFPS = ref(true);
  const errorMessage = ref("");

  // ── 从 playerState ref 派生的计算属性（确保 Vue 响应式追踪） ──
  const isPlaying = computed(() => playerState.value === "playing");
  const isPaused = computed(() => playerState.value === "paused");
  const isError = computed(() => playerState.value === "error");

  /**
   * 从 error 状态恢复到 idle
   */
  function onRetry(): void {
    errorMessage.value = "";
    stateMachine.setState("idle");
  }

  // ── 将状态机状态同步到 Vue 响应式系统 ──
  onMounted(() => {
    stateMachine.onStateChange((newState) => {
      playerState.value = newState;
    });
  });

  return {
    playerState,
    settingsOpen,
    midiDrawerOpen,
    showFPS,
    errorMessage,
    isPlaying,
    isPaused,
    isError,
    onRetry,
  };
}
