<script setup lang="ts">
/**
 * 视觉化音高指示器 — SVG 半圆刻度盘（±50 cents 映射 ±75°）
 *
 * 指针由 animejs Animatable（spring）驱动平滑转动；
 * 中央命中圆点在 |cents| ≤ 5 时脉冲一次（success 色）。
 * 颜色全部使用 daisyUI 语义类（text-success / text-warning / text-base-content）。
 */
import { computed, ref, watch, onMounted, onUnmounted } from "vue";
import {
  animate,
  createAnimatable,
  createSpring,
  type AnimatableObject,
} from "animejs";
import { isInTune } from "../utils/pitchMath";

const props = defineProps<{
  /** 当前音分偏差（-50 ~ +50 之外的值会被钳制到盘面边缘），null 表示无信号 */
  cents: number | null;
  /** 是否处于监听中 */
  active: boolean;
}>();

/** 刻度盘几何：圆心 (100, 100)，半径 80，±50 cents → ±75° */
const RADIUS = 80;
const CX = 100;
const CY = 100;
const MAX_DEG = 75;

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const needleGroup = ref<SVGGElement>();
const inTuneDot = ref<SVGCircleElement>();
let needleAnim: AnimatableObject | null = null;
let pulseAnim: ReturnType<typeof animate> | null = null;
let wasExact = false;

/** 音分 → 指针角度（度） */
function centsToAngle(cents: number): number {
  const clamped = Math.max(-50, Math.min(50, cents));
  return (clamped / 50) * MAX_DEG;
}

/** 极坐标 → 笛卡尔坐标（SVG y 轴向下，角度 0 = 正上方） */
function polar(deg: number, radius: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

/** 刻度线：每 10 cents 一格，±50/0 为主刻度 */
const ticks = computed(() => {
  const list: {
    from: { x: number; y: number };
    to: { x: number; y: number };
    major: boolean;
    label: string | null;
    labelPos: { x: number; y: number };
  }[] = [];
  for (let c = -50; c <= 50; c += 10) {
    const deg = (c / 50) * MAX_DEG;
    const major = c === 0 || Math.abs(c) === 50;
    list.push({
      from: polar(deg, RADIUS),
      to: polar(deg, major ? RADIUS - 10 : RADIUS - 6),
      major,
      label: major ? String(c) : null,
      labelPos: polar(deg, RADIUS + 8),
    });
  }
  return list;
});

/** 中央命中区弧线（±5 cents，success 色） */
const exactArc = computed(() => {
  const start = polar((-5 / 50) * MAX_DEG, RADIUS);
  const end = polar((5 / 50) * MAX_DEG, RADIUS);
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 0 1 ${end.x} ${end.y}`;
});

/** 接近区弧线（±10 cents，warning 色，更细更淡） */
const nearArc = computed(() => {
  const start = polar((-10 / 50) * MAX_DEG, RADIUS - 2);
  const end = polar((10 / 50) * MAX_DEG, RADIUS - 2);
  return `M ${start.x} ${start.y} A ${RADIUS - 2} ${RADIUS - 2} 0 0 1 ${end.x} ${end.y}`;
});

const needleAngle = computed(() =>
  props.cents === null ? 0 : centsToAngle(props.cents),
);

const isExact = computed(
  () => props.active && props.cents !== null && isInTune(props.cents).exact,
);

watch(needleAngle, (angle) => {
  needleAnim?.rotate(angle);
});

watch(isExact, (exact) => {
  if (!exact || wasExact || prefersReducedMotion || !inTuneDot.value) {
    wasExact = exact;
    return;
  }
  wasExact = exact;
  pulseAnim?.cancel();
  pulseAnim = animate(inTuneDot.value, {
    scale: [1, 1.4, 1],
    duration: 350,
    ease: "outQuad",
  });
});

function initAnimatable(): void {
  if (needleAnim || !needleGroup.value) return;
  needleAnim = createAnimatable(needleGroup.value, {
    rotate: {
      unit: "deg",
      duration: prefersReducedMotion ? 100 : 300,
      ease: createSpring({ stiffness: 260, damping: 18 }),
    },
  });
}

onMounted(() => {
  initAnimatable();
});

onUnmounted(() => {
  pulseAnim?.revert();
  pulseAnim = null;
  needleAnim?.revert();
  needleAnim = null;
});
</script>

<template>
  <div
    class="w-full flex justify-center"
    role="img"
    :aria-label="$t('tuner.indicator.ariaLabel')"
  >
    <svg
      viewBox="0 0 200 118"
      class="w-full max-w-md"
      :class="active ? 'opacity-100' : 'opacity-60'"
    >
      <!-- 刻度线 -->
      <g class="text-base-content/40">
        <template v-for="(tick, i) in ticks" :key="i">
          <line
            :x1="tick.from.x"
            :y1="tick.from.y"
            :x2="tick.to.x"
            :y2="tick.to.y"
            :stroke-width="tick.major ? 2 : 1"
            :class="
              tick.major ? 'stroke-base-content/60' : 'stroke-base-content/30'
            "
            stroke-linecap="round"
          />
          <text
            v-if="tick.label !== null"
            :x="tick.labelPos.x"
            :y="tick.labelPos.y"
            text-anchor="middle"
            class="fill-base-content/50 text-[7px]"
          >
            {{ tick.label }}
          </text>
        </template>
      </g>

      <!-- 命中区 / 接近区弧线 -->
      <path
        :d="exactArc"
        class="stroke-success"
        stroke-width="4"
        fill="none"
        stroke-linecap="round"
      />
      <path
        :d="nearArc"
        class="stroke-warning/50"
        stroke-width="2"
        fill="none"
        stroke-linecap="round"
      />

      <!-- 中央命中圆点（音准时脉冲） -->
      <!-- transform-box: fill-box 使 scale 以圆自身中心为原点 -->
      <circle
        ref="inTuneDot"
        :cx="CX"
        :cy="CY - RADIUS"
        r="4"
        style="transform-box: fill-box; transform-origin: center"
        :class="isExact ? 'fill-success' : 'fill-base-content/20'"
      />

      <!-- 指针：transform-origin 固定为表盘轴心 (CX, CY)，
           避免 CSS transform 默认绕 viewBox 中心旋转 -->
      <g
        ref="needleGroup"
        style="transform-box: view-box; transform-origin: 100px 100px"
      >
        <line
          :x1="CX"
          :y1="CY"
          :x2="CX"
          :y2="CY - RADIUS + 12"
          class="stroke-base-content"
          stroke-width="2.5"
          stroke-linecap="round"
        />
      </g>
      <circle :cx="CX" :cy="CY" r="5" class="fill-base-content" />
    </svg>
  </div>
</template>
