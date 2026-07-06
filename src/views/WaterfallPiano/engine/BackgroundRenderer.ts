import * as PIXI from "pixi.js";
import type {
  BackgroundConfig,
  PresetTheme,
  ImageFitMode,
  GradientStop,
  GradientDirection,
} from "../types";
import { presetThemes } from "../constants";
import { StarfieldRenderer } from "./StarfieldRenderer";
import { FluidRenderer } from "./FluidRenderer";

// ─── 背景渲染器：支持多色渐变、水平/径向方向、流动动画、星空、流体 ───

export class BackgroundRenderer {
  private container: PIXI.Container;
  private baseContainer: PIXI.Container; // 渐变/图片底
  private starfield: StarfieldRenderer;
  private fluid: FluidRenderer | null = null;
  private currentConfig: BackgroundConfig | null = null;
  private gradientGraphics: PIXI.Graphics | null = null;
  private flowTime = 0;
  private degradeMode = false;
  private width = 0;
  private height = 0;

  constructor(container: PIXI.Container) {
    this.container = container;
    this.baseContainer = new PIXI.Container();
    container.addChild(this.baseContainer);
    this.starfield = new StarfieldRenderer(container);
  }

  setApp(app: PIXI.Application) {
    if (this.fluid) {
      this.fluid.destroy();
    }
    this.fluid = new FluidRenderer(this.container, app);
    // 重新应用配置以初始化流体
    if (this.currentConfig) {
      this.applyConfig(this.currentConfig, this.width, this.height);
    }
  }

  applyConfig(config: BackgroundConfig, width: number, height: number) {
    this.currentConfig = config;
    this.width = width;
    this.height = height;
    this.clearBase();

    // 1. 底色/渐变
    switch (config.type) {
      case "solid":
        this.drawSolid(config.solidColor, width, height);
        break;
      case "gradient":
        this.drawGradient(
          config.gradientDirection,
          config.gradientStops.length > 0
            ? config.gradientStops
            : [
                { position: 0, color: config.gradientStart },
                { position: 1, color: config.gradientEnd },
              ],
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
        this.drawStarsBackground(width, height);
        break;
      case "fluid":
        this.drawSolid("#0a0a1f", width, height);
        break;
    }

    // 2. 星空层
    this.starfield.setEnabled(
      config.starfieldEnabled || config.type === "stars",
    );
    this.starfield.setDensity(config.starfieldDensity);
    this.starfield.resize(width, height);

    // 3. 流体层
    if (this.fluid) {
      this.fluid.setEnabled(config.fluidEnabled || config.type === "fluid");
      this.fluid.setResolution(config.fluidResolution);
      this.fluid.resize(width, height);
      const palette = presetThemes[config.presetTheme];
      if (palette) {
        const c1 = this.hexToRgb01(palette.stops[0].color);
        const c2 = this.hexToRgb01(
          palette.stops[Math.floor(palette.stops.length / 2)].color,
        );
        const c3 = this.hexToRgb01(
          palette.stops[palette.stops.length - 1].color,
        );
        this.fluid.setColors(c1, c2, c3);
      }
    }
  }

  update(deltaSeconds: number, activeNoteCount: number, fps: number) {
    if (
      !this.degradeMode &&
      this.currentConfig?.flowAnimation &&
      this.gradientGraphics
    ) {
      this.flowTime += deltaSeconds * this.currentConfig.flowSpeed;
      // 完整循环 > 60 秒
      const cycleTime = 60;
      const phase = (this.flowTime % cycleTime) / cycleTime;
      this.applyFlowAnimation(phase);
    }

    this.starfield.update(deltaSeconds, activeNoteCount);
    this.fluid?.update(deltaSeconds, activeNoteCount, fps);
  }

  private applyFlowAnimation(phase: number) {
    if (!this.gradientGraphics || !this.currentConfig) return;
    // 通过 alpha 微变化模拟呼吸感
    const breathe = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
    this.gradientGraphics.alpha = 0.85 + 0.15 * breathe;
  }

  private drawSolid(color: string, width: number, height: number) {
    const g = new PIXI.Graphics();
    g.rect(0, 0, width, height);
    g.fill(color);
    this.baseContainer.addChild(g);
    this.gradientGraphics = g;
  }

  private drawGradient(
    direction: GradientDirection,
    stops: GradientStop[],
    width: number,
    height: number,
  ) {
    const g = new PIXI.Graphics();
    const steps = 100;
    const sortedStops = [...stops].sort((a, b) => a.position - b.position);

    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const color = this.interpolateStops(sortedStops, t);

      if (direction === "linear-horizontal") {
        g.rect(t * width, 0, width / steps + 1, height);
      } else if (direction === "radial") {
        const cx = width / 2;
        const cy = height / 2;
        const maxR = Math.sqrt(cx * cx + cy * cy);
        const r = (1 - t) * maxR;
        g.circle(cx, cy, r);
      } else {
        g.rect(0, t * height, width, height / steps + 1);
      }
      g.fill(color);
    }

    this.baseContainer.addChild(g);
    this.gradientGraphics = g;
  }

  private drawPreset(theme: PresetTheme, width: number, height: number) {
    const palette = presetThemes[theme];
    this.drawGradient("linear-vertical", palette.stops, width, height);
  }

  private drawStarsBackground(width: number, height: number) {
    const bg = new PIXI.Graphics();
    bg.rect(0, 0, width, height);
    bg.fill("#050510");
    this.baseContainer.addChild(bg);
    this.gradientGraphics = bg;
  }

  private drawImage(
    imageData: string,
    _blur: number,
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
        const ts = new PIXI.TilingSprite({ texture, width, height });
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

    this.baseContainer.addChild(sprite);

    if (darken > 0) {
      const overlay = new PIXI.Graphics();
      overlay.rect(0, 0, width, height);
      overlay.fill({ color: "#000000", alpha: darken });
      this.baseContainer.addChild(overlay);
    }
  }

  private interpolateStops(stops: GradientStop[], t: number): string {
    if (stops.length === 0) return "#000000";
    if (t <= stops[0].position) return stops[0].color;
    if (t >= stops[stops.length - 1].position)
      return stops[stops.length - 1].color;

    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i].position && t <= stops[i + 1].position) {
        const range = stops[i + 1].position - stops[i].position;
        const localT = range > 0 ? (t - stops[i].position) / range : 0;
        return this.interpolateColor(
          stops[i].color,
          stops[i + 1].color,
          localT,
        );
      }
    }
    return stops[stops.length - 1].color;
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

  private hexToRgb01(hex: string): [number, number, number] {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return [0, 0, 0];
    return [rgb.r / 255, rgb.g / 255, rgb.b / 255];
  }

  resize(width: number, height: number) {
    if (this.currentConfig) {
      this.applyConfig(this.currentConfig, width, height);
    }
  }

  setDegradeMode(enabled: boolean) {
    this.degradeMode = enabled;
    this.starfield.setDegradeMode(enabled);
    this.fluid?.setDegradeMode(enabled);
  }

  private clearBase() {
    // 销毁子节点而非仅移除，防止 Graphics/Sprite/Texture 泄漏
    const children = this.baseContainer.removeChildren();
    for (const child of children) {
      child.destroy({ children: true });
    }
    this.gradientGraphics = null;
  }

  destroy() {
    this.starfield.destroy();
    this.fluid?.destroy();
    // 销毁 baseContainer 的所有子节点
    const children = this.baseContainer.removeChildren();
    for (const child of children) {
      child.destroy({ children: true });
    }
    this.gradientGraphics = null;
  }
}
