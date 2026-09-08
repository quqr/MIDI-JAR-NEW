import { colord } from "colord";
import { isValidHexColor, parseColor, type HarmonyName } from "@/helpers/color";
import { loadFromStorage, saveToStorage } from "@/helpers/storage";

/**
 * ColorPicker 组件的专属类型、常量与助手（仿 rangeSlider.ts 范式）。
 * 通用颜色数学在 `@/helpers/color`，此处只放取色器 UI 自身的状态、
 * 色环/三角几何与最近使用色存取。
 */

/** 面板滑块模式 */
export type ColorMode = "rgb" | "hsv" | "hsl";

/** 和谐色方案名（数学在 helpers/color 的 harmonyColors 完成） */
export type { HarmonyName };

/** 面板内部状态：三角取色基于 HSV */
export interface HsvState {
  /** 色相 0-360 */
  h: number;
  /** 饱和度 0-1 */
  s: number;
  /** 明度 0-1 */
  v: number;
  /** 透明度 0-1 */
  a: number;
}

/**
 * hex → HSV 面板状态（非法输入得到全黑兜底）
 * @param hex - 十六进制颜色字符串
 * @returns HSV 状态（h 0-360，s/v/a 0-1）
 */
export function hexToHsv(hex: string): HsvState {
  const hsv = colord(hex).toHsv();
  // colord 的 HSV 量纲：h 0-360、s/v 0-100 → 统一为面板内部 0-1
  return { h: hsv.h, s: hsv.s / 100, v: hsv.v / 100, a: hsv.a };
}

/**
 * HSV 面板状态 → hex 字符串（按 alpha 模式决定 6/8 位输出）
 * @param state - HSV 状态
 * @param alpha - 是否启用透明度输出（true = 恒 8 位 #rrggbbaa）
 * @returns 小写 hex 字符串
 */
export function hsvToHex(state: HsvState, alpha: boolean): string {
  // colord 的 HSV 量纲：s/v 为 0-100（面板内部状态为 0-1，需换算）
  const c = colord({
    h: state.h,
    s: state.s * 100,
    v: state.v * 100,
    a: alpha ? state.a : 1,
  });
  const hex = c.toHex();
  if (alpha && hex.length === 7) return `${hex}ff`;
  return alpha ? hex : hex.slice(0, 7);
}

// ============================================================================
// 色环 + HSV 三角几何
// ============================================================================

export interface WheelPoint {
  x: number;
  y: number;
}

/**
 * 色相角 → 单位向量。角度约定与 CSS conic-gradient 一致：
 * 0° 指向正上方（12 点钟），顺时针递增。
 * @param hue - 色相 0-360
 * @returns 单位向量（y 向下为正，适配屏幕坐标系）
 */
export function hueVector(hue: number): WheelPoint {
  const rad = (hue * Math.PI) / 180;
  return { x: Math.sin(rad), y: -Math.cos(rad) };
}

/**
 * 指针相对圆心的偏移 → 色相（色环拾取）
 * @param dx - 相对圆心 x 偏移（右为正）
 * @param dy - 相对圆心 y 偏移（下为正）
 * @returns 色相 0-360
 */
export function offsetToHue(dx: number, dy: number): number {
  return ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
}

/**
 * 当前色相下的三角顶点（相对圆心的偏移）。
 * 纯色顶点 H 对齐色环指针角度，白 W / 黑 K 分列 +120° / +240°。
 * @param hue - 色相 0-360
 * @param radius - 三角外接圆半径（px）
 * @returns [H, W, K] 三个顶点坐标
 */
export function triangleVertices(
  hue: number,
  radius: number,
): [WheelPoint, WheelPoint, WheelPoint] {
  const h = hueVector(hue);
  const w = hueVector(hue + 120);
  const k = hueVector(hue + 240);
  return [
    { x: h.x * radius, y: h.y * radius },
    { x: w.x * radius, y: w.y * radius },
    { x: k.x * radius, y: k.y * radius },
  ];
}

/**
 * 点相对三角形的重心坐标（H, W, K 三顶点的系数，和恒为 1）
 */
export function barycentric(
  p: WheelPoint,
  [vh, vw, vk]: [WheelPoint, WheelPoint, WheelPoint],
): { hc: number; wc: number; kc: number } {
  const denom = (vw.y - vk.y) * (vh.x - vk.x) + (vk.x - vw.x) * (vh.y - vk.y);
  if (Math.abs(denom) < 1e-9) return { hc: 0, wc: 0, kc: 1 };
  const hc =
    ((vw.y - vk.y) * (p.x - vk.x) + (vk.x - vw.x) * (p.y - vk.y)) / denom;
  const wc =
    ((vk.y - vh.y) * (p.x - vk.x) + (vh.x - vk.x) * (p.y - vk.y)) / denom;
  return { hc, wc, kc: 1 - hc - wc };
}

/**
 * 把点钳制到三角形内（最近点；段外落在顶点）
 * @param p - 任意点（相对圆心）
 * @param verts - 三角顶点
 * @returns 三角形内（含边界）的最近点
 */
export function clampToTriangle(
  p: WheelPoint,
  verts: [WheelPoint, WheelPoint, WheelPoint],
): WheelPoint {
  const [a, b, c] = verts;
  const closestOnSeg = (
    pt: WheelPoint,
    pa: WheelPoint,
    pb: WheelPoint,
  ): WheelPoint => {
    const abx = pb.x - pa.x;
    const aby = pb.y - pa.y;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((pt.x - pa.x) * abx + (pt.y - pa.y) * aby) / (abx * abx + aby * aby),
      ),
    );
    return { x: pa.x + abx * t, y: pa.y + aby * t };
  };
  // 已在内部则原样返回（容差覆盖落在边上的 FP 噪声）
  const { hc, wc, kc } = barycentric(p, verts);
  if (hc >= -1e-9 && wc >= -1e-9 && kc >= -1e-9) return { x: p.x, y: p.y };
  // 逐边求最近点取距离最小者
  const candidates = [
    closestOnSeg(p, a, b),
    closestOnSeg(p, b, c),
    closestOnSeg(p, c, a),
  ];
  let best = candidates[0];
  let bestD = Infinity;
  for (const q of candidates) {
    const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
}

/**
 * 三角形内一点 → HSV 的 (s, v)。
 * 映射关系：hc = v·s（纯色分量）、wc = v·(1-s)（白色分量）、kc = 1-v（黑色分量）。
 * @param p - 三角形内的点（相对圆心，已钳制在三角形内）
 * @param verts - 三角顶点
 * @returns s/v ∈ 0-1
 */
export function pointToSv(
  p: WheelPoint,
  verts: [WheelPoint, WheelPoint, WheelPoint],
): { s: number; v: number } {
  const { hc, wc } = barycentric(p, verts);
  const cH = Math.max(0, hc);
  const cW = Math.max(0, wc);
  const sum = cH + cW;
  return { s: sum > 1e-6 ? cH / sum : 0, v: Math.max(0, Math.min(1, sum)) };
}

/**
 * HSV 的 (s, v) → 三角形内的点（相对圆心）
 * @param s - 饱和度 0-1
 * @param v - 明度 0-1
 * @param verts - 三角顶点
 * @returns 点坐标
 */
export function svToPoint(
  s: number,
  v: number,
  verts: [WheelPoint, WheelPoint, WheelPoint],
): WheelPoint {
  const hc = v * s;
  const wc = v * (1 - s);
  const kc = 1 - v;
  const [vh, vw, vk] = verts;
  return {
    x: hc * vh.x + wc * vw.x + kc * vk.x,
    y: hc * vh.y + wc * vw.y + kc * vk.y,
  };
}

/**
 * 把 HSV 三角渲染到画布（色相变化时调用）。
 * 每像素求重心坐标：hc·纯色 + wc·白（kc·黑不贡献通道值）。
 * @param canvas - 目标画布（内部按 2x DPR 渲染）
 * @param hue - 当前色相 0-360
 * @param cssSize - 画布 CSS 尺寸（正方形，px）
 * @param radius - 三角外接圆半径（px，相对画布中心）
 */
export function drawHsvTriangle(
  canvas: HTMLCanvasElement,
  hue: number,
  cssSize: number,
  radius: number,
): void {
  const dpr = 2;
  canvas.width = cssSize * dpr;
  canvas.height = cssSize * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = ctx.createImageData(canvas.width, canvas.height);
  const data = img.data;
  const half = cssSize / 2;
  const local = triangleVertices(hue, radius).map((p) => ({
    x: p.x + half,
    y: p.y + half,
  })) as [WheelPoint, WheelPoint, WheelPoint];
  const hueRgb = parseColor(hsvToHex({ h: hue, s: 1, v: 1, a: 1 }, false)) ?? {
    r: 0,
    g: 0,
    b: 0,
    a: 1,
  };
  for (let py = 0; py < canvas.height; py++) {
    for (let px = 0; px < canvas.width; px++) {
      const { hc, wc, kc } = barycentric({ x: px / dpr, y: py / dpr }, local);
      const i = (py * canvas.width + px) * 4;
      if (hc >= -1e-4 && wc >= -1e-4 && kc >= -1e-4) {
        data[i] = Math.round(Math.min(1, hc * hueRgb.r + wc) * 255);
        data[i + 1] = Math.round(Math.min(1, hc * hueRgb.g + wc) * 255);
        data[i + 2] = Math.round(Math.min(1, hc * hueRgb.b + wc) * 255);
        data[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ============================================================================
// 最近使用色（localStorage 全局持久化）
// ============================================================================

export const RECENTS_KEY = "midi-jar-color-picker-recents";
export const RECENTS_MAX = 10;

/**
 * 读取最近使用色列表（坏数据自动回落为空数组）
 * @returns 小写 hex 字符串数组（最新在前）
 */
export function loadRecentColors(): string[] {
  const stored = loadFromStorage<string[]>({
    key: RECENTS_KEY,
    defaultValue: [],
  });
  return Array.isArray(stored)
    ? stored.filter((c) => typeof c === "string" && isValidHexColor(c))
    : [];
}

/**
 * 追加一条最近使用色：去重置顶 + 数量截断
 * @param recents - 当前列表
 * @param hex - 新颜色（小写 hex）
 * @returns 更新后的列表
 */
export function pushRecentColor(recents: string[], hex: string): string[] {
  return [hex, ...recents.filter((c) => c !== hex)].slice(0, RECENTS_MAX);
}

/**
 * 持久化最近使用色列表
 * @param recents - 小写 hex 字符串数组
 */
export function saveRecentColors(recents: string[]): void {
  saveToStorage(RECENTS_KEY, recents);
}
