<script setup lang="ts">
/**
 * 每拍重音编辑：点击循环 强 → 中 → 弱 → 静音 → 强。
 *
 * 用「音量柱 + 拍号」的胶囊按钮而非纯色圆点：柱高直观表达该拍的相对力度，
 * 一眼就能读出整条拍型的起伏。数据由 canvas 绘制，避免堆叠 DOM。
 */
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ACCENT_CYCLE, type AccentLevel } from "../types";

const props = defineProps<{
  accents: AccentLevel[];
  /** 当前拍序号（未播放时为 -1） */
  currentBeat: number;
}>();

const emit = defineEmits<{
  "update:accents": [value: AccentLevel[]];
}>();

const { t } = useI18n();

/** 每档重音对应的相对力度（决定柱高） */
const ACCENT_LEVEL: Record<AccentLevel, number> = {
  strong: 1,
  medium: 0.68,
  weak: 0.4,
  silent: 0,
};

const canvasRef = ref<HTMLCanvasElement>();
let ctx: CanvasRenderingContext2D | null = null;
let resizeObserver: ResizeObserver | null = null;
let dpr = 1;
let cssWidth = 0;
let cssHeight = 0;
let frameCount = 0;
/** 当前拍的闪烁相位（0..1），由 rAF 推进 */
let phase = 0;
let rafId: number | null = null;
interface ThemeColors {
  primary: string;
  content: string;
  dim: string;
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
  };
}

function barX(index: number): number {
  const count = Math.max(1, props.accents.length);
  const usable = Math.max(1, cssWidth);
  const segment = usable / count;
  return segment * (index + 0.5);
}

function resizeCanvas(): void {
  const canvas = canvasRef.value;
  if (!canvas) return;
  dpr = window.devicePixelRatio || 1;
  cssWidth = canvas.clientWidth;
  cssHeight = canvas.clientHeight;
  canvas.width = Math.max(1, Math.round(cssWidth * dpr));
  canvas.height = Math.max(1, Math.round(cssHeight * dpr));
  ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function draw(): void {
  const c = ctx;
  if (!c) return;
  c.clearRect(0, 0, cssWidth, cssHeight);
  frameCount += 1;
  if (!colors || frameCount % 60 === 0) colors = readColors();

  const count = props.accents.length;
  if (count === 0) return;

  const segment = cssWidth / count;
  const barWidth = Math.min(22, segment * 0.5);
  const topY = 4;
  const bottomY = cssHeight - 4;
  const maxHeight = bottomY - topY;

  for (let i = 0; i < count; i++) {
    const accent = props.accents[i] ?? "medium";
    const level = ACCENT_LEVEL[accent];
    const isCurrent = props.currentBeat === i;
    const x = barX(i);

    // 药丸形状的底槽
    const radius = Math.min(barWidth / 2, 8);
    c.fillStyle = colors.dim;
    c.globalAlpha = 0.45;
    c.beginPath();
    c.roundRect(x - barWidth / 2, topY, barWidth, maxHeight, radius);
    c.fill();
    c.globalAlpha = 1;

    // 力度柱
    const h = Math.max(level * maxHeight, level > 0 ? barWidth : 0);
    if (level > 0) {
      const boost = isCurrent ? 1 + 0.18 * phase : 1;
      const barH = Math.min(maxHeight, h * boost);
      c.fillStyle = accent === "weak" ? colors.content : colors.primary;
      c.globalAlpha = isCurrent
        ? 1
        : accent === "weak"
          ? 0.45
          : accent === "medium"
            ? 0.75
            : 0.95;
      c.beginPath();
      c.roundRect(x - barWidth / 2, bottomY - barH, barWidth, barH, radius);
      c.fill();
      c.globalAlpha = 1;
    } else {
      // 静音：空心提示
      c.strokeStyle = colors.content;
      c.globalAlpha = isCurrent ? 0.8 : 0.3;
      c.lineWidth = 1.5;
      c.beginPath();
      c.roundRect(
        x - barWidth / 2,
        bottomY - barWidth,
        barWidth,
        barWidth,
        radius,
      );
      c.stroke();
      c.globalAlpha = 1;
    }
  }
}

function loop(_timestamp: number): void {
  // 三角形脉冲：当前拍亮起后缓慢回落
  const t = (performance.now() % 600) / 600;
  phase = t < 0.15 ? t / 0.15 : Math.max(0, 1 - (t - 0.15) / 0.85);
  draw();
  rafId = requestAnimationFrame(loop);
}

function startLoop(): void {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(loop);
}

function stopLoop(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  phase = 0;
  draw();
}

/** 当前拍变化时确保闪烁循环处于运行状态 */
watch(
  () => props.currentBeat,
  (beat) => {
    if (beat >= 0) startLoop();
    else stopLoop();
  },
);

function accentOf(index: number): AccentLevel {
  return props.accents[index] ?? "medium";
}

function cycle(index: number): void {
  const next = [...props.accents];
  const position = ACCENT_CYCLE.indexOf(accentOf(index));
  next[index] = ACCENT_CYCLE[(position + 1) % ACCENT_CYCLE.length] ?? "medium";
  emit("update:accents", next);
}

function ariaLabel(index: number): string {
  return t("metronome.accent.beatAria", {
    index: index + 1,
    accent: t(`metronome.accent.${accentOf(index)}`),
  });
}

onMounted(() => {
  resizeCanvas();
  if (typeof ResizeObserver !== "undefined" && canvasRef.value) {
    resizeObserver = new ResizeObserver(() => resizeCanvas());
    resizeObserver.observe(canvasRef.value);
  }
  if (props.currentBeat >= 0) startLoop();
});

onBeforeUnmount(() => {
  stopLoop();
  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="relative">
      <!-- 力度柱画布（纯展示） -->
      <canvas ref="canvasRef" class="h-20 w-full" aria-hidden="true" />
      <!-- 透明命中层：每拍一个按钮，覆盖在对应柱体上 -->
      <div class="absolute inset-0 flex">
        <button
          v-for="(_accent, index) in accents"
          :key="index"
          type="button"
          class="min-w-0 flex-1 rounded-lg transition hover:bg-base-content/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          :aria-label="ariaLabel(index)"
          @click="cycle(index)"
        />
      </div>
    </div>

    <div class="flex items-center justify-between gap-3">
      <p class="text-xs text-base-content/45">
        {{ $t("metronome.accent.hint") }}
      </p>
      <!-- 图例 -->
      <div
        class="hidden sm:flex items-center gap-3 text-[11px] text-base-content/40"
      >
        <span>{{ $t("metronome.accent.strong") }}</span>
        <span>{{ $t("metronome.accent.medium") }}</span>
        <span>{{ $t("metronome.accent.weak") }}</span>
        <span>{{ $t("metronome.accent.silent") }}</span>
      </div>
    </div>
  </div>
</template>
