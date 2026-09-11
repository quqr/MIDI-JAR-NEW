import { ref, type Ref } from "vue";
import { useFilePicker } from "@/composables/useFilePicker";
import {
  VIDEO_CODECS,
  isCodecSupported,
  isWebCodecsSupported,
  type VideoCodecValue,
} from "@/utils/video/videoExport";
import type { VideoExportHandle } from "@/utils/video/encodePipeline";
import {
  ExportSuspension,
  type ExportSuspender,
} from "@/utils/video/exportSuspension";
import type { WaterfallVideoExportSession } from "../videoExport/waterfallVideoRenderer";
import type { ScheduledNote, WaterfallPianoSettings } from "../types";

/**
 * 瀑布流钢琴视频导出编排（模块级单例状态，ADR 0023）。
 *
 * 职责：导出选项（编码/分辨率/帧率）、编码能力预检、进度/错误/编码模式
 * （GPU|CPU）状态、startExport 编排（动态加载离线渲染器 → 逐帧离线渲染
 * → 保存文件双通道）。MIDI 数据（音符序列/时长/文件名）由 WaterfallPiano
 * 通过 bindExportSource 注入 provider（避免沿 SettingsPanel 逐层传 props）。
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

/** 各编码在当前环境的可用性（编码值 → 是否支持） */
const codecSupport = ref<Partial<Record<VideoCodecValue, boolean>>>({});
/** 编码探测结果：codec 探测完成标记 */
const codecProbeDone = ref(false);
/** 本次导出的编码执行模式（GPU 硬件 / CPU 软件），探测后回填 */
const encodingMode = ref<"gpu" | "cpu" | null>(null);
/** 导出速度（实时倍率，导出中实时更新，完成后定格） */
const realtimeFactor = ref<number | null>(null);

const webCodecsSupported = isWebCodecsSupported();

/** 当前是否已加载可导出的 MIDI 内容（面板显隐/提示用，响应式） */
const hasContent = ref(false);

let handle: VideoExportHandle | null = null;

/** 导出期间的前台让路钩子（ADR 0026，由 WaterfallPiano 绑定） */
const suspension = new ExportSuspension();

/** 导出数据源 provider（WaterfallPiano 挂载时注入） */
let exportSourceProvider: (() => WaterfallExportSource | null) | null = null;

/** 导出数据源：MIDI 音符序列 + 时长 + 文件名 + 设置 + 画面宽高比 */
export interface WaterfallExportSource {
  notes: ScheduledNote[];
  durationSec: number;
  fileName: string;
  settings: WaterfallPianoSettings;
  /** 画面宽高比（视口宽 / 高） */
  aspectRatio: number;
}

/** 文件名时间戳：waterfall_YYYYMMDD_HHmmss */
function timestampName(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function isCancelled(e: unknown): boolean {
  return e instanceof Error && e.message.includes("已取消");
}

export function useWaterfallVideoExport() {
  /**
   * 注入导出数据源 provider（WaterfallPiano 挂载时调用一次）。
   * provider 返回 null 表示当前无可导出内容（未加载 MIDI）。
   */
  function bindExportSource(
    provider: () => WaterfallExportSource | null,
  ): void {
    exportSourceProvider = provider;
  }

  function unbindExportSource(): void {
    exportSourceProvider = null;
  }

  /**
   * 绑定导出期间的前台让路实现（ADR 0026）。
   *
   * 导出开始前调用 suspend()（停前台渲染循环 + 暂停播放），导出结束
   * ——含成功、取消、报错——后必定 resume()。传 null 解绑。
   * 解绑本身不会留下暂停态（内部会先恢复旧钩子）。
   */
  function bindExportSuspender(suspender: ExportSuspender | null): void {
    suspension.bind(suspender);
  }

  /** 同步可导出内容状态（WaterfallPiano watch contentType 时调用） */
  function setContentAvailable(available: boolean): void {
    hasContent.value = available;
  }

  /** 预检各编码在当前环境的可用性（面板挂载时调用一次） */
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

  /** 开始导出：无内容/不支持环境直接忽略 */
  async function startExport(): Promise<void> {
    const source = exportSourceProvider?.();
    if (isExporting.value || !webCodecsSupported || !source) return;
    if (source.notes.length === 0 || source.durationSec <= 0) return;

    isExporting.value = true;
    progress.value = 0;
    error.value = null;
    done.value = false;
    encodingMode.value = null;
    realtimeFactor.value = null;
    const startedAt = performance.now();

    // 数据快照已取（上方 exportSourceProvider），现在让前台让路：
    // 停掉瀑布流渲染循环并暂停播放，把 CPU/GPU 让给离屏导出引擎 + 编码器（ADR 0026）
    suspension.suspend();

    let session: WaterfallVideoExportSession | null = null;
    try {
      // 动态加载：离线渲染器 + 共享编码管线仅在导出时进入 bundle 分包
      const { createWaterfallVideoSession } =
        await import("../videoExport/waterfallVideoRenderer");
      session = createWaterfallVideoSession({
        settings: source.settings,
        notes: source.notes,
        durationSec: source.durationSec,
        aspectRatio: source.aspectRatio,
        codec: codec.value,
        shortSide: shortSide.value,
        fps: fps.value,
      });
      await session.init();
      handle = session.handle;
      handle.onHardware((hw) => {
        encodingMode.value = hw ? "gpu" : "cpu";
      });
      handle.onProgress((r) => {
        progress.value = r;
        const elapsedSec = (performance.now() - startedAt) / 1000;
        if (elapsedSec > 0.5) {
          // 已渲染时长 / 实际耗时 = 实时倍率
          realtimeFactor.value = (r * source.durationSec) / elapsedSec;
        }
      });
      const blob = await handle.start();
      const baseName = source.fileName.replace(/\.(midi?|MIDI?)$/, "");
      await useFilePicker().saveFile(
        `${baseName || "waterfall"}_${timestampName()}.mp4`,
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
      // 会话资源（离屏引擎/PixiJS 应用/流体 canvas）统一释放
      await session?.dispose().catch(() => {});
      session = null;
      // 让路恢复：先释放离屏资源再恢复前台渲染，避免两套引擎短暂并存
      suspension.resume();
      isExporting.value = false;
    }
  }

  return {
    isExporting: isExporting as Ref<boolean>,
    progress: progress as Ref<number>,
    error: error as Ref<string | null>,
    done: done as Ref<boolean>,
    codec: codec as Ref<VideoCodecValue>,
    shortSide: shortSide as Ref<number>,
    fps: fps as Ref<number>,
    codecSupport,
    codecProbeDone,
    encodingMode: encodingMode as Ref<"gpu" | "cpu" | null>,
    realtimeFactor: realtimeFactor as Ref<number | null>,
    webCodecsSupported,
    hasContent,
    hasExportSource: (): boolean => exportSourceProvider?.() !== null,
    bindExportSource,
    unbindExportSource,
    bindExportSuspender,
    setContentAvailable,
    probeCodecs,
    startExport,
    cancel,
  };
}
