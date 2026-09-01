/**
 * 音高检测 composable — 麦克风采集 + McLeod Pitch Method
 *
 * 管线：getUserMedia → 复用 Tone.js AudioContext → AnalyserNode(4096) →
 * 40ms 循环取时域数据 → @audio/pitch-mcleod → clarity 门限 →
 * 最近 3 帧频率中值滤波 → 音名切换迟滞（连续 3 帧一致才切换）。
 *
 * 延迟预算：窗口 ≈85ms(48kHz) + 循环 40ms ≈ 125ms < 200ms。
 * 低频覆盖：A0=27.5Hz 周期 ≈1745 样本@48kHz < 2048（NSDF 半窗）✓
 */

import { ref, shallowRef, onUnmounted } from "vue";
import * as Tone from "tone";
import mcleod from "@audio/pitch-mcleod";
import { frequencyToMidi } from "../utils/pitchMath";
import type { PitchReading, PitchResult, TunerStatus } from "../types";
import { createLogger } from "@/utils/logger";

const logger = createLogger("usePitchDetector");

/** 检测帧间隔 ms */
const DETECT_INTERVAL_MS = 40;
/** 分析窗口样本数（NSDF 半窗 = 2048，可检测最低 ≈23Hz@48kHz） */
const WINDOW_SIZE = 4096;
/** McLeod clarity 门限，低于视为未检出 */
const CLARITY_THRESHOLD = 0.9;
/** 中值滤波窗口大小 */
const MEDIAN_WINDOW = 3;
/** 音名切换所需连续一致帧数（迟滞） */
const NOTE_HYSTERESIS_FRAMES = 3;

/** 中值滤波（对副本排序，不修改原数组） */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function usePitchDetector() {
  const status = ref<TunerStatus>("idle");
  /** 发生错误时的 i18n key（tuner.errors.*），无错误为空串 */
  const errorKey = ref<string>("");
  /** 最近一次有效读数（音级已含迟滞），无信号时为 null */
  const reading = shallowRef<PitchReading | null>(null);

  let stream: MediaStream | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let analyser: AnalyserNode | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let frameBuffer: Float32Array<ArrayBuffer> | null = null;

  // 中值滤波历史
  let freqHistory: number[] = [];
  // 音名迟滞状态
  let stableMidi: number | null = null;
  let candidateMidi: number | null = null;
  let candidateCount = 0;

  function isListening(): boolean {
    return timer !== null;
  }

  function handleFrame(): void {
    if (!analyser || !frameBuffer) return;
    analyser.getFloatTimeDomainData(frameBuffer);

    const fs = analyser.context.sampleRate;
    const result: PitchResult | null = mcleod(frameBuffer, { fs });
    if (!result || result.clarity < CLARITY_THRESHOLD) {
      // 信号丢失：清空历史，保留 stableMidi 以便快速恢复
      freqHistory = [];
      reading.value = null;
      return;
    }

    // 中值滤波
    freqHistory.push(result.freq);
    if (freqHistory.length > MEDIAN_WINDOW) freqHistory.shift();
    const smoothedFreq = median(freqHistory);

    // 音名迟滞：新音级需连续 NOTE_HYSTERESIS_FRAMES 帧一致才切换
    const midi = Math.round(frequencyToMidi(smoothedFreq, getA4()));

    if (midi === stableMidi) {
      candidateMidi = null;
      candidateCount = 0;
    } else if (midi === candidateMidi) {
      candidateCount += 1;
    } else {
      candidateMidi = midi;
      candidateCount = 1;
    }

    if (candidateCount >= NOTE_HYSTERESIS_FRAMES || stableMidi === null) {
      stableMidi = midi;
      candidateMidi = null;
      candidateCount = 0;
    }

    const displayMidi = stableMidi ?? midi;
    reading.value = {
      freq: smoothedFreq,
      midi: displayMidi,
      clarity: result.clarity,
    };
  }

  // 基准音 getter：由页面注入，音分/音级判定随基准音实时变化
  let getA4: () => number = () => 440;

  async function start(a4Getter?: () => number): Promise<void> {
    if (isListening()) return;
    if (a4Getter) getA4 = a4Getter;

    status.value = "starting";
    errorKey.value = "";

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const ctx = Tone.getContext().rawContext as AudioContext;
      if (ctx.state === "suspended") await ctx.resume();

      source = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = WINDOW_SIZE;
      source.connect(analyser);
      frameBuffer = new Float32Array(analyser.fftSize);

      // 重置平滑/迟滞状态
      freqHistory = [];
      stableMidi = null;
      candidateMidi = null;
      candidateCount = 0;
      reading.value = null;

      timer = setInterval(handleFrame, DETECT_INTERVAL_MS);
      status.value = "listening";
      logger.info("音高检测已启动");
    } catch (err) {
      errorKey.value =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "tuner.errors.permission"
          : "tuner.errors.generic";
      status.value = "error";
      logger.error({ err }, "音高检测启动失败");
      cleanupNodes();
    }
  }

  function cleanupNodes(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    source?.disconnect();
    source = null;
    analyser = null;
    frameBuffer = null;
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = null;
  }

  function stop(): void {
    if (!isListening() && status.value === "idle") return;
    cleanupNodes();
    reading.value = null;
    freqHistory = [];
    stableMidi = null;
    status.value = "idle";
    logger.info("音高检测已停止");
  }

  onUnmounted(stop);

  return { status, errorKey, reading, start, stop };
}
