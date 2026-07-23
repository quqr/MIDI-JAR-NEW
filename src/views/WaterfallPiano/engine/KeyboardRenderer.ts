import type { KeyboardConfig } from "../types";
import {
  midiToNoteName,
  midiToPitchClass,
  noteNameToMidi,
  NARROW_BREAKPOINT,
  KEYBOARD_RANGES,
  NARROW_RANGE,
} from "../constants";
import { getPianoThemeColors, createTopGradient } from "./themeColors";

const BLACK_KEY_CLASSES = new Set([1, 3, 6, 8, 10]);
const BLACK_KEY_WIDTH_RATIO = 0.6;
const BLACK_KEY_HEIGHT_RATIO = 0.62;

function isBlackKey(midi: number): boolean {
  return BLACK_KEY_CLASSES.has(((midi % 12) + 12) % 12);
}

function isWhiteKey(midi: number): boolean {
  return !isBlackKey(midi);
}

export interface KeyboardLayout {
  whiteKeys: number[];
  whiteKeyWidth: number;
  blackKeyWidth: number;
  height: number;
  blackKeyHeight: number;
  from: number;
  to: number;
}

/**
 * 钢琴键盘渲染器，负责在 Canvas 上绘制钢琴键盘并管理 MIDI 音符与像素坐标的双向映射
 */
export class KeyboardRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private config: KeyboardConfig | null = null;
  private width = 0;
  private height = 0;
  private from = 21;
  private to = 108;
  private activeNotes = new Set<number>();
  private _cachedLayout: KeyboardLayout | null = null;
  private _midiToIndex = new Map<number, number>();
  /** 离屏 Canvas 缓存静态层（键体、边框、分隔线、标签） */
  private _staticCache: HTMLCanvasElement | null = null;
  private _staticCacheCtx: CanvasRenderingContext2D | null = null;
  private _staticCacheDpr = 1;
  private _staticCacheDirty = true;

  /**
   * 获取主题颜色（从daisyUI）
   * 如果无法获取CSS变量，则返回配置中的颜色作为后备
   */
  private _getThemeColors() {
    const colors = getPianoThemeColors();
    return {
      whiteKey: colors.whiteKey,
      blackKey: colors.blackKey,
      pressedKey: colors.pressedKey,
      labelLight: "#333333", // 深色标签用于白键
      labelDark: "#ffffff",   // 浅色标签用于黑键
    };
  }

  /**
   * 初始化渲染器，绑定 Canvas 元素和键盘配置
   * @param canvas - 键盘绘制目标 Canvas
   * @param config - 键盘配置
   */
  init(canvas: HTMLCanvasElement, config: KeyboardConfig): void {
    if (!canvas) return;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.config = config;
    this._staticCacheDirty = true;
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
    if (this.config.range === "custom") {
      this.from = noteNameToMidi(this.config.customFrom || "A0");
      this.to = noteNameToMidi(this.config.customTo || "C8");
    } else {
      const r = KEYBOARD_RANGES[this.config.range];
      this.from = r.from;
      this.to = r.to;
    }
  }

  /**
   * 调整画布尺寸，根据宽度自动切换窄屏/宽屏 MIDI 范围
   * @param width - 逻辑宽度（CSS 像素）
   * @param height - 逻辑高度（CSS 像素）
   * @param dpr - 设备像素比，用于高清渲染
   */
  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this._staticCacheDpr = dpr;
    this._staticCacheDirty = true;
    if (this.canvas) {
      this.canvas.width = Math.max(1, Math.floor(width * dpr));
      this.canvas.height = Math.max(1, Math.floor(height * dpr));
    }
    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (this.config && width < NARROW_BREAKPOINT) {
      this.from = NARROW_RANGE.from;
      this.to = NARROW_RANGE.to;
    } else {
      this.applyRangeFromConfig();
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
   * 重建键盘布局缓存，计算白键/黑键的尺寸与位置映射
   */
  private rebuildLayout(): void {
    const whiteKeys: number[] = [];
    this._midiToIndex.clear();
    for (let m = this.from; m <= this.to; m++) {
      if (isWhiteKey(m)) {
        this._midiToIndex.set(m, whiteKeys.length);
        whiteKeys.push(m);
      }
    }
    const count = Math.max(1, whiteKeys.length);
    const whiteKeyWidth = this.width / count;
    const blackKeyWidth = whiteKeyWidth * BLACK_KEY_WIDTH_RATIO;
    const blackKeyHeight = this.height * BLACK_KEY_HEIGHT_RATIO;
    this._cachedLayout = {
      whiteKeys,
      whiteKeyWidth,
      blackKeyWidth,
      height: this.height,
      blackKeyHeight,
      from: this.from,
      to: this.to,
    };
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
   * @param midi - MIDI 音符号
   * @returns 音符在键盘上的水平中心坐标
   */
  midiToX(midi: number): number {
    const layout = this.getLayout();
    if (isWhiteKey(midi)) {
      const idx = this._midiToIndex.get(midi);
      if (idx === undefined) return 0;
      return (idx + 0.5) * layout.whiteKeyWidth;
    }
    const aboveWhite = midi + 1;
    const idx = this._midiToIndex.get(aboveWhite);
    if (idx === undefined || idx <= 0) return 0;
    return idx * layout.whiteKeyWidth;
  }

  /**
   * 将水平像素坐标转换为对应的 MIDI 音符号，优先匹配黑键边界区域
   * @param x - 水平像素坐标
   * @returns 对应的 MIDI 音符号，若键盘为空则返回 null
   */
  xToMidi(x: number): number | null {
    const layout = this.getLayout();
    if (layout.whiteKeys.length === 0) return null;
    const wkw = layout.whiteKeyWidth;
    let wi = Math.floor(x / wkw);
    wi = Math.max(0, Math.min(layout.whiteKeys.length - 1, wi));
    const whiteMidi = layout.whiteKeys[wi];
    const halfBlack = layout.blackKeyWidth / 2;
    const rightBoundary = (wi + 1) * wkw;
    if (
      isBlackKey(whiteMidi + 1) &&
      whiteMidi + 1 <= this.to &&
      Math.abs(x - rightBoundary) <= halfBlack
    ) {
      return whiteMidi + 1;
    }
    const leftBoundary = wi * wkw;
    if (
      isBlackKey(whiteMidi - 1) &&
      whiteMidi - 1 >= this.from &&
      Math.abs(x - leftBoundary) <= halfBlack
    ) {
      return whiteMidi - 1;
    }
    return whiteMidi;
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
    if (!this.ctx || !this.config) return;
    const ctx = this.ctx;
    const layout = this.getLayout();
    const kb = this.config;

    ctx.clearRect(0, 0, this.width, this.height);
    if (!kb.visible) return;

    // ── 绘制静态底图（从离屏缓存） ──
    if (this._staticCacheDirty) {
      this.rebuildStaticCache(layout, kb);
    }
    if (this._staticCache) {
      ctx.drawImage(this._staticCache, 0, 0, this.width, this.height);
    }

    // ── 仅绘制动态高亮层（按下的键） ──
    if (this.activeNotes.size > 0) {
      const themeColors = this._getThemeColors();

      // 1. 高亮白键（整个高度，后续会被黑键覆盖）
      for (let i = 0; i < layout.whiteKeys.length; i++) {
        const midi = layout.whiteKeys[i];
        if (!this.activeNotes.has(midi)) continue;
        const x = i * layout.whiteKeyWidth;
        const w = layout.whiteKeyWidth;

        // 使用主题颜色并添加渐变效果
        const gradient = createTopGradient(
          ctx,
          x,
          0,
          w,
          this.height,
          themeColors.pressedKey,
          0.15,
        );
        ctx.fillStyle = gradient;

        if (kb.keyCornerRadius > 0) {
          roundRect(ctx, x, 0, w, this.height, kb.keyCornerRadius);
          ctx.fill();
        } else {
          ctx.fillRect(x, 0, w, this.height);
        }
      }

      // 2. 重新绘制所有黑键（覆盖白键高亮，确保正确的显示）
      for (let m = this.from; m <= this.to; m++) {
        if (!isBlackKey(m)) continue;
        const x = this.midiToX(m);
        const bx = x - layout.blackKeyWidth / 2;
        const bw = layout.blackKeyWidth;
        const bh = layout.blackKeyHeight;

        // 根据是否被按下来决定颜色，添加渐变
        const isActive = this.activeNotes.has(m);
        const baseColor = isActive
          ? themeColors.pressedKey
          : themeColors.blackKey;
        const gradient = createTopGradient(
          ctx,
          bx,
          0,
          bw,
          bh,
          baseColor,
          isActive ? 0.2 : 0.15,
        );
        ctx.fillStyle = gradient;

        if (kb.keyCornerRadius > 0) {
          roundRect(ctx, bx, 0, bw, bh, kb.keyCornerRadius);
          ctx.fill();
        } else {
          ctx.fillRect(bx, 0, bw, bh);
        }
      }
    }
  }

  /** 重建离屏 Canvas 缓存：静态键体、边框、分隔线、标签 */
  private rebuildStaticCache(
    layout: KeyboardLayout,
    kb: KeyboardConfig,
  ): void {
    const dpr = this._staticCacheDpr || 1;
    const themeColors = this._getThemeColors();
    // 创建或调整离屏 Canvas
    if (
      !this._staticCache ||
      this._staticCache.width !== Math.max(1, Math.floor(this.width * dpr)) ||
      this._staticCache.height !== Math.max(1, Math.floor(this.height * dpr))
    ) {
      this._staticCache = document.createElement("canvas");
      this._staticCache.width = Math.max(1, Math.floor(this.width * dpr));
      this._staticCache.height = Math.max(1, Math.floor(this.height * dpr));
      this._staticCacheCtx = this._staticCache.getContext("2d");
    }
    const sCtx = this._staticCacheCtx;
    if (!sCtx) return;

    sCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sCtx.clearRect(0, 0, this.width, this.height);

    // 白键（添加3D渐变效果）
    for (let i = 0; i < layout.whiteKeys.length; i++) {
      const x = i * layout.whiteKeyWidth;
      const w = layout.whiteKeyWidth;

      // 使用主题颜色和渐变
      const gradient = createTopGradient(
        sCtx,
        x,
        0,
        w,
        this.height,
        themeColors.whiteKey,
        0.15,
      );
      sCtx.fillStyle = gradient;

      if (kb.keyCornerRadius > 0) {
        roundRect(sCtx, x, 0, w, this.height, kb.keyCornerRadius);
        sCtx.fill();
      } else {
        sCtx.fillRect(x, 0, w, this.height);
      }
      if (kb.keyBorderWidth > 0) {
        sCtx.strokeStyle = kb.keyBorderColor;
        sCtx.lineWidth = kb.keyBorderWidth;
        if (kb.keyCornerRadius > 0) {
          roundRect(sCtx, x, 0, w, this.height, kb.keyCornerRadius);
          sCtx.stroke();
        } else {
          sCtx.strokeRect(x, 0, w, this.height);
        }
      }
    }

    // 分隔线
    if (kb.separatorEnabled && kb.separatorThickness > 0) {
      sCtx.strokeStyle = kb.separatorColor;
      sCtx.lineWidth = kb.separatorThickness;
      sCtx.beginPath();
      sCtx.moveTo(0, this.height - kb.separatorThickness / 2);
      sCtx.lineTo(this.width, this.height - kb.separatorThickness / 2);
      sCtx.stroke();
    }

    // 黑键（添加3D渐变效果）
    for (let m = this.from; m <= this.to; m++) {
      if (!isBlackKey(m)) continue;
      const x = this.midiToX(m);
      const bx = x - layout.blackKeyWidth / 2;
      const bw = layout.blackKeyWidth;
      const bh = layout.blackKeyHeight;

      // 使用主题颜色和渐变
      const gradient = createTopGradient(
        sCtx,
        bx,
        0,
        bw,
        bh,
        themeColors.blackKey,
        0.15,
      );
      sCtx.fillStyle = gradient;

      if (kb.keyCornerRadius > 0) {
        roundRect(sCtx, bx, 0, bw, bh, kb.keyCornerRadius);
        sCtx.fill();
      } else {
        sCtx.fillRect(bx, 0, bw, bh);
      }
    }

    // 标签
    if (kb.keyLabel !== "none" || kb.showNoteNames) {
      const effectiveLabel =
        kb.showNoteNames && kb.keyLabel === "none" ? "note" : kb.keyLabel;
      sCtx.textAlign = "center";
      sCtx.textBaseline = "bottom";

      // 白键标签
      sCtx.fillStyle = themeColors.labelLight;
      sCtx.font = `${Math.max(8, layout.whiteKeyWidth * 0.3)}px sans-serif`;
      for (let i = 0; i < layout.whiteKeys.length; i++) {
        const midi = layout.whiteKeys[i];
        const label = this.labelFor(midi, effectiveLabel);
        if (!label) continue;
        const x = (i + 0.5) * layout.whiteKeyWidth;
        sCtx.fillText(label, x, this.height - 4);
      }

      // 黑键标签
      sCtx.fillStyle = themeColors.labelDark;
      sCtx.font = `${Math.max(7, layout.blackKeyWidth * 0.35)}px sans-serif`;
      for (let m = this.from; m <= this.to; m++) {
        if (!isBlackKey(m)) continue;
        const label = this.labelFor(m, effectiveLabel);
        if (!label) continue;
        const bx = this.midiToX(m);
        sCtx.fillText(label, bx, layout.blackKeyHeight - 4);
      }
    }

    this._staticCacheDirty = false;
  }

  /**
   * 根据标签模式生成琴键上显示的文本
   * @param midi - MIDI 音符号
   * @param mode - 标签模式："note" 显示音名，"pitchClass" 显示音级，"octave" 仅在八度 C 处显示
   * @returns 标签文本，无需显示时返回 null
   */
  private labelFor(
    midi: number,
    mode: KeyboardConfig["keyLabel"],
  ): string | null {
    if (mode === "none") return null;
    if (mode === "note") return midiToNoteName(midi);
    if (mode === "pitchClass") return midiToPitchClass(midi);
    if (mode === "octave") {
      return midi % 12 === 0 ? midiToNoteName(midi) : null;
    }
    return null;
  }

  getKeyboardHeight(): number {
    return this.height;
  }

  getWhiteKeyWidth(): number {
    return this.getLayout().whiteKeyWidth;
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
