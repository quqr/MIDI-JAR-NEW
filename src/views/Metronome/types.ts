/**
 * 节拍器领域类型
 *
 * - 拍（Beat）由拍号决定；细分（Subdivision）把一拍再切成 1/2/3/4 个 slot。
 * - 调度与可视化的最小单位都是 slot：slot 序号 → {小节, 拍, 细分} 纯算术推导。
 */

/** 每拍的重音档位 */
export type AccentLevel = "strong" | "medium" | "weak" | "silent";

/** 细分模式：off=整拍；eighth=八分；sixteenth=十六分；triplet=三连音 */
export type SubdivisionMode = "off" | "eighth" | "sixteenth" | "triplet";

/** 引擎状态 */
export type MetronomeStatus = "idle" | "starting" | "playing";

export interface TimeSignature {
  numerator: number;
  denominator: 2 | 4 | 8 | 16;
}

export interface MetronomeParams {
  /** 每分钟拍数（拍 = 拍号的分母音符） */
  bpm: number;
  timeSignature: TimeSignature;
  /** 每拍重音档，长度恒等于 timeSignature.numerator */
  accents: AccentLevel[];
  subdivision: SubdivisionMode;
  /** 细分音音量（0..1），独立于主音量 */
  subdivisionVolume: number;
  /** 主音量（0..1） */
  volume: number;
  /** 预备小节数：正式发声前先空数几小节 */
  countInBars: 0 | 1 | 2;
}

/** 一次点击声的音色配置 */
export interface ClickVoiceConfig {
  wave: OscillatorType;
  /** 基频（Hz） */
  freq: number;
  /** 振荡器包络衰减时长（秒） */
  decay: number;
  /** 振荡器峰值（0..1） */
  peak: number;
  /** 噪声瞬态峰值（0..1） */
  noisePeak: number;
  /** 噪声瞬态衰减时长（秒） */
  noiseDecay: number;
  /** 声像 -1..1 */
  pan: number;
}

export type ClickKind = AccentLevel | "subdivision";

/** 每帧可视化状态（全部由音频时钟推导，不做 JS 累加） */
export interface MetronomeVisualState {
  running: boolean;
  /** 自开始起已过的小节数（含预备小节） */
  barIndex: number;
  /** 当前拍序号 0..numerator-1 */
  beatIndex: number;
  /** 当前细分序号 0..slotsPerBeat-1 */
  subIndex: number;
  /** 拍内进度 0..1 */
  beatProgress: number;
  /** 小节内进度 0..1 */
  barProgress: number;
  /** 当前 slot 起点（AudioContext 时间） */
  slotStart: number;
  /** 单个 slot 时长（秒） */
  slotSec: number;
  /** 当前音频时钟（AudioContext 时间） */
  now: number;
  /** 当前 slot 的音色种类 */
  kind: ClickKind;
  /** true = 处于预备拍，不发声 */
  silent: boolean;
  /** 预备拍阶段：当前是第几个预备小节（1..countInBars），非预备拍为 0 */
  countInBar: number;
  /** 预备拍阶段：当前小节内第几拍（1..numerator），非预备拍为 0 */
  countInBeat: number;
}

export const BPM_MIN = 30;
export const BPM_MAX = 300;
export const NUMERATOR_MIN = 1;
export const NUMERATOR_MAX = 12;

export const DENOMINATORS = [2, 4, 8, 16] as const;
export const SUBDIVISIONS: readonly SubdivisionMode[] = [
  "off",
  "eighth",
  "sixteenth",
  "triplet",
];
export const ACCENT_CYCLE: readonly AccentLevel[] = [
  "strong",
  "medium",
  "weak",
  "silent",
];

export const DEFAULT_PARAMS: MetronomeParams = {
  bpm: 120,
  timeSignature: { numerator: 4, denominator: 4 },
  accents: ["strong", "medium", "medium", "medium"],
  subdivision: "off",
  subdivisionVolume: 0.6,
  volume: 0.8,
  countInBars: 0,
};

/** 每拍被切分成几个 slot：off=1、八分=2、三连音=3、十六分=4 */
export function slotsPerBeatOf(mode: SubdivisionMode): 1 | 2 | 3 | 4 {
  switch (mode) {
    case "eighth":
      return 2;
    case "triplet":
      return 3;
    case "sixteenth":
      return 4;
    default:
      return 1;
  }
}

/** 把重音数组对齐到新的拍数（新增拍默认 medium，首拍恒为 strong） */
export function normalizeAccents(
  accents: AccentLevel[],
  numerator: number,
): AccentLevel[] {
  const next: AccentLevel[] = [];
  for (let i = 0; i < numerator; i++) {
    const value = accents[i];
    next.push(i === 0 ? "strong" : (value ?? "medium"));
  }
  if (next.length > 0) next[0] = "strong";
  return next;
}
