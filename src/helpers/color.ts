interface RGBColor {
  r: number;
  g: number;
  b: number;
}

/**
 * 将十六进制颜色字符串转换为 RGB 对象，各通道值为 0-1 浮点数
 * 支持 "#RGB"、"#RRGGBB"、"RGB"、"RRGGBB" 格式
 * @param color - 十六进制颜色字符串
 * @returns RGB 颜色对象，各通道值为 0-1
 */
export function colorHexToRGB(color: string): RGBColor {
  if (typeof color !== "string") return colorHexToRGB("000000");
  if (color.startsWith("#")) {
    return colorHexToRGB(color.substring(1));
  }
  if (color.length === 3) {
    return colorHexToRGB(
      `${color.substring(0, 1).repeat(2)}${color.substring(1, 2).repeat(2)}${color
        .substring(2, 3)
        .repeat(2)}`,
    );
  }
  if (color.length === 6) {
    return {
      r: Math.min(255, parseInt(color.substring(0, 2), 16)) / 255,
      g: Math.min(255, parseInt(color.substring(2, 4), 16)) / 255,
      b: Math.min(255, parseInt(color.substring(4, 6), 16)) / 255,
    };
  }
  return colorHexToRGB("000000");
}

/**
 * 将 RGB 对象转换为十六进制颜色字符串，输入各通道值为 0-1 浮点数
 * @param rgb - RGB 颜色对象，各通道值为 0-1
 * @returns 十六进制颜色字符串（如 "#ff0000"）
 */
export function colorRGBToHex(rgb: RGBColor): string {
  return `#${(
    (1 << 24) |
    ((rgb.r * 255) << 16) |
    ((rgb.g * 255) << 8) |
    (rgb.b * 255)
  )
    .toString(16)
    .slice(1)}`;
}

/**
 * 计算颜色的相对亮度（基于 WCAG 2.0 标准的 sRGB 亮度公式）
 * @param color - 十六进制颜色字符串
 * @returns 相对亮度值（0-1）
 */
function getLuminance(color: string) {
  function normalize(value: number) {
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }
  const { r, g, b } = colorHexToRGB(color);

  return 0.2126 * normalize(r) + 0.7152 * normalize(g) + 0.0722 * normalize(b);
}

/**
 * 根据背景色亮度返回合适的对比色（深色或浅色），用于保证文字可读性
 * @param color - 背景色的十六进制字符串
 * @param darkColor - 亮背景时使用的深色，默认 "#000000"
 * @param lightColor - 暗背景时使用的浅色，默认 "#ffffff"
 * @returns 对比色的十六进制字符串
 */
export function getContrastColor(
  color: string,
  darkColor = "#000000",
  lightColor = "#ffffff",
) {
  return getLuminance(color) < getLuminance("808080") ? lightColor : darkColor;
}

/**
 * 按比例混合两种颜色
 * @param colorA - 起始颜色的十六进制字符串
 * @param colorB - 目标颜色的十六进制字符串
 * @param factor - 混合比例，0 返回 colorA，1 返回 colorB，默认 0.5
 * @returns 混合后颜色的十六进制字符串
 */
export function mixColor(colorA: string, colorB: string, factor = 0.5) {
  const a = colorHexToRGB(colorA);
  const b = colorHexToRGB(colorB);

  if (factor <= 0) {
    return colorA;
  }
  if (factor >= 1) {
    return colorB;
  }

  const c = {
    r: a.r * (1 - factor) + b.r * factor,
    g: a.g * (1 - factor) + b.g * factor,
    b: a.b * (1 - factor) + b.b * factor,
  };

  return colorRGBToHex(c);
}
