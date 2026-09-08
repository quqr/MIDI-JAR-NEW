/**
 * 视频导出：离线逐帧渲染 + WebCodecs 编码 + Mediabunny 封装（ADR 0016）
 *
 * 管线：OffscreenCanvas 逐帧 drawScoreFrame（context 无关，ADR 0010）→
 * VideoFrame → VideoEncoder → EncodedVideoPacketSource → Output(Mp4)
 * → BufferTarget → Blob。
 *
 * 设计要点：
 * - 快于实时：编码循环不受播放时钟约束，帧间让出主线程保持 UI 响应；
 * - 视图推导：deriveViewAtTime 按帧时间换算 pan/播放头（与实时视口
 *   同式，见 scoreFrameBuilder），导出画面与屏幕所见一致；
 * - 内存：逐帧 close，不缓存位图；成品走 in-memory fastStart
 *   （中等长度曲目安全，超长视频可后续切流式写盘）。
 */

import {
  BufferTarget,
  EncodedPacket,
  EncodedVideoPacketSource,
  Mp4OutputFormat,
  Output,
} from "mediabunny";
import type { PrimitiveIndex } from "./primitives";
import { drawScoreFrame, type ScoreContext2D } from "./scoreCanvasRenderer";
import {
  buildFrameOptions,
  clampCameraRect,
  deriveViewAtTime,
  type ScoreFrameInputs,
} from "./scoreFrameBuilder";
import {
  selectEncoderCodec,
  videoBitrate,
  videoCanvasSizeForRatio,
  type VideoCodecValue,
} from "./videoExport";
import type { BeatXPoint, TempoSegment } from "./beatMap";

/** 导出取景矩形（内容坐标；宽度/高度可调，垂直位置为矩形中心占谱面高度的百分比） */
export interface CameraRectSettings {
  width: number;
  height: number;
  centerYPct: number;
}

export interface VideoExportParams {
  /** 图元缓存（useOsmd.primitives） */
  primitives: PrimitiveIndex;
  /** 拍 → 谱面 X 映射快照（useScoreSync.beatXMap） */
  beatXMap: BeatXPoint[];
  /** 分段 tempo map 快照（useScoreSync.tempoMap） */
  tempoMap: TempoSegment[];
  /** 谱面完整布局高度（未缩放 px，useScoreSync.contentHeightPx） */
  contentHeightPx: number;
  /** 导出时长（秒，useScoreSync.duration） */
  durationSec: number;
  /** 帧效果输入（store 设置 + 已解析主题色，见 scoreFrameBuilder） */
  frameInputs: ScoreFrameInputs;
  /** 视频编码（MP4 容器：H.264 / H.265 / AV1） */
  codec: VideoCodecValue;
  /** 取景矩形（宽/高/垂直位置；画布比例由矩形宽高比决定） */
  camera: CameraRectSettings;
  /** 短边分辨率（px） */
  shortSide: number;
  fps: number;
}

export interface VideoExportHandle {
  /** 开始导出：完成时 resolve 视频 Blob；被取消时 reject */
  start(): Promise<Blob>;
  /** 请求取消（进行中的编码循环在下一让出点退出） */
  cancel(): void;
  /** 订阅进度（0-1） */
  onProgress(cb: (ratio: number) => void): void;
  /** 订阅编码器信息（硬件探测完成后回调；hw = 是否走 GPU 硬件编码） */
  onHardware(cb: (hw: boolean) => void): void;
}

/** 让出主线程的时间预算（ms）：绘制超过该耗时即让出，UI 保持响应 */
const YIELD_BUDGET_MS = 8;
/** 关键帧间隔（帧）：约每 2 秒一个 IDR，拖动进度条体验与文件体积的折中 */
const KEYFRAME_INTERVAL_SEC = 2;
/**
 * 编码队列背压阈值（帧）：慢速软编（AV1 等）下渲染远快于编码，
 * 不加背压会让全部帧堆进编码队列（内存暴涨），且 finalize 前
 * 若不 flush 会把未编码帧全部丢弃（成片截断）。
 */
const MAX_ENCODE_QUEUE = 60;

let yieldChannel: MessageChannel | null = null;

/**
 * 让出主线程（宏任务切片）。用 MessageChannel 而非 setTimeout(0)：
 * 后者被浏览器钳制到 ≥4ms，逐帧让出时累积可观；
 * 前者无钳制，任务间仍可处理输入/绘制/取消等事件。
 */
function yieldToUi(): Promise<void> {
  yieldChannel ??= new MessageChannel();
  return new Promise((resolve) => {
    yieldChannel!.port1.onmessage = () => resolve();
    yieldChannel!.port2.postMessage(null);
  });
}

/** 创建离屏 2D 画布：优先 OffscreenCanvas，缺失时游离 DOM canvas 兜底 */
function createOffscreenCanvas(
  width: number,
  height: number,
): {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: ScoreContext2D;
} {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (ctx) return { canvas, ctx: ctx as unknown as ScoreContext2D };
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建离屏画布 2D 上下文");
  return { canvas, ctx: ctx as unknown as ScoreContext2D };
}

/** MP4 容器（in-memory fastStart：成品元数据前置，中等长度曲目内存开销可接受） */
function createOutputFormat(): Mp4OutputFormat {
  return new Mp4OutputFormat({ fastStart: "in-memory" });
}

export function renderScoreVideo(params: VideoExportParams): VideoExportHandle {
  let cancelled = false;
  let progressCb: ((ratio: number) => void) | null = null;
  let hardwareCb: ((hw: boolean) => void) | null = null;

  return {
    onProgress(cb: (ratio: number) => void): void {
      progressCb = cb;
    },

    onHardware(cb: (hw: boolean) => void): void {
      hardwareCb = cb;
    },

    cancel(): void {
      cancelled = true;
    },

    async start(): Promise<Blob> {
      // 取景矩形：夹紧后决定画布比例与缩放（预览与导出同一套计算）
      const rect = clampCameraRect(
        params.camera.width,
        params.camera.height,
        params.camera.centerYPct,
        params.contentHeightPx,
      );
      const { width, height } = videoCanvasSizeForRatio(
        rect.width / rect.height,
        params.shortSide,
      );
      const { fps } = params;
      const total = Math.max(1, Math.ceil(params.durationSec * fps));
      const bitrate = videoBitrate(width, height, fps);
      const spec = await selectEncoderCodec(
        params.codec,
        width,
        height,
        bitrate,
        fps,
      );
      hardwareCb?.(spec.hardwareAcceleration === "prefer-hardware");
      // 摄像机缩放：画面高 / 矩形高（矩形宽度即画面覆盖的内容宽度）
      const zoom = height / rect.height;

      const { canvas, ctx } = createOffscreenCanvas(width, height);
      const target = new BufferTarget();
      const output = new Output({
        format: createOutputFormat(),
        target,
      });
      const source = new EncodedVideoPacketSource(spec.packetCodec);
      output.addVideoTrack(source, { frameRate: fps });
      await output.start();

      let encoderError: Error | null = null;
      const encoder = new VideoEncoder({
        output: (chunk, meta) => {
          void source
            .add(EncodedPacket.fromEncodedChunk(chunk), meta)
            .catch((e: unknown) => {
              encoderError = e instanceof Error ? e : new Error(String(e));
            });
        },
        error: (e: DOMException) => {
          encoderError = e;
        },
      });
      encoder.configure({
        codec: spec.encoderCodec,
        width,
        height,
        bitrate,
        framerate: fps,
        latencyMode: "quality",
        ...(spec.hardwareAcceleration
          ? { hardwareAcceleration: spec.hardwareAcceleration }
          : {}),
      });

      const keyframeEvery = Math.max(
        1,
        Math.round(fps * KEYFRAME_INTERVAL_SEC),
      );
      const timestampUs = 1e6 / fps;
      // 让出节奏按实际绘制耗时自适应（而非固定帧数）：
      // 高分辨率绘制慢 → 每帧都让出；低分辨率绘制快 → 攒够预算再让
      let lastYieldAt = performance.now();

      try {
        for (let i = 0; i < total; i++) {
          if (cancelled) throw new Error("已取消导出");
          if (encoderError) throw encoderError;

          const t = i / fps;
          const { view, playheadX } = deriveViewAtTime({
            timeSec: t,
            beatXMap: params.beatXMap,
            tempoMap: params.tempoMap,
            zoom,
            cssWidth: width,
            cssHeight: height,
            scanlinePosition: params.frameInputs.scanlinePosition,
            snapPosition: params.frameInputs.snapPosition,
            contentHeightPx: params.contentHeightPx,
            // 摄像机垂直定位：矩形顶即画面对应的内容顶
            offsetYOverride: rect.top,
          });
          drawScoreFrame(
            ctx,
            params.primitives,
            buildFrameOptions(
              params.frameInputs,
              view,
              width,
              height,
              1, // 离屏画布 dpr = 1（分辨率即画布像素）
              playheadX,
            ),
          );

          const frame = new VideoFrame(canvas, {
            timestamp: Math.round(i * timestampUs),
            duration: Math.round(timestampUs),
          });
          encoder.encode(frame, { keyFrame: i % keyframeEvery === 0 });
          frame.close();

          // 背压：慢速软编（AV1）下渲染远快于编码，等编码器消化再继续
          if (encoder.encodeQueueSize > MAX_ENCODE_QUEUE) {
            await new Promise<void>((r) =>
              encoder.addEventListener("dequeue", () => r(), { once: true }),
            );
          }

          if (performance.now() - lastYieldAt >= YIELD_BUDGET_MS) {
            progressCb?.(i / total);
            // 让出主线程：保持设置面板进度/取消按钮响应
            await yieldToUi();
            lastYieldAt = performance.now();
          }
        }
        // 冲刷编码队列：慢速软编（AV1）在循环结束时仍有大量帧未交付，
        // 不 flush 就 finalize 会把未编码帧全部丢弃（成片截断到几秒）
        progressCb?.(1);
        await encoder.flush();
      } catch (e) {
        // 取消/失败：丢弃输出，释放封装器内部资源
        if (output.state === "started" || output.state === "pending") {
          await output.cancel().catch(() => {});
        }
        throw e;
      } finally {
        if (encoder.state !== "closed") encoder.close();
      }

      if (encoderError) throw encoderError;
      await output.finalize();
      if (!target.buffer) throw new Error("封装输出为空");
      return new Blob([target.buffer], { type: spec.mime });
    },
  };
}
