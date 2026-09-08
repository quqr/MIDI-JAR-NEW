/**
 * SVG → 图元缓存解析与可见性索引（Canvas 渲染方案的数据层）
 *
 * 职责：
 * 1. 解析 OSMD（内嵌 VexFlow 1.2 fork，Raphael 风格 SVGContext）输出的 SVG：
 *    path / text / rect / line / ellipse / circle / polygon / polyline / g，
 *    未知元素跳过并计数（探针已确认渲染路径不回查已摘除节点，见 ADR 0010）。
 * 2. 为每个图元计算内容坐标包围盒（自解析 path d 指令，A 弧按半径保守扩大），
 *    供每帧可见窗口裁剪。
 * 3. PrimitiveIndex：按 x 分桶的可见性索引，queryVisible 返回按文档序（seq）
 *    排列的图元下标，绘制顺序与 SVG 文档序一致，保证遮挡关系不变。
 *
 * 坐标约定：所有图元坐标为 OSMD SVG 的未缩放内容坐标（px @ OSMD zoom 1）。
 * Path2D 由浏览器原生解析（C++ 层，微秒级），本模块不自绘路径。
 */

/** 矢量路径图元（w < 0 表示包围盒不可信，恒参与绘制） */
export interface PathPrimitive {
  kind: "path";
  /** 文档序号（绘制顺序 = SVG 文档序） */
  seq: number;
  path: Path2D;
  /**
   * 原始 d 指令字符串（rect/line/ellipse/polygon 为合成等价轮廓）。
   * 三维乐谱挤出（ADR 0018）需要轮廓指令，Path2D 无法读回，故冗余保留。
   */
  d: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** null = 不填充（fill="none" 或未设置） */
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  opacity: number;
  /**
   * 符头标记：解析完成后与 ScoreNoteInfo 符头矩形几何匹配打上
   * （markNoteheadPrimitives），高光染色（Notehead Tint）仅对标记图元生效。
   */
  notehead?: boolean;
}

/** 文字图元（歌词/力度/指法/小节号/速度标记等 <text> 元素） */
export interface TextPrimitive {
  kind: "text";
  seq: number;
  /** 包围盒左上角（裁剪用，与 PathPrimitive 语义一致） */
  x: number;
  y: number;
  /** 基线锚点（SVG text 默认 alphabetic 基线，与 canvas 一致，fillText 用） */
  ax: number;
  ay: number;
  text: string;
  fill: string | null;
  fontSizePx: number;
  fontFamily: string;
  fontStyle: string;
  fontWeight: string;
  textAlign: "left" | "center" | "right";
  opacity: number;
  /** 估算包围盒尺寸（裁剪用途，粗值；w<0 = 不可信恒绘制） */
  w: number;
  h: number;
}

export type ScorePrimitive = PathPrimitive | TextPrimitive;

/** 解析统计（首次运行即得真实元素构成，日志输出） */
export interface ParseStats {
  paths: number;
  texts: number;
  rects: number;
  lines: number;
  ellipses: number;
  polys: number;
  groups: number;
  skipped: number;
}

export interface ParseResult {
  prims: ScorePrimitive[];
  stats: ParseStats;
  /** 解析过的顶层节点（调用方负责从 DOM 摘除） */
  nodes: Element[];
}

// ── path d 指令解析：计算保守包围盒 ──

interface BBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const NUM_RE = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

function extend(b: BBox | null, x: number, y: number): BBox {
  if (!b) return { x0: x, y0: y, x1: x, y1: y };
  if (x < b.x0) b.x0 = x;
  if (y < b.y0) b.y0 = y;
  if (x > b.x1) b.x1 = x;
  if (y > b.y1) b.y1 = y;
  return b;
}

/**
 * 从 path d 字符串计算保守包围盒。
 * 贝塞尔取控制点与端点并集（略大于真实曲线，裁剪方向安全：多画不丢）；
 * A 弧按端点 + 两半径的圆心估计扩大。
 */
export function pathBBoxFromD(d: string): BBox | null {
  let box: BBox | null = null;
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (!tokens) return null;
  let i = 0;
  // 当前点与上一个指令的末控制点（S/T 反射用）
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  let prevCtrlX = 0;
  let prevCtrlY = 0;
  let prevCmd = "";
  const num = (): number => (i < tokens.length ? Number(tokens[i++]) : 0);
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[MmLlHhVvCcSsQqTtAaZz]/.test(t)) {
      i++;
      const rel = t === t.toLowerCase();
      const cmd = t.toUpperCase();
      if (cmd === "M") {
        let first = true;
        // 隐式连续 lineto
        for (;;) {
          // 退出条件必须同时覆盖「令牌耗尽」：VexFlow 轮廓路径常以坐标结尾
          if (i >= tokens.length || /[a-zA-Z]/.test(tokens[i])) break;
          const x = num() + (rel ? cx : 0);
          const y = num() + (rel ? cy : 0);
          if (first) {
            startX = x;
            startY = y;
            cx = x;
            cy = y;
            box = extend(box, x, y);
            first = false;
          } else {
            cx = x;
            cy = y;
            box = extend(box, x, y);
          }
        }
      } else if (cmd === "L") {
        while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          cx = num() + (rel ? cx : 0);
          cy = num() + (rel ? cy : 0);
          box = extend(box, cx, cy);
        }
      } else if (cmd === "H") {
        while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          cx = num() + (rel ? cx : 0);
          box = extend(box, cx, cy);
        }
      } else if (cmd === "V") {
        while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          cy = num() + (rel ? cy : 0);
          box = extend(box, cx, cy);
        }
      } else if (cmd === "C") {
        while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          const x1 = num() + (rel ? cx : 0);
          const y1 = num() + (rel ? cy : 0);
          const x2 = num() + (rel ? cx : 0);
          const y2 = num() + (rel ? cy : 0);
          const x = num() + (rel ? cx : 0);
          const y = num() + (rel ? cy : 0);
          box = extend(box, x1, y1);
          box = extend(box, x2, y2);
          box = extend(box, x, y);
          prevCtrlX = x2;
          prevCtrlY = y2;
          cx = x;
          cy = y;
        }
      } else if (cmd === "S") {
        while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          const rx = prevCmd === "C" || prevCmd === "S";
          const x1 = rx ? 2 * cx - prevCtrlX : cx;
          const y1 = rx ? 2 * cy - prevCtrlY : cy;
          const x2 = num() + (rel ? cx : 0);
          const y2 = num() + (rel ? cy : 0);
          const x = num() + (rel ? cx : 0);
          const y = num() + (rel ? cy : 0);
          box = extend(box, x1, y1);
          box = extend(box, x2, y2);
          box = extend(box, x, y);
          prevCtrlX = x2;
          prevCtrlY = y2;
          cx = x;
          cy = y;
        }
      } else if (cmd === "Q") {
        while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          const x1 = num() + (rel ? cx : 0);
          const y1 = num() + (rel ? cy : 0);
          const x = num() + (rel ? cx : 0);
          const y = num() + (rel ? cy : 0);
          box = extend(box, x1, y1);
          box = extend(box, x, y);
          prevCtrlX = x1;
          prevCtrlY = y1;
          cx = x;
          cy = y;
        }
      } else if (cmd === "T") {
        while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          const rx = prevCmd === "Q" || prevCmd === "T";
          const x1 = rx ? 2 * cx - prevCtrlX : cx;
          const y1 = rx ? 2 * cy - prevCtrlY : cy;
          const x = num() + (rel ? cx : 0);
          const y = num() + (rel ? cy : 0);
          box = extend(box, x1, y1);
          box = extend(box, x, y);
          prevCtrlX = x1;
          prevCtrlY = y1;
          cx = x;
          cy = y;
        }
      } else if (cmd === "A") {
        while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          const rx = num();
          const ry = num();
          num(); // x-axis-rotation
          num(); // large-arc
          num(); // sweep
          const x = num() + (rel ? cx : 0);
          const y = num() + (rel ? cy : 0);
          // 保守：端点 + 圆心可能范围（半径水平/垂直投影）
          box = extend(box, x - rx, y - ry);
          box = extend(box, x + rx, y + ry);
          box = extend(box, cx - rx, cy - ry);
          box = extend(box, cx + rx, cy + ry);
          box = extend(box, x, y);
          cx = x;
          cy = y;
        }
      } else if (cmd === "Z") {
        cx = startX;
        cy = startY;
      }
      prevCmd = cmd;
    } else {
      // 无指令开头的数字流：视作隐式 L（SVG 规范）
      i++;
    }
  }
  return box;
}

// ── 属性辅助 ──

function attr(el: Element, name: string): string | null {
  return el.getAttribute(name);
}

function numAttr(el: Element, name: string, fallback = 0): number {
  const v = attr(el, name);
  if (v == null) return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

/** 继承状态（g 元素下钻时传递） */
interface Inherited {
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  opacity: number;
  fontFamily: string;
  fontSizePx: number;
  fontStyle: string;
  fontWeight: string;
  textAnchor: "left" | "center" | "right";
}

const DEFAULT_INHERITED: Inherited = {
  fill: null,
  stroke: null,
  strokeWidth: 1,
  opacity: 1,
  fontFamily: "serif",
  fontSizePx: 10,
  fontStyle: "",
  fontWeight: "",
  textAnchor: "left",
};

/** 仿射变换（仅支持 translate/scale 组合；matrix 退化为恒等并标记不可裁剪） */
interface Affine {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  /** matrix 等复杂变换，bbox 不可信 */
  unsafe: boolean;
}

const IDENTITY: Affine = { sx: 1, sy: 1, tx: 0, ty: 0, unsafe: false };

function parseTransform(value: string): Affine {
  let a = IDENTITY;
  const re = /(translate|scale|matrix)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) {
    const args = m[2]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (m[1] === "translate") {
      const tx = args[0] || 0;
      const ty = args.length > 1 ? args[1] : 0;
      a = {
        sx: a.sx,
        sy: a.sy,
        tx: a.tx + tx * a.sx,
        ty: a.ty + ty * a.sy,
        unsafe: a.unsafe,
      };
    } else if (m[1] === "scale") {
      const sx = args[0] ?? 1;
      const sy = args.length > 1 ? args[1] : sx;
      a = {
        sx: a.sx * sx,
        sy: a.sy * sy,
        tx: a.tx,
        ty: a.ty,
        unsafe: a.unsafe,
      };
    } else {
      // matrix：仅在纯平移/纯缩放时精确，其余标记不可裁剪
      const [m11, , , m22, m41, m42] = args;
      const isDiag = (args[1] === 0 && args[2] === 0) || args.length < 6;
      a = {
        sx: a.sx * (m11 ?? 1),
        sy: a.sy * (m22 ?? 1),
        tx: a.tx + (m41 ?? 0) * a.sx,
        ty: a.ty + (m42 ?? 0) * a.sy,
        unsafe: a.unsafe || !isDiag,
      };
    }
  }
  return a;
}

function applyAffine(a: Affine, box: BBox | null): BBox | null {
  if (!box) return null;
  const x0 = a.tx + box.x0 * a.sx;
  const x1 = a.tx + box.x1 * a.sx;
  const y0 = a.ty + box.y0 * a.sy;
  const y1 = a.ty + box.y1 * a.sy;
  return {
    x0: Math.min(x0, x1),
    y0: Math.min(y0, y1),
    x1: Math.max(x0, x1),
    y1: Math.max(y0, y1),
  };
}

// ── 主解析入口 ──

const PAINT_NONE = new Set(["none", "transparent"]);
const SKIP_TAGS = new Set([
  "defs",
  "clippath",
  "mask",
  "lineargradient",
  "radialgradient",
  "pattern",
  "marker",
  "symbol",
  "style",
  "title",
  "desc",
  "metadata",
]);

function colorOrNull(v: string | null): string | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  return PAINT_NONE.has(s) ? null : v.trim();
}

function makePathPrim(
  path: Path2D,
  d: string,
  box: BBox | null,
  inh: Inherited,
  seq: number,
  a: Affine,
): PathPrimitive {
  const b = applyAffine(a, box);
  return {
    kind: "path",
    seq,
    path,
    d,
    x: b ? b.x0 : 0,
    y: b ? b.y0 : 0,
    w: b ? b.x1 - b.x0 : -1, // -1 = 恒绘制
    h: b ? b.y1 - b.y0 : -1,
    fill: inh.fill,
    stroke: inh.stroke,
    strokeWidth: inh.strokeWidth,
    opacity: inh.opacity,
  };
}

function rectToPath(x: number, y: number, w: number, h: number): Path2D {
  const p = new Path2D();
  p.rect(x, y, w, h);
  return p;
}

function rectToD(x: number, y: number, w: number, h: number): string {
  return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
}

function lineToD(x1: number, y1: number, x2: number, y2: number): string {
  return `M${x1} ${y1}L${x2} ${y2}`;
}

/** 椭圆采样为多边形轮廓 d（24 段，挤出/描边用途足够平滑） */
function ellipseToD(cx: number, cy: number, rx: number, ry: number): string {
  const SEG = 24;
  let d = "";
  for (let i = 0; i <= SEG; i++) {
    const a = (i / SEG) * Math.PI * 2;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d + "Z";
}

function lineToPath(x1: number, y1: number, x2: number, y2: number): Path2D {
  const p = new Path2D();
  p.moveTo(x1, y1);
  p.lineTo(x2, y2);
  return p;
}

function ellipseToPath(cx: number, cy: number, rx: number, ry: number): Path2D {
  const p = new Path2D();
  p.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  return p;
}

function pointsToPath(points: string, close: boolean): Path2D | null {
  const nums = points.match(NUM_RE);
  if (!nums || nums.length < 4) return null;
  const p = new Path2D();
  p.moveTo(Number(nums[0]), Number(nums[1]));
  for (let k = 2; k + 1 < nums.length; k += 2) {
    p.lineTo(Number(nums[k]), Number(nums[k + 1]));
  }
  if (close) p.closePath();
  return p;
}

/** polygon/polyline points 属性 → 等价 path d 字符串 */
function pointsToD(points: string, close: boolean): string | null {
  const nums = points.match(NUM_RE);
  if (!nums || nums.length < 4) return null;
  let d = `M${nums[0]} ${nums[1]}`;
  for (let k = 2; k + 1 < nums.length; k += 2) {
    d += `L${nums[k]} ${nums[k + 1]}`;
  }
  return close ? d + "Z" : d;
}

function textEstBox(
  x: number,
  y: number,
  size: number,
  len: number,
  anchor: "left" | "center" | "right",
): { w: number; h: number; x: number; y: number } {
  const w = Math.max(size * 0.62 * len, size * 0.5);
  const bx = anchor === "center" ? x - w / 2 : anchor === "right" ? x - w : x;
  const by = y - size * 0.95;
  return { x: bx, y: by, w, h: size * 1.3 };
}

/**
 * 解析 SVG 根当前的顶层子节点为图元（调用方随后摘除 nodes）。
 * limit 限制单次解析的顶层节点数：增量渲染路径每批新增量小、一次解析完；
 * 全量重渲染后的存量按片解析（空闲分片），避免一次性长任务。
 */
export function parseSvgTopLevel(
  svg: SVGSVGElement,
  limit = Number.POSITIVE_INFINITY,
): ParseResult {
  const prims: ScorePrimitive[] = [];
  const stats: ParseStats = {
    paths: 0,
    texts: 0,
    rects: 0,
    lines: 0,
    ellipses: 0,
    polys: 0,
    groups: 0,
    skipped: 0,
  };
  const nodes: Element[] = [];
  for (const node of Array.from(svg.children)) {
    if (nodes.length >= limit) break;
    nodes.push(node);
    visit(node, DEFAULT_INHERITED, IDENTITY, prims, stats);
  }
  return { prims, stats, nodes };
}

// ── 符头标记：ScoreNoteInfo 矩形 × 图元中心点几何匹配 ──

/** 符头矩形匹配外扩（px）：图形模型包围盒略紧，留容差防漏标 */
const NOTEHEAD_MATCH_MARGIN_PX = 2;
/** 单图元反向扫描候选上限：符头矩形宽度有限，兜底防御异常宽矩形 */
const NOTEHEAD_SCAN_BACK_MAX = 256;

/**
 * 对图元批量打符头标记：path 图元中心点落入任一符头外接矩形（含容差）
 * 即标记 notehead。notes 与图元同为 OSMD zoom-1 内容坐标（OSMD 固定
 * zoom=1 渲染，extractNotes 的 UNIT_IN_PX×1 缩放与 SVG 坐标一致）。
 * notes 按 x 排序 + 二分定位 + 有界回扫，一次性 O(N log M)。
 */
export function markNoteheadPrimitives(
  prims: readonly ScorePrimitive[],
  notes: ReadonlyArray<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>,
): void {
  if (notes.length === 0) return;
  const sorted = [...notes].sort((a, b) => a.x - b.x);
  for (const p of prims) {
    if (p.kind !== "path" || p.w < 0 || p.h < 0) continue;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    // 第一个 x > cx + margin 的候选：其矩形起点已越过中心点右界
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid].x <= cx + NOTEHEAD_MATCH_MARGIN_PX) lo = mid + 1;
      else hi = mid;
    }
    for (
      let i = lo - 1, scanned = 0;
      i >= 0 && scanned < NOTEHEAD_SCAN_BACK_MAX;
      i--, scanned++
    ) {
      const n = sorted[i];
      if (n.x + n.width + NOTEHEAD_MATCH_MARGIN_PX < cx) break; // 再往左矩形更靠左
      if (
        cx >= n.x - NOTEHEAD_MATCH_MARGIN_PX &&
        cx <= n.x + n.width + NOTEHEAD_MATCH_MARGIN_PX &&
        cy >= n.y - NOTEHEAD_MATCH_MARGIN_PX &&
        cy <= n.y + n.height + NOTEHEAD_MATCH_MARGIN_PX
      ) {
        p.notehead = true;
        break;
      }
    }
  }
}

function visit(
  el: Element,
  inh: Inherited,
  aff: Affine,
  out: ScorePrimitive[],
  stats: ParseStats,
): void {
  const tag = el.tagName.toLowerCase();
  if (SKIP_TAGS.has(tag)) {
    stats.skipped++;
    return;
  }

  // 继承状态合并（g 与可绘制元素都可能带表示性属性）
  const next: Inherited = { ...inh };
  const fillAttr = attr(el, "fill");
  if (fillAttr != null) next.fill = colorOrNull(fillAttr);
  const strokeAttr = attr(el, "stroke");
  if (strokeAttr != null) next.stroke = colorOrNull(strokeAttr);
  const swAttr = attr(el, "stroke-width");
  if (swAttr != null) {
    const n = parseFloat(swAttr);
    if (Number.isFinite(n)) next.strokeWidth = n;
  }
  const opAttr = attr(el, "opacity") ?? attr(el, "fill-opacity");
  if (opAttr != null) {
    const n = parseFloat(opAttr);
    if (Number.isFinite(n)) next.opacity = inh.opacity * n;
  }
  const ff = attr(el, "font-family");
  if (ff != null) next.fontFamily = ff;
  const fs = attr(el, "font-size");
  if (fs != null) {
    const n = parseFloat(fs);
    if (Number.isFinite(n)) next.fontSizePx = n;
  }
  const fst = attr(el, "font-style");
  if (fst != null) next.fontStyle = fst === "normal" ? "" : fst;
  const fw = attr(el, "font-weight");
  if (fw != null) next.fontWeight = fw === "normal" ? "" : fw;
  const ta = attr(el, "text-anchor");
  if (ta != null) {
    if (ta === "middle") next.textAnchor = "center";
    else if (ta === "end") next.textAnchor = "right";
    else next.textAnchor = "left";
  }

  const tf = attr(el, "transform");
  const a2 = tf ? parseTransform(tf) : aff;
  const combined: Affine =
    tf && aff !== IDENTITY
      ? {
          sx: a2.sx * aff.sx,
          sy: a2.sy * aff.sy,
          tx: aff.tx + a2.tx * aff.sx,
          ty: aff.ty + a2.ty * aff.sy,
          unsafe: a2.unsafe || aff.unsafe,
        }
      : a2;

  const seq = out.length;
  switch (tag) {
    case "g": {
      stats.groups++;
      for (const child of Array.from(el.children)) {
        visit(child, next, combined, out, stats);
      }
      return;
    }
    case "path": {
      const d = attr(el, "d");
      if (!d) {
        stats.skipped++;
        return;
      }
      stats.paths++;
      out.push(
        makePathPrim(new Path2D(d), d, pathBBoxFromD(d), next, seq, combined),
      );
      return;
    }
    case "rect": {
      stats.rects++;
      const x = numAttr(el, "x");
      const y = numAttr(el, "y");
      const w = numAttr(el, "width");
      const h = numAttr(el, "height");
      if (w <= 0 || h <= 0) return;
      const box: BBox = { x0: x, y0: y, x1: x + w, y1: y + h };
      out.push(
        makePathPrim(
          rectToPath(x, y, w, h),
          rectToD(x, y, w, h),
          box,
          next,
          seq,
          combined,
        ),
      );
      return;
    }
    case "line": {
      stats.lines++;
      const x1 = numAttr(el, "x1");
      const y1 = numAttr(el, "y1");
      const x2 = numAttr(el, "x2");
      const y2 = numAttr(el, "y2");
      const box: BBox = {
        x0: Math.min(x1, x2),
        y0: Math.min(y1, y2),
        x1: Math.max(x1, x2),
        y1: Math.max(y1, y2),
      };
      out.push(
        makePathPrim(
          lineToPath(x1, y1, x2, y2),
          lineToD(x1, y1, x2, y2),
          box,
          next,
          seq,
          combined,
        ),
      );
      return;
    }
    case "circle":
    case "ellipse": {
      stats.ellipses++;
      const cx = numAttr(el, "cx");
      const cy = numAttr(el, "cy");
      const rx = tag === "circle" ? numAttr(el, "r") : numAttr(el, "rx");
      const ry = tag === "circle" ? numAttr(el, "r") : numAttr(el, "ry");
      if (rx <= 0 || ry <= 0) return;
      const box: BBox = { x0: cx - rx, y0: cy - ry, x1: cx + rx, y1: cy + ry };
      out.push(
        makePathPrim(
          ellipseToPath(cx, cy, rx, ry),
          ellipseToD(cx, cy, rx, ry),
          box,
          next,
          seq,
          combined,
        ),
      );
      return;
    }
    case "polygon":
    case "polyline": {
      stats.polys++;
      const pts = attr(el, "points");
      if (!pts) return;
      const p = pointsToPath(pts, tag === "polygon");
      if (!p) return;
      const d = pointsToD(pts, tag === "polygon");
      if (!d) return;
      const nums = pts.match(NUM_RE) ?? [];
      let box: BBox | null = null;
      for (let k = 0; k + 1 < nums.length; k += 2) {
        box = extend(box, Number(nums[k]), Number(nums[k + 1]));
      }
      out.push(makePathPrim(p, d, box, next, seq, combined));
      return;
    }
    case "text": {
      stats.texts++;
      const content = el.textContent ?? "";
      if (!content.trim()) return;
      const x = numAttr(el, "x");
      const y = numAttr(el, "y");
      const est = textEstBox(
        x,
        y,
        next.fontSizePx,
        content.length,
        next.textAnchor,
      );
      const eb = applyAffine(combined, {
        x0: est.x,
        y0: est.y,
        x1: est.x + est.w,
        y1: est.y + est.h,
      });
      const anchorX = combined.tx + x * combined.sx;
      const anchorY = combined.ty + y * combined.sy;
      out.push({
        kind: "text",
        seq,
        x: eb ? eb.x0 : anchorX,
        y: eb ? eb.y0 : anchorY,
        ax: anchorX,
        ay: anchorY,
        text: content,
        fill: next.fill,
        fontSizePx: next.fontSizePx * combined.sx,
        fontFamily: next.fontFamily,
        fontStyle: next.fontStyle,
        fontWeight: next.fontWeight,
        textAlign: next.textAnchor,
        opacity: next.opacity,
        w: eb ? eb.x1 - eb.x0 : -1,
        h: eb ? eb.y1 - eb.y0 : -1,
      });
      return;
    }
    case "a":
    case "tspan": {
      // a/tspan 递归下钻（text 内 tspan 已由 textContent 覆盖，防御性处理）
      for (const child of Array.from(el.children)) {
        visit(child, next, combined, out, stats);
      }
      return;
    }
    default: {
      stats.skipped++;
      return;
    }
  }
}

// ── 可见性分桶索引 ──

/** 桶宽（未缩放内容 px）。视口典型覆盖 1-3 桶 */
const BUCKET_PX = 120;

/**
 * 图元索引：add 追加（增量解析的批次直接推入），queryVisible 返回
 * 与可见窗口相交的图元下标，顺序 = 文档序（seq 升序）。
 * 内部复用结果数组与代际标记，播放期每帧零分配。
 */
export class PrimitiveIndex {
  private prims: ScorePrimitive[] = [];
  private buckets = new Map<number, number[]>();
  /** 恒绘制图元（包围盒不可信，w<0）：始终并入可见集 */
  private always: number[] = [];
  private gens = new Int32Array(0);
  private queryGen = 0;
  private result: number[] = [];

  get count(): number {
    return this.prims.length;
  }

  get items(): readonly ScorePrimitive[] {
    return this.prims;
  }

  clear(): void {
    this.prims.length = 0;
    this.buckets.clear();
    this.always.length = 0;
    this.queryGen = 0;
    this.result.length = 0;
  }

  add(items: ScorePrimitive[]): void {
    const base = this.prims.length;
    if (this.gens.length < base + items.length) {
      const next = new Int32Array(Math.max(64, (base + items.length) * 2));
      next.set(this.gens);
      this.gens = next;
    }
    for (let k = 0; k < items.length; k++) {
      const prim = items[k];
      const idx = base + k;
      this.prims.push(prim);
      if (prim.w < 0) {
        // 恒绘制图元不入桶，queryVisible 时始终并入
        this.always.push(idx);
        continue;
      }
      const b0 = Math.floor(prim.x / BUCKET_PX);
      // 非有限 x（异常数据）不入桶：±Infinity 上 b++ 无进展会死循环
      if (!Number.isFinite(b0)) continue;
      const b1 = Math.floor((prim.x + prim.w) / BUCKET_PX);
      // 病态超宽元素封顶登记（正常谱面最长元素为系统行连线）
      const end = Math.min(b1, b0 + 4096);
      for (let b = b0; b <= end; b++) {
        let bucket = this.buckets.get(b);
        if (!bucket) {
          bucket = [];
          this.buckets.set(b, bucket);
        }
        bucket.push(idx);
      }
    }
  }

  /** 返回内部复用数组（按 seq 升序），下一次调用前必须消费完毕 */
  queryVisible(x0: number, x1: number): number[] {
    const gen = ++this.queryGen;
    const result = this.result;
    result.length = 0;
    for (let k = 0; k < this.always.length; k++) {
      const idx = this.always[k];
      this.gens[idx] = gen;
      result.push(idx);
    }
    const b0 = Math.floor(x0 / BUCKET_PX);
    const b1 = Math.floor(x1 / BUCKET_PX);
    // 非有限窗口（异常视图状态）直接返回已并入的恒绘制集，防死循环
    if (!Number.isFinite(b0) || !Number.isFinite(b1)) return result;
    for (let b = b0; b <= b1; b++) {
      const bucket = this.buckets.get(b);
      if (!bucket) continue;
      for (let k = 0; k < bucket.length; k++) {
        const idx = bucket[k];
        if (this.gens[idx] === gen) continue;
        this.gens[idx] = gen;
        const p = this.prims[idx];
        if (p.x > x1 || p.x + p.w < x0) continue;
        result.push(idx);
      }
    }
    // 桶内 push 序 = 文档序；跨桶按 b 升序遍历也近似文档序。
    // 谱面从左到右绘制，几乎恒有序；仅局部乱序时修正（长横线跨桶）。
    let sorted = true;
    for (let k = 1; k < result.length; k++) {
      if (this.prims[result[k]].seq < this.prims[result[k - 1]].seq) {
        sorted = false;
        break;
      }
    }
    if (!sorted) {
      result.sort((ia, ib) => this.prims[ia].seq - this.prims[ib].seq);
    }
    return result;
  }
}
