/**
 * 颜色工具函数模块：提供十六进制与 HSL 颜色到归一化 RGB 的转换
 *
 * 所有函数均为纯函数，无副作用，不依赖任何类状态。
 */

/**
 * 十六进制颜色字符串转归一化 RGB（各分量 0-1）
 * @param hex - 十六进制颜色（如 "#ff8800"）
 * @returns 归一化 RGB 对象，各分量范围为 0-1
 */
export function hexToRgbNorm(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "").padEnd(6, "0");
  return {
    r: (parseInt(normalized.slice(0, 2), 16) || 0) / 255,
    g: (parseInt(normalized.slice(2, 4), 16) || 0) / 255,
    b: (parseInt(normalized.slice(4, 6), 16) || 0) / 255,
  };
}

/**
 * HSL 颜色转归一化 RGB（各分量 0-1）
 * @param h - 色相，范围 0-1
 * @param s - 饱和度，范围 0-1
 * @param l - 亮度，范围 0-1
 * @returns 归一化 RGB 对象，各分量范围为 0-1
 */
export function hslToRgbNorm(
  h: number,
  s: number,
  l: number,
): { r: number; g: number; b: number } {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return { r: f(0), g: f(8), b: f(4) };
}
