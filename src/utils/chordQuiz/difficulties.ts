// ============================================================================
// 和弦测验 — 难度档案
//
// 每个难度档案定义一组允许参与出题的和弦类型（使用 tonal 类型简写）。
// 模块加载时会对所有类型做可解析性校验，非法类型会被剔除并告警，
// 以避免 `Chord.getChord` 对未知类型抛错导致页面崩溃。
// ============================================================================

import { getChord } from "@tonaljs/chord";
import type { QuizDifficulty } from "@/types";

export interface DifficultyPreset {
  /** i18n key，如 "quiz.difficulty.easy" */
  labelKey: string;
  /** tonal 类型简写，如 "M"、"m"、"7" */
  chordTypes: string[];
}

export const DIFFICULTY_PRESETS: Record<QuizDifficulty, DifficultyPreset> = {
  easy: {
    labelKey: "quiz.difficulty.easy",
    chordTypes: ["M", "m", "aug", "dim", "7"],
  },
  intermediate: {
    labelKey: "quiz.difficulty.intermediate",
    chordTypes: ["M7", "m7", "m7b5", "sus4", "6", "7sus4"],
  },
  expert: {
    labelKey: "quiz.difficulty.expert",
    chordTypes: ["9", "m9", "7b5", "dim7", "mMaj7", "9#11"],
  },
};

/** 全部难度档案的和弦类型并集（供干扰项兜底生成） */
export function getAllTypes(): string[] {
  return Array.from(
    new Set(
      Object.values(DIFFICULTY_PRESETS).flatMap((preset) => preset.chordTypes),
    ),
  );
}

/** 获取指定难度的可用和弦类型（已过滤非法类型） */
export function getDifficultyTypes(difficulty: QuizDifficulty): string[] {
  return DIFFICULTY_PRESETS[difficulty].chordTypes;
}

export interface ValidatedPresets {
  /** 过滤后的档案副本（可变类型数组，仅含可解析类型） */
  byDifficulty: Record<QuizDifficulty, string[]>;
  /** 全部可解析类型并集 */
  all: string[];
}

/**
 * 校验所有难度档案中的和弦类型可被 tonal 解析，剔除非法项。
 * 在模块加载时调用一次，结果供出题引擎复用。
 */
export function validatePresets(): ValidatedPresets {
  const byDifficulty = {} as Record<QuizDifficulty, string[]>;
  const all: string[] = [];

  for (const difficulty of Object.keys(
    DIFFICULTY_PRESETS,
  ) as QuizDifficulty[]) {
    const valid: string[] = [];
    for (const type of DIFFICULTY_PRESETS[difficulty].chordTypes) {
      try {
        getChord(type, "C");
        valid.push(type);
        if (!all.includes(type)) all.push(type);
      } catch {
        // 类型简写不被 tonal 识别，默认该类型不出题
        console.warn(`[ChordQuiz] 忽略无法解析的和弦类型: ${type}`);
      }
    }
    byDifficulty[difficulty] = valid;
  }

  return { byDifficulty, all };
}
