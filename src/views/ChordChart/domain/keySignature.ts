/**
 * 调号（key signature）推导 —— 谱面每行谱首的 ♭/♯ 记号列。
 *
 * 标准调号圈（与五度圈一致，**不另立第二套调序**）：
 * - 升种大调：C(0) G(1) D(2) A(3) E(4) B(5) F#(6) C#(7)；
 * - 降种大调：C(0) F(1) Bb(2) Eb(3) Ab(4) Db(5) Gb(6) Cb(7)；
 * - 小调用其**关系大调**的调号（Am = C，升种从 A 起、降种从 D 起）。
 *
 * 谱面渲染只按 count 重复升/降号字形（不做五线谱上的逐级线间定位——
 * 和弦谱没有五线谱，示意列即可）。
 */

import type { ChartKey } from "./types";

export interface KeySignatureInfo {
  /** 变音记号数量（0 = 无调号） */
  count: number;
  /** 记号种类；none 时不渲染 */
  accidental: "sharp" | "flat" | "none";
}

const SHARP_MAJORS: readonly string[] = [
  "C",
  "G",
  "D",
  "A",
  "E",
  "B",
  "F#",
  "C#",
];
const FLAT_MAJORS: readonly string[] = [
  "C",
  "F",
  "Bb",
  "Eb",
  "Ab",
  "Db",
  "Gb",
  "Cb",
];
const SHARP_MINORS: readonly string[] = [
  "A",
  "E",
  "B",
  "F#",
  "C#",
  "G#",
  "D#",
  "A#",
];
const FLAT_MINORS: readonly string[] = [
  "A",
  "D",
  "G",
  "C",
  "F",
  "Bb",
  "Eb",
  "Ab",
];

export function keySignature(key: ChartKey): KeySignatureInfo {
  const tonic = key.tonic;
  const sharpIndex = (
    key.mode === "major" ? SHARP_MAJORS : SHARP_MINORS
  ).indexOf(tonic);
  if (sharpIndex > 0) return { count: sharpIndex, accidental: "sharp" };
  const flatIndex = (key.mode === "major" ? FLAT_MAJORS : FLAT_MINORS).indexOf(
    tonic,
  );
  if (flatIndex > 0) return { count: flatIndex, accidental: "flat" };
  // C 大调 / A 小调，或表外拼写（如重升）→ 无调号
  return { count: 0, accidental: "none" };
}
