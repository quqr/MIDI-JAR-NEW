/**
 * 钢琴键盘渲染器（PixiJS v8）
 * 使用 Graphics + FillGradient + Text 绘制键盘，
 * RenderTexture 缓存静态层，Graphics 叠加动态高亮层
 */

import {
  Container,
  Graphics,
  Text,
  Sprite,
  RenderTexture,
  FillGradient,
} from "pixi.js";
import type { Renderer } from "pixi.js";
import type { KeyboardConfig } from "../types";
import { midiToNoteName } from "../constants";
import { getPianoThemeColors } from "./themeColors";
import {
  KeyboardLayoutCalculator,
  isBlackKey,
  isWhiteKey,
  type KeyboardLayout,
} from "./KeyboardLayoutCalculator";

// ── 重新导出以保持向后兼容 ──
export { isBlackKey, isWhiteKey, KeyboardLayout };

/**
 * 钢琴键盘渲染器，负责在 PixiJS Container 上绘制钢琴键盘并管理 MIDI 音符与像素坐标的双向映射
 */
export class KeyboardRenderer {
  private container: Container | null = null;
  private renderer: Renderer | null = null;
  private config: KeyboardConfig | null = null;
  private width = 0;
  private height = 0;
  private from = 21;
  private to = 108;
  private activeNotes = new Set<number>();
  private _cachedLayout: KeyboardLayout | null = null;
  private _midiToIndex = new Map<number, number>();

  /** 静态层 Sprite（显示缓存到 RenderTexture 的键体/边框/标签） */
  private _staticSprite: Sprite | null = null;
  /** 静态层 RenderTexture 缓存 */
  private _staticRT: RenderTexture | null = null;
  /** 静态缓存是否需要重建 */
  private _staticCacheDirty = true;
  /** 动态高亮层 Graphics（按下的键） */
  private _highlightGraphics: Graphics | null = null;

  /**
   * 获取主题颜色（从daisyUI）
   */
  private _getThemeColors() {
    const colors = getPianoThemeColors();
    return {
      whiteKey: colors.whiteKey,
      blackKey: colors.blackKey,
      pressedKey: colors.pressedKey,
      labelLight: "#333333",
      labelDark: "#ffffff",
    };
  }

  /**
   * 创建从顶部到底部的 FillGradient（模拟 3D 渐变效果）
   */
  private _createFillGradient(
    x: number,
    y: number,
    _w: number,
    h: number,
    baseColor: string,
    intensity: number = 0.15,
  ): FillGradient {
    const gradient = new FillGradient(x, y, x, y + h);

    const rgb = this._hexToRgb(baseColor);
    if (!rgb) {
      gradient.addColorStop(0, baseColor);
      gradient.addColorStop(1, baseColor);
      return gradient;
    }

    const lighterR = Math.min(255, Math.floor(rgb.r * (1 + intensity)));
    const lighterG = Math.min(255, Math.floor(rgb.g * (1 + intensity)));
    const lighterB = Math.min(255, Math.floor(rgb.b * (1 + intensity)));

    gradient.addColorStop(0, `rgb(${lighterR}, ${lighterG}, ${lighterB})`);
    gradient.addColorStop(1, baseColor);

    return gradient;
  }

  private _hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  /**
   * 初始化渲染器，绑定 PixiJS Container + Renderer 和键盘配置
   * @param container - 键盘绘制目标 Container
   * @param renderer - PixiJS Renderer（用于 RenderTexture 渲染）
   * @param config - 键盘配置
   */
  init(container: Container, renderer: Renderer, config: KeyboardConfig): void {
    if (!container || !renderer) return;
    this.container = container;
    this.renderer = renderer;
    this.config = config;
    this._staticCacheDirty = true;

    // 创建静态层 Sprite
    if (!this._staticSprite) {
      this._staticSprite = new Sprite();
      this._staticSprite.label = "keyboard-static";
      container.addChild(this._staticSprite);
    }

    // 创建动态高亮层 Graphics
    if (!this._highlightGraphics) {
      this._highlightGraphics = new Graphics();
      this._highlightGraphics.label = "keyboard-highlights";
      container.addChild(this._highlightGraphics);
    }

    this.applyRangeFromConfig();
  }

  /** 更新键盘配置并标记静态缓存为脏 */
  setKeyboardConfig(kb: KeyboardConfig): void {
    this.config = kb;
    this._staticCacheDirty = true;
    this.applyRangeFromConfig();
  }

  /** 根据键盘配置中的范围设置更新 MIDI 范围 */
  private applyRangeFromConfig(): void {
    if (!this.config) return;
    const range = KeyboardLayoutCalculator.rangeFromConfig(this.config);
    this.from = range.from;
    this.to = range.to;
  }

  /**
   * 调整画布尺寸，根据宽度自动切换窄屏/宽屏 MIDI 范围
   * @param width - 逻辑宽度（CSS 像素）
   * @param height - 逻辑高度（CSS 像素）
   * @param _dpr - 设备像素比（PixiJS 自动处理）
   */
  resize(width: number, height: number, _dpr: number): void {
    this.width = width;
    this.height = height;
    this._staticCacheDirty = true;

    if (this.config) {
      const range = KeyboardLayoutCalculator.rangeForWidth(width, this.config);
      this.from = range.from;
      this.to = range.to;
    }

    this.invalidateLayout();
  }

  setRange(from: number, to: number): void {
    this.from = from;
    this.to = to;
    this.invalidateLayout();
  }

  getVisibleRange(): { from: number; to: number } {
    return { from: this.from, to: this.to };
  }

  /**
   * 重建键盘布局缓存
   */
  private rebuildLayout(): void {
    this._cachedLayout = KeyboardLayoutCalculator.calculateLayout(
      this.width,
      this.height,
      this.from,
      this.to,
    );
    this._midiToIndex = KeyboardLayoutCalculator.buildMidiToIndex(
      this.from,
      this.to,
    );
  }

  private getLayout(): KeyboardLayout {
    if (!this._cachedLayout) this.rebuildLayout();
    return this._cachedLayout!;
  }

  invalidateLayout(): void {
    this._cachedLayout = null;
    this._staticCacheDirty = true;
  }

  /**
   * 将 MIDI 音符号转换为对应的水平像素坐标（键中心位置）
   */
  midiToX(midi: number): number {
    const layout = this.getLayout();
    return KeyboardLayoutCalculator.midiToX(midi, layout, this._midiToIndex);
  }

  /**
   * 将水平像素坐标转换为对应的 MIDI 音符号
   */
  xToMidi(x: number): number | null {
    const layout = this.getLayout();
    return KeyboardLayoutCalculator.xToMidi(x, layout);
  }

  highlightNote(midi: number): void {
    this.activeNotes.add(midi);
  }

  clearHighlight(midi: number): void {
    this.activeNotes.delete(midi);
  }

  clearAllHighlights(): void {
    this.activeNotes.clear();
  }

  getActiveNotes(): number[] {
    return Array.from(this.activeNotes);
  }

  getRangeText(): string {
    return `${midiToNoteName(this.from)} - ${midiToNoteName(this.to)}`;
  }

  render(): void {
    if (!this.container || !this.renderer || !this.config) return;
    const layout = this.getLayout();
    const kb = this.config;

    if (!kb.visible) {
      this._staticSprite && (this._staticSprite.visible = false);
      this._highlightGraphics && this._highlightGraphics.clear();
      return;
    }

    // ── 重建静态层缓存 ──
    if (this._staticCacheDirty) {
      this.rebuildStaticCache(layout, kb);
    }

    // 确保 static sprite 可见
    if (this._staticSprite) this._staticSprite.visible = true;

    // ── 绘制动态高亮层 ──
    this.renderHighlightLayer(layout, kb);
  }

  /** 使用临时 Container 渲染到 RenderTexture，然后作为 Sprite 显示 */
  private rebuildStaticCache(layout: KeyboardLayout, kb: KeyboardConfig): void {
    if (!this.renderer) return;
    const themeColors = this._getThemeColors();
    const r = this.renderer;

    // 销毁旧 RenderTexture
    if (this._staticRT) {
      this._staticRT.destroy(true);
      this._staticRT = null;
    }

    // 创建新的 RenderTexture
    const rt = RenderTexture.create({
      width: Math.max(1, Math.ceil(this.width)),
      height: Math.max(1, Math.ceil(this.height)),
    });
    this._staticRT = rt;

    // 构建临时 Container
    const tmpContainer = new Container();

    // ── 白键 ──
    const whiteG = new Graphics();
    for (let i = 0; i < layout.whiteKeys.length; i++) {
      const x = i * layout.whiteKeyWidth;
      const w = layout.whiteKeyWidth;

      const gradient = this._createFillGradient(
        x,
        0,
        w,
        this.height,
        themeColors.whiteKey,
        0.15,
      );
      whiteG.roundRect(x, 0, w, this.height, kb.keyCornerRadius);
      whiteG.fill(gradient);

      if (kb.keyBorderWidth > 0) {
        whiteG.roundRect(x, 0, w, this.height, kb.keyCornerRadius);
        whiteG.stroke({ color: kb.keyBorderColor, width: kb.keyBorderWidth });
      }
    }
    tmpContainer.addChild(whiteG);

    // ── 分隔线 ──
    if (kb.separatorEnabled && kb.separatorThickness > 0) {
      const sepG = new Graphics();
      const y = this.height - kb.separatorThickness / 2;
      sepG.moveTo(0, y);
      sepG.lineTo(this.width, y);
      sepG.stroke({ color: kb.separatorColor, width: kb.separatorThickness });
      tmpContainer.addChild(sepG);
    }

    // ── 黑键 ──
    const blackG = new Graphics();
    for (let m = this.from; m <= this.to; m++) {
      if (!isBlackKey(m)) continue;
      const cx = this.midiToX(m);
      const bx = cx - layout.blackKeyWidth / 2;
      const bw = layout.blackKeyWidth;
      const bh = layout.blackKeyHeight;

      const gradient = this._createFillGradient(
        bx,
        0,
        bw,
        bh,
        themeColors.blackKey,
        0.15,
      );
      blackG.roundRect(bx, 0, bw, bh, kb.keyCornerRadius);
      blackG.fill(gradient);
    }
    tmpContainer.addChild(blackG);

    // ── 标签 ──
    if (kb.keyLabel !== "none" || kb.showNoteNames) {
      const effectiveLabel =
        kb.showNoteNames && kb.keyLabel === "none" ? "note" : kb.keyLabel;

      // 白键标签
      const whiteFontSize = Math.max(8, layout.whiteKeyWidth * 0.3);
      for (let i = 0; i < layout.whiteKeys.length; i++) {
        const midi = layout.whiteKeys[i];
        const label = KeyboardLayoutCalculator.labelFor(midi, effectiveLabel);
        if (!label) continue;
        const x = (i + 0.5) * layout.whiteKeyWidth;
        const txt = new Text({
          text: label,
          style: {
            fontSize: whiteFontSize,
            fill: themeColors.labelLight,
            fontFamily: "sans-serif",
          },
        });
        txt.x = x;
        txt.y = this.height - 4;
        txt.anchor.set(0.5, 1);
        tmpContainer.addChild(txt);
      }

      // 黑键标签
      const blackFontSize = Math.max(7, layout.blackKeyWidth * 0.35);
      for (let m = this.from; m <= this.to; m++) {
        if (!isBlackKey(m)) continue;
        const label = KeyboardLayoutCalculator.labelFor(m, effectiveLabel);
        if (!label) continue;
        const bx = this.midiToX(m);
        const txt = new Text({
          text: label,
          style: {
            fontSize: blackFontSize,
            fill: themeColors.labelDark,
            fontFamily: "sans-serif",
          },
        });
        txt.x = bx;
        txt.y = layout.blackKeyHeight - 4;
        txt.anchor.set(0.5, 1);
        tmpContainer.addChild(txt);
      }
    }

    // 渲染临时 Container 到 RenderTexture
    r.render({ container: tmpContainer, target: rt });

    // 销毁临时 Container（释放 Graphics / Text 资源）
    tmpContainer.destroy({ children: true });

    // 更新 Sprite 纹理
    if (this._staticSprite) {
      this._staticSprite.texture = rt;
    }

    this._staticCacheDirty = false;
  }

  /** 绘制动态高亮层（按下的键），直接在 _highlightGraphics 上绘制 */
  private renderHighlightLayer(
    layout: KeyboardLayout,
    kb: KeyboardConfig,
  ): void {
    if (!this._highlightGraphics) return;
    this._highlightGraphics.clear();

    if (this.activeNotes.size === 0) return;

    const g = this._highlightGraphics;
    const themeColors = this._getThemeColors();

    // 1. 高亮白键
    for (let i = 0; i < layout.whiteKeys.length; i++) {
      const midi = layout.whiteKeys[i];
      if (!this.activeNotes.has(midi)) continue;
      const x = i * layout.whiteKeyWidth;
      const w = layout.whiteKeyWidth;

      const gradient = this._createFillGradient(
        x,
        0,
        w,
        this.height,
        themeColors.pressedKey,
        0.15,
      );
      g.roundRect(x, 0, w, this.height, kb.keyCornerRadius);
      g.fill(gradient);
    }

    // 2. 重新绘制所有黑键（覆盖白键高亮，确保正确的显示）
    for (let m = this.from; m <= this.to; m++) {
      if (!isBlackKey(m)) continue;
      const cx = this.midiToX(m);
      const bx = cx - layout.blackKeyWidth / 2;
      const bw = layout.blackKeyWidth;
      const bh = layout.blackKeyHeight;

      const isActive = this.activeNotes.has(m);
      const baseColor = isActive
        ? themeColors.pressedKey
        : themeColors.blackKey;
      const gradient = this._createFillGradient(
        bx,
        0,
        bw,
        bh,
        baseColor,
        isActive ? 0.2 : 0.15,
      );
      g.roundRect(bx, 0, bw, bh, kb.keyCornerRadius);
      g.fill(gradient);
    }
  }

  getKeyboardHeight(): number {
    return this.height;
  }

  getWhiteKeyWidth(): number {
    return this.getLayout().whiteKeyWidth;
  }

  /**
   * 销毁渲染器持有的所有 PixiJS 资源
   */
  dispose(): void {
    if (this._staticRT) {
      this._staticRT.destroy(true);
      this._staticRT = null;
    }
    if (this._staticSprite) {
      this._staticSprite.destroy();
      this._staticSprite = null;
    }
    if (this._highlightGraphics) {
      this._highlightGraphics.destroy();
      this._highlightGraphics = null;
    }
    this.container = null;
    this.renderer = null;
  }
}
