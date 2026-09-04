/**
 * 谱面 Canvas 渲染器（context 无关）
 *
 * 每帧把 PrimitiveIndex 中可见窗口内的图元绘制到给定 2D 上下文：
 * 图元矢量重绘（Path2D + fillText）保证任意缩放无损；扫描线与渐显
 * 作为绘制参数一并画入（导出画面自带播放指示，见 ADR 0010）。
 *
 * 播放动画（空间揭示带模型，见 ADR 0012；术语见 CONTEXT.md「飞入 /
 * 揭示边缘 / 符头高光」）：
 * - 揭示边缘 = 视口右缘内缩 FLY_IN_EDGE_MARGIN_PX css px（换算为世界
 *   内容 x）：边缘右侧图元不绘制；播放中视口连续右移，新内容依次在
 *   边缘处越过揭示线进入飞入带，视口内播放头右侧始终有预显示内容；
 * - 飞入：越过边缘后在「飞入带宽度」内按 cubic ease-out 平移 + 淡入，
 *   随机偏移由图元 seq 种子散列驱动（确定性、零内存）；
 *   五线谱线常驻直绘（完全跳过编排，作为静态背景框架始终绘制）；
 * - 高光：播放头 ±range 内的音符（ScoreNoteInfo，调用方保证按 x 升序）
 *   画径向渐变光斑垫底，亮度按 smoothstep 随距离衰减。
 *
 * context 无关：只依赖 Canvas2D 的最小方法子集（ScoreContext2D），
 * 同一绘制函数可运行在主线程 canvas、OffscreenCanvas 或大尺寸离屏
 * canvas（未来 PNG/MP4 导出即挂离屏 context 实现帧录制）。
 *
 * 变换约定（与原 DOM 方案一致）：
 *   屏幕 css px = pan + (contentOffset + 内容 x) × zoom
 * 背板 = css 尺寸 × dpr，setTransform 一次性组合 dpr × zoom。
 */

import type { ScoreNoteInfo } from "../types";
import type { PrimitiveIndex, ScorePrimitive } from "./primitives";

/** 渲染所需的最小 2D 上下文子集（CanvasRenderingContext2D 结构兼容） */
export type ScoreContext2D = Pick<
  CanvasRenderingContext2D,
  | "setTransform"
  | "clearRect"
  | "fill"
  | "stroke"
  | "fillText"
  | "fillRect"
  | "beginPath"
  | "moveTo"
  | "lineTo"
  | "fillStyle"
  | "strokeStyle"
  | "lineWidth"
  | "globalAlpha"
  | "font"
  | "textAlign"
  | "textBaseline"
  | "shadowBlur"
  | "shadowColor"
  | "save"
  | "restore"
  | "translate"
> & {
  createLinearGradient: CanvasRenderingContext2D["createLinearGradient"];
  createRadialGradient: CanvasRenderingContext2D["createRadialGradient"];
};

/** 视图状态（显示 px 坐标系） */
export interface ScoreViewState {
  /** 平移量（css px，无边界） */
  panX: number;
  panY: number;
  /** 显示缩放（0.01–50） */
  zoom: number;
  /** 首拍留白（未缩放内容 px，让首音符能对齐扫描线） */
  contentOffsetX: number;
  /** 谱面行垂直偏移（未缩放内容 px） */
  contentOffsetY: number;
}

export interface ScanlineDraw {
  /** 视口内水平位置（0-100 百分比） */
  positionPct: number;
  /** CSS 颜色原串（var 的 computed value，如 oklch(...) / #hex） */
  color: string;
}

export interface RevealDraw {
  positionPct: number;
  /** 调光基色（CSS 颜色原串） */
  color: string;
  /** 软边过渡宽度（css px） */
  softEdge: number;
}

/** 飞入参数（世界 px；调用方负责把 0-100 设置映射为具体值） */
export interface FlyInEffect {
  /**
   * 飞入带宽度（世界 px）：图元越过揭示边缘后在此宽度内完成飞入
   * （cubic ease-out）。揭示边缘由渲染器按视口右缘内缩
   * FLY_IN_EDGE_MARGIN_PX 自行换算，调用方只给带宽（ADR 0012）。
   */
  bandWidth: number;
  /** 横向飞入距离（自右向左，100% ≈ 800px） */
  distance: number;
  /** 纵向散落总幅（±scatter/2，100% ≈ ±200px） */
  scatter: number;
  /** 起步延迟（每个图元随机 0–delay 的额外起步距离，100% ≈ 600px） */
  delay: number;
}

/** 符头高光参数（世界 px；调用方负责把 0-100 设置映射为具体值） */
export interface GlowEffect {
  /** 作用半径（播放头两侧，超出不发光） */
  range: number;
  /** 峰值不透明度（0-1） */
  intensity: number;
  /** 单个光斑半径（世界 px） */
  size: number;
  /** 光斑颜色（#rrggbb hex） */
  color: string;
}

export interface ScoreFrameOptions {
  view: ScoreViewState;
  /** 画布 CSS 尺寸与设备像素比 */
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  scanline: ScanlineDraw | null;
  reveal: RevealDraw | null;
  /** 播放头在视口内的水平位置（0-100 百分比）；null = 未播放（飞入/高光禁用） */
  playheadPct: number | null;
  /** 飞入参数；showFlyIn 关闭时传 null */
  flyIn: FlyInEffect | null;
  /** 高光参数；showGlow 关闭时传 null */
  glow: GlowEffect | null;
  /** 按 x 升序排序的音符信息（高光定位用；可省略） */
  notes?: readonly ScoreNoteInfo[];
}

/** 可见窗口外扩边距（未缩放内容 px）：文本 bbox 估算误差 + 软边余量 */
const CULL_MARGIN_PX = 160;

/** 飞入：揭示边缘内缩（css px）——视口右缘往左多少距离为飞入开始线 */
const FLY_IN_EDGE_MARGIN_PX = 50;
/** 飞入：最小横向偏移（世界 px），保证随机值为 0 时仍有起步距离 */
const FLY_IN_MIN_OFFSET_PX = 50;
/** 飞入：带内动画图元上限，超出退化为纯 alpha 淡入（防极小缩放整谱入带卡顿） */
const MAX_FLY_IN_PRIMITIVES = 2500;

/**
 * 五线谱线判定（细长水平条）：线宽 ≤4px 且长度 ≥60px。
 * 谱线常驻直绘（ADR 0012）：完全跳过飞入编排——不 skip、不位移、
 * 不渐隐，作为静态背景框架始终绘制；
 * 加线（ledger line）短于 60px 不豁免，跟随音符飞入更自然。
 */
const STAFF_LINE_MAX_H = 4;
const STAFF_LINE_MIN_W = 60;

/** 五线谱线判定（细长水平条）：常驻直绘，跳过飞入编排 */
function isStaffLinePrimitive(p: ScorePrimitive): boolean {
  return p.w >= STAFF_LINE_MIN_W && p.h <= STAFF_LINE_MAX_H;
}

/** 空音符表（未传 notes 时的兜底，避免每帧分配） */
const EMPTY_NOTES: readonly ScoreNoteInfo[] = [];

/** 构造 canvas font 字符串（属性已做 normal 归一，缺省段直接省略） */
function fontString(p: Extract<ScorePrimitive, { kind: "text" }>): string {
  return `${p.fontStyle} ${p.fontWeight} ${p.fontSizePx}px ${p.fontFamily}`.trim();
}

/**
 * 整数种子散列 → [0, 1)。
 * 以图元文档序号 seq 为种子：零内存开销、每帧确定性一致（重绘无闪变），
 * 同一图元在任意缩放/窗口下的飞入轨迹恒定。
 */
export function hash01(seed: number): number {
  let h = (seed | 0) + 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** smoothstep 权重 r²(3-2r)：高光距离衰减曲线（r 截断到 [0,1]） */
export function smoothstep01(r: number): number {
  const c = r < 0 ? 0 : r > 1 ? 1 : r;
  return c * c * (3 - 2 * c);
}

/** "#rrggbb" → rgba(r,g,b,a)；非 6 位 hex 返回 null（调用方自行兜底） */
function hexToRgba(color: string, alpha: number): string | null {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  const v = parseInt(m[1] as string, 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${alpha})`;
}

/** 屏幕 css x → 内容世界 x（反解变换公式 屏幕 = pan + (offset + x) × zoom） */
function screenToContentX(screenX: number, view: ScoreViewState): number {
  return (screenX - view.panX) / view.zoom - view.contentOffsetX;
}

/**
 * x 升序 notes 中第一个 x ≥ target 的下标（二分）。
 * 调用方需保证 notes 已按 x 升序排序。
 */
function lowerBoundByX(notes: readonly ScoreNoteInfo[], target: number): number {
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((notes[mid] as ScoreNoteInfo).x < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * 高光光斑垫底：播放头 ±range 内的音符各画一个径向渐变软边光斑，
 * 亮度 = intensity × smoothstep(1 − |dx|/range)。绘制在图元之下。
 */
function drawGlowBlobs(
  ctx: ScoreContext2D,
  notes: readonly ScoreNoteInfo[],
  glow: GlowEffect,
  playheadX: number,
): void {
  // 从播放头左缘往前多留 64px：覆盖二分起点附近音符头外接框半宽的误差
  const start = lowerBoundByX(notes, playheadX - glow.range - 64);
  const rightLimit = playheadX + glow.range;
  for (let i = start; i < notes.length; i++) {
    const n = notes[i] as ScoreNoteInfo;
    if (n.x > rightLimit) break;
    const cx = n.x + n.width / 2;
    const r = 1 - Math.abs(cx - playheadX) / glow.range;
    if (r <= 0) continue;
    const a = glow.intensity * smoothstep01(r);
    if (a < 0.004) continue;
    const cy = n.y + n.height / 2;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glow.size);
    grad.addColorStop(0, hexToRgba(glow.color, a) ?? glow.color);
    grad.addColorStop(1, hexToRgba(glow.color, 0) ?? "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - glow.size, cy - glow.size, glow.size * 2, glow.size * 2);
  }
}

/**
 * 绘制一帧谱面。
 * 调用方负责画布尺寸管理（canvas.width = cssWidth × dpr）与重绘调度，
 * 本函数为纯绘制：不读 DOM、不分配对象，可运行在任意线程/上下文。
 */
export function drawScoreFrame(
  ctx: ScoreContext2D,
  index: PrimitiveIndex,
  opts: ScoreFrameOptions,
): void {
  const { view, cssWidth, cssHeight, dpr } = opts;
  const notes = opts.notes ?? EMPTY_NOTES;

  // 1) 清屏（css 像素坐标系）
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  // 2) 内容变换：屏幕 = dpr × (pan + (offset + x) × zoom)
  const zx = dpr * view.zoom;
  const ty = dpr * (view.panY + view.contentOffsetY * view.zoom);
  const tx = dpr * (view.panX + view.contentOffsetX * view.zoom);
  ctx.setTransform(zx, 0, 0, zx, tx, ty);

  // 3) 可见窗口（未缩放内容坐标）
  const x0 = (0 - view.panX) / view.zoom - view.contentOffsetX - CULL_MARGIN_PX;
  const x1 =
    (cssWidth - view.panX) / view.zoom - view.contentOffsetX + CULL_MARGIN_PX;

  // 4) 播放动画参数：激活条件 = 已加载乐谱（flyIn/glow 由调用方按
  //    是否有图元决定），不区分播放/暂停/idle——进度条即动画时间轴
  const flyIn = opts.flyIn;
  const glow = opts.glow;
  // 揭示边缘（世界内容坐标）= 视口右缘内缩 FLY_IN_EDGE_MARGIN_PX
  // （空间锚定，ADR 0012）：边缘右侧图元不绘制；播放中视口连续右移，
  // 新内容依次越过边缘进入飞入带
  const edgeX = flyIn
    ? screenToContentX(cssWidth - FLY_IN_EDGE_MARGIN_PX, view)
    : Number.POSITIVE_INFINITY;
  const band = flyIn ? Math.max(1, flyIn.bandWidth) : 1;
  const playheadX = glow
    ? screenToContentX((cssWidth * (opts.playheadPct as number)) / 100, view)
    : 0;

  // 5) 高光光斑垫底（画在图元之下，位于扫描线处的渐显 alpha≈0 区，不被调光压暗）
  if (glow && notes.length > 0 && glow.range > 0 && glow.size >= 1) {
    drawGlowBlobs(ctx, notes, glow, playheadX);
  }

  // 6) 飞入带图元预计数：超出上限时整帧退化为纯 alpha 淡入（不做逐图元平移）
  //    （谱线常驻直绘，不占动画预算）
  const items = index.items;
  const visible = index.queryVisible(x0, x1);
  let degraded = false;
  if (flyIn) {
    let inBand = 0;
    for (let k = 0; k < visible.length; k++) {
      const p = items[visible[k] as number];
      if (isStaffLinePrimitive(p)) continue;
      const distInside = edgeX - p.x;
      if (distInside > 0 && distInside < band + flyIn.delay) {
        if (++inBand > MAX_FLY_IN_PRIMITIVES) {
          degraded = true;
          break;
        }
      }
    }
  }

  // 7) 裁剪绘制（文档序 = seq 升序，保持 SVG 遮挡关系；含飞入编排）
  let lastAlpha = 1;
  let lastFill = "";
  let lastStroke = "";
  let lastFont = "";
  let lastAlign = "";
  for (let k = 0; k < visible.length; k++) {
    const p = items[visible[k] as number];

    // —— 飞入编排：边缘右侧未揭示；带内按 cubic ease-out 平移 + 淡入 ——
    // （五线谱线常驻直绘 ADR 0012：完全跳过编排——不 skip、不位移、
    //   不渐隐，恒为完成态直接绘制）
    let ease = 1;
    let ox = 0;
    let oy = 0;
    if (flyIn && !isStaffLinePrimitive(p)) {
      const distInside = edgeX - p.x;
      if (distInside <= 0) continue;
      // 距离远超「带宽 + 最大延迟」的图元必然已完成飞入，跳过散列计算
      if (distInside < band + flyIn.delay) {
        const raw = (distInside - hash01(p.seq) * flyIn.delay) / band;
        if (raw <= 0) continue; // 仍在自身延迟区，尚未起步
        if (raw < 1) {
          ease = 1 - (1 - raw) ** 3;
          if (!degraded) {
            // 起点在揭示边缘右侧：横向 rand×distance + 50px，纵向 ±scatter/2
            ox =
              (hash01(p.seq + 0x27d4eb2f) * flyIn.distance +
                FLY_IN_MIN_OFFSET_PX) *
              (1 - ease);
            oy =
              (hash01(p.seq + 0x1b873593) - 0.5) * flyIn.scatter * (1 - ease);
          }
        }
      }
    }

    const alpha = p.opacity * ease;
    const translated = ox !== 0 || oy !== 0;

    if (p.kind === "path") {
      if (alpha !== lastAlpha) {
        ctx.globalAlpha = alpha;
        lastAlpha = alpha;
      }
      if (translated) {
        ctx.save();
        ctx.translate(ox, oy);
      }
      if (p.fill) {
        if (p.fill !== lastFill) {
          ctx.fillStyle = p.fill;
          lastFill = p.fill;
        }
        ctx.fill(p.path);
      }
      if (p.stroke) {
        if (p.stroke !== lastStroke) {
          ctx.strokeStyle = p.stroke;
          lastStroke = p.stroke;
        }
        ctx.lineWidth = p.strokeWidth;
        ctx.stroke(p.path);
      }
      if (translated) {
        ctx.restore();
        lastAlpha = -1; // restore 还原了 globalAlpha，强制下个图元重设
      }
    } else {
      if (!p.fill) continue;
      if (alpha !== lastAlpha) {
        ctx.globalAlpha = alpha;
        lastAlpha = alpha;
      }
      if (translated) {
        ctx.save();
        ctx.translate(ox, oy);
      }
      const font = fontString(p);
      if (font !== lastFont) {
        ctx.font = font;
        lastFont = font;
      }
      if (p.fill !== lastFill) {
        ctx.fillStyle = p.fill;
        lastFill = p.fill;
      }
      if (p.textAlign !== lastAlign) {
        ctx.textAlign = p.textAlign;
        lastAlign = p.textAlign;
      }
      ctx.fillText(p.text, p.ax, p.ay);
      if (translated) {
        ctx.restore();
        lastAlpha = -1;
      }
    }
  }

  // 8) 屏幕空间 overlay：渐显 + 扫描线
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;

  if (opts.reveal) {
    const sx = (cssWidth * opts.reveal.positionPct) / 100;
    if (sx < cssWidth) {
      try {
        // color-mix 生成 82% 不透明基色（与原 CSS 方案同源），canvas 颜色解析器支持
        const solid = `color-mix(in oklab, ${opts.reveal.color} 82%, transparent)`;
        const grad = ctx.createLinearGradient(sx, 0, sx + opts.reveal.softEdge, 0);
        grad.addColorStop(0, "transparent");
        grad.addColorStop(1, solid);
        ctx.fillStyle = grad;
        ctx.fillRect(sx, 0, cssWidth - sx, cssHeight);
      } catch {
        // color-mix 不被 canvas 解析时降级：纯色 + 全局透明度（无软边）
        ctx.globalAlpha = 0.82;
        ctx.fillStyle = opts.reveal.color;
        ctx.fillRect(sx, 0, cssWidth - sx, cssHeight);
        ctx.globalAlpha = 1;
      }
    }
  }

  if (opts.scanline) {
    const sx = (cssWidth * opts.scanline.positionPct) / 100;
    ctx.strokeStyle = opts.scanline.color;
    ctx.lineWidth = 1;
    ctx.shadowBlur = 8;
    ctx.shadowColor = opts.scanline.color;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, cssHeight);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

/**
 * 计算画布背板尺寸是否需要调整。
 * 返回 null 表示尺寸未变（不触发 canvas.width 赋值——那会清空画布）。
 */
export function backingStoreSize(
  cssWidth: number,
  cssHeight: number,
  dpr: number,
  currentWidth: number,
  currentHeight: number,
): { width: number; height: number } | null {
  const w = Math.max(1, Math.round(cssWidth * dpr));
  const h = Math.max(1, Math.round(cssHeight * dpr));
  if (w === currentWidth && h === currentHeight) return null;
  return { width: w, height: h };
}
