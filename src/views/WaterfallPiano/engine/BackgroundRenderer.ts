import { Container, Graphics } from "pixi.js";
import type { BackgroundConfig } from "../types";

/**
 * 瀑布流钢琴的背景渲染器，使用 PixiJS Graphics 绘制纯色/渐变背景
 */
export class BackgroundRenderer {
  private bgGraphics: Graphics | null = null;
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
  }

  setBackgroundConfig(config: BackgroundConfig): void {
    this.config = config;
    this.dirty = true;
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
   * 渲染背景，仅在配置变更或尺寸变化时重绘
   * @param _time - 当前时间戳（保留参数，当前未使用）
   */
  render(_time: number): void {
    if (!this.bgGraphics || !this.config || !this.dirty) return;
    this.bgGraphics.clear();
    if (!this.fluidActive) {
      this.bgGraphics.rect(0, 0, this.width, this.height);
      this.bgGraphics.fill(this.config.solidColor);
    }
    this.dirty = false;
  }

  dispose(): void {
    this.bgGraphics?.destroy();
    this.bgGraphics = null;
  }
}
