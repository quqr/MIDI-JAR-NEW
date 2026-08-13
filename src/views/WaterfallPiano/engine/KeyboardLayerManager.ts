/**
 * 键盘图层资源管理器（PixiJS v8）
 *
 * 专门负责 PixiJS 显示对象（Sprite / RenderTexture / Container / Graphics）的生命周期管理。
 * 不涉及绘制指令，不涉及颜色 / 配置 — 所有绘制逻辑由 KeyGraphicsFactory 承担。
 *
 * 渲染层级顺序（由下至上）：
 *   1. 白键静态层（Sprite + RenderTexture）
 *   2. 白键高亮层（Container: 内部 Graphics 子节点用于绘制 + Text 标签作为兄弟子节点）
 *   3. 黑键静态层（Sprite + RenderTexture）
 *   4. 黑键高亮层（Container: 同上）
 *
 * 高亮层使用 Container 而非直接用 Graphics 持有 Text 子节点，
 * 避免 PixiJS v8 弃用的 Graphics.addChild（v8.0.0+ 仅 Container 可 add children）。
 */

import { Container, Graphics, Sprite, RenderTexture } from "pixi.js";
import type { Renderer } from "pixi.js";
import { createLogger } from "@/utils/logger";

const logger = createLogger("KeyboardLayerManager");

/** 键类型 — 用于区分白键 / 黑键的资源组 */
type LayerType = "white" | "black";

/**
 * 键盘图层资源管理器。
 *
 * 持有 4 层 PixiJS 显示对象，提供统一的生命周期接口：
 * - setup：初始化并按渲染顺序添加子节点
 * - rebuildStaticLayer：通用 RenderTexture 构建（封装原子性保障）
 * - clearHighlight / clearAllHighlights：清空高亮层（含子 Text 节点销毁）
 * - setVisible：统一可见性切换
 * - dispose：统一销毁所有资源
 */
export class KeyboardLayerManager {
  private renderer: Renderer | null = null;
  private width = 0;
  private height = 0;
  /** 设备像素比，RenderTexture 按此倍率渲染以匹配渲染器分辨率 */
  private dpr = 1;

  /** 白键静态层 Sprite */
  private _whiteKeySprite: Sprite | null = null;
  /** 白键静态层 RenderTexture */
  private _whiteKeyRT: RenderTexture | null = null;

  /** 黑键静态层 Sprite */
  private _blackKeySprite: Sprite | null = null;
  /** 黑键静态层 RenderTexture */
  private _blackKeyRT: RenderTexture | null = null;

  /** 白键高亮层 Container（持有 Graphics 子节点用于绘制 + Text 标签作为兄弟节点） */
  private _whiteHighlightContainer: Container | null = null;
  /** 白键高亮层内部 Graphics（用于绘制，作为 Container 的子节点） */
  private _whiteHighlightG: Graphics | null = null;
  /** 黑键高亮层 Container */
  private _blackHighlightContainer: Container | null = null;
  /** 黑键高亮层内部 Graphics */
  private _blackHighlightG: Graphics | null = null;

  // ============================================================================
  // 生命周期
  // ============================================================================

  /**
   * 绑定 Container + Renderer，创建 4 层子节点并按渲染顺序添加。
   * 渲染顺序：白键静态 → 白键高亮 → 黑键静态 → 黑键高亮
   */
  setup(container: Container, renderer: Renderer): void {
    this.renderer = renderer;

    // 1. 白键静态层
    if (!this._whiteKeySprite) {
      this._whiteKeySprite = new Sprite();
      this._whiteKeySprite.label = "white-keys-static";
      container.addChild(this._whiteKeySprite);
    }

    // 2. 白键高亮层（Container + 内部 Graphics 子节点）
    //    Text 标签作为 Container 的兄弟子节点添加，避免 PixiJS v8 弃用的 Graphics.addChild
    if (!this._whiteHighlightContainer) {
      this._whiteHighlightContainer = new Container();
      this._whiteHighlightContainer.label = "white-keys-highlight";
      this._whiteHighlightG = new Graphics();
      this._whiteHighlightG.label = "white-keys-highlight-gfx";
      this._whiteHighlightContainer.addChild(this._whiteHighlightG);
      container.addChild(this._whiteHighlightContainer);
    }

    // 3. 黑键静态层
    if (!this._blackKeySprite) {
      this._blackKeySprite = new Sprite();
      this._blackKeySprite.label = "black-keys-static";
      container.addChild(this._blackKeySprite);
    }

    // 4. 黑键高亮层（同白键结构）
    if (!this._blackHighlightContainer) {
      this._blackHighlightContainer = new Container();
      this._blackHighlightContainer.label = "black-keys-highlight";
      this._blackHighlightG = new Graphics();
      this._blackHighlightG.label = "black-keys-highlight-gfx";
      this._blackHighlightContainer.addChild(this._blackHighlightG);
      container.addChild(this._blackHighlightContainer);
    }
  }

  /** 更新画布尺寸与设备像素比（影响 RenderTexture 分辨率） */
  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.dpr = Math.max(1, dpr);
    logger.debug(`[DEBUG-kbbug] resize w=${width} h=${height} dpr=${this.dpr}`);
  }

  // ============================================================================
  // 静态层 RenderTexture 构建
  // ============================================================================

  /**
   * 重建指定类型的静态层 RenderTexture。
   *
   * 流程：创建临时 Container → 调用 draw 回调 → 渲染到新 RT → 销毁临时 Container
   *       → 赋值新 RT 给 sprite → 销毁旧 RT（原子性保障）
   *
   * 原子性：先创建新 RT 并成功渲染，再赋值给 sprite 并销毁旧 RT。
   * 若构建过程抛异常，旧纹理仍保留在 sprite 上，避免黑屏。
   *
   * @param type - 'white' 或 'black'
   * @param draw - 绘制回调，接收临时 Container 进行绘制
   */
  rebuildStaticLayer(
    type: LayerType,
    draw: (container: Container) => void,
  ): void {
    if (!this.renderer) {
      logger.warn(
        `[DEBUG-kbbug] rebuildStaticLayer(${type}) ABORT: no renderer`,
      );
      return;
    }

    const rtW = Math.max(1, Math.ceil(this.width));
    const rtH = Math.max(1, Math.ceil(this.height));
    logger.debug(
      `[DEBUG-kbbug] rebuildStaticLayer(${type}) start rtW=${rtW} rtH=${rtH} dpr=${this.dpr}`,
    );

    const rt = RenderTexture.create({
      width: rtW,
      height: rtH,
      resolution: this.dpr,
    });

    const tmpContainer = new Container();
    draw(tmpContainer);
    this.renderer.render({ container: tmpContainer, target: rt });
    tmpContainer.destroy({ children: true });

    // 原子性：保存旧 RT → 赋值新 RT → 销毁旧 RT
    const oldRt = type === "white" ? this._whiteKeyRT : this._blackKeyRT;
    const sprite =
      type === "white" ? this._whiteKeySprite : this._blackKeySprite;

    if (type === "white") {
      this._whiteKeyRT = rt;
    } else {
      this._blackKeyRT = rt;
    }

    if (sprite) {
      sprite.texture = rt;
      logger.debug(
        `[DEBUG-kbbug] rebuildStaticLayer(${type}) OK sprite.texture updated, oldRt=${oldRt ? "destroy" : "none"}`,
      );
    } else {
      logger.warn(
        `[DEBUG-kbbug] rebuildStaticLayer(${type}) sprite NULL — texture not assigned!`,
      );
    }
    if (oldRt) oldRt.destroy(true);
  }

  // ============================================================================
  // 高亮层管理
  // ============================================================================

  /** 获取指定类型高亮层的内部 Graphics（供工厂绘制） */
  getHighlightGraphics(type: LayerType): Graphics | null {
    return type === "white" ? this._whiteHighlightG : this._blackHighlightG;
  }

  /**
   * 向高亮层添加标签 Text。
   * Text 作为 Container 的子节点添加（与内部 Graphics 兄弟），
   * 避免使用 PixiJS v8 已弃用的 Graphics.addChild。
   * 渲染顺序：Container 内 Graphics 先绘制 → Text 后绘制（覆盖在 Graphics 之上）。
   */
  addHighlightText(type: LayerType, text: Container): void {
    const container =
      type === "white"
        ? this._whiteHighlightContainer
        : this._blackHighlightContainer;
    container?.addChild(text);
  }

  /**
   * 清空指定类型的高亮层：清除 Graphics 绘制命令 + 移除并销毁 Text 标签。
   * Container 的子节点中，内部 Graphics 保留，其余（Text）移除并销毁。
   */
  clearHighlight(type: LayerType): void {
    const g = type === "white" ? this._whiteHighlightG : this._blackHighlightG;
    const container =
      type === "white"
        ? this._whiteHighlightContainer
        : this._blackHighlightContainer;
    if (!g || !container) return;
    g.clear();
    // 倒序遍历移除 Text 标签，跳过内部 Graphics
    for (let i = container.children.length - 1; i >= 0; i--) {
      const child = container.children[i];
      if (child === g) continue;
      container.removeChildAt(i);
      try {
        child.destroy();
      } catch (e) {
        // PixiJS v8 内部 bug：renderer resize 后 TexturePool 可能损坏，
        // 导致 Text.destroy() 触发 returnTexture 时崩溃。忽略错误，让 GC 处理。
        logger.warn(
          `[DEBUG-kbbug] Text.destroy() failed (PixiJS TexturePool bug): ${e}`,
        );
      }
    }
  }

  /** 清空所有高亮层 */
  clearAllHighlights(): void {
    this.clearHighlight("white");
    this.clearHighlight("black");
  }

  // ============================================================================
  // 可见性
  // ============================================================================

  /** 设置所有层的可见性 */
  setVisible(visible: boolean): void {
    if (this._whiteKeySprite) this._whiteKeySprite.visible = visible;
    if (this._blackKeySprite) this._blackKeySprite.visible = visible;
  }

  /** [DEBUG-kbbug] 返回 Sprite / Graphics 当前状态用于诊断 */
  getDebugSpriteState(): string {
    const w = this._whiteKeySprite;
    const b = this._blackKeySprite;
    const wh = this._whiteHighlightContainer;
    const bh = this._blackHighlightContainer;
    const wT = w?.texture;
    const bT = b?.texture;
    return `whiteSprite(vis=${w?.visible ?? "null"} alpha=${w?.alpha ?? "?"} tex=${wT ? `${wT.width}x${wT.height}` : "null"}) blackSprite(vis=${b?.visible ?? "null"} tex=${bT ? `${bT.width}x${bT.height}` : "null"}) whiteHL(children=${wh?.children.length ?? "?"}) blackHL(children=${bh?.children.length ?? "?"})`;
  }

  // ============================================================================
  // 资源销毁
  // ============================================================================

  /** 销毁全部资源（RenderTexture + Sprite + Container/Graphics/Text） */
  dispose(): void {
    // 先清理高亮层的 Text 子节点（避免纹理泄漏）
    this.clearAllHighlights();

    // 批量销毁 RenderTexture
    const textures = [this._whiteKeyRT, this._blackKeyRT];
    for (const rt of textures) {
      rt?.destroy(true);
    }

    // 批量销毁 Sprite / 高亮 Container（Container.destroy({children:true}) 会销毁内部 Graphics）
    const displayObjects = [
      this._whiteKeySprite,
      this._whiteHighlightContainer,
      this._blackKeySprite,
      this._blackHighlightContainer,
    ];
    for (const obj of displayObjects) {
      try {
        obj?.destroy({ children: true });
      } catch (e) {
        logger.warn(
          `[DEBUG-kbbug] destroy failed (PixiJS TexturePool bug): ${e}`,
        );
      }
    }

    this._whiteKeyRT = null;
    this._blackKeyRT = null;
    this._whiteKeySprite = null;
    this._whiteHighlightContainer = null;
    this._whiteHighlightG = null;
    this._blackKeySprite = null;
    this._blackHighlightContainer = null;
    this._blackHighlightG = null;

    this.renderer = null;
  }
}
