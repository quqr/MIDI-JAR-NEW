/**
 * 音高换算纯函数库
 *
 * 所有函数以基准音 a4（A4 频率）为参数，保证基准音变化时读数可实时重算。
 * 记法惯例：A4 = MIDI 69，C4 = MIDI 60，八度 = floor(midi / 12) - 1。
 */

import { A4_MIN, A4_MAX, A4_DEFAULT } from "../types";

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

/** 频率 → 连续 MIDI 编号（小数），f ≤ 0 时返回 NaN */
export function frequencyToMidi(freq: number, a4: number): number {
  if (freq <= 0 || a4 <= 0) return NaN;
  return 69 + 12 * Math.log2(freq / a4);
}

/** MIDI 编号 → 音名（含八度，如 "A4"）；midi < 0 时返回 null */
export function midiToNoteName(midi: number): string | null {
  const rounded = Math.round(midi);
  if (rounded < 0) return null;
  const octave = Math.floor(rounded / 12) - 1;
  const pitchClass = ((rounded % 12) + 12) % 12;
  return `${NOTE_NAMES[pitchClass]}${octave}`;
}

/** 指定音级（MIDI 编号）在基准音 a4 下的理论频率 */
export function midiToFrequency(midi: number, a4: number): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

/** 频率相对指定音级的音分偏差（cents） */
export function centsOff(freq: number, midi: number, a4: number): number {
  if (freq <= 0 || a4 <= 0) return 0;
  return 1200 * Math.log2(freq / midiToFrequency(midi, a4));
}

export interface NearestNote {
  /** 最近音级 MIDI 编号（四舍五入） */
  midi: number;
  /** 音名（含八度），midi < 0 时为 null */
  name: string | null;
  /** 相对该音级的音分偏差 */
  cents: number;
}

/** 频率 → 最近音级 + 音分偏差 */
export function nearestNote(freq: number, a4: number): NearestNote {
  const midi = Math.round(frequencyToMidi(freq, a4));
  return { midi, name: midiToNoteName(midi), cents: centsOff(freq, midi, a4) };
}

/** 音准判定阈值：|cents| ≤ 5 完全准，≤ 10 接近 */
const IN_TUNE_CENTS = 5;
const NEAR_TUNE_CENTS = 10;

export interface TuneQuality {
  /** |cents| ≤ 5 */
  exact: boolean;
  /** |cents| ≤ 10 */
  near: boolean;
}

export function isInTune(cents: number): TuneQuality {
  const abs = Math.abs(cents);
  return { exact: abs <= IN_TUNE_CENTS, near: abs <= NEAR_TUNE_CENTS };
}

/** 基准音输入钳制：范围 430–450 Hz，取整 */
export function clampA4(value: number): number {
  const rounded = Math.round(value);
  if (Number.isNaN(rounded)) return A4_DEFAULT;
  return Math.min(A4_MAX, Math.max(A4_MIN, rounded));
}
