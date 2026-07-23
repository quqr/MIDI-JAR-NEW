/**
 * 主题颜色工具
 * 用于从daisyUI获取主题颜色
 */

export type DaisyUIColorName =
  | "primary"
  | "secondary"
  | "accent"
  | "neutral"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "base-100"
  | "base-200"
  | "base-300"
  | "base-content";

/**
 * 从CSS变量获取daisyUI颜色
 */
export function getDaisyUIColor(colorName: DaisyUIColorName): string {
  try {
    if (typeof document === "undefined") {
      return getDefaultColor(colorName);
    }
    const computedStyle = getComputedStyle(document.documentElement);
    const cssVar = `--color-${colorName}`;
    const color = computedStyle.getPropertyValue(cssVar).trim();
    return color || getDefaultColor(colorName);
  } catch (error) {
    return getDefaultColor(colorName);
  }
}

/**
 * 获取默认颜色（后备方案）
 */
function getDefaultColor(colorName: DaisyUIColorName): string {
  const defaults: Record<DaisyUIColorName, string> = {
    primary: "#570df8",
    secondary: "#f000b5",
    accent: "#37cdbe",
    neutral: "#3d4451",
    success: "#36d399",
    warning: "#fcb716",
    error: "#f87272",
    info: "#3abff8",
    "base-100": "#ffffff",
    "base-200": "#f2f2f2",
    "base-300": "#e5e6e6",
    "base-content": "#1f2937",
  };
  return defaults[colorName] || "#000000";
}

/**
 * 创建顶部到底部的渐变
 */
export function createTopGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  _width: number,
  height: number,
  baseColor: string,
  intensity: number = 0.15,
): CanvasGradient {
  const gradient = ctx.createLinearGradient(x, y, x, y + height);

  // 解析基础颜色
  const rgb = hexToRgb(baseColor);
  if (!rgb) {
    gradient.addColorStop(0, baseColor);
    gradient.addColorStop(1, baseColor);
    return gradient;
  }

  // 创建更亮的顶部颜色
  const lighterR = Math.min(255, Math.floor(rgb.r * (1 + intensity)));
  const lighterG = Math.min(255, Math.floor(rgb.g * (1 + intensity)));
  const lighterB = Math.min(255, Math.floor(rgb.b * (1 + intensity)));

  gradient.addColorStop(0, `rgb(${lighterR}, ${lighterG}, ${lighterB})`);
  gradient.addColorStop(1, baseColor);

  return gradient;
}

/**
 * Hex转RGB辅助函数
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * 获取钢琴主题颜色集合
 */
export function getPianoThemeColors() {
  return {
    whiteKey: getDaisyUIColor("base-100"),
    blackKey: getDaisyUIColor("base-content"),
    pressedKey: getDaisyUIColor("primary"),
    sustainedKey: getDaisyUIColor("neutral"),
  };
}