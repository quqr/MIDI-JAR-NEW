import { ref, computed, onMounted } from "vue";
import type { PlayerState } from "../state/PlayerStateMachine";
import type { PlayerStateMachine } from "../state/PlayerStateMachine";

/**
 * 侧边面板页签（ADR 0025）：资料与设置合并进同一个抽屉后，
 * 用页签区分两组内容，不再维护两个独立的开关。
 */
export type WaterfallPanelTab = "library" | "settings";

/**
 * UI 状态管理 composable
 *
 * 集中管理纯 UI 层面的响应式状态：面板开合与页签、FPS 显示、错误信息，
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
  /** 合并面板（资料 + 设置）是否展开 */
  const panelOpen = ref(false);
  /** 当前页签：默认「资料」（载入内容是面板里最常用的入口），关闭后保留上次选择 */
  const panelTab = ref<WaterfallPanelTab>("library");
  /** UI 层整体显隐（快捷键切换，沉浸模式） */
  const uiHidden = ref(false);
  const errorMessage = ref("");

  /** 切换合并面板开合 */
  function togglePanel(): void {
    panelOpen.value = !panelOpen.value;
  }

  // ── 从 playerState ref 派生的计算属性（确保 Vue 响应式追踪） ──
  const isPlaying = computed(() => playerState.value === "playing");
  const isPaused = computed(() => playerState.value === "paused");
  const isError = computed(() => playerState.value === "error");

  /** 从 error 状态恢复到 idle */
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
    panelOpen,
    panelTab,
    uiHidden,
    errorMessage,
    isPlaying,
    isPaused,
    isError,
    togglePanel,
    onRetry,
  };
}
