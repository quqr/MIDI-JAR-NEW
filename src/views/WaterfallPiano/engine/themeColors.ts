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
 * oklch 转 sRGB hex
 * oklch(L, C, H) → oklab(L, a, b) → linear sRGB → sRGB → #rrggbb
 */
function oklchToHex(L: number, C: number, H: number): string {
  const a_ = C * Math.cos((H * Math.PI) / 180);
  const b_ = C * Math.sin((H * Math.PI) / 180);

  // oklab → linear sRGB (inverse of the oklab forward matrix)
  const l_ = L + 0.3963377774 * a_ + 0.2158037573 * b_;
  const m_ = L - 0.1055613458 * a_ - 0.0638541728 * b_;
  const s_ = L - 0.0894841775 * a_ - 1.291485548 * b_;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  const rL = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const gL = -1.2684380046 * l3 + 2.6097575279 * m3 - 0.3413193965 * s3;
  const bL = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  // linear sRGB → gamma sRGB
  const srgbGamma = (c: number): number => {
    const v = Math.max(0, Math.min(1, c));
    return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  };

  const r = Math.round(srgbGamma(rL) * 255);
  const g = Math.round(srgbGamma(gL) * 255);
  const b = Math.round(srgbGamma(bL) * 255);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * 将任意 CSS 颜色字符串（hex, rgb, oklch, hsl 等）转为 #rrggbb 格式
 */
export function cssColorToHex(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;

  // oklch 格式解析：oklch(L% C H) 或 oklch(L C H)
  const oklchMatch = color.match(
    /^oklch\(\s*([\d.]+)%?\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s*\)$/,
  );
  if (oklchMatch) {
    const L = parseFloat(oklchMatch[1]) / (color.includes("%") ? 100 : 1);
    const C = parseFloat(oklchMatch[2]);
    const H = parseFloat(oklchMatch[3]);
    return oklchToHex(L, C, H);
  }

  // rgb/rgba 格式
  const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, "0");
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, "0");
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }

  // hsl 格式
  const hslMatch = color.match(
    /hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?/,
  );
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]) / 360;
    const s = parseFloat(hslMatch[2]) / 100;
    const l = parseFloat(hslMatch[3]) / 100;
    // HSL → sRGB
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
    const g = Math.round(hue2rgb(p, q, h) * 255);
    const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  // 兜底：尝试 DOM 元素解析
  if (typeof document !== "undefined") {
    const el = document.createElement("div");
    el.style.color = color;
    document.body.appendChild(el);
    const computed = getComputedStyle(el).color;
    document.body.removeChild(el);
    const m = computed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) {
      const r = parseInt(m[1]).toString(16).padStart(2, "0");
      const g = parseInt(m[2]).toString(16).padStart(2, "0");
      const b = parseInt(m[3]).toString(16).padStart(2, "0");
      return `#${r}${g}${b}`;
    }
  }

  return color;
}

/**
 * 从CSS变量获取daisyUI颜色（转为 hex 格式，兼容 PixiJS Color 解析）
 */
export function getDaisyUIColor(colorName: DaisyUIColorName): string {
  try {
    if (typeof document === "undefined") {
      return getDefaultColor(colorName);
    }
    const computedStyle = getComputedStyle(document.documentElement);
    const cssVar = `--color-${colorName}`;
    const color = computedStyle.getPropertyValue(cssVar).trim();
    if (!color) return getDefaultColor(colorName);
    return cssColorToHex(color);
  } catch {
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
