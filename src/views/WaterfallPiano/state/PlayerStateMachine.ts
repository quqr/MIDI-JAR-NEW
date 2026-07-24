/**
 * 播放器状态机 - 统一管理所有播放相关状态
 *
 * 七状态模型：idle | loading | ready | playing | paused | recording | error
 *
 * 状态转换图：
 *   idle → loading → ready → playing ↔ paused
 *     ↓       ↓        ↓        ↓
 *  recording  error   error    error
 *     ↓                 ↑
 *   idle/ready ─────────┘（停止录制后可回放）
 *
 * 严格限制模式：
 * - playing/paused 时禁止：切换模式、加载新文件
 * - recording 时禁止：加载文件；停止录制后可回 ready 回放
 * - loading 时禁止：任何操作
 * - error 时仅允许：回到 idle（重试）
 */

import { createLogger } from "@/utils/logger";

const logger = createLogger("PlayerStateMachine");

export type PlayerState =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "recording"
  | "error";

/** 状态变更监听器类型 */
export type StateChangeListener = (newState: PlayerState) => void;

/** 允许的状态转换映射表 */
const ALLOWED_TRANSITIONS: Record<PlayerState, PlayerState[]> = {
  idle: ["loading", "recording"],
  loading: ["ready", "error"],
  ready: ["playing", "recording", "loading"],
  playing: ["paused", "ready", "error"], // playing → ready（停止）
  paused: ["playing", "ready", "error"], // paused → ready（停止）
  recording: ["idle", "ready", "error"], // recording → ready（停止录制后回放）
  error: ["idle"],
};

/**
 * 播放器状态机
 *
 * 提供状态转换验证、变更通知和查询功能。
 * 所有状态转换必须通过本类进行，确保操作权限正确。
 */
export class PlayerStateMachine {
  private state: PlayerState = "idle";
  private listeners: Set<StateChangeListener> = new Set();

  /** 获取当前状态 */
  getState(): PlayerState {
    return this.state;
  }

  /**
   * 检查是否可以从 from 状态转换到 to 状态
   * @param from - 源状态
   * @param to - 目标状态
   * @returns 是否允许转换
   */
  canTransition(from: PlayerState, to: PlayerState): boolean {
    return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
  }

  /**
   * 尝试转换到新状态
   * @param newState - 目标状态
   * @returns 是否成功转换
   */
  setState(newState: PlayerState): boolean {
    if (!this.canTransition(this.state, newState)) {
      logger.warn(`Invalid transition: ${this.state} → ${newState}`);
      return false;
    }
    const oldState = this.state;
    this.state = newState;
    logger.info(`State changed: ${oldState} → ${newState}`);
    this.listeners.forEach((fn) => fn(newState));
    return true;
  }

  /**
   * 注册状态变更监听器
   * @param listener - 监听器回调
   * @returns 取消监听的函数
   */
  onStateChange(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** 检查当前是否处于指定状态 */
  is(state: PlayerState): boolean {
    return this.state === state;
  }

  /** 检查当前是否处于指定状态之一 */
  isAny(...states: PlayerState[]): boolean {
    return states.includes(this.state);
  }

  // ── 便捷查询方法 ──

  /** 是否正在播放 */
  get isPlaying(): boolean {
    return this.state === "playing";
  }

  /** 是否已暂停 */
  get isPaused(): boolean {
    return this.state === "paused";
  }

  /** 是否正在录制 */
  get isRecording(): boolean {
    return this.state === "recording";
  }

  /** 是否处于错误状态 */
  get isError(): boolean {
    return this.state === "error";
  }

  /** 是否处于空闲或就绪状态（可以加载文件） */
  get canLoadFile(): boolean {
    return this.isAny("idle", "ready");
  }

  /** 是否可以开始播放 */
  get canPlay(): boolean {
    return this.isAny("ready", "paused");
  }

  /** 是否可以暂停 */
  get canPause(): boolean {
    return this.state === "playing";
  }

  /** 是否可以停止 */
  get canStop(): boolean {
    return this.isAny("playing", "paused");
  }

  /** 是否可以切换模式 */
  get canSwitchMode(): boolean {
    return this.isAny("idle", "ready");
  }
}
