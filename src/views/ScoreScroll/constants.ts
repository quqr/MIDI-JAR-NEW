import type { ScoreScrollSettings } from "./types";

/** 设置持久化存储键 */
export const STORAGE_KEY = "midi-jar-score-scroll-settings";

/** 设置结构版本（用于后续迁移） */
export const SETTINGS_VERSION = 1;

/** 特效参数范围（0-100 百分比） */
export const EFFECT_PARAM_RANGE = { min: 0, max: 100, step: 1 } as const;

/** 可用音乐字体（OSMD 内置 VexFlow 支持的子集） */
export const MUSIC_FONTS = [
  { value: "bravura", label: "Bravura" },
  { value: "petaluma", label: "Petaluma" },
  { value: "gonville", label: "Gonville" },
] as const;

/** 可用背景样式 */
export const BACKGROUND_STYLES = [
  { value: "theme", label: "scoreScroll.appearance.backgroundTheme" },
  { value: "paper", label: "scoreScroll.appearance.backgroundPaper" },
  { value: "black", label: "scoreScroll.appearance.backgroundBlack" },
  { value: "gradient", label: "scoreScroll.appearance.backgroundGradient" },
] as const;

/** 默认设置（特效参数对齐原站默认 50%） */
export const defaultScoreScrollSettings: ScoreScrollSettings = {
  effects: {
    driftInDistance: 50,
    scatterRange: 50,
    fragmentDelay: 50,
    highlightRange: 50,
    highlightIntensity: 50,
    highlightSize: 50,
    scanlinePosition: 50,
    snapPosition: 50,
  },
  appearance: {
    musicFont: "bravura",
    background: "theme",
  },
};

/** 音符命中匹配的时间容差（拍） */
export const NOTE_MATCH_TOLERANCE_BEATS = 0.5;
