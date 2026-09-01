import type { KeySignatureConfig } from "@/helpers";

// ============================================================================
// 和弦测验类型定义
// ============================================================================

/** 出题方式：视觉（五线谱原位堆叠）/ 乱序（同音组乱序 + 开放 voicing）/ 听觉（仅播放） */
export type QuizMode = "visual" | "scrambled" | "aural";

/** 难度档位：入门 / 进阶 / 专家 */
export type QuizDifficulty = "easy" | "intermediate" | "expert";

/** 键盘显示音域（控制琴键数量）：窄 13 键 / 中 25 键 / 宽 36 键 */
export type KeyboardRange = "narrow" | "medium" | "wide";

/** 视觉提示的展示方式：键盘 / 五线谱 / 两者 / 自动（听觉模式恒不显示视觉提示） */
export type DisplayMode = "keyboard" | "notation" | "both" | "auto";

export interface QuizSettings {
  difficulty: QuizDifficulty;
  /** 参与出题的模式集合；"混合" = 数组含 ≥2 个元素，每题随机取一个 */
  modes: QuizMode[];
  display: DisplayMode;
  /** 钢琴键盘显示音域（琴键数量档位） */
  keyboardRange: KeyboardRange;
  /** 一轮题数：5 / 10 / 20 */
  questionCount: 5 | 10 | 20;
}

export interface QuizQuestion {
  id: number;
  mode: QuizMode;
  /** 正确选项文本（tonal 符号，如 "Cmaj7"） */
  symbol: string;
  /** 4 个打乱后的唯一选项 */
  options: string[];
  /** 正确选项在 options 中的下标 */
  correctIndex: number;
  /** 和弦音名（来自 @tonaljs/chord，跟随根音记法） */
  chordNotes: string[];
  /** 五线谱 / 键盘显示用 midi（视觉=原位堆叠，乱序=乱序 voicing） */
  visualMidi: number[];
  /** 听觉播放用 midi（限定 C4–B5 内最近落点） */
  playMidi: number[];
  /** 调号（恒 C 大调，五线谱无调号） */
  keySignature: KeySignatureConfig;
}

export interface QuizStats {
  total: number;
  correct: number;
  streak: number;
  bestStreak: number;
  /** 每题作答耗时（ms），与题目顺序对齐 */
  timings: number[];
  /** 每题是否正确（与 timings 对齐），供结算成绩单逐题着色 */
  correctSequence: boolean[];
}

export const DEFAULT_QUIZ_SETTINGS: QuizSettings = {
  difficulty: "easy",
  modes: ["visual"],
  display: "auto",
  keyboardRange: "medium",
  questionCount: 10,
};
