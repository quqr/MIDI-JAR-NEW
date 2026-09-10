import { onUnmounted, ref } from "vue";
import { BPM_MAX, BPM_MIN } from "../types";

/** 超过该间隔视为新一轮敲击 */
const TAP_TIMEOUT_MS = 2000;
/** 参与平均的最多敲击次数 */
const MAX_TAPS = 8;
/** 心跳停顿超过该值即视为新一轮（松手后自动重置） */
const PULSE_GAP_MS = 320;

/**
 * Tap Tempo：取最近若干次敲击间隔的平均值换算 BPM。
 *
 * 支持两种敲法：
 * - 连续敲击（点一下算一次），超过 TAP_TIMEOUT_MS 自动开始新的一轮；
 * - 长按（按住不放持续敲），按住期间按约 0.7 秒的固定间隔累积心跳，
 *   松手视为一轮结束，无需反复点按。
 *
 * @param apply 每次测得新 BPM 时的回调（用于写回参数）
 */
export function useTapTempo(apply: (bpm: number) => void) {
  const tappedBpm = ref<number | null>(null);
  const holding = ref(false);
  const pulseActive = ref(false);
  let times: number[] = [];
  let timer: number | null = null;
  let pulseTimer: number | null = null;
  let lastPulseAt = 0;

  function clearTimer(): void {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  }

  function clearPulseTimer(): void {
    if (pulseTimer !== null) {
      window.clearInterval(pulseTimer);
      pulseTimer = null;
    }
  }

  function reset(): void {
    times = [];
    tappedBpm.value = null;
    clearTimer();
  }

  function commit(now: number): void {
    const last = times[times.length - 1];
    if (last !== undefined && now - last > TAP_TIMEOUT_MS) times = [];

    times.push(now);
    if (times.length > MAX_TAPS) times.shift();

    if (times.length >= 2) {
      let sum = 0;
      for (let i = 1; i < times.length; i++) sum += times[i] - times[i - 1];
      const avg = sum / (times.length - 1);
      const bpm = Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(60000 / avg)));
      tappedBpm.value = bpm;
      apply(bpm);
    }

    clearTimer();
    timer = window.setTimeout(reset, TAP_TIMEOUT_MS);
  }

  /** 单次敲击 */
  function tap(): void {
    commit(performance.now());
  }

  /** 一次心跳：与上一次心跳间隔过短则忽略（防键盘重复触发） */
  function pulse(): void {
    const now = performance.now();
    if (now - lastPulseAt < PULSE_GAP_MS * 0.6) return;
    lastPulseAt = now;
    pulseActive.value = true;
    commit(now);
  }

  function beginHold(): void {
    if (pulseTimer !== null) return;
    holding.value = true;
    lastPulseAt = 0;
    pulse();
    pulseTimer = window.setInterval(pulse, 700);
  }

  function endHold(): void {
    clearPulseTimer();
    holding.value = false;
    pulseActive.value = false;
  }

  onUnmounted(() => {
    reset();
    clearPulseTimer();
  });

  return {
    tap,
    pulse,
    beginHold,
    endHold,
    holding,
    pulseActive,
    tappedBpm,
    reset,
  };
}
