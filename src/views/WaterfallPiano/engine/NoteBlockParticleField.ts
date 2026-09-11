import { Particle, ParticleContainer, Texture } from "pixi.js";
import type { BlockParticleConfig } from "../types";
import type { NoteBlock } from "./NoteBlockPool";

/** 渲染器为每个方块计算的矩形 + 颜色信息（key 使用 NoteBlock 对象身份） */
export interface BlockRectInfo {
  /** 所属 NoteBlock（用对象身份作为 span 映射键，池化期间稳定） */
  block: NoteBlock;
  x: number;
  y: number;
  w: number;
  h: number;
  /** tint 颜色（number，已含 triggered 提亮） */
  tint: number;
  triggered: boolean;
}

/** 指针状态（瀑布逻辑坐标） */
export interface PointerState {
  x: number;
  y: number;
  active: boolean;
}

/** 单个粒子的运行时数据（对象池复用） */
interface FieldParticle {
  sprite: Particle;
  /** 当前位置 */
  x: number;
  y: number;
  /** 聚拢起始位置（散开点） */
  startX: number;
  startY: number;
  /** 方块内网格偏移（目标 = block.x + ox, block.y + oy） */
  ox: number;
  oy: number;
  /** 采样点 alpha（0-1）；实体方块均匀填充 → 固定 1 */
  targetAlpha: number;
  /** 尺寸 px（由 particleSize * (0.75 + targetAlpha*0.45) 计算） */
  size: number;
  seed: number;
  depth: number;
  /** 聚拢 stagger 延迟 ms（seed * cfg.stagger） */
  delay: number;
  /** 消散速度（block 移除时外扩） */
  vx: number;
  vy: number;
  /** 消散标记 */
  dying: boolean;
}

/** 一个 block 对应的粒子段 */
interface Span {
  particles: FieldParticle[];
  /** 聚拢开始时间（performance.now()） */
  gatherStart: number;
  /**
   * true = 已成型：跳过聚拢插值，直接漂移 + 排斥。
   * 新 block 初始为 false（走聚拢分支），所有粒子 progress≥1 后置 true；
   * 形状重建（resize）也直接置 true 以就位。
   */
  skipGather: boolean;
  triggered: boolean;
  w: number;
  h: number;
  gridSize: number;
  /** 本帧矩形（同步阶段写入，动画阶段读取） */
  curRect: BlockRectInfo | null;
}

/** 粒子池硬上限（安全兜底，超出按 stride 降采样） */
const MAX_PARTICLES = 30000;
/** follow 插值系数（移植 ParticleText 0.22；作用在 base 上） */
const FOLLOW = 0.22;
/** 指针平滑系数（移植 ParticleText 0.18） */
const POINTER_SMOOTH = 0.18;
/** Texture.WHITE 的纹理边长（Pixi v8 为 1×1，scale 即粒子尺寸 px） */
const WHITE_TEX_SIZE = 1;

/** hex 颜色字符串 → number（无效输入返回 0） */
function hexToInt(hex: string): number {
  const h = hex.replace("#", "").padEnd(6, "0");
  return parseInt(h.slice(0, 6), 16) || 0;
}

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const clamp = (v: number, min: number, max: number): number =>
  Math.min(Math.max(v, min), max);

/** 线性 RGB 插值（reference 的 mixRgb） */
function mixRgb(c1: number, c2: number, t: number): number {
  const r1 = (c1 >> 16) & 0xff;
  const g1 = (c1 >> 8) & 0xff;
  const b1 = c1 & 0xff;
  const r2 = (c2 >> 16) & 0xff;
  const g2 = (c2 >> 8) & 0xff;
  const b2 = c2 & 0xff;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | b;
}

/**
 * NoteBlock 粒子场：将方块渲染为粒子网格（逐公式对齐 reactbits ParticleText）。
 *
 * 每个粒子的运动学完全对齐 reference：
 * - 目标：方块按 gridSize 步长采样为网格点，跟随 block 移动
 * - 散开起点：angle=seed*2π，distance=scatter*(0.35+depth*0.75)，
 *   x = target + cos*dist + (depth-0.5)*scatter*0.55，y 同理 (seed-0.5)*scatter*0.55
 * - 聚拢：local=(now-gatherStart-delay)/max(1,gatherDuration)，progress=clamp，
 *   eased=easeOutCubic，base=start+(target-start)*eased（gather 期间无漂移/排斥）
 * - 待机漂移（已成型时）：sin(t*0.9+seed*10)*idleDrift*depth 等
 * - 指针排斥（已成型时）：作用在 base 上，二次衰减 + 平滑指针 0.18
 * - follow：p += (base - p) * 0.22
 * - alpha：clamp(0.35 + progress*0.65, 0, 1)
 * - size：max(0.6, particleSize*(0.75+targetAlpha*0.45))（particleSize≈gridSize 以保证覆盖）
 * - 颜色：blend=clamp(targetX/width+(seed-0.5)*0.35,0,1)，color=mixRgb(base,highlight,blend)
 * - seed=((i*9301+49297)%233280)/233280，depth=0.45+((i*233+97)%1000)/1000*0.9
 *
 * 场景适配只改 target 与触发时机：
 * - 新 block：从散开点 ease-out + stagger 聚拢
 * - 触发沿（triggered 上升沿）：以当前目标为 anchor 重新散开再聚拢（reference 的 scatter 语义）
 * - block 移除：粒子外扩 + alpha 衰减回收
 * - glow：AdditiveBlending 近似 reference 的 shadowBlur 辉光
 *
 * 粒子按 block 分段（Span）管理：block 形状/网格变化时重建该段（保留位置就位），
 * block 移除时粒子转为消散状态后回收。
 */
export class NoteBlockParticleField {
  private container: ParticleContainer;
  /** 全量粒子槽位（sprite 常驻 container，未使用时 alpha=0） */
  private slots: FieldParticle[] = [];
  /** 空闲槽位栈 */
  private free: FieldParticle[] = [];
  /** block → 粒子段 */
  private spans = new Map<NoteBlock, Span>();
  /** 复用的存在性集合（避免每帧 new Set 的分配） */
  private presentSet = new Set<NoteBlock>();
  /** 消散中的粒子 */
  private dying: FieldParticle[] = [];
  private smoothX = 0;
  private smoothY = 0;
  private pointerInit = false;

  constructor() {
    this.container = new ParticleContainer({
      dynamicProperties: {
        position: true,
        // 槽位复用会改 scale，消散淡出/显隐会改 alpha → vertex/color 必须动态
        vertex: true,
        color: true,
        rotation: false,
        uvs: false,
      },
    });
  }

  get view(): ParticleContainer {
    return this.container;
  }

  setGlow(enabled: boolean): void {
    this.container.blendMode = enabled ? "add" : "normal";
  }

  /**
   * 每帧更新：同步 spans 与 rects、推进动画、写入 sprite 属性
   * @param rects - 本帧所有活跃方块的矩形信息
   * @param cfg - 粒子配置
   * @param pointer - 指针状态
   * @param now - performance.now()
   * @param width - 画布逻辑宽度（用于颜色 blend 的 targetX/width 渐变）
   */
  update(
    rects: BlockRectInfo[],
    cfg: BlockParticleConfig,
    pointer: PointerState,
    now: number,
    width: number,
  ): void {
    // ── 指针平滑（reference：smooth += (target - smooth) * 0.18） ──
    if (pointer.active) {
      if (!this.pointerInit) {
        this.smoothX = pointer.x;
        this.smoothY = pointer.y;
        this.pointerInit = true;
      }
      this.smoothX += (pointer.x - this.smoothX) * POINTER_SMOOTH;
      this.smoothY += (pointer.y - this.smoothY) * POINTER_SMOOTH;
    }

    // ── 移除已消失 block 的 span → 转消散 ──
    const present = this.presentSet;
    present.clear();
    for (const r of rects) present.add(r.block);
    for (const [block, span] of this.spans) {
      if (!present.has(block)) {
        this.releaseSpanToDying(span, cfg);
        this.spans.delete(block);
      }
    }

    // ── 同步/创建 span ──
    // 性能关键：realtime 模式方块每帧长高，若按「h 变了就重建」会每帧全量
    // 重建 span（粒子释放+重取+容器动态属性重上传），主线程被 O(粒子数) 的
    // 分配/搬运饿死。改为：仅当网格行列数或 gridSize 真正变化时才重建；
    // 其余尺寸渐进变化走增量重映射（零分配，目标点随 p.ox/p.oy 自动跟随）。
    for (const r of rects) {
      let span = this.spans.get(r.block);
      if (!span) {
        span = this.createSpan(r, cfg, now);
        this.spans.set(r.block, span);
      } else {
        const step = Math.max(2, Math.floor(cfg.gridSize));
        const colsChanged =
          Math.floor(r.w / step) !== Math.floor(span.w / step);
        const rowsChanged =
          Math.floor(r.h / step) !== Math.floor(span.h / step);
        if (colsChanged || rowsChanged || span.gridSize !== cfg.gridSize) {
          this.rebuildSpan(span, r, cfg);
        } else if (span.w !== r.w || span.h !== r.h) {
          this.remapSpan(span, r);
        }
      }
      if (r.triggered && !span.triggered) {
        // 触发上升沿：以当前目标为 anchor 重新散开再聚拢（reference scatter 语义）
        this.burstSpan(span, r, cfg, now);
      }
      span.triggered = r.triggered;
      span.curRect = r;
    }

    // ── 推进粒子 ──
    const driftT = now * 0.001;
    const useRepel =
      pointer.active && cfg.pointerRepelRadius > 0 && cfg.pointerRepelForce > 0;
    const gatherDur = Math.max(1, cfg.gatherDuration);
    // reference 的 offset 项 spread 在 populateSpan 用 cfg.scatter（出现散开）、
    // burstSpan 用 cfg.burstStrength（触发爆发）；颜色 blend 用画布宽度
    const w = width > 0 ? width : 1;
    const highlight = hexToInt(cfg.highlightColor);

    for (const span of this.spans.values()) {
      const r = span.curRect;
      if (!r) continue;
      const baseTint = r.tint;
      const elapsed = now - span.gatherStart;
      let allDone = true;

      for (const p of span.particles) {
        // 每颗粒子独立的聚拢进度（reference：local=(now-gatherStart-delay)/max(1,gatherDuration)）
        const progress = span.skipGather
          ? 1
          : clamp((elapsed - p.delay) / gatherDur, 0, 1);
        if (progress < 1) allDone = false;
        const eased = easeOutCubic(progress);
        const targetX = r.x + p.ox;
        const targetY = r.y + p.oy;

        // 聚拢插值（reference：base = start + (target-start) * eased）
        let baseX = p.startX + (targetX - p.startX) * eased;
        let baseY = p.startY + (targetY - p.startY) * eased;

        // 仅在「该粒子已聚拢」后应用待机漂移 + 指针排斥（reference 的 gathered 分支）。
        // gather 期间两者皆禁用；逐粒子判定以匹配 reference 的 per-particle p.gathered 锁存，
        // 使 stagger 延迟不同的粒子各自按时开始漂移。
        if (progress >= 1) {
          if (cfg.idleDrift > 0) {
            baseX +=
              Math.sin(driftT * 0.9 + p.seed * 10) * cfg.idleDrift * p.depth;
            baseY +=
              Math.cos(driftT * 0.75 + p.depth * 10) * cfg.idleDrift * p.depth;
          }
          if (useRepel) {
            const dx = baseX - this.smoothX;
            const dy = baseY - this.smoothY;
            const dist = Math.hypot(dx, dy);
            if (dist > 0 && dist < cfg.pointerRepelRadius) {
              const force =
                Math.pow(1 - dist / cfg.pointerRepelRadius, 2) *
                cfg.pointerRepelForce;
              baseX += (dx / dist) * force;
              baseY += (dy / dist) * force;
            }
          }
        }

        // follow（reference：p.x += (baseX - p.x) * 0.22）
        p.x += (baseX - p.x) * FOLLOW;
        p.y += (baseY - p.y) * FOLLOW;

        // 颜色 blend（reference：blend=clamp(targetX/width+(seed-0.5)*0.35,0,1)）
        const blend = clamp(targetX / w + (p.seed - 0.5) * 0.35, 0, 1);
        p.sprite.tint = mixRgb(baseTint, highlight, blend);

        // alpha（reference：clamp(0.35 + progress*0.65, 0, 1)）
        p.sprite.alpha = clamp(0.35 + progress * 0.65, 0, 1);
        p.sprite.x = p.x;
        p.sprite.y = p.y;
      }

      // 全部粒子聚拢完成 → 之后走「已成型」快路径（跳过逐粒子进度判定）
      if (!span.skipGather && allDone) span.skipGather = true;
    }

    // ── 消散粒子 ──
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const p = this.dying[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.sprite.x = p.x;
      p.sprite.y = p.y;
      p.sprite.alpha *= 0.9;
      if (p.sprite.alpha < 0.02) {
        p.sprite.alpha = 0;
        this.dying.splice(i, 1);
        this.free.push(p);
      }
    }
  }

  /** 移除所有 span（模式切换/清空方块时调用），粒子全部转消散 */
  clear(cfg: BlockParticleConfig, instant: boolean): void {
    for (const span of this.spans.values()) {
      if (instant) {
        for (const p of span.particles) {
          p.sprite.alpha = 0;
          this.free.push(p);
        }
      } else {
        this.releaseSpanToDying(span, cfg);
      }
    }
    this.spans.clear();
  }

  dispose(): void {
    this.spans.clear();
    this.dying.length = 0;
    this.slots.length = 0;
    this.free.length = 0;
    this.container.destroy();
  }

  // ── 内部方法 ──

  private acquireSlot(): FieldParticle | null {
    const pooled = this.free.pop();
    if (pooled) {
      pooled.dying = false;
      return pooled;
    }
    if (this.slots.length >= MAX_PARTICLES) return null;
    const sprite = new Particle({
      texture: Texture.WHITE,
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      tint: 0xffffff,
      alpha: 0,
    });
    this.container.addParticle(sprite);
    const p: FieldParticle = {
      sprite,
      x: 0,
      y: 0,
      startX: 0,
      startY: 0,
      ox: 0,
      oy: 0,
      targetAlpha: 1,
      size: 2,
      seed: 0,
      depth: 1,
      delay: 0,
      vx: 0,
      vy: 0,
      dying: false,
    };
    this.slots.push(p);
    return p;
  }

  private createSpan(
    r: BlockRectInfo,
    cfg: BlockParticleConfig,
    now: number,
  ): Span {
    const span: Span = {
      particles: [],
      gatherStart: now,
      skipGather: false,
      triggered: r.triggered,
      w: r.w,
      h: r.h,
      gridSize: cfg.gridSize,
      curRect: r,
    };
    this.populateSpan(span, r, cfg, false);
    return span;
  }

  /** 按 gridSize 网格填充 span 的粒子（hard cap 超限时按 stride 降采样）
   *  @param keepPositions - true = 重建（粒子直接落在目标点，无散开动画） */
  private populateSpan(
    span: Span,
    r: BlockRectInfo,
    cfg: BlockParticleConfig,
    keepPositions: boolean,
  ): void {
    span.particles = [];

    const step = Math.max(2, Math.floor(cfg.gridSize));
    const cols = Math.max(1, Math.floor(r.w / step));
    const rows = Math.max(1, Math.floor(r.h / step));
    const total = cols * rows;

    // 硬上限兜底：按 stride 降采样
    const capacity = MAX_PARTICLES - this.slots.length + this.free.length;
    const stride =
      total > capacity ? Math.ceil(total / Math.max(1, capacity)) : 1;

    // 出现散开距离（scatter 独立设置，与触发爆发 burstStrength 分离）
    const scatter = cfg.scatter;
    // 粒子尺寸（独立设置，default 6 ≈ gridSize 保证覆盖）
    const particleSize = Math.max(0.6, cfg.particleSize);

    let cellIndex = 0;
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const ci = cellIndex++;
        if (ci % stride !== 0) continue;
        const p = this.acquireSlot();
        if (!p) return;

        // reference seed / depth 生成（用网格单元索引保证 per-block 稳定且各 block 不同）
        const seed = ((ci * 9301 + 49297) % 233280) / 233280;
        const depth = 0.45 + (((ci * 233 + 97) % 1000) / 1000) * 0.9;
        const ox = gx * step + step / 2;
        const oy = gy * step + step / 2;

        // 散开起点（reference：angle=seed*2π, distance=scatter*(0.35+depth*0.75),
        //   x=target+cos*dist+(depth-0.5)*scatter*0.55, y 用 (seed-0.5)*scatter*0.55）
        const angle = seed * Math.PI * 2;
        const distance = scatter * (0.35 + depth * 0.75);
        const startX =
          r.x +
          ox +
          Math.cos(angle) * distance +
          (depth - 0.5) * scatter * 0.55;
        const startY =
          r.y + oy + Math.sin(angle) * distance + (seed - 0.5) * scatter * 0.55;

        p.ox = ox;
        p.oy = oy;
        p.seed = seed;
        p.depth = depth;
        // 聚拢延迟（reference delay=seed*stagger；stagger 为独立设置 ms）
        p.delay = seed * Math.max(0, cfg.stagger);
        p.targetAlpha = 1;
        // reference size：max(0.6, particleSize*(0.75+targetAlpha*0.45))
        p.size = Math.max(0.6, particleSize * (0.75 + p.targetAlpha * 0.45));
        p.vx = 0;
        p.vy = 0;

        if (!keepPositions) {
          // 新 span：从散开位置开始做聚拢动画
          p.x = startX;
          p.y = startY;
        } else {
          // 重建：直接落在目标点（每帧方块位移小，视觉连续）
          p.x = r.x + ox;
          p.y = r.y + oy;
        }
        p.startX = startX;
        p.startY = startY;

        p.sprite.scaleX = p.size / WHITE_TEX_SIZE;
        p.sprite.scaleY = p.size / WHITE_TEX_SIZE;
        p.sprite.tint = r.tint;
        // 聚拢起始 alpha（update 每帧会按 progress 重算；已成型分支直接置 1）
        p.sprite.alpha = keepPositions ? 1 : 0.35;

        span.particles.push(p);
      }
    }
  }

  private rebuildSpan(
    span: Span,
    r: BlockRectInfo,
    cfg: BlockParticleConfig,
  ): void {
    // 释放旧粒子（直接回收，无消散动画，避免形状变化时闪烁）
    for (const p of span.particles) {
      p.sprite.alpha = 0;
      this.free.push(p);
    }
    span.w = r.w;
    span.h = r.h;
    span.gridSize = cfg.gridSize;
    span.skipGather = true; // 重建就位，不做散开动画
    span.gatherStart = 0;
    this.populateSpan(span, r, cfg, true);
  }

  /**
   * 增量重映射（性能关键路径）：方块 y/h 渐进变化（realtime 生长）时
   * 不重建粒子，只按宽高比例缩放每个粒子的网格偏移 ox/oy（目标点在
   * update 中按 r.x + p.ox 逐帧重算，自动跟随）。gather 中的粒子把散开
   * 起点随方块形变平移，保持相对形状不撕裂。零分配、零容器操作。
   */
  private remapSpan(span: Span, r: BlockRectInfo): void {
    const old = span.curRect;
    const oldW = old && old.w > 0 ? old.w : r.w;
    const oldH = old && old.h > 0 ? old.h : r.h;
    const sx = r.w / oldW;
    const sy = r.h / oldH;
    for (const p of span.particles) {
      p.ox *= sx;
      p.oy *= sy;
      if (!span.skipGather && old) {
        p.startX = r.x + (p.startX - old.x) * sx;
        p.startY = r.y + (p.startY - old.y) * sy;
      }
    }
    span.w = r.w;
    span.h = r.h;
  }

  /**
   * 触发爆发（reference scatter 语义）：以当前目标为 anchor 给每个粒子一个新的散开起点，
   * 重置聚拢计时，使其先外抛再 ease-out 聚回。burstStrength=0 时关闭。
   * 注意：散开/聚拢期间禁用漂移与排斥（由 gather 分支保证）。
   */
  private burstSpan(
    span: Span,
    r: BlockRectInfo,
    cfg: BlockParticleConfig,
    now: number,
  ): void {
    if (cfg.burstStrength <= 0) return;
    const scatter = cfg.burstStrength;
    for (const p of span.particles) {
      const targetX = r.x + p.ox;
      const targetY = r.y + p.oy;
      const angle = p.seed * Math.PI * 2;
      const distance = scatter * (0.35 + p.depth * 0.75);
      p.startX =
        targetX + Math.cos(angle) * distance + (p.depth - 0.5) * scatter * 0.55;
      p.startY =
        targetY + Math.sin(angle) * distance + (p.seed - 0.5) * scatter * 0.55;
      // 立即外抛到散开点（后续 follow 缓慢拉回，形成爆发感）
      p.x = p.startX;
      p.y = p.startY;
    }
    span.skipGather = false;
    span.gatherStart = now;
  }

  /** block 移除：粒子转消散（外扩 + alpha 衰减） */
  private releaseSpanToDying(span: Span, cfg: BlockParticleConfig): void {
    const spread = Math.max(20, cfg.burstStrength * 0.5);
    for (const p of span.particles) {
      if (p.dying) continue;
      p.dying = true;
      const angle = p.seed * Math.PI * 2;
      const strength = spread * (0.3 + p.depth * 0.7) * 0.06;
      p.vx = Math.cos(angle) * strength;
      p.vy = Math.sin(angle) * strength;
      this.dying.push(p);
    }
    span.particles.length = 0;
  }
}
