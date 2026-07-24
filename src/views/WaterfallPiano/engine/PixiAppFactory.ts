import { Application } from "pixi.js";
import { createLogger } from "@/utils/logger";

const logger = createLogger("PixiAppFactory");

/**
 * 创建瀑布钢琴专用的 PixiJS Application 实例
 * - preference: 'webgl' (优先 WebGL2)
 * - antialias: false (性能优先)
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
    antialias: false,
    backgroundAlpha: 0,
    preference: "webgl",
    resolution: window.devicePixelRatio,
    autoDensity: true,
    autoStart: false,
  });
  container.appendChild(app.canvas);
  logger.debug("PixiJS Application created");
  return app;
}
