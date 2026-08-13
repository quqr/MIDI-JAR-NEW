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

// ============================================================================
// CSS 变量与色彩空间转换
// ============================================================================

/**
 * 判断是否为有效的十六进制颜色字符串（支持 #RRGGBB 或 RRGGBB 格式）
 * @param hex - 待检测的字符串
 * @returns 是否为有效十六进制颜色
 */
export function isValidHexColor(hex: string): boolean {
  return /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.test(hex);
}

/**
 * 将 hex 色值转换为带 alpha 的 rgba 字符串
 * @param hex - 十六进制颜色字符串
 * @param alpha - 透明度（0-1）
 * @returns rgba 字符串；若 hex 无效则原样返回
 */
export function hexToRgba(hex: string, alpha: number): string {
  if (!isValidHexColor(hex)) return hex;
  const { r, g, b } = colorHexToRGB(hex);
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
}

/**
 * 按比例提亮颜色（向白色混合）
 * @param hex - 起始颜色的十六进制字符串
 * @param amount - 提亮比例（0-1），0 不变，1 为纯白
 * @returns 提亮后颜色的十六进制字符串
 */
export function lightenColor(hex: string, amount: number): string {
  const { r, g, b } = colorHexToRGB(hex);
  return colorRGBToHex({
    r: Math.min(1, r + (1 - r) * amount),
    g: Math.min(1, g + (1 - g) * amount),
    b: Math.min(1, b + (1 - b) * amount),
  });
}

/**
 * 按比例压暗颜色（向黑色混合）
 * @param hex - 起始颜色的十六进制字符串
 * @param amount - 压暗比例（0-1），0 不变，1 为纯黑
 * @returns 压暗后颜色的十六进制字符串
 */
export function darkenColor(hex: string, amount: number): string {
  const { r, g, b } = colorHexToRGB(hex);
  return colorRGBToHex({
    r: Math.max(0, r * (1 - amount)),
    g: Math.max(0, g * (1 - amount)),
    b: Math.max(0, b * (1 - amount)),
  });
}

/**
 * 将 HSL 色值转换为十六进制（sRGB）
 * @param h - 色相（0-360）
 * @param s - 饱和度（0-100）
 * @param l - 亮度（0-100）
 * @returns 十六进制颜色字符串
 */
export function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const a = sNorm * Math.min(lNorm, 1 - lNorm);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return lNorm - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return `#${clamp(f(0)).toString(16).padStart(2, "0")}${clamp(f(8)).toString(16).padStart(2, "0")}${clamp(f(4)).toString(16).padStart(2, "0")}`;
}

/**
 * 将 OKLCH 色值转换为十六进制（sRGB 近似）
 * @param l - 亮度（0-1）
 * @param c - 彩度
 * @param h - 色相（0-360）
 * @returns 十六进制颜色字符串
 */
export function oklchToHex(l: number, c: number, h: number): string {
  // OKLCH → OKLab
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);
  // OKLab → linear sRGB
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;
  const r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const b_ = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g).toString(16).padStart(2, "0")}${clamp(b_).toString(16).padStart(2, "0")}`;
}

/**
 * 读取 DaisyUI 主题的 CSS 变量并转换为十六进制色值。
 * 尝试通过临时元素让浏览器解析为 rgb；若失败则直接读取 CSS 变量值并尝试解析 oklch 或 hsl。
 * @param varName - CSS 变量名（如 "--p"）
 * @returns 十六进制色值（如 "#5700e6"），读取失败时返回 null
 */
export function readDaisyUiColor(varName: string): string | null {
  if (typeof document === "undefined") return null;
  // 方法1：通过临时元素让浏览器解析 CSS 变量为 rgb
  const el = document.createElement("div");
  el.style.color = `var(${varName})`;
  el.style.display = "none";
  document.body.appendChild(el);
  const computed = getComputedStyle(el).color;
  document.body.removeChild(el);
  const rgbMatch = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]);
    const g = parseInt(rgbMatch[2]);
    const b = parseInt(rgbMatch[3]);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }
  // 方法2：直接读取 CSS 变量值，尝试解析 oklch()
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  const oklchMatch = raw.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (oklchMatch) {
    return oklchToHex(
      parseFloat(oklchMatch[1]),
      parseFloat(oklchMatch[2]),
      parseFloat(oklchMatch[3]),
    );
  }
  // 方法3：尝试解析 hsl() 格式
  const hslMatch = raw.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%?\s+([\d.]+)%?/);
  if (hslMatch) {
    return hslToHex(
      parseFloat(hslMatch[1]),
      parseFloat(hslMatch[2]),
      parseFloat(hslMatch[3]),
    );
  }
  return null;
}
