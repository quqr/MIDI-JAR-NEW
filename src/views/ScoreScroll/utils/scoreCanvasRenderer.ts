/**
 * 谱面 Canvas 渲染器（context 无关）
 *
 * 每帧把 PrimitiveIndex 中可见窗口内的图元绘制到给定 2D 上下文：
 * 图元矢量重绘（Path2D + fillText）保证任意缩放无损；扫描线与渐显
 * 作为绘制参数一并画入（导出画面自带播放指示，见 ADR 0010）。
 *
 * 播放动画（扫描线锚定飞入带，见 ADR 0012；术语见 CONTEXT.md「飞入 /
 * 飞入带 / 符头高光」）：
 * - 飞入带起始 = 扫描线的内容位置（随画布平移与播放推进同步变化）：
 *   带自扫描线向右延伸「带宽 + 延迟」，带远端之外图元未显现（不绘制）；
 *   音符在带内朝扫描线方向飞入，抵达扫描线即落位——动画始终发生在
 *   扫描线附近，拖画布与播放的表现一致；
 * - 飞入：按行进距离 cubic ease-out 平移 + 淡入，
 *   随机偏移由图元 seq 种子散列驱动（确定性、零内存）；
 *   五线谱线常驻直绘（完全跳过编排，作为静态背景框架始终绘制）；
 * - 高光：播放头 ±range 内的音符 fill/stroke 向染色色插值（smoothstep 衰减）。
 *
 * context 无关：只依赖 Canvas2D 的最小方法子集（ScoreContext2D），
 * 同一绘制函数可运行在主线程 canvas、OffscreenCanvas 或大尺寸离屏
 * canvas（未来 PNG/MP4 导出即挂离屏 context 实现帧录制）。
 *
 * 变换约定（与原 DOM 方案一致）：
 *   屏幕 css px = pan + (contentOffset + 内容 x) × zoom
 * 背板 = css 尺寸 × dpr，setTransform 一次性组合 dpr × zoom。
 */

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
  | "strokeRect"
  | "setLineDash"
>;

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

/**
 * 画布背景（屏幕空间绘制，位于图元之下）。
 * canvas 自含背景：导出画面自带底色；点阵为世界坐标网格——
 * 平移/缩放时随谱面移动（拖动点阵跟着走，ADR 0013 后的视觉反馈）。
 */
export interface BackgroundDraw {
  kind: "dots" | "solid";
  /** 底色（CSS 颜色原串） */
  base: string;
  /** 点阵点色（kind=dots 时必填） */
  dot?: string;
}

/** 飞入参数（世界 px；调用方负责把 0-100 设置映射为具体值） */
export interface FlyInEffect {
  /**
   * 飞入带起始（世界内容坐标 x）= 扫描线的内容位置：飞入带自扫描线
   * 向右延伸「带宽 + 延迟」，音符在此区间内朝扫描线方向飞入落位；
   * 远端之外未显现（不绘制）。边缘随画布平移/播放推进同步变化——
   * 动画始终发生在扫描线附近（ADR 0012 修订）。
   */
  bandEdgeX: number;
  /** 飞入带宽度（世界 px）：音符在带内完成飞入 */
  bandWidth: number;
  /** 横向飞入距离（自右向左，100% ≈ 800px） */
  distance: number;
  /** 纵向散落总幅（±scatter/2，100% ≈ ±200px） */
  scatter: number;
  /** 起步延迟（每个图元随机 0–delay 的额外起步距离，100% ≈ 600px） */
  delay: number;
}

/** 飞出参数（世界 px；调用方负责把 0-100 设置映射为具体值） */
export interface FlyOutEffect {
  /**
   * 飞出带起始（世界内容坐标 x）= 扫描线的内容位置：飞出带自扫描线
   * 向左延伸「带宽 + 延迟」，音符越过扫描线后在带内飞出淡出，
   * 越过带远端即完全消失（不绘制）。
   */
  bandEdgeX: number;
  /** 飞出带宽度（世界 px）：音符在带内完成飞出 */
  bandWidth: number;
  /** 横向飞出距离（向左，100% ≈ 800px） */
  distance: number;
  /** 纵向散落总幅（±scatter/2，100% ≈ ±200px） */
  scatter: number;
  /** 起步延迟（每个图元随机 0–delay 的额外距离，100% ≈ 600px） */
  delay: number;
}

/** 符头高光参数（世界 px；调用方负责把 0-100 设置映射为具体值） */
export interface GlowEffect {
  /**
   * 播放头世界坐标 x（未缩放内容 px，时间锚定）：
   * 由播放同步器逐帧给出（当前发声位置），与视口平移无关。
   */
  playheadX: number;
  /** 作用半径（播放头两侧，超出不染色） */
  range: number;
  /** 峰值强度（0-1）：染色最大插值比例 */
  intensity: number;
  /** 染色颜色（范围内音符 fill/stroke 插值目标，#rrggbb hex） */
  tint: string;
}

export interface ScoreFrameOptions {
  view: ScoreViewState;
  /** 画布 CSS 尺寸与设备像素比 */
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  /** 画布背景（底色 + 可选点阵）；null = 透明（调用方自行处理底色） */
  background: BackgroundDraw | null;
  scanline: ScanlineDraw | null;
  /** 飞入参数；showFlyIn 关闭时传 null */
  flyIn: FlyInEffect | null;
  /** 飞出参数；showFlyOut 关闭时传 null */
  flyOut: FlyOutEffect | null;
  /** 高光（染色）参数；showGlow 关闭时传 null */
  glow: GlowEffect | null;
}

/** 可见窗口外扩边距（未缩放内容 px）：文本 bbox 估算误差 + 软边余量 */
const CULL_MARGIN_PX = 160;

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

// ── 高光可染判定：仅符头（Notehead Tint） ──
// 图元由解析后与 ScoreNoteInfo 符头矩形几何匹配打标记（见 useOsmd.extractAll
// → markNoteheadPrimitives），未标记的谱线/符梁/加线/连线/文字一律不染——
// 否则大范围高光下整行谱面被染色，与「符头高光」语义不符。
function isGlowEligible(p: ScorePrimitive): boolean {
  return p.kind === "path" && p.notehead === true;
}

/** 点阵网格：世界坐标间距（未缩放内容 px） */
const DOT_GRID_SPACING_PX = 20;
/** 点阵 LOD：屏幕间距下限（低于此值网格升层，防止摩尔纹与点数爆炸） */
const DOT_MIN_SCREEN_SPACING_PX = 16;
/** 点大小（屏幕 css px，恒定不随缩放变化） */
const DOT_SIZE_PX = 1.2;
/** 点不透明度 */
const DOT_ALPHA = 0.16;

/**
 * 点阵网格（屏幕空间绘制，世界坐标对齐）：
 * 网格点吸附在世界坐标 step 的整数倍上——拖动/缩放时点阵随谱面移动、
 * 缩放时间距真实变化；屏幕间距低于下限时 k 倍升层（点密度重置，无摩尔纹）。
 * 点大小固定屏幕像素，不随缩放变化（Figma/Miro 同类画布的做法）。
 */
function drawDotGrid(
  ctx: ScoreContext2D,
  view: ScoreViewState,
  cssWidth: number,
  cssHeight: number,
  dotColor: string,
): void {
  const spacing = DOT_GRID_SPACING_PX * view.zoom;
  const k = Math.max(1, Math.ceil(DOT_MIN_SCREEN_SPACING_PX / spacing));
  const step = DOT_GRID_SPACING_PX * k; // 世界 px 步长（k 的整数倍）

  // 可见世界范围（反解变换：屏幕 = pan + (offset + 世界) × zoom）
  const wx0 = (0 - view.panX) / view.zoom - view.contentOffsetX;
  const wx1 = (cssWidth - view.panX) / view.zoom - view.contentOffsetX;
  const wy0 = (0 - view.panY) / view.zoom - view.contentOffsetY;
  const wy1 = (cssHeight - view.panY) / view.zoom - view.contentOffsetY;

  // ceil/floor：只画起笔落在画布内的点（边缘外 1.2px 点虽被裁剪也无谓）
  const i0 = Math.ceil(wx0 / step);
  const i1 = Math.floor(wx1 / step);
  const j0 = Math.ceil(wy0 / step);
  const j1 = Math.floor(wy1 / step);

  ctx.fillStyle = dotColor;
  ctx.globalAlpha = DOT_ALPHA;
  for (let ix = i0; ix <= i1; ix++) {
    const sx = view.panX + (view.contentOffsetX + ix * step) * view.zoom;
    for (let jy = j0; jy <= j1; jy++) {
      const sy = view.panY + (view.contentOffsetY + jy * step) * view.zoom;
      ctx.fillRect(sx, sy, DOT_SIZE_PX, DOT_SIZE_PX);
    }
  }
  ctx.globalAlpha = 1;
}

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

/** 屏幕 css x → 内容世界 x（反解变换公式 屏幕 = pan + (offset + x) × zoom） */
function screenToContentX(screenX: number, view: ScoreViewState): number {
  return (screenX - view.panX) / view.zoom - view.contentOffsetX;
}

// ── 高光染色（方案一）：播放头 ±range 内图元 fill/stroke 向高光色插值 ──

/** 染色插值量化档数：t 截断到档位后缓存混合色，避免每帧海量颜色字符串 */
const TINT_QUANT = 24;
/** 混合色缓存：key = 原 fill | 高光色 | 档位（fill 种类有限，命中率高） */
const tintCache = new Map<string, string>();
const TINT_CACHE_MAX = 2048;

/** "#rrggbb" / "#rrggbbaa" → [r, g, b]（alpha 忽略）；非 hex 返回 null */
function parseHex(color: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})(?:[0-9a-f]{2})?$/i.exec(
    color.trim(),
  );
  if (!m) return null;
  return [
    parseInt(m[1] as string, 16),
    parseInt(m[2] as string, 16),
    parseInt(m[3] as string, 16),
  ];
}

/**
 * 原色 → 高光色线性插值（t ∈ (0,1]，量化缓存）。
 * 任一端非 hex（理论不会发生——谱面色都是固定 hex）返回 null = 不染。
 */
function mixHexColors(
  base: string,
  highlight: string,
  t: number,
): string | null {
  if (t <= 0) return base;
  const pa = parseHex(base);
  if (!pa) return null; // 非 hex 基色一律不染（含 t=1 满强度）
  if (t >= 1) return highlight;
  const pb = parseHex(highlight);
  if (!pb) return null;
  const q = Math.round(t * TINT_QUANT);
  if (q <= 0) return base;
  const key = `${base}|${highlight}|${q}`;
  const hit = tintCache.get(key);
  if (hit !== undefined) return hit;
  const f = q / TINT_QUANT;
  const mixed = `rgb(${Math.round(pa[0] + (pb[0]! - pa[0]!) * f)},${Math.round(pa[1] + (pb[1]! - pa[1]!) * f)},${Math.round(pa[2] + (pb[2]! - pa[2]!) * f)})`;
  if (tintCache.size >= TINT_CACHE_MAX) tintCache.clear();
  tintCache.set(key, mixed);
  return mixed;
}

/** 单图元染色强度：intensity × smoothstep(1 − |图元中心 − 播放头| / range) */
function tintStrength(
  p: ScorePrimitive,
  glow: GlowEffect,
  playheadX: number,
): number {
  const dx = p.x + p.w / 2 - playheadX;
  const r = 1 - Math.abs(dx) / glow.range;
  if (r <= 0) return 0;
  return glow.intensity * smoothstep01(r);
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

  // 1) 清屏 + 背景（css 像素坐标系）：canvas 自含底色与点阵
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const bg = opts.background;
  if (bg) {
    ctx.fillStyle = bg.base;
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    if (bg.kind === "dots" && bg.dot) {
      drawDotGrid(ctx, view, cssWidth, cssHeight, bg.dot);
    }
  }

  // 2) 内容变换：屏幕 = dpr × (pan + (offset + x) × zoom)
  const zx = dpr * view.zoom;
  const ty = dpr * (view.panY + view.contentOffsetY * view.zoom);
  const tx = dpr * (view.panX + view.contentOffsetX * view.zoom);
  ctx.setTransform(zx, 0, 0, zx, tx, ty);

  // 3) 可见窗口（未缩放内容坐标）
  const x0 = (0 - view.panX) / view.zoom - view.contentOffsetX - CULL_MARGIN_PX;
  const x1 =
    (cssWidth - view.panX) / view.zoom - view.contentOffsetX + CULL_MARGIN_PX;

  // 4) 播放动画参数：激活条件 = 已加载乐谱（flyIn/flyOut/glow 由调用方按
  //    是否有图元决定），不区分播放/暂停/idle——进度条即动画时间轴
  const flyIn = opts.flyIn;
  const flyOut = opts.flyOut;
  const glow = opts.glow;
  // 扫描线的内容位置：飞入带（向右）与飞出带（向左）的公共起点，
  // 随画布平移与播放推进同步变化——音符始终在扫描线附近飞入/飞出
  const edgeX =
    flyIn || flyOut
      ? screenToContentX(
          (cssWidth * (opts.scanline?.positionPct ?? 50)) / 100,
          view,
        )
      : Number.POSITIVE_INFINITY;
  const band = flyIn ? Math.max(1, flyIn.bandWidth) : 1;
  const outBand = flyOut ? Math.max(1, flyOut.bandWidth) : 1;
  // 高光锚点 = 播放头世界坐标（时间锚定，由同步器逐帧给出，
  // 与视口平移/缩放无关——拖动画布不会改变"哪些音符在发声"）
  const playheadX = glow ? glow.playheadX : 0;

  // 6) 飞入/飞出带图元预计数：超出上限时整帧退化为纯 alpha 淡入（不做逐图元平移）
  //    （谱线常驻直绘，不占动画预算）
  const items = index.items;
  const visible = index.queryVisible(x0, x1);
  let degraded = false;
  if (flyIn || flyOut) {
    let inBand = 0;
    for (let k = 0; k < visible.length; k++) {
      const p = items[visible[k] as number];
      if (isStaffLinePrimitive(p)) continue;
      const dist = p.x - edgeX;
      const inFlyIn = flyIn && dist > 0 && dist < band + flyIn.delay;
      const inFlyOut = flyOut && dist < 0 && -dist < outBand + flyOut.delay;
      if (inFlyIn || inFlyOut) {
        if (++inBand > MAX_FLY_IN_PRIMITIVES) {
          degraded = true;
          break;
        }
      }
    }
  }

  // 7) 裁剪绘制（文档序 = seq 升序，保持 SVG 遮挡关系；含飞入/飞出编排）
  let lastAlpha = 1;
  let lastFill = "";
  let lastStroke = "";
  let lastFont = "";
  let lastAlign = "";
  for (let k = 0; k < visible.length; k++) {
    const p = items[visible[k] as number];

    // —— 飞入编排：飞入带自扫描线向右延伸「带宽 + 延迟」，带内音符朝
    //    扫描线方向飞入落位，抵达扫描线即完成；带远端之外未显现 ——
    // —— 飞出编排（镜像）：已播放音符越过扫描线后向左飞出淡出，
    //    越过飞出带远端即完全消失 ——
    // （五线谱线常驻直绘 ADR 0012：完全跳过编排——不 skip、不位移、
    //   不渐隐，恒为完成态直接绘制）
    let ease = 1;
    let ox = 0;
    let oy = 0;
    let skip = false;
    if (!isStaffLinePrimitive(p)) {
      const dist = p.x - edgeX; // 距扫描线的内容距离（右侧为正，未播放）
      if (flyIn) {
        if (dist > band + flyIn.delay) skip = true; // 飞入带远端之外：未显现
        else if (dist > 0) {
          // u：飞入进度，0 = 在远端起步，1 = 抵达扫描线落位
          const u = 1 - (dist - hash01(p.seq) * flyIn.delay) / band;
          if (u <= 0) skip = true; // 仍在自身延迟区，尚未起步
          else if (u < 1) {
            ease = 1 - (1 - u) ** 3;
            if (!degraded) {
              // 起点在扫描线右侧：横向 rand×distance + 50px，纵向 ±scatter/2
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
      if (flyOut && !skip) {
        const outDist = -dist; // 已越过扫描线的距离（左侧为正）
        if (outDist > outBand + flyOut.delay) skip = true; // 完全飞出
        else if (outDist > 0) {
          // raw：飞出进度，0 = 刚越过扫描线（原位），1 = 完全消失
          const raw =
            (outDist - hash01(p.seq + 0x9e3779b9) * flyOut.delay) / outBand;
          if (raw >= 1) skip = true;
          else if (raw > 0) {
            const flyE = 1 - (1 - raw) ** 3;
            ease = 1 - flyE;
            if (!degraded) {
              // 飞出方向与飞入相反：向左离场，纵向 ±scatter/2
              ox =
                -(
                  hash01(p.seq + 0x85ebca6b) * flyOut.distance +
                  FLY_IN_MIN_OFFSET_PX
                ) * flyE;
              oy = (hash01(p.seq + 0xc2b2ae35) - 0.5) * flyOut.scatter * flyE;
            }
          }
        }
      }
    }
    if (skip) continue;

    const alpha = p.opacity * ease;
    const translated = ox !== 0 || oy !== 0;

    // —— 高光染色（方案一）：播放头 ±range 内的音符类图元向高光色插值 ——
    // fill/stroke 皆为固定 hex（主题配色），量化缓存混合串，lastFill
    // 缓存机制自然兼容；非 hex 色降级为不染；文字图元无 stroke
    let fill = p.fill;
    let stroke = p.kind === "path" ? p.stroke : null;
    if (glow && glow.range > 0 && isGlowEligible(p)) {
      const t = tintStrength(p, glow, playheadX);
      if (t > 0) {
        if (fill) {
          const mixed = mixHexColors(fill, glow.tint, t);
          if (mixed) fill = mixed;
        }
        if (stroke) {
          const mixed = mixHexColors(stroke, glow.tint, t);
          if (mixed) stroke = mixed;
        }
      }
    }

    if (p.kind === "path") {
      if (alpha !== lastAlpha) {
        ctx.globalAlpha = alpha;
        lastAlpha = alpha;
      }
      if (translated) {
        ctx.save();
        ctx.translate(ox, oy);
      }
      if (fill) {
        if (fill !== lastFill) {
          ctx.fillStyle = fill;
          lastFill = fill;
        }
        ctx.fill(p.path);
      }
      if (stroke) {
        if (stroke !== lastStroke) {
          ctx.strokeStyle = stroke;
          lastStroke = stroke;
        }
        ctx.lineWidth = p.strokeWidth;
        ctx.stroke(p.path);
      }
      if (translated) {
        ctx.restore();
        // restore 还原了 save 后的全部状态，所有 JS 侧状态缓存同步失效，
        // 强制下个图元重设——否则过期颜色串残留会串染后续图元
        lastAlpha = -1;
        lastFill = "";
        lastStroke = "";
      }
    } else {
      if (!fill) continue;
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
      if (fill !== lastFill) {
        ctx.fillStyle = fill;
        lastFill = fill;
      }
      if (p.textAlign !== lastAlign) {
        ctx.textAlign = p.textAlign;
        lastAlign = p.textAlign;
      }
      ctx.fillText(p.text, p.ax, p.ay);
      if (translated) {
        ctx.restore();
        lastAlpha = -1;
        lastFill = "";
        lastFont = "";
        lastAlign = "";
      }
    }
  }

  // 8) 屏幕空间 overlay：扫描线
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;

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
