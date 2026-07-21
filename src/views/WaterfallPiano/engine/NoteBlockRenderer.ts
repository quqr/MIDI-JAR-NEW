import type { WaterfallPianoSettings } from "../types";
import { noteToColor, type CustomColors } from "./NoteColorMapper";
import type { KeyboardRenderer } from "./KeyboardRenderer";
import type { NoteBlock } from "./NoteBlockPool";

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

/**
 * Note block 渲染器：负责将活跃方块绘制到画布上，
 * 包含命中线、实体方块与 Aura 发光效果（逐层批处理以减少 save/restore）。
 */
export class NoteBlockRenderer {
  constructor(
    private readonly getCtx: () => CanvasRenderingContext2D | null,
    private readonly getSettings: () => WaterfallPianoSettings | null,
    private readonly getKeyboardRenderer: () => KeyboardRenderer | null,
    private readonly getWidth: () => number,
    private readonly getHeight: () => number,
    private readonly getActive: () => NoteBlock[],
    private readonly getTriggeredSet: () => Set<number>,
  ) {}

  render(): void {
    const ctx = this.getCtx();
    const settings = this.getSettings();
    const keyboardRenderer = this.getKeyboardRenderer();
    if (!ctx || !settings || !keyboardRenderer) return;
    const p = settings.particles;
    const auraCfg = settings.aura;
    const width = this.getWidth();
    const height = this.getHeight();
    const active = this.getActive();
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();

    if (p.hitLine.visible) {
      ctx.strokeStyle = p.hitLine.color;
      ctx.lineWidth = p.hitLine.thickness;
      ctx.beginPath();
      ctx.moveTo(0, height - p.hitLine.thickness / 2);
      ctx.lineTo(width, height - p.hitLine.thickness / 2);
      ctx.stroke();
    }

    const whiteKeyWidth = keyboardRenderer.getWhiteKeyWidth();
    const blackKeyWidth = whiteKeyWidth * BLACK_KEY_WIDTH_RATIO;
    const customColors: CustomColors = p.customColors;
    const triggeredSet = this.getTriggeredSet();
    const time = performance.now();

    // 单遍遍历：收集 aura 数据 + 绘制实体方块
    const auraBlocks: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
    }> = [];
    const needAura = auraCfg.enabled;

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
      const isTriggered = triggeredSet.has(b.midi);
      const color = isTriggered ? brightenColor(baseColor, 0.4) : baseColor;

      // 绘制实体方块
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = color;
      if (p.cornerRadius > 0) {
        this.roundRect(ctx, x, y, blockWidth, h, p.cornerRadius);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, blockWidth, h);
      }
      ctx.globalAlpha = 1;

      // 收集 aura 数据
      if (needAura) {
        const applyAura =
          auraCfg.target === "all" ||
          (auraCfg.target === "triggered" && isTriggered);
        if (applyAura) {
          auraBlocks.push({ x, y, w: blockWidth, h, color });
        }
      }
    }

    // 批量渲染 aura 图层
    if (auraBlocks.length > 0) {
      this.renderAuraLayers(ctx, auraBlocks, p.cornerRadius, time, settings);
    }

    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    const radius = Math.min(r, w / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  /** DaisyUI aura ease-out 插值：1 - (1 - t)^2 */
  private easeOut(t: number): number {
    return 1 - (1 - t) * (1 - t);
  }

  /** DaisyUI aura-glow 关键帧插值（20%-50%-80% 三段式 easeOut） */
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
   * 批量渲染所有 Aura 图层（按层批处理，减少 save/restore 和 filter 切换）
   * 性能：save/restore 3 + filter 2 + gradient N（旧版为 3N/2N/N）
   */
  private renderAuraLayers(
    ctx: CanvasRenderingContext2D,
    blocks: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
    }>,
    cornerRadius: number,
    time: number,
    settings: WaterfallPianoSettings,
  ): void {
    const cfg = settings.aura;
    if (!cfg) return;

    const style = cfg.style;
    const p = cfg.padding;
    const auraR = p + cornerRadius;
    const animMs = cfg.duration * 1000;
    const animT = (time % animMs) / animMs;
    const angleRad = (animT * cfg.rotationRange * Math.PI) / 180;
    const pulseT = animT;
    const innerA = cfg.innerOpacity / 100;
    const outerA = cfg.outerOpacity / 100;
    const beamStartNorm = cfg.beamAngle / 360;
    const beamEndNorm = (cfg.beamAngle + cfg.beamWidth) / 360;
    const glowStyle = style === "glow";
    const isCustom = style === "custom";

    const buildGradient = (
      cx: number,
      cy: number,
      color: string,
    ): CanvasGradient | null => {
      if (glowStyle) {
        const extentNorm = cfg.glowExtent / 100;
        const r = Math.min(p * 2, 200) * 0.5;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r / extentNorm);
        g.addColorStop(0, color);
        g.addColorStop(extentNorm, "transparent");
        return g;
      }
      const g = ctx.createConicGradient(angleRad, cx, cy);
      if (style === "rainbow") {
        const m = cfg.rainbowMargin / 100;
        g.addColorStop(0, "transparent");
        g.addColorStop(m, "hsl(0, 80%, 60%)");
        g.addColorStop(0.25, "hsl(90, 80%, 60%)");
        g.addColorStop(0.5, "hsl(180, 80%, 60%)");
        g.addColorStop(0.75, "hsl(270, 80%, 60%)");
        g.addColorStop(1 - m, "hsl(360, 80%, 60%)");
        g.addColorStop(1, "transparent");
        return g;
      }
      const useColor = isCustom && cfg.primaryColor ? cfg.primaryColor : color;
      if (style === "dual") {
        const offN = cfg.dualOffRatio / 100;
        const onN = cfg.dualOnRatio / 100;
        const total = offN + onN;
        for (let i = 0; i < 1; i += total) {
          g.addColorStop(Math.min(i, 1), "transparent");
          g.addColorStop(Math.min(i + offN, 1), "transparent");
          g.addColorStop(Math.min(i + offN + 0.01, 1), useColor);
          g.addColorStop(Math.min(i + total, 1), useColor);
        }
        return g;
      }
      // 基底 conic
      g.addColorStop(0, "transparent");
      g.addColorStop(beamStartNorm, "transparent");
      g.addColorStop(beamStartNorm + 0.001, useColor);
      g.addColorStop(beamEndNorm, useColor);
      g.addColorStop(beamEndNorm + 0.001, "transparent");
      g.addColorStop(1, "transparent");
      return g;
    };

    const drawOne = (
      bx: number,
      by: number,
      bw: number,
      bh: number,
      color: string,
    ): void => {
      const cx = bx + bw / 2;
      const cy = by + bh / 2;
      const g = buildGradient(cx, cy, color);
      if (g) {
        ctx.fillStyle = g;
        // 内联 drawPath 逻辑
        ctx.beginPath();
        if (auraR > 0) {
          this.roundRect(ctx, bx - p, by - p, bw + p * 2, bh + p * 2, auraR);
        } else {
          ctx.rect(bx - p, by - p, bw + p * 2, bh + p * 2);
        }
        ctx.closePath();
        ctx.fill();
      }
    };

    // Layer 1: ::after
    ctx.save();
    if (glowStyle) {
      ctx.shadowBlur = this.glowProgress(
        pulseT,
        cfg.outerBlur,
        cfg.glowAfterPeakBlur,
      );
      ctx.globalAlpha = this.glowProgress(
        pulseT,
        outerA,
        cfg.glowAfterPeakOpacity / 100,
      );
    } else {
      ctx.shadowBlur = cfg.outerBlur;
      ctx.globalAlpha = outerA;
    }
    for (const blk of blocks) {
      ctx.shadowColor = blk.color;
      drawOne(blk.x, blk.y, blk.w, blk.h, blk.color);
    }
    ctx.restore();

    // Layer 2: ::before
    ctx.save();
    if (glowStyle) {
      ctx.shadowBlur = this.glowProgress(
        pulseT,
        cfg.innerBlur,
        cfg.glowPeakBlur,
      );
      ctx.globalAlpha = this.glowProgress(
        pulseT,
        innerA,
        cfg.glowPeakOpacity / 100,
      );
    } else {
      ctx.shadowBlur = cfg.innerBlur;
      ctx.globalAlpha = innerA;
    }
    for (const blk of blocks) {
      ctx.shadowColor = blk.color;
      drawOne(blk.x, blk.y, blk.w, blk.h, blk.color);
    }
    ctx.restore();

    // Layer 3: 基底
    for (const blk of blocks) drawOne(blk.x, blk.y, blk.w, blk.h, blk.color);
  }
}
