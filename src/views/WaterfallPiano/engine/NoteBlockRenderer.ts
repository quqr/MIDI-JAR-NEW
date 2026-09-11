import { Container, Graphics } from "pixi.js";
import { OutlineFilter, GlowFilter } from "pixi-filters";
import type { AuraConfig, ParticleConfig } from "../types";
import { noteToColor, type CustomColors } from "./NoteColorMapper";
import type { KeyboardRenderer } from "./KeyboardRenderer";
import type { NoteBlock } from "./NoteBlockPool";
import {
  NoteBlockParticleField,
  type BlockRectInfo,
  type PointerState,
} from "./NoteBlockParticleField";

const BLACK_KEY_CLASSES = new Set([1, 3, 6, 8, 10]);
export const BLACK_KEY_WIDTH_RATIO = 0.6;

/** 判断给定的 MIDI 音符编号是否对应黑键 */
export function isBlackKey(midi: number): boolean {
  return BLACK_KEY_CLASSES.has(((midi % 12) + 12) % 12);
}

/** 将十六进制颜色向白色混合，ratio 为 0 时不变，为 1 时纯白 */
function brightenColor(hex: string, ratio: number): string {
  const h = hex.replace("#", "").padEnd(6, "0");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  const br = Math.round(r + (255 - r) * ratio);
  const bg = Math.round(g + (255 - g) * ratio);
  const bb = Math.round(b + (255 - b) * ratio);
  return `#${br.toString(16).padStart(2, "0")}${bg.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`;
}

/** 将 hex 颜色字符串转为 number（用于 pixi-filters 的 color 参数） */
function hexToNumber(hex: string): number {
  const h = hex.replace("#", "").padEnd(6, "0");
  return parseInt(h.slice(0, 6), 16);
}

/**
 * Note block 渲染器：负责将活跃方块绘制到 PixiJS Container 上，
 * 包含命中线、实体方块与 Aura 发光效果。
 *
 * Aura 使用 3 个独立 Graphics 层实现多层光晕（基于 pixi-filters）：
 * - auraOuterLayer: 外层光晕（GlowFilter, knockout=true，仅渲染辉光）
 * - auraInnerLayer: 内层描边（OutlineFilter, knockout=true，仅渲染描边）
 * - auraBaseLayer:  基底光晕（无滤镜，彩色实体基底，全透明度）
 *
 * OutlineFilter 与 GlowFilter 的颜色取自 AuraConfig.primaryColor（默认白色）。
 * 滤镜基于 alpha 通道工作，knockout=true 使其仅输出描边/辉光，不输出原图，
 * 因此多层叠加得到：彩色基底 + 单色描边 + 单色辉光的干净 Aura 效果。
 * 每层拥有独立的滤镜实例（持久化），避免每帧创建和资源泄漏。
 */
export class NoteBlockRenderer {
  /** Aura 外层光晕（GlowFilter, knockout） */
  private auraOuterLayer: Graphics = new Graphics();
  /** Aura 内层描边（OutlineFilter, knockout） */
  private auraInnerLayer: Graphics = new Graphics();
  /** Aura 基底层（无滤镜，彩色实体） */
  private auraBaseLayer: Graphics = new Graphics();
  /** 持久化 OutlineFilter 实例（knockout=true，仅渲染描边） */
  private outlineFilter: OutlineFilter = new OutlineFilter({
    thickness: 0,
    color: 0xffffff,
    alpha: 0,
    knockout: true,
  });
  /** 持久化 GlowFilter 实例（knockout=true，仅渲染辉光） */
  private glowFilter: GlowFilter = new GlowFilter({
    distance: 0,
    outerStrength: 4,
    color: 0xffffff,
    alpha: 0,
    knockout: true,
  });
  private blocksGraphics: Graphics = new Graphics();
  private hitLineGraphics: Graphics = new Graphics();
  /** 粒子方块场（blockParticle.enabled 时替代实体方块渲染） */
  private particleField = new NoteBlockParticleField();
  /** 上一帧粒子模式开关（用于关闭时清空残留 span） */
  private particleEnabledLast = false;
  /** 复用的 BlockRectInfo 缓冲区，避免每帧分配 */
  private rectBuffer: BlockRectInfo[] = [];
  /** 指针状态（由 NoteBlockSystem 注入更新） */
  private pointer: PointerState = { x: 0, y: 0, active: false };
  /**
   * 渲染时钟（ms）。null = 跟随墙钟（实时预览）；
   * 视频导出设置 transport 时间，保证粒子动画逐帧确定、与编码速度无关。
   */
  renderTimeMs: number | null = null;

  constructor(
    private readonly getParticleConfig: () => ParticleConfig | null,
    private readonly getAuraConfig: () => AuraConfig | null,
    private readonly getKeyboardRenderer: () => KeyboardRenderer | null,
    private readonly getWidth: () => number,
    private readonly getHeight: () => number,
    private readonly getActive: () => NoteBlock[],
    private readonly getTriggeredSet: () => Set<number>,
  ) {}

  init(container: Container): void {
    container.addChild(
      this.auraOuterLayer,
      this.auraInnerLayer,
      this.auraBaseLayer,
      this.blocksGraphics,
      this.particleField.view,
      this.hitLineGraphics,
    );
  }

  /** 更新指针状态（瀑布逻辑坐标，用于粒子排斥） */
  setPointer(x: number, y: number, active: boolean): void {
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.active = active;
  }

  render(): void {
    const p = this.getParticleConfig();
    const auraCfg = this.getAuraConfig();
    const keyboardRenderer = this.getKeyboardRenderer();
    if (!p || !keyboardRenderer) return;
    const width = this.getWidth();
    const height = this.getHeight();
    const active = this.getActive();

    // 1. 清空所有图层
    this.blocksGraphics.clear();
    this.hitLineGraphics.clear();
    this.auraOuterLayer.clear();
    this.auraInnerLayer.clear();
    this.auraBaseLayer.clear();

    // 2. 绘制命中线
    if (p.hitLine.visible) {
      this.hitLineGraphics.moveTo(0, height - p.hitLine.thickness / 2);
      this.hitLineGraphics.lineTo(width, height - p.hitLine.thickness / 2);
      this.hitLineGraphics.stroke({
        color: p.hitLine.color,
        width: p.hitLine.thickness,
      });
    }

    // 3. 收集 aura 数据 + 绘制实体方块
    const whiteKeyWidth = keyboardRenderer.getWhiteKeyWidth();
    const blackKeyWidth = whiteKeyWidth * BLACK_KEY_WIDTH_RATIO;
    const customColors: CustomColors = p.customColors;
    const triggeredSet = this.getTriggeredSet();
    const time = this.renderTimeMs ?? performance.now();

    const auraBlocks: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
    }> = [];
    const needAura = auraCfg?.enabled ?? false;
    const particleModeAny = p.blockParticle?.enabled ?? false;

    for (const b of active) {
      const isBlack = isBlackKey(b.midi);
      const blockWidth = isBlack ? blackKeyWidth * 0.9 : whiteKeyWidth * 0.85;
      const x = keyboardRenderer.midiToX(b.midi) - blockWidth / 2;
      const h = b.height <= 0 ? blockWidth : b.height;
      const y = b.y - h;
      const baseColor = noteToColor(
        b.midi,
        p.colorScheme,
        b.hand,
        customColors,
      );
      // 触发高亮的判定依据随方块来源而不同：
      // - synthesia 方块（trackIndex >= 0）有起止时间，必须用方块自身的
      //   触发状态判断，否则同一音高的「未来」方块会因全局集合里存在该
      //   音高而被一起点亮（尚未接触命中线却被高亮）；
      // - realtime 方块（trackIndex < 0）没有起止时间，仍以全局已触发
      //   集合（按音高）判断。
      const isTriggered =
        b.trackIndex >= 0 ? b.triggered && !b.ended : triggeredSet.has(b.midi);
      const color = isTriggered ? brightenColor(baseColor, 0.4) : baseColor;

      // 粒子模式：跳过实体填充，收集矩形信息给粒子场
      if (particleModeAny) {
        this.rectBuffer.push({
          block: b,
          x,
          y,
          w: blockWidth,
          h,
          tint: hexToNumber(color),
          triggered: isTriggered,
        });
      } else {
        // 绘制实体方块（单 Graphics 批绘制）
        if (p.cornerRadius > 0) {
          this.blocksGraphics.roundRect(x, y, blockWidth, h, p.cornerRadius);
        } else {
          this.blocksGraphics.rect(x, y, blockWidth, h);
        }
        this.blocksGraphics.fill({ color, alpha: p.opacity });
      }

      // 收集 aura 数据
      if (needAura && auraCfg) {
        const applyAura =
          auraCfg.target === "all" ||
          (auraCfg.target === "triggered" && isTriggered);
        if (applyAura) {
          auraBlocks.push({ x, y, w: blockWidth, h, color });
        }
      }
    }

    // 3.5 粒子场更新/清空
    if (particleModeAny) {
      const cfg = p.blockParticle;
      this.particleField.setGlow(cfg.glow);
      this.particleField.view.alpha = p.opacity;
      this.particleField.update(
        this.rectBuffer,
        cfg,
        this.pointer,
        time,
        width,
      );
    } else if (this.particleEnabledLast) {
      // 刚关闭：立即清空残留粒子
      this.particleField.clear(p.blockParticle, true);
    }
    this.particleEnabledLast = particleModeAny;
    this.rectBuffer.length = 0;

    // 4. 批量渲染 aura 图层
    if (auraBlocks.length > 0 && auraCfg) {
      // 有内容时设置 filter
      this.auraOuterLayer.filters = [this.glowFilter];
      this.auraInnerLayer.filters = [this.outlineFilter];
      this.renderAuraLayers(auraBlocks, p.cornerRadius, time, auraCfg);
    } else {
      // 无内容时移除 filter，避免空 Graphics + filter 导致 alphaMode 错误
      this.auraOuterLayer.filters = null;
      this.auraInnerLayer.filters = null;
    }
  }

  /** ease-out 插值：1 - (1 - t)^2 */
  private easeOut(t: number): number {
    return 1 - (1 - t) * (1 - t);
  }

  /** glow 关键帧插值（20%-50%-80% 三段式 easeOut） */
  private glowProgress(t: number, valley: number, peak: number): number {
    if (t < 0.2) return valley;
    if (t < 0.5) {
      const p = (t - 0.2) / 0.3;
      return valley + (peak - valley) * this.easeOut(p);
    }
    if (t < 0.8) {
      const p = (t - 0.5) / 0.3;
      return peak - (peak - valley) * this.easeOut(p);
    }
    return valley;
  }

  /**
   * 批量渲染 Aura 图层：使用 3 个独立 Graphics 层 + 持久化滤镜
   *
   * PixiJS v8 中 filters 在渲染时统一应用，同一 Graphics 对象无法分段
   * 应用不同滤镜。因此使用 3 个独立层：
   * - auraOuterLayer: 外层光晕（GlowFilter, knockout=true）
   * - auraInnerLayer: 内层描边（OutlineFilter, knockout=true）
   * - auraBaseLayer:  基底光晕（无滤镜，彩色实体）
   *
   * 滤镜颜色取自 cfg.primaryColor（默认白色），通过 hexToNumber 转换。
   * 滤镜基于 alpha 通道工作，knockout=true 仅输出描边/辉光本身。
   */
  private renderAuraLayers(
    blocks: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
    }>,
    cornerRadius: number,
    time: number,
    cfg: AuraConfig,
  ): void {
    const p = cfg.padding;
    const auraR = p + cornerRadius;
    const animMs = cfg.duration * 1000;
    const pulseT = (time % animMs) / animMs;
    const innerA = cfg.innerOpacity / 100;
    const outerA = cfg.outerOpacity / 100;
    const isGlow = cfg.style === "glow";

    // 计算当前帧的动态参数
    let outerDistance: number;
    let outerAlpha: number;
    let innerThickness: number;
    let innerAlpha: number;

    if (isGlow) {
      outerDistance = this.glowProgress(
        pulseT,
        cfg.outerBlur,
        cfg.glowAfterPeakBlur,
      );
      outerAlpha = this.glowProgress(
        pulseT,
        outerA,
        cfg.glowAfterPeakOpacity / 100,
      );
      innerThickness = this.glowProgress(
        pulseT,
        cfg.innerBlur,
        cfg.glowPeakBlur,
      );
      innerAlpha = this.glowProgress(pulseT, innerA, cfg.glowPeakOpacity / 100);
    } else {
      outerDistance = cfg.outerBlur;
      outerAlpha = outerA;
      innerThickness = cfg.innerBlur;
      innerAlpha = innerA;
    }

    // 滤镜颜色：custom 样式使用 primaryColor，其余默认白色
    const auraColorHex = cfg.primaryColor ?? "#ffffff";
    const auraColorNum = hexToNumber(auraColorHex);

    // 更新持久化滤镜参数（避免每帧创建新实例）
    this.glowFilter.distance = outerDistance;
    this.glowFilter.alpha = outerAlpha;
    this.glowFilter.color = auraColorNum;
    this.outlineFilter.thickness = innerThickness;
    this.outlineFilter.alpha = innerAlpha;
    this.outlineFilter.color = auraColorNum;

    // 辅助 lambda：绘制单个色块
    const drawBlock = (
      gfx: Graphics,
      blk: (typeof blocks)[0],
      alpha: number,
    ) => {
      if (auraR > 0) {
        gfx.roundRect(
          blk.x - p,
          blk.y - p,
          blk.w + p * 2,
          blk.h + p * 2,
          auraR,
        );
      } else {
        gfx.rect(blk.x - p, blk.y - p, blk.w + p * 2, blk.h + p * 2);
      }
      gfx.fill({ color: blk.color, alpha });
    };

    // Layer 1: 外层光晕（GlowFilter, knockout=true → 仅辉光）
    // alpha=1 仅为让滤镜检测到形状，knockout 会隐藏原图
    for (const blk of blocks) {
      drawBlock(this.auraOuterLayer, blk, 1);
    }

    // Layer 2: 内层描边（OutlineFilter, knockout=true → 仅描边）
    for (const blk of blocks) {
      drawBlock(this.auraInnerLayer, blk, 1);
    }

    // Layer 3: 基底层（无滤镜，彩色实体，全透明度）
    for (const blk of blocks) {
      drawBlock(this.auraBaseLayer, blk, 1);
    }
  }

  dispose(): void {
    this.auraOuterLayer.destroy();
    this.auraInnerLayer.destroy();
    this.auraBaseLayer.destroy();
    this.outlineFilter.destroy();
    this.glowFilter.destroy();
    this.blocksGraphics.destroy();
    this.hitLineGraphics.destroy();
    this.particleField.dispose();
  }
}
