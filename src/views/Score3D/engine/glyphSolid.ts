import * as THREE from "three";

/**
 * SVG path d 指令 → 三维挤出几何（ADR 0018 符号实体的几何层）。
 *
 * 职责：
 * 1. 解析 d 指令为扁平化子路径（贝塞尔细分、A 弧转三次曲线，输出折线点列）；
 * 2. 按嵌套深度划分子路径的形状/挖孔角色（VexFlow 空心符头等挖孔轮廓）；
 * 3. 挤出为带厚度的浮雕几何；纯描边轮廓（连线、符杠、延音线）走管状几何。
 *
 * 全部为纯函数：输入谱面 px 坐标，输出世界坐标几何（缩放与 y 翻转在此完成）。
 */

const TOKEN_RE = /[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g;

/** 单条扁平化子路径：折线点列（x, y 交替）+ 是否闭合 */
interface FlatSubpath {
  pts: number[];
  closed: boolean;
}

/** 三次贝塞尔细分段数（符头曲线 8 段足够平滑） */
const CURVE_SEGMENTS = 8;
/** 圆弧转三次曲线的分段数 */
const ARC_SEGMENTS = 6;

/** 按三次贝塞尔公式细分一段曲线，追加到点列 */
function flattenCubic(
  out: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
): void {
  for (let i = 1; i <= CURVE_SEGMENTS; i++) {
    const t = i / CURVE_SEGMENTS;
    const mt = 1 - t;
    const a = mt * mt * mt;
    const b = 3 * mt * mt * t;
    const c = 3 * mt * t * t;
    const d = t * t * t;
    out.push(
      a * x0 + b * x1 + c * x2 + d * x3,
      a * y0 + b * y1 + c * y2 + d * y3,
    );
  }
}

/** 圆弧（A 指令）端点参数化 → 若干三次曲线（标准 SVG arc 转换） */
function flattenArc(
  out: number[],
  x0: number,
  y0: number,
  rx: number,
  ry: number,
  angleDeg: number,
  largeArc: number,
  sweep: number,
  x: number,
  y: number,
): void {
  const phi = (angleDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx2 = (x0 - x) / 2;
  const dy2 = (y0 - y) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  // 半径过小时的圆心半径修正（SVG 规范）
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }
  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const sign = largeArc === sweep ? -1 : 1;
  const den = rx2 * y1p * y1p + ry2 * x1p * x1p;
  const co = sign * Math.sqrt(Math.max(0, (rx2 * ry2) / den - 1));
  const cxp = (co * rx * y1p) / ry;
  const cyp = (-co * ry * x1p) / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (x0 + x) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y0 + y) / 2;

  const theta1 = Math.atan2((y1p - cyp) / ry, (x1p - cxp) / rx);
  const theta2 = Math.atan2((-y1p - cyp) / ry, (-x1p - cxp) / rx);
  let delta = theta2 - theta1;
  if (sweep === 0 && delta > 0) delta -= Math.PI * 2;
  if (sweep === 1 && delta < 0) delta += Math.PI * 2;

  const segments = Math.max(
    1,
    Math.ceil((Math.abs(delta) / (Math.PI * 2)) * ARC_SEGMENTS * 2),
  );
  for (let i = 1; i <= segments; i++) {
    const t = theta1 + (delta * i) / segments;
    const px = cx + rx * Math.cos(t) * cosPhi - ry * Math.sin(t) * sinPhi;
    const py = cy + rx * Math.cos(t) * sinPhi + ry * Math.sin(t) * cosPhi;
    out.push(px, py);
  }
}

/**
 * 解析 d 指令为扁平化子路径。覆盖 M/L/H/V/C/S/Q/T/A/Z 与隐式连线
 * （无指令开头的数字流）；与 primitives.pathBBoxFromD 相同的鲁棒性约定：
 * 退出条件必须覆盖令牌耗尽（VexFlow 路径常不带结尾 Z）。
 */
export function parseDToSubpaths(d: string): FlatSubpath[] {
  const tokens = d.match(TOKEN_RE);
  if (!tokens) return [];
  const subpaths: FlatSubpath[] = [];
  let cur: number[] = [];
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  let prevCtrlX = 0;
  let prevCtrlY = 0;
  let prevCmd = "";
  let i = 0;
  const num = (): number => (i < tokens.length ? Number(tokens[i++]) : 0);

  const pushPoint = (x: number, y: number): void => {
    cur.push(x, y);
  };
  const finishSubpath = (closed: boolean): void => {
    if (cur.length >= 4) subpaths.push({ pts: cur, closed });
    cur = [];
  };

  while (i < tokens.length) {
    const t = tokens[i];
    if (!/[MmLlHhVvCcSsQqTtAaZz]/.test(t)) {
      // 无指令开头的数字流：视作隐式 L（SVG 规范）
      i++;
      const x = num() + cx;
      const y = num() + cy;
      pushPoint(x, y);
      cx = x;
      cy = y;
      continue;
    }
    i++;
    const rel = t === t.toLowerCase();
    const cmd = t.toUpperCase();
    if (cmd === "M") {
      let first = true;
      while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
        const x = num() + (rel ? cx : 0);
        const y = num() + (rel ? cy : 0);
        if (first) {
          finishSubpath(false);
          startX = x;
          startY = y;
          cx = x;
          cy = y;
          // 起点必须压入点列：两点线段（谱线/符杆）只靠 M+L 两点构成，
          // 缺起点会让子路径长度不足被丢弃（两点线段：谱线/符杆）
          pushPoint(x, y);
          first = false;
        } else {
          pushPoint(x, y);
          cx = x;
          cy = y;
        }
      }
    } else if (cmd === "L") {
      while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
        cx = num() + (rel ? cx : 0);
        cy = num() + (rel ? cy : 0);
        pushPoint(cx, cy);
      }
    } else if (cmd === "H") {
      while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
        cx = num() + (rel ? cx : 0);
        pushPoint(cx, cy);
      }
    } else if (cmd === "V") {
      while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
        cy = num() + (rel ? cy : 0);
        pushPoint(cx, cy);
      }
    } else if (cmd === "C") {
      while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
        const x1 = num() + (rel ? cx : 0);
        const y1 = num() + (rel ? cy : 0);
        const x2 = num() + (rel ? cx : 0);
        const y2 = num() + (rel ? cy : 0);
        const x = num() + (rel ? cx : 0);
        const y = num() + (rel ? cy : 0);
        flattenCubic(cur, cx, cy, x1, y1, x2, y2, x, y);
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
        flattenCubic(cur, cx, cy, x1, y1, x2, y2, x, y);
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
        // 二次 → 三次升阶后细分
        const cx1 = cx + (2 / 3) * (x1 - cx);
        const cy1 = cy + (2 / 3) * (y1 - cy);
        const cx2 = x + (2 / 3) * (x1 - x);
        const cy2 = y + (2 / 3) * (y1 - y);
        flattenCubic(cur, cx, cy, cx1, cy1, cx2, cy2, x, y);
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
        const cx1 = cx + (2 / 3) * (x1 - cx);
        const cy1 = cy + (2 / 3) * (y1 - cy);
        const cx2 = x + (2 / 3) * (x1 - x);
        const cy2 = y + (2 / 3) * (y1 - y);
        flattenCubic(cur, cx, cy, cx1, cy1, cx2, cy2, x, y);
        prevCtrlX = x1;
        prevCtrlY = y1;
        cx = x;
        cy = y;
      }
    } else if (cmd === "A") {
      while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
        const rx = num();
        const ry = num();
        const rot = num();
        const large = num();
        const sweep = num();
        const x = num() + (rel ? cx : 0);
        const y = num() + (rel ? cy : 0);
        if (rx > 0 && ry > 0) {
          flattenArc(cur, cx, cy, rx, ry, rot, large, sweep, x, y);
        } else {
          pushPoint(x, y);
        }
        cx = x;
        cy = y;
      }
    } else if (cmd === "Z") {
      if (cur.length >= 2) {
        pushPoint(startX, startY);
      }
      finishSubpath(true);
      cx = startX;
      cy = startY;
    }
    prevCmd = cmd;
  }
  finishSubpath(false);
  return subpaths;
}

/** 点是否在多边形内（射线法；容差 1e-9 防 FP 噪声误判边界点） */
function pointInPolygon(pts: number[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i];
    const yi = pts[i + 1];
    const xj = pts[j];
    const yj = pts[j + 1];
    if (
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi - 1e-9
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * 扁平化子路径 → THREE.Shape[]（外形 + 挖孔归属）。
 *
 * 嵌套深度判定：取子路径首点（若在外部则回退取中点）统计被其他子路径
 * 包含的次数；偶数次 = 外形，奇数次 = 其最近包含者的挖孔。即 even-odd
 * 语义——与 SMuFL/VexFlow 字形轮廓的书写习惯一致。
 */
export function subpathsToShapes(subpaths: FlatSubpath[]): THREE.Shape[] {
  const usable = subpaths.filter((s) => s.pts.length >= 6);
  if (usable.length === 0) return [];

  // 预计算各子路径的包围盒（嵌套粗筛）与参照点
  const boxes = usable.map((s) => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let k = 0; k < s.pts.length; k += 2) {
      x0 = Math.min(x0, s.pts[k]);
      x1 = Math.max(x1, s.pts[k]);
      y0 = Math.min(y0, s.pts[k + 1]);
      y1 = Math.max(y1, s.pts[k + 1]);
    }
    return { x0, y0, x1, y1 };
  });
  const probes = usable.map((s) => {
    // 首点可能在自交或贴边位置，中点更稳；两者都试
    const midX = s.pts[s.pts.length / 2] ?? s.pts[0];
    const midY = s.pts[s.pts.length / 2 + 1] ?? s.pts[1];
    return { x: s.pts[0], y: s.pts[1], mx: midX, my: midY };
  });

  const depth = new Array<number>(usable.length).fill(0);
  const parent = new Array<number>(usable.length).fill(-1);
  for (let a = 0; a < usable.length; a++) {
    const pa = probes[a];
    for (let b = 0; b < usable.length; b++) {
      if (a === b) continue;
      const bb = boxes[b];
      if (pa.x < bb.x0 || pa.x > bb.x1 || pa.y < bb.y0 || pa.y > bb.y1) {
        continue;
      }
      const pb = usable[b].pts;
      if (pointInPolygon(pb, pa.x, pa.y) || pointInPolygon(pb, pa.mx, pa.my)) {
        depth[a]++;
        // 父取包围盒面积最小的直接包含者（多层嵌套时归属最近一层）
        if (parent[a] === -1 || areaOf(boxes[parent[a]]) > areaOf(boxes[b])) {
          parent[a] = b;
        }
      }
    }
  }

  const shapes: THREE.Shape[] = [];
  const shapeByIndex = new Map<number, THREE.Shape>();
  const holesByParent = new Map<number, THREE.Path[]>();
  for (let a = 0; a < usable.length; a++) {
    if (depth[a] % 2 === 0) {
      const shape = shapeFromPoints(usable[a].pts);
      shapes.push(shape);
      shapeByIndex.set(a, shape);
    } else {
      const hole = pathFromPoints(usable[a].pts);
      const p = parent[a];
      const list = holesByParent.get(p);
      if (list) list.push(hole);
      else holesByParent.set(p, [hole]);
    }
  }
  // 挂挖孔：父若自身是挖孔（三层嵌套的怪异字形），向上找到最近外形
  for (const [idx, holes] of holesByParent) {
    let target = idx;
    while (target !== -1 && depth[target] % 2 !== 0) {
      target = parent[target];
    }
    if (target === -1) continue;
    const shape = shapeByIndex.get(target);
    if (shape) shape.holes.push(...holes);
  }
  return shapes;
}

function areaOf(b: { x0: number; y0: number; x1: number; y1: number }): number {
  return (b.x1 - b.x0) * (b.y1 - b.y0);
}

function shapeFromPoints(pts: number[]): THREE.Shape {
  const v: THREE.Vector2[] = [];
  for (let k = 0; k < pts.length; k += 2) {
    // y 翻转：SVG y 向下 → 世界 y 向上
    v.push(new THREE.Vector2(pts[k], -pts[k + 1]));
  }
  return new THREE.Shape(v);
}

function pathFromPoints(pts: number[]): THREE.Path {
  const v: THREE.Vector2[] = [];
  for (let k = 0; k < pts.length; k += 2) {
    v.push(new THREE.Vector2(pts[k], -pts[k + 1]));
  }
  return new THREE.Path(v);
}

/**
 * 纯描边轮廓（延音线、连线、符杠等）→ 管状几何。
 * 点列为谱面 px 折线，经 CatmullRom 平滑后成管（y 翻转在此完成）。
 */
export function tubeFromPolyline(
  pts: number[],
  scale: number,
  radiusWorld: number,
  zWorld: number,
): THREE.TubeGeometry | null {
  const points: THREE.Vector3[] = [];
  for (let k = 0; k < pts.length; k += 2) {
    points.push(new THREE.Vector3(pts[k] * scale, -pts[k + 1] * scale, zWorld));
  }
  if (points.length < 2) return null;
  // 去重相邻重复点（CatmullRom 对重复点会产生 NaN 切线）
  const deduped: THREE.Vector3[] = [points[0]];
  for (let k = 1; k < points.length; k++) {
    if (points[k].distanceToSquared(deduped[deduped.length - 1]) > 1e-10) {
      deduped.push(points[k]);
    }
  }
  if (deduped.length < 2) return null;
  const curve = new THREE.CatmullRomCurve3(deduped, false, "catmullrom", 0.5);
  return new THREE.TubeGeometry(
    curve,
    Math.min(64, deduped.length * 4),
    radiusWorld,
    6,
    false,
  );
}
