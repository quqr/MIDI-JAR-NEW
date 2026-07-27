/**
 * 钢琴主题预设 — 三套统一视觉语言的主题色板
 *
 * 每套主题定义了键体、边框、高亮、标签、主音点等全套颜色 token，
 * 渲染器根据主题自动选择对应色板，实现一键切换整体外观。
 */

/** 可选的钢琴主题标识 */
export type PianoTheme = "coral" | "indigo" | "midnight";

/** 主题色板 — 渲染器消费的完整颜色集合 */
export interface PianoThemeColors {
  /** 白键基色 */
  whiteKeyColor: string;
  /** 黑键基色 */
  blackKeyColor: string;
  /** 按下键高亮色（用于半透明叠加） */
  pressedKeyColor: string;
  /** 键体边框色 */
  keyBorderColor: string;
  /** 命中分隔线颜色 */
  separatorColor: string;
  /** 白键标签文字色 */
  labelColor: string;
  /** 黑键标签文字色 */
  blackLabelColor: string;
  /** 主音(C)圆点颜色 */
  tonicDotColor: string;
  /** 按下键叠加透明度 (0-1) */
  pressedOverlayAlpha: number;
  /** 白键渐变顶部提亮比例 */
  whiteGradientLight: number;
  /** 白键渐变底部压暗比例 */
  whiteGradientDark: number;
  /** 黑键渐变顶部提亮比例 */
  blackGradientLight: number;
  /** 黑键渐变底部压暗比例 */
  blackGradientDark: number;
}

/**
 * 三套主题色板定义
 *
 * 设计原则：
 * - 扁平化为主，渐变仅做极微妙的明暗变化以暗示键体深度
 * - 按下键采用半透明叠加 + 顶部高光带，而非纯色填充
 * - 标签使用柔和的中性色，保证可读性不抢眼
 * - 主音点使用主题色的低饱和度变体
 * - 边框色与白键基色保持微妙色相差异，营造精致分离感
 */
export const PIANO_THEMES: Record<PianoTheme, PianoThemeColors> = {
  // ── Coral：暖色调，参考图片中的珊瑚粉高亮 ──
  // 暖白键体 + 深棕黑键 + 珊瑚红高亮，柔和温馨
  coral: {
    whiteKeyColor: "#FBF8F3",
    blackKeyColor: "#2B2020",
    pressedKeyColor: "#FF5C5C",
    keyBorderColor: "#EBE0D6",
    separatorColor: "#FFC4B0",
    labelColor: "#6A5A52",
    blackLabelColor: "rgba(255, 232, 225, 0.88)",
    tonicDotColor: "#E8A598",
    pressedOverlayAlpha: 0.7,
    whiteGradientLight: 0.018,
    whiteGradientDark: 0.035,
    blackGradientLight: 0.07,
    blackGradientDark: 0.025,
  },
  // ── Indigo：冷色调，专业现代 ──
  // 冷白键体 + 深蓝黑键 + 靛蓝高亮，干净利落
  indigo: {
    whiteKeyColor: "#F6F8FB",
    blackKeyColor: "#131428",
    pressedKeyColor: "#5B5EF5",
    keyBorderColor: "#CFD5E4",
    separatorColor: "#A8B5FD",
    labelColor: "#46506A",
    blackLabelColor: "rgba(225, 232, 255, 0.9)",
    tonicDotColor: "#7C87F6",
    pressedOverlayAlpha: 0.7,
    whiteGradientLight: 0.018,
    whiteGradientDark: 0.03,
    blackGradientLight: 0.08,
    blackGradientDark: 0.022,
  },
  // ── Midnight：暗色调，优雅深邃 ──
  // 蓝灰白键体 + 纯黑黑键 + 紫罗兰高亮，神秘高贵
  midnight: {
    whiteKeyColor: "#E9EBF4",
    blackKeyColor: "#08080F",
    pressedKeyColor: "#8B4FE8",
    keyBorderColor: "#383A52",
    separatorColor: "#C6C8E4",
    labelColor: "#8A8AAA",
    blackLabelColor: "rgba(218, 224, 255, 0.85)",
    tonicDotColor: "#A88BFA",
    pressedOverlayAlpha: 0.7,
    whiteGradientLight: 0.022,
    whiteGradientDark: 0.045,
    blackGradientLight: 0.09,
    blackGradientDark: 0.03,
  },
};

/**
 * 获取指定主题的色板
 * @param theme - 主题标识
 * @returns 主题色板；若 theme 为 undefined 返回 null
 */
export function getThemeColors(
  theme: PianoTheme | undefined,
): PianoThemeColors | null {
  if (!theme) return null;
  return PIANO_THEMES[theme] ?? null;
}

/** 所有主题标识列表，用于 UI 选项生成 */
export const THEME_IDS: readonly PianoTheme[] = ["coral", "indigo", "midnight"];
