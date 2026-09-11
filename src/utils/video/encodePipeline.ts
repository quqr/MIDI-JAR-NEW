/**
 * 通用视频编码管线：离线逐帧 → WebCodecs 编码 → Mediabunny 封装（MP4）
 *
 * 从 ScoreScroll 的 videoEncoder.ts 抽取的共享核心（ADR 0016 / 0023）：
 * 与画面内容完全解耦——调用方通过 drawFrame 回调按帧索引绘制画面，
 * 本模块负责编码器配置、背压、主线程让出、关键帧间隔、flush 与 MP4 封装。
 *
 * 设计要点：
 * - 快于实时：编码循环不受播放时钟约束，帧间让出主线程保持 UI 响应；
 * - 页面可切走：不依赖 rAF / captureStream，后台任务不受可见性节流；
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
import {
  selectEncoderCodec,
  videoBitrate,
  type VideoCodecValue,
} from "./videoExport";

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

export interface VideoFramePipelineParams {
  /** 画布宽（像素，偶数） */
  width: number;
  /** 画布高（像素，偶数） */
  height: number;
  fps: number;
  /** 视频编码（MP4 容器：H.264 / H.265 / AV1） */
  codec: VideoCodecValue;
  /** 导出总时长（秒）：决定总帧数与实时倍率分母 */
  durationSec: number;
  /**
   * 绘制第 i 帧（t = i/fps 秒）到给定离屏画布（同步）。
   * 画布为 2D 上下文；dpr = 1（画布像素即视频像素）。
   */
  drawFrame: (
    canvas: OffscreenCanvas | HTMLCanvasElement,
    i: number,
    tSec: number,
  ) => void;
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
): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** MP4 容器（in-memory fastStart：成品元数据前置，中等长度曲目内存开销可接受） */
function createOutputFormat(): Mp4OutputFormat {
  return new Mp4OutputFormat({ fastStart: "in-memory" });
}

/**
 * 逐帧离线渲染 + 编码 + 封装。drawFrame 负责画面内容，
 * 本函数负责整条编码管线；进度按帧数推进。
 */
export function renderVideoFromFrames(
  params: VideoFramePipelineParams,
): VideoExportHandle {
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
      const { width, height, fps } = params;
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

      const canvas = createOffscreenCanvas(width, height);
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

          params.drawFrame(canvas, i, i / fps);

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
