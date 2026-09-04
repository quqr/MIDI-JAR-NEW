import type { ScoreScrollSettings } from "./types";

/** 设置持久化存储键 */
export const STORAGE_KEY = "midi-jar-score-scroll-settings";

/** 设置结构版本（用于后续迁移） */
export const SETTINGS_VERSION = 1;

/** 显示参数范围（0-100 百分比） */
export const DISPLAY_PARAM_RANGE = { min: 0, max: 100, step: 1 } as const;

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

/** 默认高光颜色（与视口 --color-primary 兜底值一致） */
export const DEFAULT_GLOW_COLOR = "#3b82f6";

/** 默认设置 */
export const defaultScoreScrollSettings: ScoreScrollSettings = {
  display: {
    scanlinePosition: 50,
    snapPosition: 50,
    showScanline: true,
    showReveal: true,
    flyInDistance: 50,
    flyInScatter: 50,
    flyInDelay: 50,
    flyInDuration: 50,
    glowRange: 50,
    glowIntensity: 50,
    glowSize: 50,
    showFlyIn: true,
    showGlow: true,
    glowColor: DEFAULT_GLOW_COLOR,
  },
  appearance: {
    musicFont: "bravura",
    background: "theme",
  },
};
