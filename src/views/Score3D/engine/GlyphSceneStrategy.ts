import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ScorePrimitive } from "@/views/ScoreScroll/utils/primitives";
import { createLogger } from "@/utils/logger";
import {
  parseDToSubpaths,
  subpathsToShapes,
  tubeFromPolyline,
} from "./glyphSolid";
import { BallTracker } from "./BallTracker";
import type { VisualStrategy } from "./VisualStrategy";
import type {
  GlowParams,
  StaffBand,
  TimeXPoint,
  TrailPoint,
  VoiceEvent,
} from "../types";
import {
  GLYPH_CHUNK_PX,
  GLYPH_EXTRUDE_DEPTH,
  GLYPH_WORLD_SCALE,
  STROKE_THICKNESS_BOOST,
  GLOW_Z,
  TEXT_PLANE_MAX,
  isStaffLinePrim,
  trackColor,
} from "../constants";

const logger = createLogger("Score3D/GlyphScene");

/** GlyphSceneStrategy 装配选项 */
export interface GlyphSceneInput {
  /** OSMD 渲染解析出的图元（谱面 px 坐标 @ zoom 1） */
  prims: readonly ScorePrimitive[];
  /** 谱表带（符号归属声部轨与播放头定位的依据） */
  bands: readonly StaffBand[];
  /** 时间↔谱面 x 锚点（按 t 升序；来自音符坐标） */
  noteX: readonly TimeXPoint[];
  /** 追迹小球事件序列（每声部轨按 t 升序，ADR 0019） */
  voiceEvents: readonly VoiceEvent[];
  /** 高亮强度参数 */
  glow: GlowParams;
}

/** 单个合批组：一个 x 窗口 × 一个声部轨的一块浮雕 */
interface ChunkGroup {
  chunk: number;
  trackIndex: number;
  isStaffLine: boolean;
  /** 谱面 px x 范围（高亮命中判定用） */
  x0: number;
  x1: number;
  shapes: THREE.Shape[];
  /** 描边轮廓 → 管状几何（点列 + 管半径，均按图元实际线宽换算） */
  tubes: { pts: number[]; radius: number }[];
  boxes: { cx: number; cy: number; w: number; h: number }[];
  material: THREE.MeshStandardMaterial | null;
  mesh: THREE.Mesh | null;
}

/**
 * 符号实体场景策略（ADR 0018）。
 *
 * - 每个符号图元（SMuFL 字形 path、谱线、矩形等）以轮廓挤出为三维浮雕体，
 *   保持谱面布局直铺；纯描边轮廓（连线/延音线）走管状几何。
 * - 按「x 窗口 × 声部轨」合批（mergeGeometries），draw call 控制在两位数量级；
 *   声部显隐 = 整块 Mesh 显隐。
 * - 能量轨迹降级为每谱表带一根细引导线；光点（球体 + 点光源）为播放头。
 * - 播放高亮：播放头 x 命中的合批组 emissive 提亮。
 * - 构建异步分片进行（片间让出主线程），完成态经 ready 暴露（加载遮罩覆盖全程）。
 */
export class GlyphSceneStrategy implements VisualStrategy {
  readonly name = "glyph";
  readonly root: THREE.Group = new THREE.Group();

  ready: Promise<void> = Promise.resolve();

  private readonly inputPrims: readonly ScorePrimitive[];
  private readonly groups: ChunkGroup[] = [];
  private readonly bands: StaffBand[];
  private readonly noteX: readonly TimeXPoint[];
  private readonly glow: GlowParams;
  private readonly ballTracker: BallTracker;

  private readonly glowLight: THREE.PointLight;
  private readonly disposables: (
    | THREE.BufferGeometry
    | THREE.Material
    | THREE.Texture
  )[] = [];

  /** 小球尚未出现时的相机跟随回退点（世界坐标） */
  private fallbackPoint: TrailPoint = { x: 0, y: 0, z: GLOW_Z };
  /** 主球局部坐标暂存（update 内避免分配） */
  private readonly tmpLocal = { x: 0, y: 0, z: 0 };

  constructor(input: GlyphSceneInput) {
    this.inputPrims = input.prims;
    this.bands = [...input.bands].sort((a, b) => a.yTop - b.yTop);
    this.noteX = input.noteX;
    this.glow = input.glow;
    this.ballTracker = new BallTracker(input.voiceEvents);

    // 谱面平铺：墙式布局（x 右 / y 上 / z 出面）绕 x 轴 -90° 放平成桌面，
    // 出面方向变为世界上方——小球沿法向弹跳即"从谱面正上方抛出"
    this.root.rotation.x = -Math.PI / 2;

    this.glowLight = new THREE.PointLight(0xffffff, 2, 80, 1.6);
    this.glowLight.position.z = GLOW_Z + 1;
  }

  build(): void {
    this.root.add(this.glowLight, this.ballTracker.root);
    this.ready = this.buildAsync();
  }

  private async buildAsync(): Promise<void> {
    this.logPrimStats();
    const groups = this.partition();
    this.groups.push(...groups);

    // 每片构建 2 个合批组，片间让出主线程（一次性异步，ADR 0013 风格）
    for (let i = 0; i < groups.length; i += 2) {
      for (let k = i; k < Math.min(i + 2, groups.length); k++) {
        this.buildGroup(groups[k]);
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await this.buildTextPlanes();
  }

  /** 图元构成统计（一次性诊断日志：核实谱线/符杆实际元素类型与线宽分布） */
  private logPrimStats(): void {
    let fill = 0;
    let strokeOnly = 0;
    let staffLines = 0;
    let texts = 0;
    let maxStrokeW = 0;
    for (const p of this.inputPrims) {
      if (p.kind === "text") {
        texts++;
        continue;
      }
      if (isStaffLinePrim(p.w, p.h)) staffLines++;
      if (p.fill != null) fill++;
      else if (p.stroke != null) {
        strokeOnly++;
        maxStrokeW = Math.max(maxStrokeW, p.strokeWidth);
      }
    }
    logger.info(
      `图元构成: 总=${this.inputPrims.length} 填充=${fill} 纯描边=${strokeOnly}(最大线宽${maxStrokeW.toFixed(1)}px) 谱线=${staffLines} 文本=${texts}`,
    );
  }

  /** 图元分桶：x 窗口 × 声部轨；谱线/描边轮廓单独归类 */
  private partition(): ChunkGroup[] {
    const map = new Map<string, ChunkGroup>();
    const groups: ChunkGroup[] = [];
    const groupOf = (
      chunk: number,
      trackIndex: number,
      isStaffLine: boolean,
    ): ChunkGroup => {
      const key = `${chunk}:${trackIndex}:${isStaffLine ? 1 : 0}`;
      let g = map.get(key);
      if (!g) {
        g = {
          chunk,
          trackIndex,
          isStaffLine,
          x0: Infinity,
          x1: -Infinity,
          shapes: [],
          tubes: [],
          boxes: [],
          material: null,
          mesh: null,
        };
        map.set(key, g);
        groups.push(g);
      }
      return g;
    };

    for (const prim of this.inputPrims) {
      const cx = prim.x + prim.w / 2;
      const cy = prim.y + prim.h / 2;
      const chunk = Math.floor(prim.x / GLYPH_CHUNK_PX);
      const trackIndex = this.trackOfPoint(cy, cx);

      if (prim.kind === "text") continue; // 文字走贴面网格，另行构建

      const g = groupOf(chunk, trackIndex, isStaffLinePrim(prim.w, prim.h));
      g.x0 = Math.min(g.x0, prim.x);
      g.x1 = Math.max(g.x1, prim.x + prim.w);

      if (prim.kind === "path") {
        const strokeOnly = prim.fill == null && prim.stroke != null;
        if (strokeOnly) {
          // 管径按图元实际线宽换算并整体加粗（二维谱里 1-2px 的线在
          // 三维世界坐标里是发丝级，白底不可见——ADR 0019）
          const radius =
            Math.max(prim.strokeWidth, 2) *
            0.5 *
            GLYPH_WORLD_SCALE *
            STROKE_THICKNESS_BOOST;
          if (prim.w < GLYPH_CHUNK_PX * 4) {
            for (const pts of this.polylineOfD(prim.d)) {
              g.tubes.push({ pts, radius });
            }
          } else {
            // 超长描边（系统行横线等）：退化为细长盒，截面 = 加粗线宽
            const thickness = prim.strokeWidth * STROKE_THICKNESS_BOOST;
            const horizontal = prim.h <= prim.w;
            g.boxes.push({
              cx,
              cy,
              w: horizontal ? prim.w : thickness,
              h: horizontal ? thickness : prim.h,
            });
          }
        } else {
          this.pushShapes(g, prim.d);
        }
      }
    }
    return groups;
  }

  /** 挤出（一次 ExtrudeGeometry 吞整组形状）+ 管状/盒状补充，合并成块 */
  private buildGroup(g: ChunkGroup): void {
    const geoms: THREE.BufferGeometry[] = [];
    if (g.shapes.length > 0) {
      const geo = new THREE.ExtrudeGeometry(g.shapes, {
        depth: GLYPH_EXTRUDE_DEPTH,
        bevelEnabled: false,
        curveSegments: 1,
      });
      geo.scale(GLYPH_WORLD_SCALE, GLYPH_WORLD_SCALE, 1);
      geoms.push(geo);
    }
    for (const tube of g.tubes) {
      const geo = tubeFromPolyline(
        tube.pts,
        GLYPH_WORLD_SCALE,
        tube.radius,
        GLYPH_EXTRUDE_DEPTH / 2,
      );
      if (geo) geoms.push(geo);
    }
    for (const b of g.boxes) {
      const geo = new THREE.BoxGeometry(
        b.w * GLYPH_WORLD_SCALE,
        b.h * GLYPH_WORLD_SCALE,
        GLYPH_EXTRUDE_DEPTH,
      );
      geo.translate(
        b.cx * GLYPH_WORLD_SCALE,
        -b.cy * GLYPH_WORLD_SCALE,
        GLYPH_EXTRUDE_DEPTH / 2,
      );
      geoms.push(geo);
    }
    if (geoms.length === 0) return;

    // mergeGeometries 要求索引属性一致：ExtrudeGeometry 非索引、
    // TubeGeometry 索引，混组直接 merge 返回 null（整组丢失，实证于
    // 音符浮雕消失）——统一转非索引后再合并
    const flat = geoms.map((geo) => (geo.index ? geo.toNonIndexed() : geo));
    const merged = flat.length === 1 ? flat[0] : mergeGeometries(flat, false);
    for (const geo of geoms) if (geo !== merged) geo.dispose();
    for (const geo of flat) {
      if (geo !== merged && !geoms.includes(geo)) geo.dispose();
    }
    if (!merged) return;

    const isGuide = g.isStaffLine;
    const color = isGuide
      ? "#8a93a6"
      : g.trackIndex >= 0
        ? trackColor(g.trackIndex)
        : "#c8cdd8";
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.45,
      metalness: 0.1,
      emissive: color,
      emissiveIntensity: isGuide ? 0.5 : 0.08,
    });
    const mesh = new THREE.Mesh(merged, material);
    mesh.userData.trackIndex = g.trackIndex;
    mesh.visible = true; // 初次全部可见，显隐由 setTrackVisible 接管
    g.material = material;
    g.mesh = mesh;
    this.disposables.push(merged, material);
    this.root.add(mesh);
  }

  /** 文字图元 → canvas 纹理贴面（歌词/速度标记等无轮廓数据，贴面呈现） */
  private async buildTextPlanes(): Promise<void> {
    let count = 0;
    for (const prim of this.inputPrims) {
      if (prim.kind !== "text") continue;
      if (count++ >= TEXT_PLANE_MAX) break;
      const canvas = document.createElement("canvas");
      const w = Math.max(2, Math.ceil(prim.w));
      const h = Math.max(2, Math.ceil(prim.h));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = prim.fill ?? "#1e293b";
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      // text prim 的 ay 为基线（相对包围盒顶部偏移约 0.95 字高）
      ctx.font =
        `${prim.fontStyle} ${prim.fontWeight} ${prim.fontSizePx}px ${prim.fontFamily}`.trim();
      ctx.fillText(prim.text, 0, h * 0.95);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const geo = new THREE.PlaneGeometry(
        prim.w * GLYPH_WORLD_SCALE,
        prim.h * GLYPH_WORLD_SCALE,
      );
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, material);
      const cx = (prim.x + prim.w / 2) * GLYPH_WORLD_SCALE;
      const cy = -(prim.y + prim.h / 2) * GLYPH_WORLD_SCALE;
      mesh.position.set(cx, cy, GLYPH_EXTRUDE_DEPTH + 0.02);
      this.disposables.push(geo, material, texture);
      this.root.add(mesh);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  // ── 每帧更新 ──

  update(time: number): void {
    const x = this.timeToX(time);

    // 追迹小球推进；点光源挂在第一声部主球上随行照明
    this.ballTracker.update(time);
    const main = this.ballTracker.getMainBallPoint(this.tmpLocal);
    if (main) {
      // 根组绕 x 轴 -90°（谱面平铺）：局部 (x,y,z) → 世界 (x,z,-y)
      this.fallbackPoint.x = this.tmpLocal.x;
      this.fallbackPoint.y = this.tmpLocal.z;
      this.fallbackPoint.z = -this.tmpLocal.y;
      this.glowLight.position.set(
        this.tmpLocal.x,
        this.tmpLocal.y,
        this.tmpLocal.z + 1,
      );
    }

    // 高亮：播放头所在 x 窗口的符号块提亮
    const { peakIntensity } = this.glow;
    for (const g of this.groups) {
      if (!g.material || g.isStaffLine) continue;
      const hit = x >= g.x0 - 40 && x <= g.x1 + 40;
      g.material.emissiveIntensity = hit ? peakIntensity * 0.35 : 0.08;
    }
  }

  /** 相机跟随目标：第一声部主球（小球未出现时回退到时间轴插值点） */
  getFollowTarget(): TrailPoint | null {
    return this.fallbackPoint;
  }

  setTrackVisible(trackIndex: number, visible: boolean): void {
    for (const g of this.groups) {
      if (g.trackIndex === trackIndex && g.mesh) {
        g.mesh.visible = visible;
      }
    }
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    this.groups.length = 0;
    this.ballTracker.dispose();
    this.root.clear();
  }

  // ── 内部工具 ──

  /** 谱面 y（px）→ 声部轨索引：落在谱表带内取该带，否则取中心最近的带 */
  private trackOfPoint(y: number, x: number): number {
    let best: StaffBand | null = null;
    let bestDist = Infinity;
    for (const b of this.bands) {
      if (y >= b.yTop && y <= b.yBottom && x >= b.x0 - 40 && x <= b.x1 + 40) {
        return b.trackIndex;
      }
      const c = (b.yTop + b.yBottom) / 2;
      const d = Math.abs(c - y);
      if (d < bestDist) {
        bestDist = d;
        best = b;
      }
    }
    return best?.trackIndex ?? 0;
  }

  /** 描边 d → 折线点列集合（每个子路径一条） */
  private polylineOfD(d: string): number[][] {
    const subpaths = parseDToSubpaths(d);
    return subpaths.map((s) => s.pts);
  }

  /** 填充 d → 形状集合（外形 + 挖孔），追加到组 */
  private pushShapes(g: ChunkGroup, d: string): void {
    const subpaths = parseDToSubpaths(d);
    if (subpaths.length === 0) return;
    const shapes = subpathsToShapes(subpaths);
    g.shapes.push(...shapes);
  }

  /** 时间 → 谱面 x（px）：noteX 锚点线性插值，端点钳制 */
  private timeToX(t: number): number {
    const list = this.noteX;
    if (list.length === 0) return 0;
    if (t <= list[0].t) return list[0].x;
    const last = list[list.length - 1];
    if (t >= last.t) return last.x;
    let lo = 0;
    let hi = list.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid].t <= t) lo = mid;
      else hi = mid;
    }
    const a = list[lo];
    const b = list[hi];
    const span = b.t - a.t;
    const f = span > 1e-9 ? (t - a.t) / span : 0;
    return a.x + (b.x - a.x) * f;
  }
}
