/**
 * 音高检测 composable — 麦克风采集 + McLeod Pitch Method
 *
 * 管线：getUserMedia → 复用 Tone.js AudioContext → AnalyserNode(4096) →
 * 40ms 循环取时域数据 → @audio/pitch-mcleod → clarity 双门限迟滞 →
 * 最近 5 帧频率中值滤波 → 音名切换迟滞（连续 3 帧一致才切换）。
 *
 * 稳定性设计（修复"读数瞬间消失/回中再弹出"）：
 * - clarity 双门限：进入检测需 ≥ CLARITY_ENTER，保持检测只需 ≥ CLARITY_KEEP，
 *   避免置信度在单一阈值附近徘徊时读数反复出现/消失；
 * - 丢失宽限：单帧未检出不清空读数，连续 MAX_MISSED_FRAMES 帧丢失才判定
 *   信号结束，消除指针回中→弹出的跳变；
 * - 中值窗口 5 帧，抑制野值。
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
/** clarity 进入门限：从"未检出"进入"已检出"所需置信度 */
const CLARITY_ENTER = 0.85;
/** clarity 保持门限：已检出后低于此值才算信号丢失（低于进入门限，防边界抖动） */
const CLARITY_KEEP = 0.72;
/** 连续未检出多少帧后才判定信号结束（40ms/帧 → 4 帧 ≈160ms 宽限） */
const MAX_MISSED_FRAMES = 4;
/** 中值滤波窗口大小 */
const MEDIAN_WINDOW = 5;
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
  /** 最近一次有效读数（音级已含迟滞），信号结束后为 null */
  const reading = shallowRef<PitchReading | null>(null);
  /** AnalyserNode 实例，供音频仪表组件读取频谱/电平；未启动时为 null */
  const analyserNode = shallowRef<AnalyserNode | null>(null);

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
  // 是否处于"已检出"状态（clarity 双门限迟滞）
  let detected = false;
  // 连续未检出帧计数（丢失宽限）
  let missedFrames = 0;

  function isListening(): boolean {
    return timer !== null;
  }

  function resetTracking(): void {
    freqHistory = [];
    stableMidi = null;
    candidateMidi = null;
    candidateCount = 0;
    detected = false;
    missedFrames = 0;
    reading.value = null;
  }

  function handleFrame(): void {
    if (!analyser || !frameBuffer) return;
    analyser.getFloatTimeDomainData(frameBuffer);

    const fs = analyser.context.sampleRate;
    const result: PitchResult | null = mcleod(frameBuffer, { fs });

    // clarity 双门限迟滞：未检出状态需达到 ENTER 才算信号到来；
    // 已检出状态跌破 KEEP 才开始计丢失。
    if (!result || result.clarity < (detected ? CLARITY_KEEP : CLARITY_ENTER)) {
      missedFrames += 1;
      if (detected && missedFrames < MAX_MISSED_FRAMES) {
        // 宽限期：保持上一次读数，避免指针回中再弹出的跳变
        return;
      }
      // 信号真正结束
      detected = false;
      missedFrames = 0;
      freqHistory = [];
      reading.value = null;
      return;
    }

    // 信号恢复：清零丢失计数；freqHistory 保留（跨宽限期快速重锁）
    missedFrames = 0;
    detected = true;

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
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      frameBuffer = new Float32Array(analyser.fftSize);
      analyserNode.value = analyser;

      resetTracking();

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
    analyserNode.value = null;
    frameBuffer = null;
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = null;
  }

  function stop(): void {
    if (!isListening() && status.value === "idle") return;
    cleanupNodes();
    resetTracking();
    status.value = "idle";
    logger.info("音高检测已停止");
  }

  onUnmounted(stop);

  return { status, errorKey, reading, analyserNode, start, stop };
}
