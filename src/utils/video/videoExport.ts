/**
 * 视频导出工具：编码能力探测、分辨率计算与码率估算（共享模块）
 *
 * 录制方案：离线渲染（快于实时，ADR 0016 / 0023）——逐帧绘制 →
 * WebCodecs VideoEncoder 编码 → Mediabunny 封装为 MP4 容器。
 * 本模块只做能力探测与参数计算，逐帧编码循环见 encodePipeline.ts。
 * 使用方：ScoreScroll（滚动乐谱）与 WaterfallPiano（瀑布流钢琴）。
 */

/**
 * 候选视频编码（MP4 容器）。运行时按 VideoEncoder.isConfigSupported
 * 过滤：UI 只展示当前环境可用的编码；导出时再次探测并按
 * 硬件加速（prefer-hardware）优先落档。
 */
export const VIDEO_CODECS = [
  {
    value: "avc",
    encoderCandidates: ["avc1.640028", "avc1.4d0028", "avc1.42e01e"],
    packetCodec: "avc",
    mime: "video/mp4",
  },
  {
    value: "hevc",
    encoderCandidates: ["hvc1.1.6.L93.B0", "hev1.1.6.L93.B0"],
    packetCodec: "hevc",
    mime: "video/mp4",
  },
  {
    value: "av1",
    encoderCandidates: ["av01.0.08M.08"],
    packetCodec: "av1",
    mime: "video/mp4",
  },
] as const;

export type VideoCodecValue = (typeof VIDEO_CODECS)[number]["value"];

/** Mediabunny 封装层使用的视频 codec 标识（MP4 容器子集） */
export type MuxerVideoCodec = "avc" | "hevc" | "av1";

/** 编码 + 封装参数（导出时探测确定） */
export interface VideoCodecSpec {
  /** VideoEncoder 的 codec 字符串（在候选档位间探测择优） */
  encoderCodec: string;
  /** Mediabunny EncodedVideoPacketSource 的 codec */
  packetCodec: MuxerVideoCodec;
  /** 输出 Blob MIME */
  mime: string;
  /**
   * 硬件加速偏好（探测成功的档位）。导出是吞吐敏感的离线任务，
   * 优先探测 GPU 编码器（NVENC / QSV / AMF），失败再退回无偏好
   * （软编）；缺省 = 无偏好。
   */
  hardwareAcceleration?:
    | "no-preference"
    | "prefer-hardware"
    | "prefer-software";
}

/** WebCodecs 离线编码的最小能力（缺 OffscreenCanvas 的环境用游离 canvas 兜底，不设门槛） */
export function isWebCodecsSupported(): boolean {
  return (
    typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined"
  );
}

/** 探测一轮 isConfigSupported（codec 字符串 × 硬件加速偏好） */
async function probeEncoderConfig(
  encoderCodec: string,
  hw: "prefer-hardware" | undefined,
  width: number,
  height: number,
  bitrate: number,
  framerate: number,
): Promise<boolean> {
  try {
    const support = await VideoEncoder.isConfigSupported({
      codec: encoderCodec,
      width,
      height,
      bitrate,
      framerate,
      ...(hw ? { hardwareAcceleration: hw } : {}),
    });
    return support.supported === true;
  } catch {
    // 探测异常视同不支持
    return false;
  }
}

/**
 * 探测当前环境是否支持某编码（UI 可用性预检用）。
 * 以 1080p/30fps 探测：支持的编码在此规格下基本都可用；
 * 更高规格的实际可用性在导出时由 selectEncoderCodec 再次把关。
 */
export async function isCodecSupported(
  codec: VideoCodecValue,
): Promise<boolean> {
  const spec = VIDEO_CODECS.find((c) => c.value === codec);
  if (!spec || !isWebCodecsSupported()) return false;
  for (const encoderCodec of spec.encoderCandidates) {
    for (const hw of ["prefer-hardware", undefined] as const) {
      if (
        await probeEncoderConfig(encoderCodec, hw, 1920, 1080, 8_000_000, 30)
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 探测当前环境可用的编码档位：在候选 codec 字符串 × 硬件加速偏好间
 * 择优（GPU 编码器通常比软编快数倍，优先 prefer-hardware）。
 * 全部失败抛错（由调用方提示换编码）。
 */
export async function selectEncoderCodec(
  codec: VideoCodecValue,
  width: number,
  height: number,
  bitrate: number,
  framerate: number,
): Promise<VideoCodecSpec> {
  const spec = VIDEO_CODECS.find((c) => c.value === codec);
  if (!spec) throw new Error(`未知编码：${codec}`);
  for (const hw of ["prefer-hardware", undefined] as const) {
    for (const encoderCodec of spec.encoderCandidates) {
      if (
        await probeEncoderConfig(
          encoderCodec,
          hw,
          width,
          height,
          bitrate,
          framerate,
        )
      ) {
        return {
          encoderCodec,
          packetCodec: spec.packetCodec,
          mime: spec.mime,
          hardwareAcceleration: hw,
        };
      }
    }
  }
  throw new Error(`当前环境不支持编码 ${codec}（无可用 codec）`);
}

/** 画面比例由取景矩形宽高比决定；分辨率选项为短边像素 */
export const VIDEO_RESOLUTIONS = [720, 1080, 1440, 2160] as const;

/** 可选帧率 */
export const VIDEO_FPS = [30, 60] as const;

/**
 * 由取景矩形宽高比 + 短边分辨率计算画布尺寸（偶数对齐，编码器友好）。
 * 比例被夹紧在编码器安全范围内（画布任意一边 ≤4096）——极端矩形不会
 * 产出无意义的超宽/超高画布；预览与导出共用本函数，夹紧后两者一致。
 * 例：短边 1080 + 比例 16:9 → 1920×1080；比例 9:16 → 1080×1920。
 */
export function videoCanvasSizeForRatio(
  ratio: number,
  shortSide: number,
): { width: number; height: number } {
  const even = (n: number): number => Math.max(2, Math.round(n / 2) * 2);
  const maxRatio = 4096 / Math.max(2, shortSide);
  const minRatio = Math.max(2, shortSide) / 4096;
  const r = Math.max(minRatio, Math.min(maxRatio, ratio));
  return r >= 1
    ? { width: even(shortSide * r), height: even(shortSide) }
    : { width: even(shortSide), height: even(shortSide / r) };
}

/** 按像素规模与帧率估算录制码率（bits/s），夹紧在 4–40 Mbps */
export function videoBitrate(
  width: number,
  height: number,
  fps: number,
): number {
  const estimate = width * height * fps * 0.15;
  return Math.round(Math.min(40e6, Math.max(4e6, estimate)));
}
