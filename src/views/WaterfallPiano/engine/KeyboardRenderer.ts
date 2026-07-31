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
import {
  KeyboardLayoutCalculator,
  isBlackKey,
  isWhiteKey,
  type KeyboardLayout,
} from "./KeyboardLayoutCalculator";
import { getThemeColors, type PianoThemeColors } from "../config/pianoThemes";

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
  /** 设备像素比，RenderTexture 按此倍率渲染以匹配渲染器分辨率，避免放大锯齿 */
  private dpr = 1;
  private from = 21;
  private to = 108;
  private activeNotes = new Set<number>();
  private _cachedLayout: KeyboardLayout | null = null;
  private _midiToIndex = new Map<number, number>();

  /** 静态缓存是否需要重建 */
  private _staticCacheDirty = true;

  /** 白键静态层 Sprite */
  private _whiteKeySprite: Sprite | null = null;
  /** 白键静态层 RenderTexture */
  private _whiteKeyRT: RenderTexture | null = null;

  /** 黑键静态层 Sprite */
  private _blackKeySprite: Sprite | null = null;
  /** 黑键静态层 RenderTexture */
  private _blackKeyRT: RenderTexture | null = null;

  /** 白键高亮层 Graphics */
  private _whiteHighlightG: Graphics | null = null;
  /** 黑键高亮层 Graphics */
  private _blackHighlightG: Graphics | null = null;

  // ============================================================================
  // 主题色板解析与颜色辅助
  // ============================================================================

  /**
   * 读取 DaisyUI 主题的 CSS 变量并转换为十六进制色值。
   * 尝试通过临时元素让浏览器解析为 rgb；若失败则直接读取 CSS 变量值并尝试解析 oklch 或 hsl。
   * @returns 十六进制色值（如 "#5700e6"），读取失败时返回 null
   */
  private _readDaisyUiColor(varName: string): string | null {
    if (typeof document === "undefined") return null;
    // 方法1：通过临时元素让浏览器解析 CSS 变量为 rgb
    const el = document.createElement("div");
    el.style.color = `var(${varName})`;
    el.style.display = "none";
    document.body.appendChild(el);
    const computed = getComputedStyle(el).color;
    document.body.removeChild(el);
    const rgbMatch = computed.match(
      /rgba?\((\d+),\s*(\d+),\s*(\d+)/,
    );
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]);
      const g = parseInt(rgbMatch[2]);
      const b = parseInt(rgbMatch[3]);
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    }
    // 方法2：直接读取 CSS 变量值，尝试解析 oklch()
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
    const oklchMatch = raw.match(
      /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/,
    );
    if (oklchMatch) {
      return this._oklchToHex(
        parseFloat(oklchMatch[1]),
        parseFloat(oklchMatch[2]),
        parseFloat(oklchMatch[3]),
      );
    }
    // 方法3：尝试解析 hsl() 格式
    const hslMatch = raw.match(
      /hsl\(\s*([\d.]+)\s+([\d.]+)%?\s+([\d.]+)%?/,
    );
    if (hslMatch) {
      return this._hslToHex(
        parseFloat(hslMatch[1]),
        parseFloat(hslMatch[2]),
        parseFloat(hslMatch[3]),
      );
    }
    return null;
  }

  /** 将 HSL 色值转换为十六进制（sRGB） */
  private _hslToHex(h: number, s: number, l: number): string {
    const sNorm = s / 100;
    const lNorm = l / 100;
    const a = sNorm * Math.min(lNorm, 1 - lNorm);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      return lNorm - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    const clamp = (v: number) =>
      Math.max(0, Math.min(255, Math.round(v * 255)));
    return `#${clamp(f(0)).toString(16).padStart(2, "0")}${clamp(f(8)).toString(16).padStart(2, "0")}${clamp(f(4)).toString(16).padStart(2, "0")}`;
  }

  /** 将 OKLCH 色值转换为十六进制（sRGB 近似） */
  private _oklchToHex(l: number, c: number, h: number): string {
    // OKLCH → OKLab
    const hRad = (h * Math.PI) / 180;
    const a = c * Math.cos(hRad);
    const b = c * Math.sin(hRad);
    // OKLab → linear sRGB
    const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = l - 0.0894841775 * a - 1.2914855480 * b;
    const l3 = l_ * l_ * l_;
    const m3 = m_ * m_ * m_;
    const s3 = s_ * s_ * s_;
    const r =
      4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
    const g =
      -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
    const b_ =
      -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;
    const clamp = (v: number) =>
      Math.max(0, Math.min(255, Math.round(v * 255)));
    return `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g).toString(16).padStart(2, "0")}${clamp(b_).toString(16).padStart(2, "0")}`;
  }

  /**
   * 解析当前配置的有效颜色集。
   * 若设置了 theme，使用主题色板覆盖各独立颜色字段；否则使用 kb 中的独立颜色。
   * pressedKeyColor 始终被 DaisyUI 主题色 (--p) 覆盖，保证键盘高亮与全局主题一致。
   */
  private _resolveColors(kb: KeyboardConfig): PianoThemeColors {
    // 优先读取 DaisyUI primary 色作为高亮色
    const daisyPrimary = this._readDaisyUiColor("--p");

    const tc = getThemeColors(kb.theme);
    if (tc) {
      return {
        ...tc,
        pressedKeyColor: daisyPrimary ?? tc.pressedKeyColor,
        separatorColor: daisyPrimary ?? tc.separatorColor,
      };
    }
    // 无主题时回退到独立颜色 + 默认渐变参数
    return {
      whiteKeyColor: kb.whiteKeyColor,
      blackKeyColor: kb.blackKeyColor,
      pressedKeyColor: daisyPrimary ?? kb.pressedKeyColor,
      keyBorderColor: kb.keyBorderColor,
      separatorColor: daisyPrimary ?? kb.separatorColor,
      labelColor: "#4a4a4a",
      blackLabelColor: "rgba(255, 255, 255, 0.9)",
      tonicDotColor: "#9ca3af",
      pressedOverlayAlpha: 0.25,
      whiteGradientLight: 0.02,
      whiteGradientDark: 0.04,
      blackGradientLight: 0.08,
      blackGradientDark: 0.03,
    };
  }

  // ============================================================================
  // 现代化渐变效果（扁平化设计 + 主题感知）
  // ============================================================================

  /**
   * 创建白键渐变（现代扁平化风格）
   * 纯色填充 + 极微妙的顶部提亮与底部压暗
   */
  private _createWhiteKeyGradient(
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
    const rgb = this._hexToRgb(baseColor);
    if (!rgb) {
      gradient.addColorStop(0, baseColor);
      gradient.addColorStop(1, baseColor);
      return gradient;
    }

    const lighter = this._lightenColor(rgb, lightAmount);
    const darker = this._darkenColor(rgb, darkAmount);

    gradient.addColorStop(0, lighter);
    gradient.addColorStop(0.85, baseColor);
    gradient.addColorStop(1, darker);

    return gradient;
  }

  /**
   * 创建黑键渐变（现代扁平化风格）
   * 深色填充 + 顶部微高光
   */
  private _createBlackKeyGradient(
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
    const rgb = this._hexToRgb(baseColor);
    if (!rgb) {
      gradient.addColorStop(0, baseColor);
      gradient.addColorStop(1, baseColor);
      return gradient;
    }

    const lighter = this._lightenColor(rgb, lightAmount);
    const darker = this._darkenColor(rgb, darkAmount);

    gradient.addColorStop(0, lighter);
    gradient.addColorStop(0.15, baseColor);
    gradient.addColorStop(1, darker);

    return gradient;
  }

  // ============================================================================
  // 颜色辅助函数
  // ============================================================================

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

  /** 将 hex 色值转换为带 alpha 的 rgba 字符串 */
  private _hexToRgba(hex: string, alpha: number): string {
    const rgb = this._hexToRgb(hex);
    if (!rgb) return hex;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }

  private _lightenColor(
    rgb: { r: number; g: number; b: number },
    amount: number,
  ): string {
    const r = Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * amount));
    const g = Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * amount));
    const b = Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * amount));
    return `rgb(${r}, ${g}, ${b})`;
  }

  private _darkenColor(
    rgb: { r: number; g: number; b: number },
    amount: number,
  ): string {
    const r = Math.max(0, Math.floor(rgb.r * (1 - amount)));
    const g = Math.max(0, Math.floor(rgb.g * (1 - amount)));
    const b = Math.max(0, Math.floor(rgb.b * (1 - amount)));
    return `rgb(${r}, ${g}, ${b})`;
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

    // ── 创建分层渲染结构 ──
    // 渲染顺序：白键静态 -> 白键高亮 -> 黑键静态 -> 黑键高亮

    // 1. 白键静态层
    if (!this._whiteKeySprite) {
      this._whiteKeySprite = new Sprite();
      this._whiteKeySprite.label = "white-keys-static";
      container.addChild(this._whiteKeySprite);
    }

    // 2. 白键高亮层
    if (!this._whiteHighlightG) {
      this._whiteHighlightG = new Graphics();
      this._whiteHighlightG.label = "white-keys-highlight";
      container.addChild(this._whiteHighlightG);
    }

    // 3. 黑键静态层
    if (!this._blackKeySprite) {
      this._blackKeySprite = new Sprite();
      this._blackKeySprite.label = "black-keys-static";
      container.addChild(this._blackKeySprite);
    }

    // 4. 黑键高亮层
    if (!this._blackHighlightG) {
      this._blackHighlightG = new Graphics();
      this._blackHighlightG.label = "black-keys-highlight";
      container.addChild(this._blackHighlightG);
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
   * @param dpr - 设备像素比，RenderTexture 按此倍率渲染以匹配渲染器分辨率
   */
  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.dpr = Math.max(1, dpr);
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
    const blackKeyHeightRatio = this.config?.blackKeyHeightRatio;
    this._cachedLayout = KeyboardLayoutCalculator.calculateLayout(
      this.width,
      this.height,
      this.from,
      this.to,
      blackKeyHeightRatio,
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
   * 将像素坐标转换为对应的 MIDI 音符号。
   * 传入 y 坐标可避免黑键下方的白键区域被错误拦截。
   */
  xToMidi(x: number, y?: number): number | null {
    const layout = this.getLayout();
    return KeyboardLayoutCalculator.xToMidi(x, layout, y);
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
    if (!this.container || !this.renderer || !this.config) {
      return;
    }
    const layout = this.getLayout();
    const kb = this.config;

    if (!kb.visible) {
      this._whiteKeySprite && (this._whiteKeySprite.visible = false);
      this._blackKeySprite && (this._blackKeySprite.visible = false);
      this._whiteHighlightG && this._whiteHighlightG.clear();
      this._blackHighlightG && this._blackHighlightG.clear();
      return;
    }

    // ── 重建静态层缓存 ──
    if (this._staticCacheDirty) {
      this.rebuildWhiteKeyCache(layout, kb);
      this.rebuildBlackKeyCache(layout, kb);
      this._staticCacheDirty = false;
    }

    // 确保静态层可见
    if (this._whiteKeySprite) this._whiteKeySprite.visible = true;
    if (this._blackKeySprite) this._blackKeySprite.visible = true;

    // ── 绘制动态高亮层 ──
    this.renderHighlightLayer(layout, kb);
  }

  /** 构建白键静态层 RenderTexture */
  private rebuildWhiteKeyCache(
    layout: KeyboardLayout,
    kb: KeyboardConfig,
  ): void {
    if (!this.renderer) return;
    const r = this.renderer;
    const colors = this._resolveColors(kb);

    // 销毁旧 RenderTexture
    if (this._whiteKeyRT) {
      this._whiteKeyRT.destroy(true);
      this._whiteKeyRT = null;
    }

    // 创建新的 RenderTexture（按 dpr 放大实际像素，匹配渲染器分辨率以消除放大锯齿）
    const rt = RenderTexture.create({
      width: Math.max(1, Math.ceil(this.width)),
      height: Math.max(1, Math.ceil(this.height)),
      resolution: this.dpr,
    });
    this._whiteKeyRT = rt;

    // 构建临时 Container
    const tmpContainer = new Container();

    // ── 白键（主题感知渐变） ──
    const whiteG = new Graphics();
    for (let i = 0; i < layout.whiteKeys.length; i++) {
      const x = i * layout.whiteKeyWidth;
      const w = layout.whiteKeyWidth;

      const gradient = this._createWhiteKeyGradient(
        x,
        0,
        this.height,
        colors.whiteKeyColor,
        colors.whiteGradientLight,
        colors.whiteGradientDark,
      );
      whiteG.roundRect(x, 0, w, this.height, kb.keyCornerRadius);
      whiteG.fill(gradient);

      // 边框
      if (kb.keyBorderWidth > 0) {
        whiteG.roundRect(x, 0, w, this.height, kb.keyCornerRadius);
        whiteG.stroke({
          color: colors.keyBorderColor,
          width: kb.keyBorderWidth,
        });
      }
    }
    tmpContainer.addChild(whiteG);

    // ── 分隔线 ──
    if (kb.separatorEnabled && kb.separatorThickness > 0) {
      const sepG = new Graphics();
      const y = this.height - kb.separatorThickness / 2;
      sepG.moveTo(0, y);
      sepG.lineTo(this.width, y);
      sepG.stroke({
        color: colors.separatorColor,
        width: kb.separatorThickness,
      });
      tmpContainer.addChild(sepG);
    }

    // ── 白键标签 ──
    if (kb.keyLabel !== "none" || kb.showNoteNames) {
      const effectiveLabel =
        kb.showNoteNames && kb.keyLabel === "none" ? "note" : kb.keyLabel;

      const whiteFontSize = Math.max(
        11,
        Math.min(16, layout.whiteKeyWidth * 0.26),
      );
      const labelY = this.height - 8;

      for (let i = 0; i < layout.whiteKeys.length; i++) {
        const midi = layout.whiteKeys[i];
        const label = KeyboardLayoutCalculator.labelFor(midi, effectiveLabel);
        if (!label) continue;
        const x = (i + 0.5) * layout.whiteKeyWidth;

        const txt = new Text({
          text: label,
          style: {
            fontSize: whiteFontSize,
            fontFamily:
              "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: "600",
            fill: colors.labelColor,
            letterSpacing: 0.5,
          },
        });
        txt.x = x;
        txt.y = labelY;
        txt.anchor.set(0.5, 1);
        tmpContainer.addChild(txt);

        // ── tonic 圆点（C 键上的小圆点） ──
        const noteName = midiToNoteName(midi);
        if (
          noteName &&
          noteName.startsWith("C") &&
          !noteName.includes("#") &&
          !noteName.includes("b")
        ) {
          const dotRadius = Math.max(2.5, layout.whiteKeyWidth * 0.05);
          const dotY = labelY - whiteFontSize - 10;

          const dotG = new Graphics();
          dotG.circle(x, dotY, dotRadius);
          dotG.fill({ color: colors.tonicDotColor });
          tmpContainer.addChild(dotG);
        }
      }
    }

    // 渲染临时 Container 到 RenderTexture
    r.render({ container: tmpContainer, target: rt });

    // 销毁临时 Container
    tmpContainer.destroy({ children: true });

    // 更新 Sprite 纹理
    if (this._whiteKeySprite) {
      this._whiteKeySprite.texture = rt;
    }
  }

  /** 构建黑键静态层 RenderTexture */
  private rebuildBlackKeyCache(
    layout: KeyboardLayout,
    kb: KeyboardConfig,
  ): void {
    if (!this.renderer) return;
    const r = this.renderer;
    const colors = this._resolveColors(kb);

    // 销毁旧 RenderTexture
    if (this._blackKeyRT) {
      this._blackKeyRT.destroy(true);
      this._blackKeyRT = null;
    }

    // 创建新的 RenderTexture（按 dpr 放大实际像素，匹配渲染器分辨率以消除放大锯齿）
    const rt = RenderTexture.create({
      width: Math.max(1, Math.ceil(this.width)),
      height: Math.max(1, Math.ceil(this.height)),
      resolution: this.dpr,
    });
    this._blackKeyRT = rt;

    // 构建临时 Container
    const tmpContainer = new Container();

    // ── 黑键（主题感知渐变） ──
    const blackG = new Graphics();
    for (let m = this.from; m <= this.to; m++) {
      if (!isBlackKey(m)) continue;
      const cx = this.midiToX(m);
      const bx = cx - layout.blackKeyWidth / 2;
      const bw = layout.blackKeyWidth;
      const bh = layout.blackKeyHeight;

      const gradient = this._createBlackKeyGradient(
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
    tmpContainer.addChild(blackG);

    // ── 黑键标签 ──
    if (kb.keyLabel !== "none" || kb.showNoteNames) {
      const effectiveLabel =
        kb.showNoteNames && kb.keyLabel === "none" ? "note" : kb.keyLabel;

      const blackFontSize = Math.max(
        9,
        Math.min(13, layout.blackKeyWidth * 0.3),
      );
      const labelY = layout.blackKeyHeight - 6;

      for (let m = this.from; m <= this.to; m++) {
        if (!isBlackKey(m)) continue;
        const label = KeyboardLayoutCalculator.labelFor(m, effectiveLabel);
        if (!label) continue;
        const bx = this.midiToX(m);

        const txt = new Text({
          text: label,
          style: {
            fontSize: blackFontSize,
            fontFamily:
              "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: "600",
            fill: colors.blackLabelColor,
            letterSpacing: 0.3,
          },
        });
        txt.x = bx;
        txt.y = labelY;
        txt.anchor.set(0.5, 1);
        tmpContainer.addChild(txt);
      }
    }

    // 渲染临时 Container 到 RenderTexture
    r.render({ container: tmpContainer, target: rt });

    // 销毁临时 Container
    tmpContainer.destroy({ children: true });

    // 更新 Sprite 纹理
    if (this._blackKeySprite) {
      this._blackKeySprite.texture = rt;
    }
  }

  /** 绘制动态高亮层（按下的键）— 半透明叠加 + 顶部高光 */
  private renderHighlightLayer(
    layout: KeyboardLayout,
    kb: KeyboardConfig,
  ): void {
    // 清空高亮层
    if (this._whiteHighlightG) this._whiteHighlightG.clear();
    if (this._blackHighlightG) this._blackHighlightG.clear();

    if (this.activeNotes.size === 0) return;

    const colors = this._resolveColors(kb);
    const overlayAlpha = colors.pressedOverlayAlpha;
    const pressedColor = colors.pressedKeyColor;

    // 绘制白键高亮：半透明叠加 + 顶部高光带
    if (this._whiteHighlightG) {
      const g = this._whiteHighlightG;
      for (let i = 0; i < layout.whiteKeys.length; i++) {
        const midi = layout.whiteKeys[i];
        if (!this.activeNotes.has(midi)) continue;
        const x = i * layout.whiteKeyWidth;
        const w = layout.whiteKeyWidth;

        // 1. 主体半透明叠加
        g.roundRect(x, 0, w, this.height, kb.keyCornerRadius);
        g.fill({ color: this._hexToRgba(pressedColor, overlayAlpha) });

        // 2. 顶部高光带（渐变从亮到透明）
        const glowH = Math.min(24, this.height * 0.15);
        const glowGrad = new FillGradient({
          start: { x, y: 0 },
          end: { x, y: glowH },
        });
        glowGrad.addColorStop(
          0,
          this._hexToRgba(pressedColor, overlayAlpha * 0.55),
        );
        glowGrad.addColorStop(1, this._hexToRgba(pressedColor, 0));
        g.roundRect(x, 0, w, glowH, kb.keyCornerRadius);
        g.fill(glowGrad);
      }
    }

    // 绘制黑键高亮：半透明叠加 + 顶部高光带
    if (this._blackHighlightG) {
      const g = this._blackHighlightG;
      for (let m = this.from; m <= this.to; m++) {
        if (!isBlackKey(m)) continue;
        if (!this.activeNotes.has(m)) continue;

        const cx = this.midiToX(m);
        const bx = cx - layout.blackKeyWidth / 2;
        const bw = layout.blackKeyWidth;
        const bh = layout.blackKeyHeight;

        // 1. 主体半透明叠加
        g.roundRect(bx, 0, bw, bh, kb.keyCornerRadius);
        g.fill({ color: this._hexToRgba(pressedColor, overlayAlpha) });

        // 2. 顶部高光带
        const glowH = Math.min(16, bh * 0.2);
        const glowGrad = new FillGradient({
          start: { x: bx, y: 0 },
          end: { x: bx, y: glowH },
        });
        glowGrad.addColorStop(
          0,
          this._hexToRgba(pressedColor, overlayAlpha * 0.55),
        );
        glowGrad.addColorStop(1, this._hexToRgba(pressedColor, 0));
        g.roundRect(bx, 0, bw, glowH, kb.keyCornerRadius);
        g.fill(glowGrad);
      }
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
    // 销毁白键层资源
    if (this._whiteKeyRT) {
      this._whiteKeyRT.destroy(true);
      this._whiteKeyRT = null;
    }
    if (this._whiteKeySprite) {
      this._whiteKeySprite.destroy();
      this._whiteKeySprite = null;
    }
    if (this._whiteHighlightG) {
      this._whiteHighlightG.destroy();
      this._whiteHighlightG = null;
    }

    // 销毁黑键层资源
    if (this._blackKeyRT) {
      this._blackKeyRT.destroy(true);
      this._blackKeyRT = null;
    }
    if (this._blackKeySprite) {
      this._blackKeySprite.destroy();
      this._blackKeySprite = null;
    }
    if (this._blackHighlightG) {
      this._blackHighlightG.destroy();
      this._blackHighlightG = null;
    }

    this.container = null;
    this.renderer = null;
  }
}
