<script setup lang="ts">
/**
 * 音频仪表 — 频谱 EQ 条形图 + 音量电平条（canvas 渲染，rAF 驱动）
 *
 * - 频谱：28 条对数频率分布（40Hz–8kHz），带峰值保持与下落动画
 * - 电平：RMS 分贝映射（-60..0dB），峰值标记 + 削波（clip）红色保持
 * - 颜色全部读取 daisyUI CSS 变量（--color-*），随主题自动切换
 */
import { ref, watch, onMounted, onUnmounted } from "vue";

/** 削波红色保持帧数（响应式：驱动 clip badge 显示） */
const clipHold = ref(0);

const props = defineProps<{
  /** 音频分析节点，未启动监听时为 null */
  analyser: AnalyserNode | null;
  /** 是否处于监听中 */
  active: boolean;
}>();

const canvasRef = ref<HTMLCanvasElement>();
const wrapperRef = ref<HTMLDivElement>();

// ── 仪表常量 ──
/** EQ 条数 */
const BAR_COUNT = 28;
/** 频谱显示频率范围（对数分布） */
const FREQ_MIN = 40;
const FREQ_MAX = 8000;
/** 电平条 dB 映射下限（-60dB → 0） */
const LEVEL_DB_FLOOR = 60;
/** 峰值保持下落速度（每秒满量程比例） */
const PEAK_FALL_PER_SEC = 0.35;
/** 削波红色保持帧数 */
const CLIP_HOLD_FRAMES = 45;
/** 主题颜色缓存刷新间隔（帧） */
const COLOR_REFRESH_FRAMES = 90;

interface ThemeColors {
  bar: string;
  barPeak: string;
  level: string;
  clip: string;
  grid: string;
  dim: string;
}

let ctx: CanvasRenderingContext2D | null = null;
let rafId: number | null = null;
let freqData: Uint8Array<ArrayBuffer> | null = null;
let timeData: Float32Array<ArrayBuffer> | null = null;
let barValues = new Float32Array(BAR_COUNT);
let barPeaks = new Float32Array(BAR_COUNT);
let barBinRanges: { start: number; end: number }[] = [];
let frameCount = 0;
let colors: ThemeColors | null = null;

function readColors(): ThemeColors {
  const style = getComputedStyle(document.documentElement);
  const v = (name: string): string =>
    style.getPropertyValue(name).trim() || "currentColor";
  return {
    bar: v("--color-primary"),
    barPeak: v("--color-primary-content"),
    level: v("--color-success"),
    clip: v("--color-error"),
    grid: v("--color-base-content"),
    dim: v("--color-base-300"),
  };
}

/** 对数频率 → FFT bin 序号范围 */
function buildBinRanges(analyser: AnalyserNode): void {
  const nyquist = analyser.context.sampleRate / 2;
  const binCount = analyser.frequencyBinCount;
  barBinRanges = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const f0 = FREQ_MIN * Math.pow(FREQ_MAX / FREQ_MIN, i / BAR_COUNT);
    const f1 = FREQ_MIN * Math.pow(FREQ_MAX / FREQ_MIN, (i + 1) / BAR_COUNT);
    const start = Math.max(0, Math.floor((f0 / nyquist) * binCount));
    const end = Math.min(binCount - 1, Math.ceil((f1 / nyquist) * binCount));
    barBinRanges.push({ start: Math.max(start, 1), end });
  }
}

function resizeCanvas(): void {
  const canvas = canvasRef.value;
  const wrapper = wrapperRef.value;
  if (!canvas || !wrapper) return;
  const dpr = window.devicePixelRatio || 1;
  const { clientWidth, clientHeight } = wrapper;
  canvas.width = Math.max(1, Math.round(clientWidth * dpr));
  canvas.height = Math.max(1, Math.round(clientHeight * dpr));
  ctx = canvas.getContext("2d");
}

function drawStatic(): void {
  const canvas = canvasRef.value;
  if (!canvas || !ctx) return;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  if (!colors) colors = readColors();
  // 静态基线
  ctx.fillStyle = colors.grid;
  ctx.globalAlpha = 0.15;
  ctx.fillRect(0, height - 2 * (window.devicePixelRatio || 1), width, 2);
  ctx.globalAlpha = 1;
}

function renderFrame(): void {
  const canvas = canvasRef.value;
  const analyser = props.analyser;
  if (!canvas || !ctx || !analyser) return;
  const { width, height } = canvas;
  const levelBarHeight = 8 * (window.devicePixelRatio || 1);
  const gap = 6 * (window.devicePixelRatio || 1);
  const spectrumHeight = height - levelBarHeight - gap;

  ctx.clearRect(0, 0, width, height);

  // 定期刷新主题颜色缓存
  frameCount += 1;
  if (!colors || frameCount % COLOR_REFRESH_FRAMES === 0) {
    colors = readColors();
  }

  // ── 频谱 ──
  if (!freqData || freqData.length !== analyser.frequencyBinCount) {
    freqData = new Uint8Array(analyser.frequencyBinCount);
    buildBinRanges(analyser);
  }
  analyser.getByteFrequencyData(freqData);

  const barWidth = width / BAR_COUNT;
  const peakFall = PEAK_FALL_PER_SEC / 60;

  for (let i = 0; i < BAR_COUNT; i++) {
    const range = barBinRanges[i];
    let sum = 0;
    for (let b = range.start; b <= range.end; b++) sum += freqData[b];
    const avg = sum / Math.max(1, range.end - range.start + 1);
    const v = Math.min(1, Math.pow(avg / 255, 0.8) * 1.25);

    // 条形平滑：快速上升、缓慢下降
    barValues[i] = v > barValues[i] ? v : barValues[i] * 0.82 + v * 0.18;
    barPeaks[i] = Math.max(barValues[i], barPeaks[i] - peakFall);

    const h = barValues[i] * (spectrumHeight - 4);
    const x = i * barWidth + barWidth * 0.12;
    const w = barWidth * 0.76;

    ctx.fillStyle = colors.bar;
    ctx.globalAlpha = 0.85;
    if (h > 1) ctx.fillRect(x, spectrumHeight - h, w, h);
    ctx.globalAlpha = 1;

    // 峰值保持帽
    const peakY = spectrumHeight - barPeaks[i] * (spectrumHeight - 4);
    ctx.fillStyle = colors.barPeak;
    if (barPeaks[i] > 0.02) ctx.fillRect(x, peakY - 2, w, 2);
  }

  // ── 电平（RMS → dB） ──
  if (!timeData || timeData.length !== analyser.fftSize) {
    timeData = new Float32Array(analyser.fftSize);
  }
  analyser.getFloatTimeDomainData(timeData);
  let sumSq = 0;
  let peakAbs = 0;
  for (let i = 0; i < timeData.length; i++) {
    const s = timeData[i];
    sumSq += s * s;
    const abs = Math.abs(s);
    if (abs > peakAbs) peakAbs = abs;
  }
  const rms = Math.sqrt(sumSq / timeData.length);
  const db = 20 * Math.log10(Math.max(rms, 1e-8));
  const level = Math.min(
    1,
    Math.max(0, (db + LEVEL_DB_FLOOR) / LEVEL_DB_FLOOR),
  );

  const isClip = peakAbs >= 0.99;
  if (isClip) clipHold.value = CLIP_HOLD_FRAMES;
  else if (clipHold.value > 0) clipHold.value -= 1;

  const levelY = height - levelBarHeight;
  ctx.fillStyle = colors.dim;
  ctx.globalAlpha = 0.4;
  ctx.fillRect(0, levelY, width, levelBarHeight);
  ctx.globalAlpha = 1;

  ctx.fillStyle = clipHold.value > 0 ? colors.clip : colors.level;
  ctx.fillRect(0, levelY, level * width, levelBarHeight);

  // 峰值标记
  if (level > 0.01) {
    ctx.fillStyle = colors.grid;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(level * width - 2, levelY - 1, 2, levelBarHeight + 2);
    ctx.globalAlpha = 1;
  }
}

function loop(): void {
  renderFrame();
  rafId = requestAnimationFrame(loop);
}

function startLoop(): void {
  if (rafId !== null) return;
  resizeCanvas();
  rafId = requestAnimationFrame(loop);
}

function stopLoop(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  barValues.fill(0);
  barPeaks.fill(0);
  drawStatic();
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    resizeCanvas();
    if (rafId === null) drawStatic();
  });
  if (wrapperRef.value) resizeObserver.observe(wrapperRef.value);
  if (props.active && props.analyser) startLoop();
  else drawStatic();
});

watch(
  () => [props.active, props.analyser] as const,
  ([active, analyser]) => {
    if (active && analyser) startLoop();
    else stopLoop();
  },
);

onUnmounted(() => {
  stopLoop();
  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <span class="text-xs font-medium text-base-content/70">
        {{ $t("tuner.meter.title") }}
      </span>
      <span v-if="active && clipHold > 0" class="badge badge-error badge-sm">
        {{ $t("tuner.meter.clip") }}
      </span>
    </div>
    <div ref="wrapperRef" class="h-28 sm:h-32 lg:h-40 w-full">
      <canvas
        ref="canvasRef"
        class="h-full w-full"
        role="img"
        :aria-label="$t('tuner.meter.ariaLabel')"
      />
    </div>
    <div
      class="text-[10px] text-base-content/40 font-mono flex justify-between"
    >
      <span>{{ $t("tuner.meter.lowFreq") }}</span>
      <span>{{ $t("tuner.meter.level") }}</span>
      <span>{{ $t("tuner.meter.highFreq") }}</span>
    </div>
  </div>
</template>
