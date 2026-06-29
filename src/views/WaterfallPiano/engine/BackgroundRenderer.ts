import * as PIXI from "pixi.js";
import type { BackgroundConfig, PresetTheme } from "../types";
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
        this.drawGradient(config.gradientDirection, config.gradientStart, config.gradientEnd, width, height);
        break;
      case "preset":
        this.drawPreset(config.presetTheme, width, height);
        break;
      case "image":
        if (config.imageFile) {
          this.drawImage(config.imageFile, config.imageBlur, config.imageDarken, width, height);
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

  private drawGradient(_direction: string, start: string, end: string, width: number, height: number) {
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
    this.drawGradient("linear-vertical", colors.start, colors.end, width, height);

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

  private drawImage(imageData: string, blur: number, darken: number, width: number, height: number) {
    const sprite = PIXI.Sprite.from(imageData);
    sprite.width = width;
    sprite.height = height;

    if (blur > 0) {
      // Note: BlurFilter requires pixi.js filters
      // For now, we'll just darken the image
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
