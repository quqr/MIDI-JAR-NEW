import type { WaterfallPianoSettings } from "../types";

/**
 * 瀑布流钢琴的背景渲染器，使用离屏 Canvas 缓存静态背景以提升绘制性能
 */
export class BackgroundRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private settings: WaterfallPianoSettings | null = null;
  private width = 0;
  private height = 0;
  // 缓存的静态背景
  private bgCanvas: HTMLCanvasElement | null = null;
  private bgCtx: CanvasRenderingContext2D | null = null;
  private bgCached = false;

  /**
   * 初始化渲染器，绑定目标 Canvas 和配置项
   * @param canvas - 用于绘制背景的 Canvas 元素
   * @param settings - 瀑布流钢琴的渲染配置
   */
  init(canvas: HTMLCanvasElement, settings: WaterfallPianoSettings): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.settings = settings;
    this.markDirty();
  }

  /**
   * 调整画布尺寸，同步更新主 Canvas 与离屏缓存 Canvas 的分辨率
   * @param width - 逻辑宽度（CSS 像素）
   * @param height - 逻辑高度（CSS 像素）
   * @param dpr - 设备像素比，用于高清屏适配
   */
  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    if (this.canvas) {
      this.canvas.width = Math.max(1, Math.floor(width * dpr));
      this.canvas.height = Math.max(1, Math.floor(height * dpr));
    }
    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (this.bgCanvas) {
      this.bgCanvas.width = Math.max(1, Math.floor(width * dpr));
      this.bgCanvas.height = Math.max(1, Math.floor(height * dpr));
      this.bgCtx = this.bgCanvas.getContext("2d");
      if (this.bgCtx) this.bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    this.markDirty();
  }

  setSettings(settings: WaterfallPianoSettings): void {
    this.settings = settings;
    this.markDirty();
  }

  private markDirty(): void {
    this.bgCached = false;
  }

  /**
   * 懒创建离屏缓存 Canvas，仅在首次渲染或尺寸变化时调用
   */
  private ensureBgCanvas(): void {
    if (!this.bgCanvas) {
      this.bgCanvas = document.createElement("canvas");
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.bgCanvas.width = Math.max(1, Math.floor(this.width * dpr));
      this.bgCanvas.height = Math.max(1, Math.floor(this.height * dpr));
      this.bgCtx = this.bgCanvas.getContext("2d");
      if (this.bgCtx) this.bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  /**
   * 渲染背景，优先使用缓存的离屏 Canvas；缓存失效时重新绘制并更新缓存
   * @param _time - 当前时间戳（保留参数，当前未使用）
   */
  render(_time: number): void {
    if (!this.ctx || !this.settings) return;
    const ctx = this.ctx;
    const bg = this.settings.background;

    // 纯色背景是静态的，使用缓存
    if (this.bgCached && this.bgCanvas) {
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.drawImage(this.bgCanvas, 0, 0, this.width, this.height);
      return;
    }

    this.ensureBgCanvas();
    const targetCtx = this.bgCtx!;
    targetCtx.clearRect(0, 0, this.width, this.height);
    targetCtx.fillStyle = bg.solidColor;
    targetCtx.fillRect(0, 0, this.width, this.height);

    ctx.clearRect(0, 0, this.width, this.height);
    ctx.drawImage(this.bgCanvas!, 0, 0, this.width, this.height);
    this.bgCached = true;
  }

  dispose(): void {
    this.bgCanvas = null;
    this.bgCtx = null;
  }
}
