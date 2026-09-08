<template>
  <div
    class="range-slider range-primary"
    :class="[colorClass, { 'range-slider--ticks': showTicks }]"
  >
    <div class="flex min-w-0 items-center gap-2">
      <div
        ref="trackRef"
        class="relative min-w-0 grow"
        :style="trackStyle"
        @pointerdown="onTrackPointerDown"
      >
        <!-- 刻度点：垫在 input 底下（与 thumb 行程同一公式对齐） -->
        <div v-if="showTicks" class="rs-dots" aria-hidden="true">
          <span
            v-for="i in tickCount"
            :key="i"
            class="rs-dot"
            :style="{ left: tickPos(i - 1) }"
          />
        </div>

        <!-- 双头填充段：两 thumb 之间的范围填充 -->
        <div
          v-if="dual && !noFill"
          class="rs-segment"
          :class="{ 'bg-current': !fillColor }"
          :style="segmentStyle"
          aria-hidden="true"
        />

        <input
          ref="minInputRef"
          type="range"
          class="range rs-input"
          :class="[sizeClass, { 'rs-dual': dual }]"
          :min="min"
          :max="max"
          :step="step"
          :value="loValue"
          :disabled="disabled"
          :style="inputStyle(0)"
          :aria-label="dual ? (ariaLabelMin ?? ariaLabel) : ariaLabel"
          :aria-valuetext="loText"
          @pointerdown="topThumb = 0"
          @input="onInput(0, $event)"
        />
        <!-- 抽稀激活时：悬停/聚焦滑块显示当前选中标签（左缘夹取防裁剪） -->
        <span
          v-if="showTooltip"
          class="rs-tooltip rounded bg-neutral px-2 py-0.5 text-xs text-neutral-content shadow"
          :style="edgePosStyle(loIndex, 16)"
          aria-hidden="true"
          >{{ loText }}</span
        >
        <input
          v-if="dual"
          ref="maxInputRef"
          type="range"
          class="range rs-input"
          :class="[sizeClass, 'rs-dual']"
          :min="min"
          :max="max"
          :step="step"
          :value="hiValue"
          :disabled="disabled"
          :style="inputStyle(1)"
          :aria-label="ariaLabelMax ?? ariaLabel"
          :aria-valuetext="hiText"
          @pointerdown="topThumb = 1"
          @input="onInput(1, $event)"
        />
        <span
          v-if="dual && showTooltip && loIndex !== hiIndex"
          class="rs-tooltip rounded bg-neutral px-2 py-0.5 text-xs text-neutral-content shadow"
          :style="edgePosStyle(hiIndex, 16)"
          aria-hidden="true"
          >{{ hiText }}</span
        >

        <!-- 刻度标签（measure）：宽度感知抽稀，左缘夹取防出容器，title 全文 -->
        <div v-if="showTicks" class="rs-labels">
          <button
            v-for="i in visibleLabelIndices"
            :key="i"
            type="button"
            class="rs-label text-xs text-base-content/70 hover:text-base-content"
            :style="edgePosStyle(i)"
            :title="tickLabels?.[i]"
            :disabled="disabled"
            @click.stop="jumpToTick(i)"
          >
            {{ tickLabels?.[i] }}
          </button>
        </div>
      </div>

      <!-- 抽稀激活时，当前选中值以徽标常显（信息不丢失）。
           隐形占位文本撑起最宽可能文本的宽度，实际值绝对定位覆盖：
           宽度恒定，值变化不会挤压轨道导致滑条抖动 -->
      <span v-if="showBadge" class="relative shrink-0">
        <span
          class="badge badge-sm badge-ghost invisible justify-center whitespace-nowrap"
        >
          {{ widestBadgeText }}
        </span>
        <span
          class="badge badge-sm badge-ghost absolute inset-0 justify-center whitespace-nowrap"
        >
          {{ badgeText }}
        </span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  clampSnap,
  labelWidthEm,
  RANGE_THUMB_SIZE_MULT,
  trackPosCalc,
} from "./rangeSlider";
import type {
  RangeSliderColor,
  RangeSliderSize,
  RangeSliderValue,
} from "./rangeSlider";

/**
 * 通用范围滑条（对齐 daisyUI 5 Range，扩展刻度/双头/自定义填充）。
 *
 * - 单头：number 值；noFill 对应 daisyUI「no fill」变体；tickLabels 提供刻度标注。
 * - 双头：dual + [lo, hi]；互不穿越 + 推挤（重合后继续拖动即推挤对方，
 *   重叠时被推的 thumb 置顶保证能拖开）。
 * - 填充色：color = daisyUI 九色关键字（随主题）；fillColor = 任意 CSS 色（优先）。
 * - 替代 select/radio：调用方用 optionsToRange 把选项映射为索引滑条。
 */
interface Props {
  modelValue: RangeSliderValue;
  min: number;
  max: number;
  step?: number;
  /** 双头范围模式：modelValue 为 [lo, hi] */
  dual?: boolean;
  /** 刻度标签（measure），长度应等于刻度数 (max-min)/step+1 */
  tickLabels?: string[];
  /** 隐藏刻度点与标签（tooltip/badge 文本仍取 tickLabels） */
  hideLabels?: boolean;
  /** 无填充：单头隐藏进度填充；双头隐藏范围填充段 */
  noFill?: boolean;
  /** daisyUI 颜色关键字，映射 range-* 类，自动跟随主题 */
  color?: RangeSliderColor;
  /** 任意 CSS 颜色，优先于 color（覆盖 --range-progress 与填充段） */
  fillColor?: string;
  /** daisyUI 尺寸（缺省 md） */
  size?: RangeSliderSize;
  disabled?: boolean;
  /** 标签抽稀的最大可见数（与宽度感知取更严格者，首尾强制保留） */
  maxTickLabels?: number;
  ariaLabel?: string;
  ariaLabelMin?: string;
  ariaLabelMax?: string;
}

const props = withDefaults(defineProps<Props>(), {
  step: 1,
  dual: false,
  tickLabels: undefined,
  hideLabels: false,
  noFill: false,
  color: undefined,
  fillColor: undefined,
  size: "md",
  disabled: false,
  maxTickLabels: 8,
  ariaLabel: undefined,
  ariaLabelMin: undefined,
  ariaLabelMax: undefined,
});

const emit = defineEmits<{
  "update:modelValue": [value: RangeSliderValue];
}>();

const trackRef = ref<HTMLElement | null>(null);
const minInputRef = ref<HTMLInputElement | null>(null);
const maxInputRef = ref<HTMLInputElement | null>(null);
/** 双头重叠时置顶的 thumb（0=lo, 1=hi）；推挤发生后切到被推的那个，保证能拖开 */
const topThumb = ref<0 | 1>(0);
const trackWidth = ref(0);
let resizeObserver: ResizeObserver | null = null;

function measureTrack() {
  trackWidth.value = trackRef.value?.clientWidth ?? 0;
}

onMounted(() => {
  // 同步首测 + resize 兜底：RO 在后台/节流标签页可能迟迟不派发
  measureTrack();
  window.addEventListener("resize", measureTrack);
  if (trackRef.value && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => measureTrack());
    resizeObserver.observe(trackRef.value);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", measureTrack);
  resizeObserver?.disconnect();
  resizeObserver = null;
});

// ---- 值 ----

const loValue = computed<number>(() => {
  if (props.dual) {
    return Array.isArray(props.modelValue) ? props.modelValue[0] : props.min;
  }
  return typeof props.modelValue === "number" ? props.modelValue : props.min;
});

const hiValue = computed<number>(() => {
  if (props.dual) {
    return Array.isArray(props.modelValue)
      ? props.modelValue[1]
      : loValue.value;
  }
  return loValue.value;
});

// ---- 刻度与标签 ----

const tickCount = computed(() => {
  const safeStep = props.step > 0 ? props.step : 1;
  return Math.max(1, Math.round((props.max - props.min) / safeStep) + 1);
});

const hasLabels = computed(() => (props.tickLabels?.length ?? 0) > 0);
const showTicks = computed(() => hasLabels.value && !props.hideLabels);

function tickPos(i: number): string {
  const p = tickCount.value > 1 ? i / (tickCount.value - 1) : 0;
  return trackPosCalc(p, props.size);
}

/**
 * 标签/tooltip 定位：居中放置但按估算宽度夹取左缘，保证不出轨道容器
 * （首尾标签自然贴边，不再伸出容器被外层裁剪）。
 * 未测量到宽度前退回居中 calc 定位；extraPx 为 tooltip 自身内边距补偿。
 */
function edgePosStyle(i: number, extraPx = 0): Record<string, string> {
  const width = trackWidth.value;
  const box = labelLayout.value?.[Math.round(i)];
  if (extraPx > 0 || !box) {
    // tooltip：按自身文本宽度 + 内边距居中后夹取
    if (!width) return { left: tickPos(i) };
    const p = tickCount.value > 1 ? i / (tickCount.value - 1) : 0;
    const ts = thumbSizePx();
    const x = ts / 2 + p * Math.max(width - ts, 0);
    const w = labelWidthEm(indexLabel(i)) * 12 + extraPx;
    const left = Math.min(Math.max(x - w / 2, 0), Math.max(width - w, 0));
    return { left: `${left}px`, transform: "none" };
  }
  return {
    left: `${box.left}px`,
    maxWidth: `${box.maxWidth}px`,
    transform: "none",
  };
}

/**
 * 可见标签布局：用相邻标签中心的中点把容器切成互不重叠的切片，
 * 每个标签在其切片内居中定位、宽度封顶（省略号截断），
 * 结构上保证既不出容器也互不遮挡。未测量宽度时为 null（退回 CSS 居中）。
 */
const labelLayout = computed<Record<
  number,
  { left: number; maxWidth: number }
> | null>(() => {
  const width = trackWidth.value;
  if (!width || !props.tickLabels) return null;
  const ts = thumbSizePx();
  const idxs = visibleLabelIndices.value;
  const xs = idxs.map((i) => {
    const p = tickCount.value > 1 ? i / (tickCount.value - 1) : 0;
    return ts / 2 + p * Math.max(width - ts, 0);
  });
  const boxes: Record<number, { left: number; maxWidth: number }> = {};
  idxs.forEach((i, k) => {
    const sliceL = k === 0 ? 0 : (xs[k - 1] + xs[k]) / 2;
    const sliceR = k === idxs.length - 1 ? width : (xs[k] + xs[k + 1]) / 2;
    const maxWidth = Math.max(sliceR - sliceL - 4, 16);
    const w = Math.min(
      labelWidthEm(props.tickLabels?.[i] ?? "") * 12,
      maxWidth,
    );
    const left = Math.min(Math.max(xs[k] - w / 2, sliceL), sliceR - w);
    boxes[i] = { left, maxWidth };
  });
  return boxes;
});

/** 宽度感知 + 数量上限双重抽稀：标签平均显示宽度超出轨道时按倍数抽稀 */
const everyN = computed(() => {
  const labels = props.tickLabels;
  if (!labels || labels.length <= 1) return 1;
  const width = trackWidth.value || 320;
  const labelPx = 12; // text-xs
  const total = labels.reduce(
    (sum, label) => sum + labelWidthEm(label) * labelPx + 14,
    0,
  );
  const byWidth = Math.ceil(total / Math.max(width, 1));
  const byCount = Math.ceil(labels.length / Math.max(props.maxTickLabels, 1));
  return Math.max(1, byWidth, byCount);
});

const visibleLabelIndices = computed(() => {
  const result: number[] = [];
  for (let i = 0; i < tickCount.value; i++) {
    if (i % everyN.value === 0 || i === tickCount.value - 1) result.push(i);
  }
  return result;
});

const isThinning = computed(() => everyN.value > 1);

const showTooltip = computed(
  () => hasLabels.value && (props.hideLabels || isThinning.value),
);

function indexLabel(i: number): string {
  return props.tickLabels?.[Math.round(i)] ?? String(i);
}

const loIndex = computed(() =>
  Math.round((loValue.value - props.min) / (props.step || 1)),
);
const hiIndex = computed(() =>
  Math.round((hiValue.value - props.min) / (props.step || 1)),
);

const loText = computed(() =>
  hasLabels.value ? indexLabel(loIndex.value) : undefined,
);
const hiText = computed(() =>
  hasLabels.value ? indexLabel(hiIndex.value) : undefined,
);

const showBadge = computed(
  () => hasLabels.value && (props.hideLabels || isThinning.value),
);
const badgeText = computed(() =>
  props.dual
    ? `${indexLabel(loIndex.value)} – ${indexLabel(hiIndex.value)}`
    : indexLabel(loIndex.value),
);

/** 徽标最宽可能文本（隐形占位用）：单头 = 最长标签；双头 = 最长标签对 */
const widestBadgeText = computed(() => {
  const labels = props.tickLabels ?? [];
  let widest = "";
  for (const l of labels) {
    if (labelWidthEm(l) > labelWidthEm(widest)) widest = l;
  }
  return props.dual ? `${widest} – ${widest}` : widest;
});

// ---- 样式 ----

const sizeClass = computed(() =>
  props.size === "md" ? "" : `range-${props.size}`,
);
const colorClass = computed(() => (props.color ? `range-${props.color}` : ""));

/** 填充相关 CSS 变量：双头禁用原生填充（thumb 阴影无法画范围段）；fillColor 覆盖进度色 */
const fillVars = computed<Record<string, string>>(() => {
  const style: Record<string, string> = {};
  if (props.dual) {
    style["--range-fill"] = "0";
    style["--range-bg"] = "transparent";
  } else if (props.noFill) {
    style["--range-fill"] = "0";
  }
  if (props.fillColor) style["--range-progress"] = props.fillColor;
  return style;
});

const trackStyle = computed(() => fillVars.value);

function inputStyle(idx: 0 | 1): Record<string, string | number> {
  const style: Record<string, string | number> = {
    ...fillVars.value,
    width: "100%",
  };
  if (props.dual) {
    style.zIndex = topThumb.value === idx ? 30 : idx === 0 ? 10 : 20;
  }
  return style;
}

const segmentStyle = computed(() => {
  const span = props.max - props.min || 1;
  const pLo = (loValue.value - props.min) / span;
  const pHi = (hiValue.value - props.min) / span;
  const mult = RANGE_THUMB_SIZE_MULT[props.size];
  const sel = "var(--size-selector, .25rem)";
  return {
    left: trackPosCalc(pLo, props.size),
    width: `calc(${Math.max(0, pHi - pLo)} * (100% - ${sel} * ${mult}))`,
    height: `calc(${sel} * ${mult} * 0.5)`,
    backgroundColor: props.fillColor,
  };
});

// ---- 交互 ----

function currentPair(): [number, number] {
  return Array.isArray(props.modelValue)
    ? props.modelValue
    : [loValue.value, hiValue.value];
}

function onInput(idx: 0 | 1, event: Event) {
  const raw = Number((event.target as HTMLInputElement).value);
  const v = clampSnap(raw, props.min, props.max, props.step);
  if (!props.dual) {
    emit("update:modelValue", v);
    return;
  }
  const [, hi] = currentPair();
  const [lo] = currentPair();
  if (idx === 0) {
    if (v > hi) topThumb.value = 1; // 推挤发生：被推的 thumb 置顶
    emit("update:modelValue", [v, Math.max(v, hi)]);
  } else {
    if (v < lo) topThumb.value = 0;
    emit("update:modelValue", [Math.min(v, lo), v]);
  }
}

function thumbSizePx(): number {
  return minInputRef.value?.offsetHeight || 24;
}

function valueFromPointer(clientX: number): number {
  const rect = trackRef.value?.getBoundingClientRect();
  if (!rect || rect.width <= 0) return props.min;
  const ts = thumbSizePx();
  const p = (clientX - rect.left - ts / 2) / Math.max(rect.width - ts, 1);
  const clamped = Math.min(1, Math.max(0, p));
  return clampSnap(
    props.min + clamped * (props.max - props.min),
    props.min,
    props.max,
    props.step,
  );
}

/** 双头：点击轨道/刻度跳到最近 thumb（推挤语义） */
function jumpWith(idx: 0 | 1, v: number) {
  topThumb.value = idx;
  const el = idx === 0 ? minInputRef.value : maxInputRef.value;
  if (el) {
    el.value = String(v);
    el.focus();
  }
  const [lo, hi] = currentPair();
  if (idx === 0) emit("update:modelValue", [v, Math.max(v, hi)]);
  else emit("update:modelValue", [Math.min(v, lo), v]);
}

function onTrackPointerDown(event: PointerEvent) {
  if (!props.dual || props.disabled) return;
  if (event.target instanceof HTMLInputElement) return;
  const v = valueFromPointer(event.clientX);
  const idx: 0 | 1 =
    Math.abs(loValue.value - v) <= Math.abs(hiValue.value - v) ? 0 : 1;
  jumpWith(idx, v);
}

/** 点击刻度点/标签跳转 */
function jumpToTick(i: number) {
  if (props.disabled) return;
  const v = clampSnap(
    props.min + i * props.step,
    props.min,
    props.max,
    props.step,
  );
  if (!props.dual) {
    emit("update:modelValue", v);
    return;
  }
  const idx: 0 | 1 =
    Math.abs(loValue.value - v) <= Math.abs(hiValue.value - v) ? 0 : 1;
  jumpWith(idx, v);
}
</script>

<style scoped>
.range-slider--ticks {
  /* 刻度标签行在轨道下方绝对定位，占位预留 */
  padding-bottom: 1.75rem;
}

.rs-input {
  vertical-align: middle;
}

/* 双头：两个 input 叠加，轨道不可命中、仅 thumb 可命中 */
.rs-dual {
  pointer-events: none;
}

.rs-dual::-webkit-slider-thumb {
  pointer-events: auto;
}

.rs-dual::-moz-range-thumb {
  pointer-events: auto;
}

/* 双头第二个 input 与第一个完全重叠 */
.rs-dual + .rs-dual {
  position: absolute;
  inset: 0;
}

.rs-dots {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.rs-dot {
  position: absolute;
  top: 50%;
  width: 4px;
  height: 4px;
  border-radius: 9999px;
  background-color: currentColor;
  opacity: 0.55;
  transform: translate(-50%, -50%);
}

.rs-segment {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  border-radius: var(--radius-selector, 0.5rem);
  pointer-events: none;
}

.rs-labels {
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  height: 1.25rem;
  margin-top: 2px;
  pointer-events: none;
}

.rs-label {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  max-width: 6rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.25rem;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.rs-label:disabled {
  pointer-events: none;
  opacity: 0.4;
}

/* 抽稀激活时的当前值 tooltip：悬停/聚焦滑块时浮现在轨道下方标签行
   （上方常被视口/容器边缘裁剪，下方组件已预留标签行空间） */
.rs-tooltip {
  position: absolute;
  top: calc(100% + 2px);
  z-index: 40;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.range-slider:hover .rs-tooltip,
.range-slider:focus-within .rs-tooltip {
  opacity: 1;
}
</style>
