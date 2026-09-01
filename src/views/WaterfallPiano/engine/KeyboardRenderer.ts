/**
 * 钢琴键盘渲染器（PixiJS v8）— 核心控制器
 *
 * 职责（重构后）：
 * - 状态管理：activeNotes、config、布局缓存
 * - 脏检查调度：_staticCacheDirty / _highlightDirty 标志驱动渲染
 * - 坐标映射：midiToX / xToMidi
 * - 颜色解析：_resolveColors（主题 + DaisyUI 覆盖）
 * - 生命周期编排：委托 KeyboardLayerManager 管理资源、KeyGraphicsFactory 执行绘制
 *
 * 作为公共门面保留全部对外 API，内部组合 LayerManager + KeyGraphicsFactory。
 */

import type { Container, Renderer } from "pixi.js";
import type { KeyboardConfig, KeyLabel } from "../types";
import { midiToNoteName } from "../constants";
import {
  KeyboardLayoutCalculator,
  isBlackKey,
  isWhiteKey,
  type KeyboardLayout,
} from "./KeyboardLayoutCalculator";
import { getThemeColors, type PianoThemeColors } from "../config/pianoThemes";
import { readDaisyUiColor } from "@/helpers/color";
import { KeyGraphicsFactory, type RenderContext } from "./KeyGraphicsFactory";
import { KeyboardLayerManager } from "./KeyboardLayerManager";
import { createLogger } from "@/utils/logger";

const logger = createLogger("KeyboardRenderer");

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

  /** 静态缓存是否需要重建 */
  private _staticCacheDirty = true;
  /** 高亮层是否需要重绘（避免每帧无条件重绘） */
  private _highlightDirty = true;
  /** 颜色缓存（与静态缓存同步刷新，避免渲染流程中重复 DOM 操作） */
  private _cachedColors: PianoThemeColors | null = null;
  /** [DEBUG-kbbug] 帧计数器，用于确认 render() 是否被持续调用 */
  private _frameCount = 0;

  /** 图层资源管理器（Sprite / RenderTexture / Graphics 生命周期） */
  private layerManager = new KeyboardLayerManager();

  // ============================================================================
  // 主题色板解析
  // ============================================================================

  /**
   * 解析当前配置的有效颜色集。
   * 若设置了 theme，使用主题色板覆盖各独立颜色字段；否则使用 kb 中的独立颜色。
   * pressedKeyColor 始终被 DaisyUI 主题色 (--p) 覆盖，保证键盘高亮与全局主题一致。
   *
   * 注意：此方法涉及 DOM 操作（readDaisyUiColor），应在 _staticCacheDirty 时调用一次并缓存，
   * 不应放在每帧渲染路径中。
   */
  private _resolveColors(kb: KeyboardConfig): PianoThemeColors {
    // 优先读取 DaisyUI primary / primary-content 色作为高亮色与标签色
    const daisyPrimary = readDaisyUiColor("--p");
    const daisyPrimaryContent = readDaisyUiColor("--pc");

    const tc = getThemeColors(kb.theme);
    if (tc) {
      return {
        ...tc,
        pressedKeyColor: daisyPrimary ?? tc.pressedKeyColor,
        pressedLabelColor: daisyPrimaryContent ?? tc.pressedLabelColor,
        separatorColor: daisyPrimary ?? tc.separatorColor,
      };
    }
    // 无主题时回退到独立颜色 + 默认渐变参数
    return {
      whiteKeyColor: kb.whiteKeyColor,
      blackKeyColor: kb.blackKeyColor,
      pressedKeyColor: daisyPrimary ?? kb.pressedKeyColor,
      pressedLabelColor: daisyPrimaryContent ?? "#FFFFFF",
      keyBorderColor: kb.keyBorderColor,
      separatorColor: daisyPrimary ?? kb.separatorColor,
      labelColor: "#4a4a4a",
      blackLabelColor: "rgba(255, 255, 255, 1)",
      tonicDotColor: "#9ca3af",
      pressedOverlayAlpha: 1,
      whiteGradientLight: 0.02,
      whiteGradientDark: 0.04,
      blackGradientLight: 0.08,
      blackGradientDark: 0.03,
    };
  }

  // ============================================================================
  // 标签配置解析（配置语义解释，不属于绘制）
  // ============================================================================

  /**
   * 判断是否启用标签，并返回有效标签模式。
   * @returns 标签模式；若标签未启用返回 null
   */
  private _getEffectiveLabel(kb: KeyboardConfig): KeyLabel | null {
    if (kb.keyLabel === "none" && !kb.showNoteNames) return null;
    return kb.showNoteNames && kb.keyLabel === "none" ? "note" : kb.keyLabel;
  }

  // ============================================================================
  // 生命周期管理
  // ============================================================================

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
    this._highlightDirty = true;

    // 创建分层渲染结构（委托 LayerManager）
    this.layerManager.setup(container, renderer);

    this.applyRangeFromConfig();
  }

  /**
   * 更新键盘配置并重建布局缓存。
   * 注意：from/to 变化后必须调用 invalidateLayout() 失效 _cachedLayout，
   * 否则 render() 会继续用旧音域的布局绘制，切换音域将毫无视觉效果。
   */
  setKeyboardConfig(kb: KeyboardConfig): void {
    this.config = kb;
    this.applyRangeFromConfig();
    this.invalidateLayout();
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
    this.layerManager.resize(width, height, Math.max(1, dpr));
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
    this._highlightDirty = true;
  }

  // ============================================================================
  // MIDI ↔ 像素坐标映射
  // ============================================================================

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

  // ============================================================================
  // 高亮音符管理（脏标记驱动，避免每帧无条件重绘）
  // ============================================================================

  highlightNote(midi: number): void {
    if (this.activeNotes.has(midi)) return;
    this.activeNotes.add(midi);
    this._highlightDirty = true;
    logger.debug(
      `[DEBUG-kbbug] highlightNote midi=${midi} → _highlightDirty=true _staticCacheDirty=${this._staticCacheDirty} _cachedColors=${!!this._cachedColors}`,
    );
  }

  clearHighlight(midi: number): void {
    if (!this.activeNotes.delete(midi)) return;
    this._highlightDirty = true;
  }

  clearAllHighlights(): void {
    if (this.activeNotes.size === 0) return;
    this.activeNotes.clear();
    this._highlightDirty = true;
  }

  getActiveNotes(): number[] {
    return Array.from(this.activeNotes);
  }

  getRangeText(): string {
    return `${midiToNoteName(this.from)} - ${midiToNoteName(this.to)}`;
  }

  // ============================================================================
  // 渲染入口
  // ============================================================================

  render(): void {
    if (!this.container || !this.renderer || !this.config) {
      logger.warn(
        `[DEBUG-kbbug] render SKIP missing: container=${!!this.container} renderer=${!!this.renderer} config=${!!this.config}`,
      );
      return;
    }
    const kb = this.config;
    const layout = this.getLayout();

    // 入口日志：每次 render 都记录脏标记状态（确认 render 在被调用）
    // 帧计数器使每条日志唯一，避免 Chrome 折叠相同日志导致误判
    this._frameCount++;
    logger.debug(
      `[DEBUG-kbbug] render ENTER #${this._frameCount} sD=${this._staticCacheDirty} hD=${this._highlightDirty} cc=${!!this._cachedColors} vis=${kb.visible} w=${this.width} h=${this.height}`,
    );

    if (!kb.visible) {
      this.layerManager.setVisible(false);
      // 键盘不可见时清空高亮层（仅在脏标记时执行）
      if (this._highlightDirty) {
        this.layerManager.clearAllHighlights();
        this._highlightDirty = false;
      }
      logger.debug(`[DEBUG-kbbug] render SKIP kb.visible=false`);
      return;
    }

    // ── 重建静态层缓存 ──
    if (this._staticCacheDirty) {
      // 颜色解析（含 DOM 操作）仅在缓存失效时执行一次，渲染流程中直接复用
      this._cachedColors = this._resolveColors(kb);
      const ctx: RenderContext = {
        layout,
        kb,
        colors: this._cachedColors,
        width: this.width,
        height: this.height,
        from: this.from,
        to: this.to,
        midiToX: (m) => this.midiToX(m),
        effectiveLabel: this._getEffectiveLabel(kb),
      };
      logger.debug(
        `[DEBUG-kbbug] render REBUILD static w=${this.width} h=${this.height} from=${this.from} to=${this.to} whiteKeys=${layout.whiteKeys.length}`,
      );
      this.layerManager.rebuildStaticLayer("white", (c) =>
        KeyGraphicsFactory.drawWhiteKeyLayer(c, ctx),
      );
      this.layerManager.rebuildStaticLayer("black", (c) =>
        KeyGraphicsFactory.drawBlackKeyLayer(c, ctx),
      );
      this._staticCacheDirty = false;
      logger.debug(
        `[DEBUG-kbbug] render after REBUILD spriteState=${this.layerManager.getDebugSpriteState()}`,
      );
    }

    // 确保静态层可见
    this.layerManager.setVisible(true);

    // ── 绘制动态高亮层（仅在脏标记时重绘，减少 GPU 指令提交） ──
    if (this._highlightDirty && this._cachedColors) {
      logger.debug(
        `[DEBUG-kbbug] render HIGHLIGHT dirty activeNotes=${this.activeNotes.size}`,
      );
      this.renderHighlightLayer(layout, kb, this._cachedColors);
      this._highlightDirty = false;
      logger.debug(
        `[DEBUG-kbbug] render after HIGHLIGHT spriteState=${this.layerManager.getDebugSpriteState()}`,
      );
    } else if (this._highlightDirty && !this._cachedColors) {
      logger.warn(
        `[DEBUG-kbbug] render HIGHLIGHT SKIP: _highlightDirty=true but _cachedColors=null`,
      );
    }
  }

  // ============================================================================
  // 动态高亮层（协调 LayerManager 清空 + Factory 绘制 + addChild Text）
  // ============================================================================

  /**
   * 绘制动态高亮层（按下的键）— 半透明叠加 + 顶部高光 + 标签覆写。
   * 委托 LayerManager 清空旧资源，委托 KeyGraphicsFactory 执行绘制，
   * 最后将工厂返回的标签 Text 添加为 Graphics 子节点。
   */
  private renderHighlightLayer(
    layout: KeyboardLayout,
    kb: KeyboardConfig,
    colors: PianoThemeColors,
  ): void {
    // 清空高亮层（图形命令 + 旧标签 Text 子节点）
    this.layerManager.clearAllHighlights();

    if (this.activeNotes.size === 0) return;

    const ctx: RenderContext = {
      layout,
      kb,
      colors,
      width: this.width,
      height: this.height,
      from: this.from,
      to: this.to,
      midiToX: (m) => this.midiToX(m),
      effectiveLabel: this._getEffectiveLabel(kb),
    };

    // 绘制白键高亮：半透明叠加 + 顶部高光带 + 标签覆写
    const whiteG = this.layerManager.getHighlightGraphics("white");
    if (whiteG) {
      const texts = KeyGraphicsFactory.drawWhiteHighlight(
        whiteG,
        ctx,
        this.activeNotes,
      );
      // 标签 Text 加到 Container（而非 Graphics，避免 PixiJS v8 弃用的 Graphics.addChild）
      for (const t of texts) this.layerManager.addHighlightText("white", t);
    }

    // 绘制黑键高亮：半透明叠加 + 顶部高光带 + 标签覆写
    const blackG = this.layerManager.getHighlightGraphics("black");
    if (blackG) {
      const texts = KeyGraphicsFactory.drawBlackHighlight(
        blackG,
        ctx,
        this.activeNotes,
      );
      for (const t of texts) this.layerManager.addHighlightText("black", t);
    }
  }

  // ============================================================================
  // 查询接口
  // ============================================================================

  getKeyboardHeight(): number {
    return this.height;
  }

  getWhiteKeyWidth(): number {
    return this.getLayout().whiteKeyWidth;
  }

  // ============================================================================
  // 资源销毁
  // ============================================================================

  /**
   * 销毁渲染器持有的所有 PixiJS 资源
   */
  dispose(): void {
    this.layerManager.dispose();
    this._cachedColors = null;
    this.container = null;
    this.renderer = null;
  }
}
