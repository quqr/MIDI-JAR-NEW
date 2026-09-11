import { Container, Graphics, Sprite, Texture } from "pixi.js";
import type { BackgroundConfig } from "../types";
import { GalaxyRenderer } from "./GalaxyRenderer";

/**
 * 瀑布流钢琴的背景渲染器，使用 PixiJS Graphics 绘制纯色/渐变背景，
 * 可选的自定义背景图片 Sprite（最底层，cover 铺满），
 * 并在底色之上叠加 Galaxy 星系粒子（可开关，与流体背景可叠加）
 */
export class BackgroundRenderer {
  private bgGraphics: Graphics | null = null;
  /** 自定义背景图片 Sprite（config.backgroundImage 存在时创建） */
  private bgImage: Sprite | null = null;
  private bgTexture: Texture | null = null;
  /** 图片加载令牌：配置切换/销毁时使旧的异步加载结果失效 */
  private imageToken = 0;
  /** 当前图片加载完成（或失败/无图）的 Promise，导出器据此等待再开始编码 */
  private imageLoadPromise: Promise<void> = Promise.resolve();
  private galaxyRenderer = new GalaxyRenderer();
  private config: BackgroundConfig | null = null;
  private width = 0;
  private height = 0;
  private dirty = true;
  /**
   * 流体启用标志：true 时跳过不透明背景绘制，让下层 WebGL 流体 canvas 穿透显示。
   * 流体关闭时恢复绘制。
   */
  private fluidActive = false;

  /**
   * 初始化渲染器，绑定目标 Container 和背景配置
   * @param container - 用于绘制背景的 PixiJS Container
   * @param config - 背景渲染配置
   */
  init(container: Container, config: BackgroundConfig): void {
    this.bgGraphics = new Graphics();
    container.addChild(this.bgGraphics);
    this.config = config;
    this.dirty = true;
    if (config.backgroundImage) {
      this.applyBackgroundImage(config.backgroundImage);
    }
    this.galaxyRenderer.init(container, config.galaxy);
    this.galaxyRenderer.resize(this.width, this.height);
  }

  /**
   * 调整尺寸
   * @param width - 逻辑宽度（CSS 像素）
   * @param height - 逻辑高度（CSS 像素）
   * @param _dpr - 设备像素比（PixiJS 自动处理）
   */
  resize(width: number, height: number, _dpr: number): void {
    this.width = width;
    this.height = height;
    this.dirty = true;
    this.layoutImage();
    this.galaxyRenderer.resize(width, height, _dpr);
  }

  setBackgroundConfig(config: BackgroundConfig): void {
    const prevImage = this.config?.backgroundImage;
    this.config = config;
    this.dirty = true;
    if ((config.backgroundImage ?? null) !== (prevImage ?? null)) {
      this.applyBackgroundImage(config.backgroundImage ?? null);
    }
    this.galaxyRenderer.setConfig(config.galaxy);
  }

  /**
   * 设置流体激活状态：激活时跳过不透明背景绘制以露出下层 WebGL 流体 canvas
   */
  setFluidActive(active: boolean): void {
    if (this.fluidActive === active) return;
    this.fluidActive = active;
    this.dirty = true;
  }

  /**
   * 渲染背景，仅在配置变更或尺寸变化时重绘纯色底；星系粒子每帧推进动画
   * @param time - 当前时间戳（透传给星系渲染器推进动画）
   */
  render(time: number): void {
    if (this.bgGraphics && this.config && this.dirty) {
      this.bgGraphics.clear();
      // 流体在底层（fluidActive）时跳过纯色填充：Pixi canvas 须保持透明，
      // 让下方流体 canvas 透出（实时预览由容器 CSS 背景供底色，
      // 视频导出由合成器先铺 solidColor）——否则不透明背景会盖住底层流体
      this.bgGraphics.rect(0, 0, this.width, this.height);
      if (!this.fluidActive) {
        this.bgGraphics.fill(this.config.solidColor);
      }
      if (this.bgImage) {
        this.bgImage.visible = !this.fluidActive;
        this.layoutImage();
      }
      this.dirty = false;
    }
    this.galaxyRenderer.render(time);
  }

  /** 当前背景图片是否已加载完毕（无图/加载结束均视为就绪），供导出器等待 */
  get imageSettled(): Promise<void> {
    return this.imageLoadPromise;
  }

  dispose(): void {
    this.imageToken++; // 使未完成的图片加载失效
    this.bgImage?.destroy();
    this.bgImage = null;
    this.bgTexture?.destroy(true);
    this.bgTexture = null;
    this.bgGraphics?.destroy();
    this.bgGraphics = null;
    this.galaxyRenderer.dispose();
  }

  // ─── 自定义背景图片 ───

  /**
   * 加载自定义背景图片（dataURL）为最底层 Sprite；
   * 传 null 时移除图片，回退到纯色底。
   * solidColor 始终先铺在 Graphics 上作为无图/加载中的底色。
   */
  private applyBackgroundImage(dataUrl: string | null): void {
    const token = ++this.imageToken;
    this.removeImageSprite();
    if (!dataUrl) {
      this.imageLoadPromise = Promise.resolve();
      this.dirty = true;
      return;
    }
    this.imageLoadPromise = new Promise<void>((resolve) => {
      const img = new Image();
      const settle = () => resolve();
      img.onload = () => {
        // 配置已再次变更 / 已销毁 → 丢弃过期加载结果
        const gfx = this.bgGraphics;
        if (token !== this.imageToken || !gfx) {
          settle();
          return;
        }
        const texture = Texture.from(img);
        if (token !== this.imageToken) {
          texture.destroy(true);
          settle();
          return;
        }
        this.bgTexture = texture;
        const sprite = new Sprite(texture);
        // 插入到纯色 Graphics 之上、Galaxy 之下（最底层背景）
        const parent = gfx.parent;
        if (parent) {
          parent.addChildAt(sprite, parent.getChildIndex(gfx) + 1);
          this.bgImage = sprite;
          this.layoutImage();
          this.dirty = true;
        } else {
          texture.destroy(true);
        }
        settle();
      };
      img.onerror = () => {
        // 加载失败回退纯色底（dirty 使 solidColor 重绘）
        this.dirty = true;
        settle();
      };
      img.src = dataUrl;
    });
  }

  private removeImageSprite(): void {
    if (this.bgImage) {
      this.bgImage.destroy();
      this.bgImage = null;
    }
    if (this.bgTexture) {
      this.bgTexture.destroy(true);
      this.bgTexture = null;
    }
  }

  /** 图片 cover 铺满：取 max 缩放比并居中（等比裁切超出部分） */
  private layoutImage(): void {
    if (!this.bgImage || !this.bgTexture) return;
    const tw = this.bgTexture.width;
    const th = this.bgTexture.height;
    if (!tw || !th || !this.width || !this.height) return;
    const scale = Math.max(this.width / tw, this.height / th);
    this.bgImage.scale.set(scale);
    this.bgImage.position.set(
      (this.width - tw * scale) / 2,
      (this.height - th * scale) / 2,
    );
  }
}
