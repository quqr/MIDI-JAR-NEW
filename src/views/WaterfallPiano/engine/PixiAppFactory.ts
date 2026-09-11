import { Application } from "pixi.js";
import { createLogger } from "@/utils/logger";

const logger = createLogger("PixiAppFactory");

/**
 * 创建瀑布钢琴专用的 PixiJS Application 实例
 * - preference: 'webgl' (优先 WebGL2)
 * - antialias: true (启用抗锯齿，配合 DPR 支持)
 * - backgroundAlpha: 0 (透明，让 CSS 背景穿透)
 * - resizeTo: 外部容器
 * - resolution: devicePixelRatio (高 DPI 清晰)
 * - autoDensity: true (自动适配 CSS 尺寸)
 */
export async function createWaterfallApp(
  container: HTMLElement,
): Promise<Application> {
  const app = new Application();
  await app.init({
    resizeTo: container,
    antialias: true,
    backgroundAlpha: 0,
    preference: "webgl",
    resolution: window.devicePixelRatio,
    autoDensity: true,
    autoStart: false,
  });
  container.appendChild(app.canvas);
  // PixiJS v8 默认不会给主 canvas 设置 position，导致它处于普通文档流。
  // 当与独立的 fluid canvas（position:absolute）层叠时，CSS 规范使 positioned 元素
  // 总是绘制在 non-positioned 元素之上，与 DOM 顺序无关，会出现 fluid 误盖 PixiJS 的问题。
  // 这里显式设 position:absolute + z-index:1，让两层 canvas 同处 positioned 上下文，
  // 由 z-index 决定层叠（fluid canvas 的 z-index 由 WaterfallCanvas.vue 控制）。
  app.canvas.style.position = "absolute";
  app.canvas.style.zIndex = "1";
  (globalThis as Record<string, unknown>).__PIXI_APP__ = app;
  logger.debug("PixiJS Application created");
  return app;
}

/**
 * 创建离屏（视频导出专用）的 PixiJS Application 实例（ADR 0023）
 * - 与 createWaterfallApp 相同的渲染偏好（webgl / antialias / autoStart:false）
 * - canvas 不 append 到 DOM、不设 CSS 样式，由导出管线手动驱动渲染
 * - resolution 固定为传入 dpr（导出 = 1：画布像素即视频像素）
 * - 不写入 __PIXI_APP__ 全局（避免与前台可见实例混淆）
 */
export async function createOfflineWaterfallApp(
  width: number,
  height: number,
  dpr = 1,
): Promise<Application> {
  const app = new Application();
  await app.init({
    width,
    height,
    antialias: true,
    backgroundAlpha: 0,
    preference: "webgl",
    resolution: dpr,
    autoDensity: false,
    autoStart: false,
  });
  logger.debug(`Offline PixiJS Application created (${width}x${height})`);
  return app;
}
