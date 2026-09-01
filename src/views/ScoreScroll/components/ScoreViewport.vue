<template>
  <div class="relative h-full overflow-hidden" :class="backgroundClass">
    <!-- 谱面滚动容器 -->
    <div ref="scrollEl" class="absolute inset-0 overflow-auto">
      <div class="mx-auto w-full px-6 pt-6 pb-[45vh]">
        <div class="relative">
          <div ref="osmdEl" class="score-osmd-target"></div>
          <!-- 特效覆盖层：与谱面同坐标系、随内容滚动 -->
          <slot name="overlay"></slot>
        </div>
      </div>
    </div>

    <!-- 扫描线（仅播放时显示，指示当前播放位置） -->
    <div
      v-if="playing"
      class="pointer-events-none absolute left-0 right-0 z-10"
      :style="{ top: `${scanlinePosition}%` }"
    >
      <div
        class="h-[2px] w-full bg-primary"
        :style="{ opacity: 0.35, boxShadow: '0 0 8px var(--color-primary)' }"
      ></div>
    </div>

    <!-- 缩放控件 -->
    <div
      class="absolute right-3 bottom-3 z-10 flex items-center gap-1 rounded-xl border border-base-content/10 bg-base-100/80 px-1 py-1 backdrop-blur-md"
    >
      <button
        class="btn btn-xs btn-circle btn-ghost"
        :title="t('scoreScroll.appearance.title')"
        :aria-label="'zoom-out'"
        @click="$emit('update:zoom', zoom - 0.1)"
      >
        <Icon name="minus" :size="14" aria-hidden="true" />
      </button>
      <span
        class="min-w-10 text-center text-xs tabular-nums text-base-content/70"
      >
        {{ Math.round(zoom * 100) }}%
      </span>
      <button
        class="btn btn-xs btn-circle btn-ghost"
        :aria-label="'zoom-in'"
        @click="$emit('update:zoom', zoom + 0.1)"
      >
        <Icon name="plus" :size="14" aria-hidden="true" />
      </button>
    </div>

    <!-- 加载中 -->
    <div
      v-if="loading"
      class="absolute inset-0 z-20 flex items-center justify-center bg-base-100/60"
    >
      <LoadingSpinner :label="t('scoreScroll.source.load')" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 谱面视口：OSMD 渲染容器 + 滚动控制 + 扫描线 + 缩放控件。
 * 滚动内容与视口分层：扫描线/特效层固定于视口坐标系。
 */
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import type { ScoreBackgroundStyle } from "../types";

const props = defineProps<{
  zoom: number;
  /** 扫描线在视口内的垂直位置（0-100） */
  scanlinePosition: number;
  /** 背景样式 */
  background: ScoreBackgroundStyle;
  loading: boolean;
  /** 是否正在播放（控制扫描线显示） */
  playing: boolean;
}>();

defineEmits<{
  "update:zoom": [value: number];
}>();

const { t } = useI18n();

const scrollEl = ref<HTMLElement>();
const osmdEl = ref<HTMLElement>();

const backgroundClass = computed(
  (): string =>
    ({
      theme: "bg-base-300",
      paper: "bg-[#f5f1e8]",
      black: "bg-black",
      gradient: "bg-gradient-to-b from-base-300 to-base-200",
    })[props.background],
);

/**
 * 滚动到内容坐标 y（px，OSMD SVG 坐标系）
 * @param y - OSMD 坐标系中的目标 y
 * @param anchorOffsetPx - 视口内的锚点偏移（吸顶位置）
 */
function scrollToContentY(y: number, anchorOffsetPx: number): void {
  const scroller = scrollEl.value;
  const target = osmdEl.value;
  if (!scroller || !target) return;
  // 通过 getBoundingClientRect 计算 OSMD 容器在滚动内容中的偏移
  const contentOffset =
    target.getBoundingClientRect().top -
    scroller.getBoundingClientRect().top -
    scroller.scrollTop;
  scroller.scrollTop = Math.max(0, contentOffset + y - anchorOffsetPx);
}

/** 视口高度（px） */
function getViewportHeight(): number {
  return scrollEl.value?.clientHeight ?? 0;
}

/** 重置滚动到顶部 */
function scrollToTop(): void {
  if (scrollEl.value) scrollEl.value.scrollTop = 0;
}

defineExpose({
  scrollEl,
  osmdEl,
  scrollToContentY,
  getViewportHeight,
  scrollToTop,
});
</script>
