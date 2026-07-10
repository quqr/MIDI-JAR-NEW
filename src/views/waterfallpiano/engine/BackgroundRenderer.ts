import type { WaterfallPianoSettings } from "../types";
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

  init(canvas: HTMLCanvasElement, settings: WaterfallPianoSettings): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.settings = settings;
    this.prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    this.regenerateStars();
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
    this.regenerateStars();
  }

  setSettings(settings: WaterfallPianoSettings): void {
    this.settings = settings;
    this.regenerateStars();
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
  }

  render(time: number): void {
    if (!this.ctx || !this.settings) return;
    const ctx = this.ctx;
    const bg = this.settings.background;
    ctx.clearRect(0, 0, this.width, this.height);

    switch (bg.type) {
      case "solid":
        ctx.fillStyle = bg.solidColor;
        ctx.fillRect(0, 0, this.width, this.height);
        break;
      case "gradient":
        this.renderGradient(ctx, bg, time);
        break;
      case "preset":
        this.renderPreset(ctx, bg, time);
        break;
      case "image":
        this.renderImage(ctx, bg);
        break;
      case "stars":
        ctx.fillStyle = bg.solidColor || "#000000";
        ctx.fillRect(0, 0, this.width, this.height);
        break;
    }

    if (this.settings.background.starfieldEnabled && bg.type !== "stars") {
      this.renderStars(ctx, time);
    } else if (bg.type === "stars") {
      this.renderStars(ctx, time);
    }
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
      for (const stop of bg.gradientStops) {
        const pos = (stop.position + offset) % 1;
        flowGrad.addColorStop(Math.max(0, Math.min(1, pos)), stop.color);
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
    const offset = this.flowOffset(time);
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    for (const stop of palette.stops) {
      let pos = stop.position;
      if (bg.flowAnimation && !this.prefersReducedMotion) {
        pos = (stop.position + offset) % 1;
        if (pos < 0) pos += 1;
      }
      grad.addColorStop(Math.max(0, Math.min(1, pos)), stop.color);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
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

  private renderStars(ctx: CanvasRenderingContext2D, time: number): void {
    const palette = this.settings?.background.presetTheme
      ? presetThemes[this.settings.background.presetTheme]
      : null;
    const color = palette?.starColor ?? "#ffffff";
    ctx.fillStyle = color;
    for (const star of this.stars) {
      const twinkle = this.prefersReducedMotion
        ? 0.8
        : 0.5 + 0.5 * Math.sin(time * 0.001 * star.speed + star.phase);
      ctx.globalAlpha = twinkle;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
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
  }
}
