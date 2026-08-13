/**
 * 键盘绘制工厂（PixiJS v8）
 *
 * 纯静态方法集合，封装所有 Graphics / Text / FillGradient 绘制指令。
 * 不持有状态，不存储引用 — 所有数据通过 RenderContext 或参数传入。
 *
 * 职责：
 * - 渐变创建（白键 / 黑键）
 * - 标签 Text 创建与字号度量
 * - 静态层绘制（白键层 / 黑键层）
 * - 高亮层绘制（白键 / 黑键，返回 Text[] 交由调用方 addChild）
 */

import { Container, Graphics, Text, FillGradient } from "pixi.js";
import type { KeyboardConfig, KeyLabel } from "../types";
import type { KeyboardLayout } from "./KeyboardLayoutCalculator";
import {
  KeyboardLayoutCalculator,
  isBlackKey,
} from "./KeyboardLayoutCalculator";
import { midiToNoteName } from "../constants";
import type { PianoThemeColors } from "../config/pianoThemes";
import {
  hexToRgba,
  lightenColor,
  darkenColor,
  isValidHexColor,
} from "@/helpers/color";

/**
 * 渲染上下文 — 打包绘制所需的全部数据与回调。
 * 由 KeyboardRenderer 在脏标记触发时构建，传递给工厂的静态方法。
 */
export interface RenderContext {
  /** 键盘布局（白黑键位置与尺寸） */
  layout: KeyboardLayout;
  /** 键盘配置（圆角、边框、分隔线等外观参数） */
  kb: KeyboardConfig;
  /** 已解析的颜色集（主题 + DaisyUI 覆盖） */
  colors: PianoThemeColors;
  /** 画布逻辑宽度（CSS 像素） */
  width: number;
  /** 画布逻辑高度（CSS 像素） */
  height: number;
  /** 可见 MIDI 范围起始 */
  from: number;
  /** 可见 MIDI 范围结束 */
  to: number;
  /** MIDI → X 坐标映射（由 KeyboardRenderer 提供，黑键定位用） */
  midiToX: (midi: number) => number;
  /** 已解析的有效标签模式（null 表示不渲染标签） */
  effectiveLabel: KeyLabel | null;
}

/** 字体族常量，所有键标签共用 */
const LABEL_FONT_FAMILY =
  "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif";

/** 标签度量结果 */
interface LabelMetrics {
  fontSize: number;
  letterSpacing: number;
  y: number;
}

/**
 * 键盘绘制工厂 — 纯静态方法，无实例状态。
 */
export class KeyGraphicsFactory {
  // ============================================================================
  // 渐变创建
  // ============================================================================

  /**
   * 创建白键渐变（现代扁平化风格）
   * 纯色填充 + 极微妙的顶部提亮与底部压暗
   */
  static createWhiteKeyGradient(
    x: number,
    y: number,
    h: number,
    baseColor: string,
    lightAmount: number,
    darkAmount: number,
  ): FillGradient {
    const gradient = new FillGradient({
      start: { x, y },
      end: { x, y: y + h },
    });
    if (!isValidHexColor(baseColor)) {
      gradient.addColorStop(0, baseColor);
      gradient.addColorStop(1, baseColor);
      return gradient;
    }

    const lighter = lightenColor(baseColor, lightAmount);
    const darker = darkenColor(baseColor, darkAmount);

    gradient.addColorStop(0, lighter);
    gradient.addColorStop(0.85, baseColor);
    gradient.addColorStop(1, darker);

    return gradient;
  }

  /**
   * 创建黑键渐变（现代扁平化风格）
   * 深色填充 + 顶部微高光
   */
  static createBlackKeyGradient(
    x: number,
    y: number,
    h: number,
    baseColor: string,
    lightAmount: number,
    darkAmount: number,
  ): FillGradient {
    const gradient = new FillGradient({
      start: { x, y },
      end: { x, y: y + h },
    });
    if (!isValidHexColor(baseColor)) {
      gradient.addColorStop(0, baseColor);
      gradient.addColorStop(1, baseColor);
      return gradient;
    }

    const lighter = lightenColor(baseColor, lightAmount);
    const darker = darkenColor(baseColor, darkAmount);

    gradient.addColorStop(0, lighter);
    gradient.addColorStop(0.15, baseColor);
    gradient.addColorStop(1, darker);

    return gradient;
  }

  // ============================================================================
  // 标签辅助
  // ============================================================================

  /**
   * 创建键标签 Text 对象（统一字体族、字重、锚点）
   * @param text - 标签文本
   * @param fontSize - 字号
   * @param fill - 填充色
   * @param letterSpacing - 字间距
   * @param x - 水平居中位置
   * @param y - 底部基线位置
   */
  static createLabelText(
    text: string,
    fontSize: number,
    fill: string,
    letterSpacing: number,
    x: number,
    y: number,
  ): Text {
    const txt = new Text({
      text,
      style: {
        fontSize,
        fontFamily: LABEL_FONT_FAMILY,
        fontWeight: "600",
        fill,
        letterSpacing,
      },
    });
    txt.x = x;
    txt.y = y;
    txt.anchor.set(0.5, 1);
    return txt;
  }

  /** 计算白键标签样式参数（字号、字间距、Y 坐标） */
  static whiteLabelMetrics(layout: KeyboardLayout): LabelMetrics {
    return {
      fontSize: Math.max(11, Math.min(16, layout.whiteKeyWidth * 0.26)),
      letterSpacing: 0.5,
      y: layout.height - 8,
    };
  }

  /** 计算黑键标签样式参数（字号、字间距、Y 坐标） */
  static blackLabelMetrics(layout: KeyboardLayout): LabelMetrics {
    return {
      fontSize: Math.max(9, Math.min(13, layout.blackKeyWidth * 0.3)),
      letterSpacing: 0.3,
      y: layout.blackKeyHeight - 6,
    };
  }

  // ============================================================================
  // 静态层绘制
  // ============================================================================

  /**
   * 绘制白键静态层到指定 Container。
   * 包含白键渐变主体、边框、分隔线、标签与主音(C)圆点。
   */
  static drawWhiteKeyLayer(container: Container, ctx: RenderContext): void {
    const { layout, kb, colors, width, height } = ctx;

    // ── 白键（主题感知渐变） ──
    const whiteG = new Graphics();
    for (let i = 0; i < layout.whiteKeys.length; i++) {
      const x = i * layout.whiteKeyWidth;
      const w = layout.whiteKeyWidth;

      const gradient = KeyGraphicsFactory.createWhiteKeyGradient(
        x,
        0,
        height,
        colors.whiteKeyColor,
        colors.whiteGradientLight,
        colors.whiteGradientDark,
      );
      whiteG.roundRect(x, 0, w, height, kb.keyCornerRadius);
      whiteG.fill(gradient);

      // 边框
      if (kb.keyBorderWidth > 0) {
        whiteG.roundRect(x, 0, w, height, kb.keyCornerRadius);
        whiteG.stroke({
          color: colors.keyBorderColor,
          width: kb.keyBorderWidth,
        });
      }
    }
    container.addChild(whiteG);

    // ── 分隔线 ──
    if (kb.separatorEnabled && kb.separatorThickness > 0) {
      const sepG = new Graphics();
      const y = height - kb.separatorThickness / 2;
      sepG.moveTo(0, y);
      sepG.lineTo(width, y);
      sepG.stroke({
        color: colors.separatorColor,
        width: kb.separatorThickness,
      });
      container.addChild(sepG);
    }

    // ── 白键标签 ──
    const effectiveLabel = ctx.effectiveLabel;
    if (effectiveLabel) {
      const {
        fontSize,
        letterSpacing,
        y: labelY,
      } = KeyGraphicsFactory.whiteLabelMetrics(layout);

      for (let i = 0; i < layout.whiteKeys.length; i++) {
        const midi = layout.whiteKeys[i];
        const label = KeyboardLayoutCalculator.labelFor(midi, effectiveLabel);
        if (!label) continue;
        const x = (i + 0.5) * layout.whiteKeyWidth;

        container.addChild(
          KeyGraphicsFactory.createLabelText(
            label,
            fontSize,
            colors.labelColor,
            letterSpacing,
            x,
            labelY,
          ),
        );

        // ── tonic 圆点（C 键上的小圆点） ──
        const noteName = midiToNoteName(midi);
        if (
          noteName &&
          noteName.startsWith("C") &&
          !noteName.includes("#") &&
          !noteName.includes("b")
        ) {
          const dotRadius = Math.max(2.5, layout.whiteKeyWidth * 0.05);
          const dotY = labelY - fontSize - 10;

          const dotG = new Graphics();
          dotG.circle(x, dotY, dotRadius);
          dotG.fill({ color: colors.tonicDotColor });
          container.addChild(dotG);
        }
      }
    }
  }

  /**
   * 绘制黑键静态层到指定 Container。
   * 包含黑键渐变主体与黑键标签。
   */
  static drawBlackKeyLayer(container: Container, ctx: RenderContext): void {
    const { layout, kb, colors, from, to, midiToX } = ctx;

    // ── 黑键（主题感知渐变） ──
    const blackG = new Graphics();
    for (let m = from; m <= to; m++) {
      if (!isBlackKey(m)) continue;
      const cx = midiToX(m);
      const bx = cx - layout.blackKeyWidth / 2;
      const bw = layout.blackKeyWidth;
      const bh = layout.blackKeyHeight;

      const gradient = KeyGraphicsFactory.createBlackKeyGradient(
        bx,
        0,
        bh,
        colors.blackKeyColor,
        colors.blackGradientLight,
        colors.blackGradientDark,
      );
      blackG.roundRect(bx, 0, bw, bh, kb.keyCornerRadius);
      blackG.fill(gradient);
    }
    container.addChild(blackG);

    // ── 黑键标签 ──
    const effectiveLabel = ctx.effectiveLabel;
    if (effectiveLabel) {
      const {
        fontSize,
        letterSpacing,
        y: labelY,
      } = KeyGraphicsFactory.blackLabelMetrics(layout);

      for (let m = from; m <= to; m++) {
        if (!isBlackKey(m)) continue;
        const label = KeyboardLayoutCalculator.labelFor(m, effectiveLabel);
        if (!label) continue;
        const bx = midiToX(m);

        container.addChild(
          KeyGraphicsFactory.createLabelText(
            label,
            fontSize,
            colors.blackLabelColor,
            letterSpacing,
            bx,
            labelY,
          ),
        );
      }
    }
  }

  // ============================================================================
  // 高亮层绘制
  // ============================================================================

  /**
   * 绘制白键高亮层到指定 Graphics，并返回需要 addChild 的标签 Text 数组。
   * 调用方负责 addChild 与销毁，保持 LayerManager 对资源的统一管理。
   *
   * 绘制内容：半透明叠加 + 顶部高光带 + 标签覆写（由调用方添加）
   * @returns 标签 Text 数组（已定位，未 addChild）
   */
  static drawWhiteHighlight(
    g: Graphics,
    ctx: RenderContext,
    activeNotes: Set<number>,
  ): Text[] {
    const texts: Text[] = [];
    const { layout, kb, colors, height } = ctx;

    const overlayAlpha = colors.pressedOverlayAlpha;
    const pressedColor = colors.pressedKeyColor;
    const pressedLabelColor = colors.pressedLabelColor;

    const effectiveLabel = ctx.effectiveLabel;
    const whiteMetrics = effectiveLabel
      ? KeyGraphicsFactory.whiteLabelMetrics(layout)
      : null;

    for (let i = 0; i < layout.whiteKeys.length; i++) {
      const midi = layout.whiteKeys[i];
      if (!activeNotes.has(midi)) continue;
      const x = i * layout.whiteKeyWidth;
      const w = layout.whiteKeyWidth;

      // 1. 主体半透明叠加
      g.roundRect(x, 0, w, height, kb.keyCornerRadius);
      g.fill({ color: hexToRgba(pressedColor, overlayAlpha) });

      // 2. 顶部高光带（渐变从亮到透明）
      const glowH = Math.min(24, height * 0.15);
      const glowGrad = new FillGradient({
        start: { x, y: 0 },
        end: { x, y: glowH },
      });
      glowGrad.addColorStop(0, hexToRgba(pressedColor, overlayAlpha * 0.55));
      glowGrad.addColorStop(1, hexToRgba(pressedColor, 0));
      g.roundRect(x, 0, w, glowH, kb.keyCornerRadius);
      g.fill(glowGrad);

      // 3. 标签覆写（primary-content 色，覆盖静态层标签以保证可读性）
      if (effectiveLabel && whiteMetrics) {
        const label = KeyboardLayoutCalculator.labelFor(midi, effectiveLabel);
        if (label) {
          texts.push(
            KeyGraphicsFactory.createLabelText(
              label,
              whiteMetrics.fontSize,
              pressedLabelColor,
              whiteMetrics.letterSpacing,
              x + w / 2,
              whiteMetrics.y,
            ),
          );
        }
      }
    }
    return texts;
  }

  /**
   * 绘制黑键高亮层到指定 Graphics，并返回需要 addChild 的标签 Text 数组。
   * 调用方负责 addChild 与销毁，保持 LayerManager 对资源的统一管理。
   *
   * 绘制内容：半透明叠加 + 顶部高光带 + 标签覆写（由调用方添加）
   * @returns 标签 Text 数组（已定位，未 addChild）
   */
  static drawBlackHighlight(
    g: Graphics,
    ctx: RenderContext,
    activeNotes: Set<number>,
  ): Text[] {
    const texts: Text[] = [];
    const { layout, kb, colors, from, to, midiToX } = ctx;

    const overlayAlpha = colors.pressedOverlayAlpha;
    const pressedColor = colors.pressedKeyColor;
    const pressedLabelColor = colors.pressedLabelColor;

    const effectiveLabel = ctx.effectiveLabel;
    const blackMetrics = effectiveLabel
      ? KeyGraphicsFactory.blackLabelMetrics(layout)
      : null;

    for (let m = from; m <= to; m++) {
      if (!isBlackKey(m)) continue;
      if (!activeNotes.has(m)) continue;

      const cx = midiToX(m);
      const bx = cx - layout.blackKeyWidth / 2;
      const bw = layout.blackKeyWidth;
      const bh = layout.blackKeyHeight;

      // 1. 主体半透明叠加
      g.roundRect(bx, 0, bw, bh, kb.keyCornerRadius);
      g.fill({ color: hexToRgba(pressedColor, overlayAlpha) });

      // 2. 顶部高光带
      const glowH = Math.min(16, bh * 0.2);
      const glowGrad = new FillGradient({
        start: { x: bx, y: 0 },
        end: { x: bx, y: glowH },
      });
      glowGrad.addColorStop(0, hexToRgba(pressedColor, overlayAlpha * 0.55));
      glowGrad.addColorStop(1, hexToRgba(pressedColor, 0));
      g.roundRect(bx, 0, bw, glowH, kb.keyCornerRadius);
      g.fill(glowGrad);

      // 3. 标签覆写（primary-content 色）
      if (effectiveLabel && blackMetrics) {
        const label = KeyboardLayoutCalculator.labelFor(m, effectiveLabel);
        if (label) {
          texts.push(
            KeyGraphicsFactory.createLabelText(
              label,
              blackMetrics.fontSize,
              pressedLabelColor,
              blackMetrics.letterSpacing,
              cx,
              blackMetrics.y,
            ),
          );
        }
      }
    }
    return texts;
  }
}
