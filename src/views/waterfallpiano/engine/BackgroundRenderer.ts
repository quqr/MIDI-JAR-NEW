import type { WaterfallPianoSettings, GradientStop } from "../types";
import { presetThemes } from "../constants";

interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
}

export class BackgroundRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private settings: WaterfallPianoSettings | null = null;
  private width = 0;
  private height = 0;
  private stars: Star[] = [];
  private imageCache = new Map<string, HTMLImageElement>();
  private prefersReducedMotion = false;

  // 脏标记：静态背景只需绘制一次
  private dirty = true;
  // 星场离屏 canvas
  private starCanvas: HTMLCanvasElement | null = null;
  private starCtx: CanvasRenderingContext2D | null = null;
  private starDirty = true;
  // 缓存的静态背景
  private bgCanvas: HTMLCanvasElement | null = null;
  private bgCtx: CanvasRenderingContext2D | null = null;
  private bgCached = false;

  init(canvas: HTMLCanvasElement, settings: WaterfallPianoSettings): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.settings = settings;
    this.prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    this.regenerateStars();
    this.markDirty();
  }

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
    // 同步离屏 canvas 尺寸
    if (this.starCanvas) {
      this.starCanvas.width = Math.max(1, Math.floor(width * dpr));
      this.starCanvas.height = Math.max(1, Math.floor(height * dpr));
      this.starCtx = this.starCanvas.getContext("2d");
      if (this.starCtx) this.starCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (this.bgCanvas) {
      this.bgCanvas.width = Math.max(1, Math.floor(width * dpr));
      this.bgCanvas.height = Math.max(1, Math.floor(height * dpr));
      this.bgCtx = this.bgCanvas.getContext("2d");
      if (this.bgCtx) this.bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    this.regenerateStars();
    this.markDirty();
  }

  setSettings(settings: WaterfallPianoSettings): void {
    this.settings = settings;
    this.regenerateStars();
    this.markDirty();
  }

  private markDirty(): void {
    this.dirty = true;
    this.bgCached = false;
  }

  /** 判断当前背景是否需要每帧动画 */
  private isAnimated(): boolean {
    if (!this.settings) return false;
    const bg = this.settings.background;
    if (this.prefersReducedMotion) return false;
    // 流动动画
    if (bg.flowAnimation && (bg.type === "gradient" || bg.type === "preset")) {
      return true;
    }
    // 星场闪烁
    if (bg.starfieldEnabled || bg.type === "stars") {
      return true;
    }
    return false;
  }

  private regenerateStars(): void {
    if (!this.settings || !this.settings.background.starfieldEnabled) {
      this.stars = [];
      return;
    }
    const area = this.width * this.height;
    const count = Math.floor((area / 4000) * this.settings.background.starfieldDensity);
    this.stars = [];
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        r: Math.random() * 1.2 + 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1.5,
      });
    }
    this.starDirty = true;
  }

  private ensureStarCanvas(): void {
    if (!this.starCanvas) {
      this.starCanvas = document.createElement("canvas");
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.starCanvas.width = Math.max(1, Math.floor(this.width * dpr));
      this.starCanvas.height = Math.max(1, Math.floor(this.height * dpr));
      this.starCtx = this.starCanvas.getContext("2d");
      if (this.starCtx) this.starCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

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

  render(time: number): void {
    if (!this.ctx || !this.settings) return;
    const ctx = this.ctx;
    const bg = this.settings.background;
    const animated = this.isAnimated();

    // 静态背景使用缓存
    if (!animated && this.bgCached && this.bgCanvas) {
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.drawImage(this.bgCanvas, 0, 0, this.width, this.height);
      return;
    }

    if (animated) {
      ctx.clearRect(0, 0, this.width, this.height);
    }

    // 选择绘制目标：动画直接画主 canvas，静态画离屏 canvas
    const targetCtx = animated ? ctx : (this.ensureBgCanvas(), this.bgCtx!);
    if (!animated) {
      targetCtx.clearRect(0, 0, this.width, this.height);
    }

    switch (bg.type) {
      case "solid":
        targetCtx.fillStyle = bg.solidColor;
        targetCtx.fillRect(0, 0, this.width, this.height);
        break;
      case "gradient":
        this.renderGradient(targetCtx, bg, time);
        break;
      case "preset":
        this.renderPreset(targetCtx, bg, time);
        break;
      case "image":
        this.renderImage(targetCtx, bg);
        break;
      case "stars":
        targetCtx.fillStyle = bg.solidColor || "#000000";
        targetCtx.fillRect(0, 0, this.width, this.height);
        break;
    }

    // 星场渲染
    if (bg.starfieldEnabled || bg.type === "stars") {
      this.renderStarsOptimized(ctx, targetCtx, time);
    }

    // 静态背景缓存后绘制到主 canvas
    if (!animated) {
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.drawImage(this.bgCanvas!, 0, 0, this.width, this.height);
      this.bgCached = true;
    }

    this.dirty = false;
  }

  private renderGradient(
    ctx: CanvasRenderingContext2D,
    bg: WaterfallPianoSettings["background"],
    time: number,
  ): void {
    const offset = this.flowOffset(time);
    let grad: CanvasGradient;
    if (bg.gradientDirection === "linear-horizontal") {
      grad = ctx.createLinearGradient(0, 0, this.width, 0);
    } else if (bg.gradientDirection === "radial") {
      const cx = this.width / 2;
      const cy = this.height / 2;
      grad = ctx.createRadialGradient(
        cx,
        cy,
        0,
        cx,
        cy,
        Math.max(this.width, this.height) / 2,
      );
    } else {
      grad = ctx.createLinearGradient(0, 0, 0, this.height);
    }
    grad.addColorStop(0, bg.gradientStart);
    grad.addColorStop(1, bg.gradientEnd);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
    if (offset > 0 && bg.gradientStops.length > 0) {
      ctx.globalAlpha = 0.3;
      const flowGrad = ctx.createLinearGradient(0, 0, 0, this.height);
      const sortedStops = this.buildSortedFlowStops(bg.gradientStops, offset);
      for (const stop of sortedStops) {
        flowGrad.addColorStop(stop.position, stop.color);
      }
      ctx.fillStyle = flowGrad;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.globalAlpha = 1;
    }
  }

  private renderPreset(
    ctx: CanvasRenderingContext2D,
    bg: WaterfallPianoSettings["background"],
    time: number,
  ): void {
    const palette = presetThemes[bg.presetTheme];
    if (bg.flowAnimation && !this.prefersReducedMotion) {
      const offset = this.flowOffset(time);
      const sortedStops = this.buildSortedFlowStops(palette.stops, offset);
      const grad = ctx.createLinearGradient(0, 0, 0, this.height);
      for (const stop of sortedStops) {
        grad.addColorStop(stop.position, stop.color);
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);
    } else {
      // 无动画：直接使用原始 stops
      const grad = ctx.createLinearGradient(0, 0, 0, this.height);
      for (const stop of palette.stops) {
        grad.addColorStop(stop.position, stop.color);
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  /**
   * 构建排序后的流动渐变色标，避免取模跳变导致频闪。
   * 策略：将所有色标按偏移后的位置排序，对于 wrap-around 的色标
   * 在首尾各补一份，确保渐变平滑过渡。
   */
  private buildSortedFlowStops(
    stops: GradientStop[],
    offset: number,
  ): GradientStop[] {
    if (offset === 0) return stops.slice().sort((a, b) => a.position - b.position);

    // 计算偏移后的位置
    const shifted: GradientStop[] = stops.map((s) => {
      let pos = (s.position + offset) % 1;
      if (pos < 0) pos += 1;
      return { position: pos, color: s.color };
    });

    // 按 position 排序
    shifted.sort((a, b) => a.position - b.position);

    // 确保首尾有色标（避免空白区域）
    if (shifted.length > 0) {
      const first = shifted[0];
      const last = shifted[shifted.length - 1];

      // 如果第一个色标不在 0，用最后一个色标补充到 0 位置
      if (first.position > 0.001) {
        shifted.unshift({ position: 0, color: last.color });
      }
      // 如果最后一个色标不在 1，用第一个色标补充到 1 位置
      if (last.position < 0.999) {
        shifted.push({ position: 1, color: first.color });
      }
    }

    return shifted;
  }

  private flowOffset(time: number): number {
    if (!this.settings || !this.settings.background.flowAnimation) return 0;
    if (this.prefersReducedMotion) return 0;
    return (time * this.settings.background.flowSpeed * 0.02) % 1;
  }

  private renderImage(
    ctx: CanvasRenderingContext2D,
    bg: WaterfallPianoSettings["background"],
  ): void {
    if (!bg.imageFile) {
      ctx.fillStyle = bg.solidColor;
      ctx.fillRect(0, 0, this.width, this.height);
      return;
    }
    const img = this.imageCache.get(bg.imageFile);
    if (!img || !img.complete) {
      ctx.fillStyle = bg.solidColor;
      ctx.fillRect(0, 0, this.width, this.height);
      return;
    }
    ctx.save();
    if (bg.imageBlur > 0) {
      ctx.filter = `blur(${bg.imageBlur}px)`;
    }
    this.drawImageFit(ctx, img, bg.imageFitMode);
    ctx.restore();
    if (bg.imageDarken > 0) {
      ctx.fillStyle = `rgba(0,0,0,${bg.imageDarken})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  private drawImageFit(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    mode: string,
  ): void {
    const w = this.width;
    const h = this.height;
    if (mode === "stretch") {
      ctx.drawImage(img, 0, 0, w, h);
    } else if (mode === "center") {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2);
    } else if (mode === "tile") {
      const pattern = ctx.createPattern(img, "repeat");
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, w, h);
      }
    } else {
      const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }
  }

  /**
   * 优化的星场渲染：使用离屏 canvas 预渲染星场基础层，
   * 闪烁效果通过整体 alpha 调制而非逐星设置。
   * 对于静态背景，星场整体只绘制一次。
   */
  private renderStarsOptimized(
    mainCtx: CanvasRenderingContext2D,
    bgCtx: CanvasRenderingContext2D,
    time: number,
  ): void {
    if (this.stars.length === 0) return;

    const palette = this.settings?.background.presetTheme
      ? presetThemes[this.settings.background.presetTheme]
      : null;
    const color = palette?.starColor ?? "#ffffff";

    // 预渲染星场到离屏 canvas（仅在 starDirty 时重绘）
    if (this.starDirty || !this.starCanvas) {
      this.ensureStarCanvas();
      if (!this.starCtx) return;
      this.starCtx.clearRect(0, 0, this.width, this.height);

      // 批量绘制：按亮度分组减少状态切换
      this.starCtx.fillStyle = color;
      for (const star of this.stars) {
        this.starCtx.globalAlpha = 0.8;
        this.starCtx.beginPath();
        this.starCtx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        this.starCtx.fill();
      }
      this.starCtx.globalAlpha = 1;
      this.starDirty = false;
    }

    // 绘制星场到目标
    const animated = this.isAnimated();
    const targetCtx = animated ? mainCtx : bgCtx;

    if (this.prefersReducedMotion || !animated) {
      // 静态模式：直接绘制预渲染的星场
      targetCtx.drawImage(this.starCanvas!, 0, 0, this.width, this.height);
    } else {
      // 动画模式：使用正弦闪烁 - 将星星分3组，每组用不同相位
      // 比逐星设置 globalAlpha 高效得多
      const baseAlpha = 0.7 + 0.3 * Math.sin(time * 0.0008);
      targetCtx.globalAlpha = baseAlpha;
      targetCtx.drawImage(this.starCanvas!, 0, 0, this.width, this.height);

      // 额外绘制一层较暗的星星作为闪烁层
      targetCtx.globalAlpha = 0.3 + 0.2 * Math.sin(time * 0.002 + 1.5);
      targetCtx.drawImage(this.starCanvas!, 0, 0, this.width, this.height);

      targetCtx.globalAlpha = 1;
    }
  }

  async loadImage(src: string): Promise<HTMLImageElement> {
    const cached = this.imageCache.get(src);
    if (cached && cached.complete) return cached;
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.imageCache.set(src, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  dispose(): void {
    this.imageCache.clear();
    this.stars = [];
    this.starCanvas = null;
    this.starCtx = null;
    this.bgCanvas = null;
    this.bgCtx = null;
  }
}
