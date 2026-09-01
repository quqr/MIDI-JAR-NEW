/**
 * Tuner 模块类型定义
 */

/** 检测器原始结果（@audio/pitch-mcleod 输出） */
export interface PitchResult {
  /** 基频 Hz */
  freq: number;
  /** 置信度 [0, 1] */
  clarity: number;
}

/** 音名拼音级后的完整读数（音级已含迟滞平滑） */
export interface PitchReading {
  /** 平滑后的基频 Hz */
  freq: number;
  /** 迟滞锁定的最近音级 MIDI 编号 */
  midi: number;
  /** 置信度 [0, 1] */
  clarity: number;
}

/** 调音器工作状态 */
export type TunerStatus = "idle" | "starting" | "listening" | "error";

/** 基准音范围常量 */
export const A4_MIN = 430;
export const A4_MAX = 450;
export const A4_DEFAULT = 440;

/** 常用基准音预设 */
export const A4_PRESETS = [432, 440, 442] as const;
