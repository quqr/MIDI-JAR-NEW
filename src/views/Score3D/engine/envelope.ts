import type { EnvelopeParams } from "../types";

/** 包络求值的音符输入（只依赖时间与力度字段） */
export interface EnvelopeNote {
  timeOn: number;
  timeOff: number;
  velocity: number;
}

/**
 * 力度 → 辉光系数（0-1）的正弦非线性映射。
 * 借鉴 M2V `calculate_brightness` 的 `sin(velocity·π/2)` 曲线：
 * 中低力度区间被抬升，避免弱音在画面上完全消失。
 */
export function evaluateGlowSine(velocity: number): number {
  const v = Math.min(1, Math.max(0, velocity));
  return Math.sin((v * Math.PI) / 2);
}

/**
 * ADSR 包络求值（纯函数）。
 *
 * 算法借鉴 M2V `evaluate_envelope`：以 min(time, timeOff) − timeOn 计算包络内相对时间，
 * 依次经过 attack（线性上升）→ decay（回落至 sustain）→ sustain（保持）；
 * time 之后进入 release（线性衰减至 0）。
 * 力度按 velocitySensitivity 与包络线性混合：
 * 输出 = (1 − sensitivity) × envelope + sensitivity × velocity × envelope。
 *
 * @returns 0-1 的归一化包络值
 */
export function evaluateEnvelope(
  time: number,
  note: EnvelopeNote,
  params: EnvelopeParams,
): number {
  const { attack, decay, sustain, release, velocitySensitivity } = params;
  const relativeTime = Math.min(time, note.timeOff) - note.timeOn;

  if (relativeTime <= 0) return 0;

  let envelope: number;
  if (relativeTime < attack) {
    envelope = relativeTime / attack;
  } else {
    const decayTime = relativeTime - attack;
    if (decayTime < decay) {
      envelope = (1 - decayTime / decay) * (1 - sustain) + sustain;
    } else {
      envelope = sustain;
    }
  }

  if (time > note.timeOff) {
    const releaseRatio = 1 - (time - note.timeOff) / release;
    if (releaseRatio <= 0) return 0;
    envelope *= releaseRatio;
  }

  const blended =
    (1 - velocitySensitivity) * envelope +
    velocitySensitivity * note.velocity * envelope;
  return Math.min(1, Math.max(0, blended));
}
