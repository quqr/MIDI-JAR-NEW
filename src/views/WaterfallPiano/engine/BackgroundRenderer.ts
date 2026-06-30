import * as PIXI from "pixi.js";
import type { BackgroundConfig, PresetTheme, ImageFitMode } from "../types";
import { presetThemes } from "../constants";

export class BackgroundRenderer {
  private container: PIXI.Container;
  private currentConfig: BackgroundConfig | null = null;

  constructor(container: PIXI.Container) {
    this.container = container;
  }

  applyConfig(config: BackgroundConfig, width: number, height: number) {
    this.currentConfig = config;
    this.clear();

    switch (config.type) {
      case "solid":
        this.drawSolid(config.solidColor, width, height);
        break;
      case "gradient":
        this.drawGradient(
          config.gradientDirection,
          config.gradientStart,
          config.gradientEnd,
          width,
          height,
        );
        break;
      case "preset":
        this.drawPreset(config.presetTheme, width, height);
        break;
      case "image":
        if (config.imageFile) {
          this.drawImage(
            config.imageFile,
            config.imageBlur,
            config.imageDarken,
            config.imageFitMode,
            width,
            height,
          );
        } else {
          this.drawPreset("night-sky", width, height);
        }
        break;
      case "stars":
        this.drawStars(width, height);
        break;
    }
  }

  private drawSolid(color: string, width: number, height: number) {
    const g = new PIXI.Graphics();
    g.rect(0, 0, width, height);
    g.fill(color);
    this.container.addChild(g);
  }

  private drawGradient(
    _direction: string,
    start: string,
    end: string,
    width: number,
    height: number,
  ) {
    const g = new PIXI.Graphics();

    // PixiJS 8 doesn't have built-in gradient, so we simulate with horizontal lines
    const steps = 100;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const color = this.interpolateColor(start, end, t);
      g.rect(0, t * height, width, height / steps + 1);
      g.fill(color);
    }

    this.container.addChild(g);
  }

  private drawPreset(theme: PresetTheme, width: number, height: number) {
    const colors = presetThemes[theme];
    this.drawGradient(
      "linear-vertical",
      colors.start,
      colors.end,
      width,
      height,
    );

    // Add decorative elements for some themes
    if (theme === "night-sky") {
      this.addStars(width, height);
    }
  }

  private addStars(width: number, height: number) {
    const g = new PIXI.Graphics();
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height * 0.7;
      const size = Math.random() * 2 + 0.5;
      const alpha = Math.random() * 0.5 + 0.3;
      g.circle(x, y, size);
      g.fill({ color: "#ffffff", alpha });
    }
    this.container.addChild(g);
  }

  private drawStars(width: number, height: number) {
    // Deep dark background
    const bg = new PIXI.Graphics();
    bg.rect(0, 0, width, height);
    bg.fill("#050510");
    this.container.addChild(bg);

    // Multiple layers of stars for depth
    const g = new PIXI.Graphics();
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * 1.5 + 0.3;
      const alpha = Math.random() * 0.6 + 0.2;
      g.circle(x, y, size);
      g.fill({ color: "#ffffff", alpha });
    }
    this.container.addChild(g);
  }

  private drawImage(
    imageData: string,
    blur: number,
    darken: number,
    fitMode: ImageFitMode,
    width: number,
    height: number,
  ) {
    const texture = PIXI.Texture.from(imageData);
    const imgW = texture.width;
    const imgH = texture.height;

    let sprite: PIXI.Sprite | PIXI.TilingSprite;

    switch (fitMode) {
      case "cover": {
        const s = PIXI.Sprite.from(texture);
        const scale = Math.max(width / imgW, height / imgH);
        s.width = imgW * scale;
        s.height = imgH * scale;
        s.x = (width - s.width) / 2;
        s.y = (height - s.height) / 2;
        sprite = s;
        break;
      }
      case "stretch": {
        const s = PIXI.Sprite.from(texture);
        s.width = width;
        s.height = height;
        sprite = s;
        break;
      }
      case "center": {
        const s = PIXI.Sprite.from(texture);
        // If image is larger than screen, scale down to fit
        if (imgW > width || imgH > height) {
          const scale = Math.min(width / imgW, height / imgH);
          s.width = imgW * scale;
          s.height = imgH * scale;
        } else {
          s.width = imgW;
          s.height = imgH;
        }
        s.x = (width - s.width) / 2;
        s.y = (height - s.height) / 2;
        sprite = s;
        break;
      }
      case "tile": {
        const ts = new PIXI.TilingSprite({
          texture,
          width,
          height,
        });
        sprite = ts;
        break;
      }
      default: {
        const s = PIXI.Sprite.from(texture);
        const scale = Math.max(width / imgW, height / imgH);
        s.width = imgW * scale;
        s.height = imgH * scale;
        s.x = (width - s.width) / 2;
        s.y = (height - s.height) / 2;
        sprite = s;
      }
    }

    this.container.addChild(sprite);

    // Darken overlay
    if (darken > 0) {
      const overlay = new PIXI.Graphics();
      overlay.rect(0, 0, width, height);
      overlay.fill({ color: "#000000", alpha: darken });
      this.container.addChild(overlay);
    }
  }

  private interpolateColor(color1: string, color2: string, t: number): string {
    const c1 = this.hexToRgb(color1);
    const c2 = this.hexToRgb(color2);
    if (!c1 || !c2) return color1;

    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);

    return `rgb(${r}, ${g}, ${b})`;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  resize(width: number, height: number) {
    if (this.currentConfig) {
      this.applyConfig(this.currentConfig, width, height);
    }
  }

  private clear() {
    this.container.removeChildren();
  }
}
