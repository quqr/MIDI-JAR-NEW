import { colord, extend } from "colord";
import harmoniesPlugin from "colord/plugins/harmonies";
import type { HarmonyType } from "colord/plugins/harmonies";
import mixPlugin from "colord/plugins/mix";

extend([harmoniesPlugin, mixPlugin]);

/**
 * 项目统一的颜色工具模块。
 *
 * 分层约定（详见 docs/adr/0015）：
 * - 引擎路径函数（供 PixiJS / WebGL / Canvas 消费）保持手写实现，不依赖 colord，
 *   保证行为逐位一致：colorHexToRGB / hexToRgba / lightenColor / darkenColor /
 *   hslToHex / hexToRgbNorm / hslToRgbNorm / interpolateHex；
 * - 仅 UI 面板侧功能使用 colord：harmonyColors（和谐色）、tints / shades（明暗阶）。
 *
 * 解析入口 parseColor 对脏值（"transparent"、rgba() 字符串、null 等）健壮容错。
 */

// ============================================================================
// 类型
// ============================================================================

/** 0-1 浮点 RGB（内部与着色器/渐变消费格式） */
interface RGBColor {
  r: number;
  g: number;
  b: number;
}

/** 0-255 整数 RGB */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** 0-1 归一化 RGB（着色器/粒子引擎消费格式） */
export interface RgbNorm {
  r: number;
  g: number;
  b: number;
}

/** 带透明度的解析结果（各通道 0-1 浮点） */
export interface ParsedColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** daisyUI 主题色 token 名（daisyUI 5 变量为 `--color-<name>`，值是 oklch） */
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

/** 和谐色方案名（UI 层；数学由 colord harmonies 插件完成） */
export type HarmonyName =
  | "complementary"
  | "analogous"
  | "triadic"
  | "splitComplementary"
  | "tetradic";

// ============================================================================
// 解析（脏值容忍层）
// ============================================================================

/**
 * 统一的颜色解析入口：把任意输入归一化为 0-1 RGBA。
 * 特判 "transparent"/空串为完全透明黑；hex（3/6/8 位）、rgb()/rgba()、hsl()/hsla()
 * 交由 colord 解析；无法解析返回 null（调用方自行兜底）。
 * @param input - 任意颜色字符串 / null / undefined
 * @returns 0-1 浮点 RGBA 对象；无法解析时 null
 */
export function parseColor(
  input: string | null | undefined,
): ParsedColor | null {
  if (input == null) return null;
  const s = input.trim().toLowerCase();
  if (s === "" || s === "transparent" || s === "none") {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  const c = colord(s);
  if (!c.isValid()) return null;
  const rgba = c.toRgb();
  return { r: rgba.r / 255, g: rgba.g / 255, b: rgba.b / 255, a: rgba.a };
}

/**
 * 判断是否为有效的十六进制颜色字符串（支持 #RRGGBB / #RRGGBBAA / 裸 6 位 / 裸 8 位）
 * @param hex - 待检测的字符串
 * @returns 是否为有效十六进制颜色
 */
export function isValidHexColor(hex: string): boolean {
  return /^#?([a-f\d]{6}|[a-f\d]{8})$/i.test(hex);
}

// ============================================================================
// 十六进制 ↔ RGB 基础转换（引擎路径，手写实现）
// ============================================================================

/**
 * 将十六进制颜色字符串转换为 RGB 对象，各通道值为 0-1 浮点数
 * 支持 "#RGB"、"#RRGGBB"、"#RRGGBBAA"、"RGB"、"RRGGBB" 格式
 * @param color - 十六进制颜色字符串
 * @returns RGB 颜色对象，各通道值为 0-1（非法输入回退黑色）
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
  if (color.length === 8) {
    // 8 位格式取前 6 位，忽略 alpha 通道
    return colorHexToRGB(color.substring(0, 6));
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

/** 0-1 浮点 RGB → hex（位运算截断，历史实现；lighten/darken 依赖其行为不变） */
function rgb01ToHex(rgb: RGBColor): string {
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
 * 0-255 整数 RGB → hex（四舍五入 + 钳制）
 * @param r - 红通道（0-255）
 * @param g - 绿通道（0-255）
 * @param b - 蓝通道（0-255）
 * @returns 小写 hex 字符串（如 "#ff8800"）
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    "#" + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")
  );
}

/**
 * hex → 0-255 整数 RGB；非法输入返回 null。
 * 接受 6 位与 8 位（#rrggbbaa 的 alpha 部分被忽略）。
 * @param hex - 十六进制颜色字符串
 * @returns RGB 对象（0-255），解析失败时 null
 */
export function hexToRgb(hex: string): Rgb | null {
  const result =
    /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})(?:[a-f\d]{2})?$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * 把任意颜色归一化为 6 位 `#rrggbb`（丢弃 alpha）。
 * 供不支持 8 位 hex 的消费方使用（如 three.js 的 Color，实测 `#rrggbbaa`
 * 会被解析成白色）。
 * @param color - CSS 颜色字符串（hex / rgb() / hsl() 等）
 * @returns 6 位小写 hex；无法解析时原样返回
 */
export function toHex6(color: string): string {
  const hex = cssColorToHex(color);
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHex(rgb.r, rgb.g, rgb.b) : color;
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
 * 在两个十六进制颜色之间进行线性插值（非法输入按黑色处理）
 * @param low - 起始颜色（十六进制）
 * @param high - 结束颜色（十六进制）
 * @param t - 插值因子，0 返回 low，1 返回 high
 * @returns 插值后的十六进制颜色
 */
export function interpolateHex(low: string, high: string, t: number): string {
  const c1 = hexToRgb(low) ?? { r: 0, g: 0, b: 0 };
  const c2 = hexToRgb(high) ?? { r: 0, g: 0, b: 0 };
  const tClamped = Math.max(0, Math.min(1, t));
  const lerp = (a: number, b: number) => a + (b - a) * tClamped;
  return rgbToHex(lerp(c1.r, c2.r), lerp(c1.g, c2.g), lerp(c1.b, c2.b));
}

// ============================================================================
// 色彩空间转换（引擎路径，手写实现）
// ============================================================================

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
 * 十六进制颜色字符串转归一化 RGB（各分量 0-1）
 * 注意与 hslToHex 的量纲不同：此处 h 为 0-1。
 * @param hex - 十六进制颜色（如 "#ff8800"）
 * @returns 归一化 RGB 对象，各分量范围为 0-1
 */
export function hexToRgbNorm(hex: string): Rgb {
  const normalized = hex.replace("#", "").padEnd(6, "0");
  return {
    r: (parseInt(normalized.slice(0, 2), 16) || 0) / 255,
    g: (parseInt(normalized.slice(2, 4), 16) || 0) / 255,
    b: (parseInt(normalized.slice(4, 6), 16) || 0) / 255,
  };
}

/**
 * HSL 颜色转归一化 RGB（各分量 0-1）
 * 注意与 hslToHex 的量纲不同：此处 h/s/l 均为 0-1（着色器消费）。
 * @param h - 色相，范围 0-1
 * @param s - 饱和度，范围 0-1
 * @param l - 亮度，范围 0-1
 * @returns 归一化 RGB 对象，各分量范围为 0-1
 */
export function hslToRgbNorm(h: number, s: number, l: number): RgbNorm {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return { r: f(0), g: f(8), b: f(4) };
}

/**
 * 将 OKLCH 色值转换为十六进制（sRGB，含 gamma 校正——与浏览器渲染一致）
 * oklch(L, C, H) → oklab(L, a, b) → linear sRGB → gamma sRGB → #rrggbb
 * @param L - 亮度（0-1）
 * @param C - 彩度
 * @param H - 色相（0-360）
 * @returns 十六进制颜色字符串
 */
export function oklchToHex(L: number, C: number, H: number): string {
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
 * （8 位 hex 会丢弃 alpha 只取色值部分）
 * @param color - CSS 颜色字符串
 * @returns hex 字符串；无法解析时原样返回
 */
export function cssColorToHex(color: string): string {
  const hexMatch = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(color);
  if (hexMatch) return `#${hexMatch[1]}`;

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

// ============================================================================
// 亮度与明暗判定
// ============================================================================

/**
 * 计算颜色的相对亮度（基于 WCAG 2.0 标准的 sRGB 亮度公式）
 * @param color - 十六进制颜色字符串
 * @returns 相对亮度值（0-1）
 */
export function getLuminance(color: string): number {
  const normalize = (value: number) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  const { r, g, b } = colorHexToRGB(color);

  return 0.2126 * normalize(r) + 0.7152 * normalize(g) + 0.0722 * normalize(b);
}

/**
 * 判断颜色是否为亮色（亮度 ≥ 0.5），用于决定其上叠加图标/文字用黑还是白
 * @param hex - 十六进制颜色字符串
 * @returns 是否为亮色
 */
export function isLightColor(hex: string): boolean {
  return getLuminance(hex) >= 0.5;
}

// ============================================================================
// 明暗调整（引擎路径，公式保持不变）
// ============================================================================

/**
 * 按比例提亮颜色（向白色混合）
 * @param hex - 起始颜色的十六进制字符串
 * @param amount - 提亮比例（0-1），0 不变，1 为纯白
 * @returns 提亮后颜色的十六进制字符串
 */
export function lightenColor(hex: string, amount: number): string {
  const { r, g, b } = colorHexToRGB(hex);
  return rgb01ToHex({
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
  return rgb01ToHex({
    r: Math.max(0, r * (1 - amount)),
    g: Math.max(0, g * (1 - amount)),
    b: Math.max(0, b * (1 - amount)),
  });
}

// ============================================================================
// daisyUI 主题 token 解析
// ============================================================================

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

/** daisyUI token 缺省色兜底表（变量读取失败时使用） */
const DAISY_UI_DEFAULT_COLORS: Record<DaisyUIColorName, string> = {
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

function getDaisyUiDefaultColor(colorName: DaisyUIColorName): string {
  return DAISY_UI_DEFAULT_COLORS[colorName] || "#000000";
}

/**
 * 从 CSS 变量获取 daisyUI 主题色（转为 hex 格式，兼容 PixiJS Color 解析）
 * @param colorName - daisyUI token 名（如 "primary"）
 * @returns 十六进制色值；读取失败时返回该 token 的缺省色
 */
export function getDaisyUIColor(colorName: DaisyUIColorName): string {
  try {
    if (typeof document === "undefined") {
      return getDaisyUiDefaultColor(colorName);
    }
    const computedStyle = getComputedStyle(document.documentElement);
    const cssVar = `--color-${colorName}`;
    const color = computedStyle.getPropertyValue(cssVar).trim();
    if (!color) return getDaisyUiDefaultColor(colorName);
    return cssColorToHex(color);
  } catch {
    return getDaisyUiDefaultColor(colorName);
  }
}

// ============================================================================
// UI 面板侧功能（colord 驱动）
// ============================================================================

/** HarmonyName → colord harmonies 方案名 */
const HARMONY_SCHEMES: Record<HarmonyName, HarmonyType> = {
  complementary: "complementary",
  analogous: "analogous",
  triadic: "triadic",
  splitComplementary: "split-complementary",
  tetradic: "tetradic",
};

/**
 * 计算和谐色系（互补/邻近/三角/分裂互补/四角）
 * @param hex - 基准颜色（十六进制）
 * @param name - 和谐色方案名
 * @returns 小写 hex 数组（不含基准色自身）；基准色无效时返回空数组
 */
export function harmonyColors(hex: string, name: HarmonyName): string[] {
  const base = colord(hex);
  if (!base.isValid()) return [];
  const source = base.toHex();
  return base
    .harmonies(HARMONY_SCHEMES[name])
    .map((c) => c.toHex())
    .filter((h) => h !== source);
}

/**
 * 生成明色阶（向白色混合的阶梯）
 * @param hex - 基准颜色（十六进制）
 * @param count - 阶数（默认 9）
 * @returns 小写 hex 数组，从接近基准色到接近白色（不含基准色与纯白端点）
 */
export function tints(hex: string, count = 9): string[] {
  const base = colord(hex);
  if (!base.isValid()) return [];
  return Array.from(
    { length: count },
    (_, i) => base.mix("#ffffff", (i + 1) / (count + 1)).toHex() as string,
  );
}

/**
 * 生成暗色阶（向黑色混合的阶梯）
 * @param hex - 基准颜色（十六进制）
 * @param count - 阶数（默认 9）
 * @returns 小写 hex 数组，从接近基准色到接近黑色（不含基准色与纯黑端点）
 */
export function shades(hex: string, count = 9): string[] {
  const base = colord(hex);
  if (!base.isValid()) return [];
  return Array.from({ length: count }, (_, i) =>
    base.mix("#000000", (i + 1) / (count + 1)).toHex(),
  );
}

// ============================================================================
// 吸管（EyeDropper API）
// ============================================================================

/** 浏览器 EyeDropper API 结果（TS lib.dom 尚未收录，自行声明） */
interface EyeDropperResult {
  sRGBHex: string;
}

interface EyeDropperInstance {
  open(options?: { signal?: AbortSignal }): Promise<EyeDropperResult>;
}

declare global {
  interface Window {
    EyeDropper?: new () => EyeDropperInstance;
  }
}

/**
 * 是否支持屏幕吸管（Chromium 95+ / WebView2 支持；WebKit 不支持）
 */
export function isEyeDropperSupported(): boolean {
  return (
    typeof window !== "undefined" && typeof window.EyeDropper === "function"
  );
}

/**
 * 打开屏幕吸管拾取颜色
 * @returns 小写 hex 字符串；用户取消或环境不支持时返回 null
 */
export async function pickColorWithEyeDropper(): Promise<string | null> {
  if (!isEyeDropperSupported()) return null;
  try {
    const result = await new window.EyeDropper!().open();
    return result.sRGBHex.toLowerCase();
  } catch {
    // 用户按 ESC 取消拾取
    return null;
  }
}
