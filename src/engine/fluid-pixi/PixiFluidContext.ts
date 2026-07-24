import { Application, RenderTexture, Container, Sprite, Filter } from "pixi.js";
import type { TEXTURE_FORMATS, SCALE_MODE } from "pixi.js";

/**
 * 双缓冲 RenderTexture（ping-pong 模式）
 * 用于流体模拟中需要交替读写的场（velocity, dye, pressure）
 */
export interface DoubleRT {
  read: RenderTexture;
  write: RenderTexture;
  swap(): void;
}

/**
 * PixiJS 流体渲染上下文：封装 Application 访问和 RenderTexture 管理
 *
 * 职责：
 * 1. 提供对 PixiJS Application/Renderer 的类型安全访问
 * 2. 创建和管理浮点格式 RenderTexture（用于流体模拟场）
 * 3. 管理持久化 Sprite（用于 Filter Pass 执行，零 GC）
 * 4. 提供 applyPass 方法（核心 Filter 执行原语）
 */
export class PixiFluidContext {
  private app: Application;

  /** 持久化 Sprite：整个流体生命周期只创建一次，用于 Filter Pass 渲染全屏 quad */
  private quadSprite: Sprite;
  /** 持久化 Container：包含 quadSprite，作为 renderer.render() 的目标容器 */
  private quadContainer: Container;

  constructor(app: Application) {
    this.app = app;

    // 创建持久化 quad Sprite（生命周期与 context 相同，零 GC）
    this.quadContainer = new Container();
    this.quadSprite = new Sprite();
    this.quadSprite.label = "fluid-quad";
    this.quadContainer.addChild(this.quadSprite);
  }

  /** 获取 PixiJS Application */
  get application(): Application {
    return this.app;
  }

  /**
   * 创建指定格式和尺寸的 RenderTexture
   * @param width - 纹理宽度（像素）
   * @param height - 纹理高度（像素）
   * @param format - 纹理格式（默认 'rgba8unorm'）
   * @param scaleMode - 缩放模式（默认 'linear'，流体模拟需要线性插值）
   */
  createRT(
    width: number,
    height: number,
    format: TEXTURE_FORMATS = "rgba8unorm",
    scaleMode: SCALE_MODE = "linear",
  ): RenderTexture {
    return RenderTexture.create({
      width,
      height,
      scaleMode,
      format,
    });
  }

  /**
   * 创建用于 ping-pong 的双缓冲 RenderTexture
   * @param width - 纹理宽度
   * @param height - 纹理高度
   * @param format - 纹理格式
   * @param scaleMode - 缩放模式
   */
  createDoubleRT(
    width: number,
    height: number,
    format: TEXTURE_FORMATS = "rgba8unorm",
    scaleMode: SCALE_MODE = "linear",
  ): DoubleRT {
    let read = this.createRT(width, height, format, scaleMode);
    let write = this.createRT(width, height, format, scaleMode);
    return {
      get read() {
        return read;
      },
      get write() {
        return write;
      },
      swap() {
        const temp = read;
        read = write;
        write = temp;
      },
    };
  }

  /**
   * 执行单次 Filter Pass：将 filter 应用于 input 纹理，输出到 output RenderTexture
   *
   * 使用 PixiJS v8 FilterSystem.applyFilter() 直接应用 filter，
   * 避免 Sprite 渲染管线中 bounds/坐标不匹配的问题。
   *
   * @param filter - 要应用的 PixiJS Filter
   * @param input - 输入 RenderTexture
   * @param output - 输出 RenderTexture
   * @param clear - 是否清除输出纹理（默认 true）。设为 false 可实现累加混合。
   */
  applyPass(filter: Filter, input: RenderTexture, output: RenderTexture, clear: boolean = true): void {
    // 优先使用 FilterSystem.applyFilter() 直接应用 filter
    const filterSystem = (this.app.renderer as any).filters;
    if (filterSystem && typeof filterSystem.applyFilter === "function") {
      filterSystem.applyFilter(filter, input, output, clear);
      return;
    }

    // 回退：通过 Sprite + Filter 渲染到 RenderTexture
    this.quadSprite.texture = input;
    this.quadSprite.filters = [filter];
    this.app.renderer.render({
      container: this.quadContainer,
      target: output,
      clear,
    });
    this.quadSprite.filters = null;
  }

  /** 销毁所有持久化资源 */
  destroy(): void {
    this.quadSprite.filters = null;
    this.quadSprite.destroy();
    this.quadContainer.destroy();
  }

  /** 销毁单个 RenderTexture */
  destroyRT(rt: RenderTexture): void {
    rt.destroy(true);
  }

  /** 销毁双缓冲 RenderTexture */
  destroyDoubleRT(rt: DoubleRT): void {
    rt.read.destroy(true);
    rt.write.destroy(true);
  }
}
