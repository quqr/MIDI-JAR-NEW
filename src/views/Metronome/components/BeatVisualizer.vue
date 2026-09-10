<script setup lang="ts">
/**
 * 拍点阵可视化（canvas，rAF 驱动）
 *
 * - 中央一排拍点：强拍更大且用主色，当前拍脉冲放大 + 光晕。
 * - 细分为小点，排在拍点之间（与拍点同一直线，节拍器感更强）。
 * - 底部为小节进度轨，已走过的小节部分以主色填充。
 * - 状态来自 `getState()`（由音频时钟现算），组件不持有任何计数，永不漂移。
 * - 颜色读取 daisyUI CSS 变量，随主题自动切换。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { AccentLevel, MetronomeVisualState } from "../types";

const props = defineProps<{
  getState: () => MetronomeVisualState | null;
  numerator: number;
  denominator: 2 | 4 | 8 | 16;
  slotsPerBeat: number;
  accents: AccentLevel[];
  running: boolean;
  /** 预备拍倒计时文本（无预备拍时为空串） */
  countInText: string;
}>();

/** 脉冲衰减时长（秒） */
const PULSE_SEC = 0.22;
/** 主题颜色缓存刷新间隔（帧） */
const COLOR_REFRESH_FRAMES = 60;
/** 帧间隔超过该值（后台标签页回到前台）时跳过脉冲，避免虚高 */
const MAX_FRAME_DT_SEC = 0.25;

const wrapperRef = ref<HTMLDivElement>();
const canvasRef = ref<HTMLCanvasElement>();

const signatureText = computed(() => `${props.numerator}/${props.denominator}`);

let ctx: CanvasRenderingContext2D | null = null;
let rafId: number | null = null;
let resizeObserver: ResizeObserver | null = null;
let frameCount = 0;
let cssWidth = 0;
let cssHeight = 0;
let lastFrameAt = 0;
let prefersReducedMotion = false;
let suppressPulse = false;

interface ThemeColors {
  primary: string;
  content: string;
  dim: string;
  base: string;
}

let colors: ThemeColors | null = null;

function readColors(): ThemeColors {
  const style = getComputedStyle(document.documentElement);
  const v = (name: string): string =>
    style.getPropertyValue(name).trim() || "currentColor";
  return {
    primary: v("--color-primary"),
    content: v("--color-base-content"),
    dim: v("--color-base-300"),
    base: v("--color-base-100"),
  };
}

function resizeCanvas(): void {
  const canvas = canvasRef.value;
  const wrapper = wrapperRef.value;
  if (!canvas || !wrapper) return;
  const dpr = window.devicePixelRatio || 1;
  cssWidth = wrapper.clientWidth;
  cssHeight = wrapper.clientHeight;
  canvas.width = Math.max(1, Math.round(cssWidth * dpr));
  canvas.height = Math.max(1, Math.round(cssHeight * dpr));
  ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

/** 当前 slot 起点的脉冲系数：1 + 峰值 × 衰减 */
function pulseFactor(state: MetronomeVisualState | null): number {
  if (!state || prefersReducedMotion || suppressPulse) return 1;
  const elapsed = state.now - state.slotStart;
  return 1 + 0.45 * Math.max(0, 1 - elapsed / PULSE_SEC);
}

function draw(): void {
  const c = ctx;
  if (!c) return;
  c.clearRect(0, 0, cssWidth, cssHeight);
  if (!colors || frameCount % COLOR_REFRESH_FRAMES === 0) colors = readColors();
  frameCount += 1;

  const state = props.running ? props.getState() : null;
  const numerator = Math.max(1, props.numerator);
  const spb = Math.max(1, props.slotsPerBeat);

  const padX = Math.min(36, cssWidth * 0.05);
  const usable = Math.max(1, cssWidth - padX * 2);
  const rowY = cssHeight * 0.48;
  const trackH = 4;

  // 拍点位置：小节均分为 numerator 段，拍点落在每段中心
  const segment = usable / numerator;
  const beatX = (i: number): number =>
    numerator === 1 ? cssWidth / 2 : padX + segment * (i + 0.5);

  const baseRadius = Math.max(
    5,
    Math.min(15, segment * 0.26, cssHeight * 0.16),
  );

  const pulse = pulseFactor(state);
  const dim = state?.silent ? 0.5 : 1;

  // ── 小节底轨（视觉基座） ──
  c.fillStyle = colors.dim;
  c.globalAlpha = 0.4;
  c.beginPath();
  c.roundRect(padX, rowY - trackH / 2, usable, trackH, trackH / 2);
  c.fill();
  c.globalAlpha = 1;

  // 已走过的小节部分
  if (state) {
    const played = Math.min(1, Math.max(0, state.barProgress)) * usable;
    if (played > 0.5) {
      c.fillStyle = colors.primary;
      c.globalAlpha = 0.5 * dim;
      c.beginPath();
      c.roundRect(padX, rowY - trackH / 2, played, trackH, trackH / 2);
      c.fill();
      c.globalAlpha = 1;
    }
  }

  // ── 细分点：均布在拍点之间 ──
  if (spb > 1) {
    const slotStep = segment / spb;
    const subRadius = Math.max(2, baseRadius * 0.34);
    const currentSlot = state ? state.beatIndex * spb + state.subIndex : -1;
    for (let beat = 0; beat < numerator; beat++) {
      for (let s = 1; s < spb; s++) {
        const index = beat * spb + s;
        const x = padX + segment * beat + slotStep * s;
        const isCurrent = index === currentSlot;
        c.beginPath();
        c.arc(
          x,
          rowY,
          isCurrent ? subRadius * pulse : subRadius,
          0,
          Math.PI * 2,
        );
        c.fillStyle = isCurrent ? colors.primary : colors.content;
        c.globalAlpha = (isCurrent ? 0.85 : 0.22) * dim;
        c.fill();
        c.globalAlpha = 1;
      }
    }
  }

  // ── 拍点 ──
  for (let i = 0; i < numerator; i++) {
    const accent = props.accents[i] ?? "medium";
    const isCurrent = !!state && state.beatIndex === i;
    const accentScale = accent === "strong" ? 1.3 : accent === "weak" ? 0.8 : 1;
    const radius =
      baseRadius * accentScale * (isCurrent ? Math.max(1, pulse) : 1);
    const x = beatX(i);

    // 当前拍光晕
    if (isCurrent && !prefersReducedMotion && pulse > 1.02) {
      const glow = c.createRadialGradient(x, rowY, 0, x, rowY, radius * 2.6);
      glow.addColorStop(0, colors.primary);
      glow.addColorStop(1, "transparent");
      c.fillStyle = glow;
      c.globalAlpha = (0.35 * (pulse - 1)) / 0.45;
      c.beginPath();
      c.arc(x, rowY, radius * 2.6, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    }

    if (accent === "silent") {
      c.beginPath();
      c.arc(x, rowY, radius * 0.9, 0, Math.PI * 2);
      c.strokeStyle = colors.content;
      c.globalAlpha = (isCurrent ? 0.8 : 0.3) * dim;
      c.lineWidth = 1.5;
      c.stroke();
      c.globalAlpha = 1;
      continue;
    }

    const isPrimary = accent === "strong" || accent === "medium";
    c.beginPath();
    c.arc(x, rowY, radius * 0.9, 0, Math.PI * 2);
    c.fillStyle = isPrimary ? colors.primary : colors.content;
    c.globalAlpha =
      (accent === "strong"
        ? isCurrent
          ? 1
          : 0.85
        : accent === "medium"
          ? isCurrent
            ? 0.9
            : 0.5
          : isCurrent
            ? 0.7
            : 0.3) * dim;
    c.fill();
    c.globalAlpha = 1;

    // 减动效模式：用固定圆环标识当前拍
    if (isCurrent && prefersReducedMotion) {
      c.beginPath();
      c.arc(x, rowY, radius + 5, 0, Math.PI * 2);
      c.strokeStyle = colors.primary;
      c.globalAlpha = 0.85 * dim;
      c.lineWidth = 2;
      c.stroke();
      c.globalAlpha = 1;
    }
  }

  // ── 预备拍：压暗画面，强调倒计时 ──
  if (state?.silent) {
    c.fillStyle = colors.base;
    c.globalAlpha = 0.5;
    c.fillRect(0, 0, cssWidth, cssHeight);
    c.globalAlpha = 1;
  }
}

function loop(timestamp: number): void {
  const dt = lastFrameAt ? (timestamp - lastFrameAt) / 1000 : 0;
  lastFrameAt = timestamp;
  suppressPulse = dt > MAX_FRAME_DT_SEC;
  draw();
  rafId = requestAnimationFrame(loop);
}

function startLoop(): void {
  if (rafId !== null) return;
  lastFrameAt = 0;
  rafId = requestAnimationFrame(loop);
}

function stopLoop(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

onMounted(() => {
  prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  resizeCanvas();
  if (typeof ResizeObserver !== "undefined" && wrapperRef.value) {
    resizeObserver = new ResizeObserver(() => resizeCanvas());
    resizeObserver.observe(wrapperRef.value);
  }
  if (props.running) startLoop();
});

watch(
  () => props.running,
  (running) => {
    if (running) startLoop();
    else {
      stopLoop();
      draw();
    }
  },
);

onBeforeUnmount(() => {
  stopLoop();
  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- 顶部读数条：拍号 + 预备拍倒计时 -->
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-baseline gap-2">
        <span class="text-xl font-semibold tabular-nums leading-none">
          {{ signatureText }}
        </span>
        <span class="text-[11px] tracking-wider text-base-content/40">
          {{ $t("metronome.visual.signatureLabel") }}
        </span>
      </div>
      <Transition
        enter-active-class="transition duration-200"
        enter-from-class="opacity-0 translate-y-1"
        leave-active-class="transition duration-150"
        leave-to-class="opacity-0"
      >
        <span
          v-if="countInText"
          class="badge badge-warning badge-sm font-medium tabular-nums"
        >
          {{ countInText }}
        </span>
      </Transition>
    </div>

    <div ref="wrapperRef" class="h-32 sm:h-40 w-full">
      <canvas
        ref="canvasRef"
        class="h-full w-full"
        role="img"
        :aria-label="$t('metronome.visual.ariaLabel')"
      />
    </div>
  </div>
</template>
