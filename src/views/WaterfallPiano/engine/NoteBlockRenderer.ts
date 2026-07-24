import { Container, Graphics, Text, BlurFilter } from "pixi.js";
import type { AuraConfig, ParticleConfig } from "../types";
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
 * Note block 渲染器：负责将活跃方块绘制到 PixiJS Container 上，
 * 包含命中线、实体方块与 Aura 发光效果（单 Graphics 批绘制）。
 */
export class NoteBlockRenderer {
  private container: Container | null = null;
  private auraGraphics: Graphics = new Graphics();
  private blocksGraphics: Graphics = new Graphics();
  private hitLineGraphics: Graphics = new Graphics();
  private fpsText: Text | null = null;

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
    this.container = container;
    this.fpsText = new Text({
      text: "",
      style: { fontSize: 12, fill: "white", fontFamily: "monospace" },
    });
    container.addChild(
      this.auraGraphics,
      this.blocksGraphics,
      this.hitLineGraphics,
      this.fpsText,
    );
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
    this.auraGraphics.clear();

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
    const time = performance.now();

    const auraBlocks: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
    }> = [];
    const needAura = auraCfg?.enabled ?? false;

    for (const b of active) {
      const isBlack = isBlackKey(b.midi);
      const blockWidth = isBlack ? blackKeyWidth * 0.9 : whiteKeyWidth * 0.85;
      const x = keyboardRenderer.midiToX(b.midi) - blockWidth / 2;
      const h = b.height <= 0 ? blockWidth : b.height;
      const y = b.y - h;
      const baseColor = noteToColor(b.midi, p.colorScheme, b.hand, customColors);
      const isTriggered = triggeredSet.has(b.midi);
      const color = isTriggered ? brightenColor(baseColor, 0.4) : baseColor;

      // 绘制实体方块（单 Graphics 批绘制）
      if (p.cornerRadius > 0) {
        this.blocksGraphics.roundRect(x, y, blockWidth, h, p.cornerRadius);
      } else {
        this.blocksGraphics.rect(x, y, blockWidth, h);
      }
      this.blocksGraphics.fill({ color, alpha: p.opacity });

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

    // 4. 批量渲染 aura 图层
    if (auraBlocks.length > 0 && auraCfg) {
      this.renderAuraLayers(auraBlocks, p.cornerRadius, time, auraCfg);
    }
  }

  renderFPS(fps: number): void {
    if (this.fpsText) this.fpsText.text = `FPS: ${Math.round(fps)}`;
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
   * 批量渲染 Aura 图层（简化版：使用 BlurFilter + 半透明色块代替 Canvas 渐变）
   * PixiJS Graphics 不支持 createConicGradient / createRadialGradient，
   * 因此改用扩大尺寸的半透明色块 + BlurFilter 模拟光晕效果。
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

    // 计算当前帧的动态模糊和透明度
    let outerBlur: number;
    let outerAlpha: number;
    let innerBlur: number;
    let innerAlpha: number;

    if (isGlow) {
      outerBlur = this.glowProgress(pulseT, cfg.outerBlur, cfg.glowAfterPeakBlur);
      outerAlpha = this.glowProgress(pulseT, outerA, cfg.glowAfterPeakOpacity / 100);
      innerBlur = this.glowProgress(pulseT, cfg.innerBlur, cfg.glowPeakBlur);
      innerAlpha = this.glowProgress(pulseT, innerA, cfg.glowPeakOpacity / 100);
    } else {
      outerBlur = cfg.outerBlur;
      outerAlpha = outerA;
      innerBlur = cfg.innerBlur;
      innerAlpha = innerA;
    }

    // Layer 1: ::after（外层光晕）
    this.auraGraphics.filters = [new BlurFilter({ strength: outerBlur })];
    for (const blk of blocks) {
      if (auraR > 0) {
        this.auraGraphics.roundRect(
          blk.x - p,
          blk.y - p,
          blk.w + p * 2,
          blk.h + p * 2,
          auraR,
        );
      } else {
        this.auraGraphics.rect(blk.x - p, blk.y - p, blk.w + p * 2, blk.h + p * 2);
      }
      this.auraGraphics.fill({ color: blk.color, alpha: outerAlpha });
    }

    // Layer 2: ::before（内层光晕）
    this.auraGraphics.filters = [new BlurFilter({ strength: innerBlur })];
    for (const blk of blocks) {
      if (auraR > 0) {
        this.auraGraphics.roundRect(
          blk.x - p,
          blk.y - p,
          blk.w + p * 2,
          blk.h + p * 2,
          auraR,
        );
      } else {
        this.auraGraphics.rect(blk.x - p, blk.y - p, blk.w + p * 2, blk.h + p * 2);
      }
      this.auraGraphics.fill({ color: blk.color, alpha: innerAlpha });
    }

    // Layer 3: 基底层（无模糊）
    this.auraGraphics.filters = [];
    for (const blk of blocks) {
      if (auraR > 0) {
        this.auraGraphics.roundRect(
          blk.x - p,
          blk.y - p,
          blk.w + p * 2,
          blk.h + p * 2,
          auraR,
        );
      } else {
        this.auraGraphics.rect(blk.x - p, blk.y - p, blk.w + p * 2, blk.h + p * 2);
      }
      this.auraGraphics.fill({ color: blk.color, alpha: 1 });
    }
  }

  dispose(): void {
    this.auraGraphics.destroy();
    this.blocksGraphics.destroy();
    this.hitLineGraphics.destroy();
    this.fpsText?.destroy();
    this.container = null;
  }
}
