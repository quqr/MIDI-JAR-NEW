import { ref } from "vue";
import { useFilePicker } from "@/composables/useFilePicker";
import {
  VIDEO_CODECS,
  isCodecSupported,
  isWebCodecsSupported,
  type VideoCodecValue,
} from "@/utils/video/videoExport";
import { cameraDefaultRect } from "../utils/scoreFrameBuilder";
import {
  ExportSuspension,
  type ExportSuspender,
} from "@/utils/video/exportSuspension";
import type {
  VideoExportHandle,
  VideoExportParams,
} from "../utils/videoEncoder";

/**
 * 视频导出编排（模块级单例状态：ScoreScroll 与右侧设置面板共享）。
 *
 * 职责：导出选项（编码/比例/分辨率/帧率/摄像机）、编码能力预检、
 * 进度/错误/编码模式（GPU|CPU）状态、run() 编排（动态加载编码管线 →
 * 逐帧离线渲染 → 保存文件双通道）。谱面数据（图元/时间轴/尺寸）由
 * ScoreScroll 在 run() 时组装传入。
 */

const isExporting = ref(false);
const progress = ref(0);
const error = ref<string | null>(null);
/** 本次导出已完成并保存 */
const done = ref(false);

/** 视频编码（MP4 容器：H.264 / H.265 / AV1） */
const codec = ref<VideoCodecValue>("avc");
const shortSide = ref<number>(1080);
const fps = ref<number>(30);

/**
 * 取景矩形（内容 px）：宽度/高度可调，垂直位置 = 矩形中心占谱面高度的
 * 百分比。0 值表示尚未按当前乐谱初始化（乐谱加载时由 initCamera 填充
 * 默认值：谱面全高 + 余量，16:9）。
 */
const cameraWidth = ref(0);
const cameraHeight = ref(0);
const cameraCenterY = ref(50);
/** 页面上预览取景矩形（矩形外谱面灰显） */
const cameraPreview = ref(true);

/** 各编码在当前环境的可用性（编码值 → 是否支持） */
const codecSupport = ref<Partial<Record<VideoCodecValue, boolean>>>({});
/** 编码探测结果：codec 探测完成标记 */
const codecProbeDone = ref(false);
/** 本次导出的编码执行模式（GPU 硬件 / CPU 软件），探测后回填 */
const encodingMode = ref<"gpu" | "cpu" | null>(null);
/** 导出速度（实时倍率，导出中实时更新，完成后定格） */
const realtimeFactor = ref<number | null>(null);

const webCodecsSupported = isWebCodecsSupported();

let handle: VideoExportHandle | null = null;

/** 导出期间的前台让路钩子（ADR 0026，由 ScoreScroll 绑定） */
const suspension = new ExportSuspension();

/** 文件名时间戳：score_YYYYMMDD_HHmmss */
function timestampName(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function isCancelled(e: unknown): boolean {
  return e instanceof Error && e.message.includes("已取消");
}

export function useVideoExport() {
  /**
   * 绑定导出期间的前台让路实现（ADR 0026）。
   *
   * 导出前 suspend()（暂停播放 + 抑制视口重绘），导出结束——含成功、
   * 取消、报错——后必定 resume()。传 null 解绑；解绑不会留下暂停态。
   */
  function bindExportSuspender(suspender: ExportSuspender | null): void {
    suspension.bind(suspender);
  }

  /**
   * 按当前乐谱初始化取景矩形默认值（乐谱加载/更换时调用）：
   * 谱面全高 + 上下余量，宽高比 16:9，垂直居中。
   */
  function initCamera(contentHeightPx: number): void {
    if (contentHeightPx <= 0) return;
    const rect = cameraDefaultRect(contentHeightPx);
    cameraWidth.value = rect.width;
    cameraHeight.value = rect.height;
    cameraCenterY.value = 50;
  }

  /** 预检各编码在当前环境的可用性（挂载时调用一次） */
  async function probeCodecs(): Promise<void> {
    if (codecProbeDone.value) return;
    codecProbeDone.value = true;
    const results = await Promise.all(
      VIDEO_CODECS.map(
        async (c) => [c.value, await isCodecSupported(c.value)] as const,
      ),
    );
    codecSupport.value = Object.fromEntries(results);
    // 当前选中编码不可用时自动回落到第一个可用编码
    if (!codecSupport.value[codec.value]) {
      const fallback = VIDEO_CODECS.find((c) => codecSupport.value[c.value]);
      if (fallback) codec.value = fallback.value;
    }
  }

  function cancel(): void {
    handle?.cancel();
  }

  /**
   * 开始导出。params 为谱面数据部分（不含选项——由本 composable 的
   * 选项 state 合并）；完成后自动经 useFilePicker 双通道保存。
   */
  async function run(
    base: Omit<VideoExportParams, "codec" | "shortSide" | "fps" | "camera">,
  ): Promise<void> {
    if (isExporting.value || !webCodecsSupported) return;
    isExporting.value = true;
    progress.value = 0;
    error.value = null;
    done.value = false;
    encodingMode.value = null;
    realtimeFactor.value = null;
    const startedAt = performance.now();

    // 谱面数据已由调用方组装传入，现在让前台让路：
    // 暂停播放并抑制视口重绘，把 CPU 让给逐帧离线渲染 + 编码器（ADR 0026）
    suspension.suspend();

    try {
      // 动态加载：编码管线与 mediabunny 仅在导出时进入 bundle 分包
      const { renderScoreVideo } = await import("../utils/videoEncoder");
      handle = renderScoreVideo({
        ...base,
        codec: codec.value,
        shortSide: shortSide.value,
        fps: fps.value,
        camera: {
          width: cameraWidth.value,
          height: cameraHeight.value,
          centerYPct: cameraCenterY.value,
        },
      });
      handle.onHardware((hw) => {
        encodingMode.value = hw ? "gpu" : "cpu";
      });
      handle.onProgress((r) => {
        progress.value = r;
        const elapsedSec = (performance.now() - startedAt) / 1000;
        if (elapsedSec > 0.5) {
          // 已渲染时长 / 实际耗时 = 实时倍率
          realtimeFactor.value = (r * base.durationSec) / elapsedSec;
        }
      });
      const blob = await handle.start();
      await useFilePicker().saveFile(
        `score_${timestampName()}.mp4`,
        blob,
        "video/mp4",
      );
      done.value = true;
    } catch (e) {
      if (!isCancelled(e)) {
        error.value = e instanceof Error ? e.message : String(e);
      }
    } finally {
      handle = null;
      // 让路恢复（视口会在恢复时补一次重绘）
      suspension.resume();
      isExporting.value = false;
    }
  }

  return {
    isExporting,
    progress,
    error,
    done,
    codec,
    shortSide,
    fps,
    cameraWidth,
    cameraHeight,
    cameraCenterY,
    cameraPreview,
    codecSupport,
    codecProbeDone,
    encodingMode,
    realtimeFactor,
    webCodecsSupported,
    initCamera,
    probeCodecs,
    bindExportSuspender,
    run,
    cancel,
  };
}
