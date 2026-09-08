import type { ScoreScrollSettings } from "./types";

/** 设置持久化存储键 */
export const STORAGE_KEY = "midi-jar-score-scroll-settings";

/** 设置结构版本（用于后续迁移） */
export const SETTINGS_VERSION = 1;

/** 显示参数范围（0-100 百分比） */
export const DISPLAY_PARAM_RANGE = { min: 0, max: 100, step: 1 } as const;

/**
 * 效果参数滑条范围（0-200）：飞入/飞出/高光作用范围等世界坐标量纲参数。
 * 100 档位保持原映射（如飞入带 100 ≈ 300px），200 即翻倍上限；
 * 百分比类参数（扫描线/谱面行位置、染色强度）仍用 DISPLAY_PARAM_RANGE。
 */
export const EFFECT_PARAM_RANGE = { min: 0, max: 200, step: 1 } as const;

/** 可用背景样式 */
export const BACKGROUND_STYLES = [
  { value: "theme", label: "scoreScroll.appearance.backgroundTheme" },
  { value: "paper", label: "scoreScroll.appearance.backgroundPaper" },
  { value: "custom", label: "scoreScroll.appearance.backgroundCustom" },
] as const;

/** 默认自定义背景色（承接旧「纯黑」选项的默认观感） */
export const DEFAULT_CUSTOM_BACKGROUND = "#000000";

/**
 * 播放尾部静默时长（秒）：时间轴在末音符结束后延长该时长，
 * 让扫描线完全越过乐谱末端（水平外推继续推进），导出视频同样包含。
 */
export const PLAYBACK_TAIL_SEC = 2;

/** 默认高光颜色（与视口 --color-primary 兜底值一致） */
export const DEFAULT_GLOW_COLOR = "#3b82f6";

/** 默认设置 */
export const defaultScoreScrollSettings: ScoreScrollSettings = {
  display: {
    scanlinePosition: 50,
    snapPosition: 50,
    showScanline: true,
    flyInDistance: 50,
    flyInScatter: 50,
    flyInDelay: 50,
    flyInDuration: 50,
    showFlyOut: true,
    flyOutDistance: 50,
    flyOutScatter: 50,
    flyOutDelay: 50,
    flyOutDuration: 50,
    glowRange: 50,
    glowIntensity: 50,
    showFlyIn: true,
    showGlow: true,
    tintColor: DEFAULT_GLOW_COLOR,
  },
  appearance: {
    background: "theme",
    customColor: DEFAULT_CUSTOM_BACKGROUND,
  },
};
