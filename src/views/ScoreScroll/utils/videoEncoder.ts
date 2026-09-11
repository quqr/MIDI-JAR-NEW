/**
 * 滚动乐谱视频导出：离线逐帧渲染（ADR 0016）
 *
 * 画面内容（deriveViewAtTime + drawScoreFrame）在本模块组装，
 * 编码/封装管线委托共享核心 renderVideoFromFrames（ADR 0023，
 * src/utils/video/encodePipeline.ts，瀑布流钢琴共用同一条管线）。
 *
 * 管线：OffscreenCanvas 逐帧 drawScoreFrame（context 无关，ADR 0010）→
 * VideoFrame → VideoEncoder → EncodedVideoPacketSource → Output(Mp4)
 * → BufferTarget → Blob。
 */

import type { PrimitiveIndex } from "./primitives";
import { drawScoreFrame, type ScoreContext2D } from "./scoreCanvasRenderer";
import {
  buildFrameOptions,
  clampCameraRect,
  deriveViewAtTime,
  type ScoreFrameInputs,
} from "./scoreFrameBuilder";
import {
  videoCanvasSizeForRatio,
  type VideoCodecValue,
} from "@/utils/video/videoExport";
import {
  renderVideoFromFrames,
  type VideoExportHandle,
} from "@/utils/video/encodePipeline";
import type { BeatXPoint, TempoSegment } from "./beatMap";

export type { VideoExportHandle } from "@/utils/video/encodePipeline";

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

export function renderScoreVideo(params: VideoExportParams): VideoExportHandle {
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

  return renderVideoFromFrames({
    width,
    height,
    fps: params.fps,
    codec: params.codec,
    durationSec: params.durationSec,
    drawFrame: (canvas, i, tSec) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("无法获取离屏画布 2D 上下文");
      // 摄像机缩放：画面高 / 矩形高（矩形宽度即画面覆盖的内容宽度）
      const zoom = height / rect.height;
      const { view, playheadX } = deriveViewAtTime({
        timeSec: tSec,
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
        ctx as unknown as ScoreContext2D,
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
      // i 未直接使用（时间即帧序号推导），保留签名一致性
      void i;
    },
  });
}
