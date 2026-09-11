/**
 * 瀑布流钢琴视频导出：离线逐帧渲染（ADR 0023）
 *
 * 复用共享编码管线 renderVideoFromFrames（WebCodecs + Mediabunny，
 * src/utils/video/encodePipeline.ts），画面内容来自一个**独立的离屏
 * PixiJS 引擎实例**（与前台可见引擎互不干扰）：
 *
 * 确定性基础：SynthesiaModeController.update(pps) 完全由 transportTime
 * 驱动——方块位置、触发/结束事件、键盘高亮与流体 splat 均在时间推进时
 * 确定性发生。逐帧 setTransportTime(t) + noteBlockSystem.update(dt) 即可
 * 重放任意时刻画面；不挂音频引擎（静音导出，仅视频）。
 *
 * 流体：独立 WebGL canvas，同任务内紧随渲染 drawImage 合成
 * （无需 preserveDrawingBuffer），层叠顺序遵循 fluidLayerPosition 设置。
 */

import { Container, type Application } from "pixi.js";
import {
  WaterfallEngine,
  type WaterfallLayers,
} from "../engine/WaterfallEngine";
import { createOfflineWaterfallApp } from "../engine/PixiAppFactory";
import type { ScheduledNote, WaterfallPianoSettings } from "../types";
import {
  renderVideoFromFrames,
  type VideoExportHandle,
} from "@/utils/video/encodePipeline";
import {
  videoCanvasSizeForRatio,
  type VideoCodecValue,
} from "@/utils/video/videoExport";

export interface WaterfallVideoExportParams {
  /** 瀑布流设置快照（store.settings） */
  settings: WaterfallPianoSettings;
  /** 预定音符序列（MidiFilePlayer.getScheduledNotes()） */
  notes: ScheduledNote[];
  /** 导出时长（秒） */
  durationSec: number;
  /** 画面宽高比（取导出时刻瀑布视口宽高比） */
  aspectRatio: number;
  /** 视频编码（MP4 容器：H.264 / H.265 / AV1） */
  codec: VideoCodecValue;
  /** 短边分辨率（px） */
  shortSide: number;
  fps: number;
}

/** 流体降帧参数：镜像 RenderLoop 的每 2 帧更新一次（≈30Hz） */
const FLUID_SKIP_FRAMES = 1;
let exportFluidFrameCount = 0;

/** 离屏引擎逐帧驱动 + 合成 + 交给共享管线编码 */
function drawExportFrame(
  engine: WaterfallEngine,
  app: Application,
  composite: OffscreenCanvas | HTMLCanvasElement,
  fluidCanvas: HTMLCanvasElement | null,
  fluidOnTop: boolean,
  width: number,
  height: number,
  fps: number,
  tSec: number,
  backgroundColor: string,
): void {
  const compositeCtx = composite.getContext(
    "2d",
  ) as OffscreenCanvasRenderingContext2D | null;
  if (!compositeCtx) throw new Error("无法获取合成画布 2D 上下文");

  const dt = 1 / fps;
  const nb = engine.noteBlockSystemRef;

  // ── 按 RenderLoop 的阶段顺序手动驱动离屏引擎 ──
  nb.setRenderTime(tSec * 1000); // 粒子动画用 transport 时间（确定性）
  nb.setTransportTime(tSec);
  engine.renderBackground(tSec * 1000); // 背景动画用合成时间驱动（逐帧确定）
  nb.update(dt); // 触发/结束事件 → 键盘高亮 + 流体 splat
  nb.render();
  engine.renderKeyboard();
  // 流体降帧 + 固定步长：镜像 RenderLoop（每 2 帧一次、步长 1/60s），
  // 导出帧率无关地复现实时预览的流体节奏（连续 splat 注入频率也随之一致）
  exportFluidFrameCount++;
  if (
    engine.shouldUpdateFluid() &&
    exportFluidFrameCount > FLUID_SKIP_FRAMES
  ) {
    engine.updateFluidAndSplats(1 / 60);
    exportFluidFrameCount = 0;
  }
  engine.renderFrame();

  // ── 合成：底色 → 流体（下层位置）→ PixiJS 主画布 → 流体（上层位置） ──
  // 兜底铺设置背景色：即使引擎背景层未就绪，帧也不会因透明被编码器填白
  compositeCtx.fillStyle = backgroundColor;
  compositeCtx.fillRect(0, 0, width, height);
  if (fluidCanvas && !fluidOnTop) {
    compositeCtx.drawImage(fluidCanvas, 0, 0, width, height);
  }
  compositeCtx.drawImage(app.canvas, 0, 0, width, height);
  if (fluidCanvas && fluidOnTop) {
    compositeCtx.drawImage(fluidCanvas, 0, 0, width, height);
  }
}

/**
 * 导出会话：init() 创建离屏引擎，handle.start() 执行逐帧编码，
 * dispose() 释放全部导出会话资源。
 */
export interface WaterfallVideoExportSession {
  handle: VideoExportHandle;
  init(): Promise<void>;
  dispose(): Promise<void>;
}

/**
 * 创建导出会话（ADR 0023）：
 * - init()：创建离屏 PixiJS 应用 + 第二个 WaterfallEngine + 流体 canvas
 *   （不挂音频引擎 → 静音；stopRenderLoop 后由管线按帧驱动）
 * - dispose()：engine.dispose → pixiApp.destroy(false)
 *   （TexturePool 为全局单例，禁止 destroy(true) 清空全局纹理池）
 */
export function createWaterfallVideoSession(
  params: WaterfallVideoExportParams,
): WaterfallVideoExportSession {
  const { width, height } = videoCanvasSizeForRatio(
    params.aspectRatio,
    params.shortSide,
  );
  const fps = params.fps;
  const settings = params.settings;
  const fluidEnabled = settings.background.fluidEnabled === true;
  const fluidOnTop = settings.background.fluidLayerPosition === "top";

  let app: Application | null = null;
  let engine: WaterfallEngine | null = null;
  let fluidCanvas: HTMLCanvasElement | null = null;
  let composite: OffscreenCanvas | HTMLCanvasElement | null = null;

  async function init(): Promise<void> {
    // 合成画布（导出帧的最终像素来源）
    composite =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(width, height)
        : Object.assign(document.createElement("canvas"), { width, height });

    // 流体 canvas：游离 DOM canvas，分辨率即导出尺寸（dpr = 1）
    if (fluidEnabled) {
      fluidCanvas = document.createElement("canvas");
      fluidCanvas.width = width;
      fluidCanvas.height = height;
    }

    // 离屏 PixiJS 应用 + 第二引擎实例（不挂音频引擎 → 静音）
    app = await createOfflineWaterfallApp(width, height, 1);
    const layers: WaterfallLayers = {
      background: new Container(),
      fluid: new Container(),
      waterfall: new Container(),
      keyboard: new Container(),
    };
    layers.background.label = "background";
    layers.fluid.label = "fluid";
    layers.waterfall.label = "waterfall";
    layers.keyboard.label = "keyboard";
    app.stage.addChild(
      layers.background,
      layers.fluid,
      layers.waterfall,
      layers.keyboard,
    );

    engine = new WaterfallEngine();
    engine.init(app, layers, settings, fluidCanvas ?? undefined);
    engine.stopRenderLoop(); // 导出引擎由本模块按帧驱动，Ticker 必须停
    engine.setMode("synthesia");
    engine.noteBlockSystemRef.scheduleSynthesiaNotes(params.notes);
    engine.noteBlockSystemRef.setTransportPlaying(true);
    engine.resize(width, height);
    // 自定义背景图为异步加载：等其就绪（或失败回退）再开始编码，
    // 避免视频开头若干帧缺图、中途"闪现"背景图
    await engine.backgroundRendererRef.imageSettled;
    exportFluidFrameCount = 0;
  }

  async function dispose(): Promise<void> {
    if (engine) {
      engine.stopAllSounds();
      await engine.dispose();
      engine = null;
    }
    if (app) {
      app.destroy(false, {
        children: true,
        texture: false,
        textureSource: false,
      });
      app = null;
    }
    fluidCanvas = null;
    composite = null;
  }

  const handle = renderVideoFromFrames({
    width,
    height,
    fps,
    codec: params.codec,
    durationSec: params.durationSec,
    drawFrame: (canvas, _i, tSec) => {
      if (!engine || !app || !composite) {
        throw new Error("导出会话未初始化或已释放");
      }
      drawExportFrame(
        engine,
        app,
        composite,
        fluidCanvas,
        fluidOnTop,
        width,
        height,
        fps,
        tSec,
        settings.background.solidColor,
      );
      // 编码画布：把合成结果绘制上去（renderVideoFromFrames 从该画布构造 VideoFrame）
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("无法获取编码画布 2D 上下文");
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(composite as CanvasImageSource, 0, 0);
    },
  });

  return { handle, init, dispose };
}
