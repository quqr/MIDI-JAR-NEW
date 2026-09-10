<script setup lang="ts">
/**
 * 单个和弦的渲染块。
 *
 * 语义要点（见 ADR 0022）：
 * - **宽度由 `beats` 决定**，不是固定 cell 宽——和弦占几拍就画几拍宽。
 * - N.C. / 空单元 / 不可见根音三种特殊态各有独立视觉。
 * - 只读组件：不做任何编辑，交互事件向上抛。
 */
import { computed } from "vue";

import { formatChordUnit } from "../domain/chordText";

import type { ChordUnit } from "../domain/types";

const props = defineProps<{
  unit: ChordUnit;
  /** 该和弦占用的拍数（= 网格单元数），用于计算宽度 */
  cells: number;
  /** 每拍像素宽 */
  cellWidth: number;
  /** 是否处于编辑光标位置 */
  active?: boolean;
  /** 是否落在选区内 */
  selected?: boolean;
  /** 所属小节索引（用于浮层锚点定位，写进 data 属性供 querySelector 查） */
  measureIndex?: number;
  /** 和弦在自己小节内的序号 */
  chordIndex?: number;
}>();

/** 和弦主文本（省略 alternate，alternate 单独画在右上角） */
const text = computed(() => formatChordUnit(props.unit));

/** alternate 文本 */
const alternateText = computed(() => {
  const alt = props.unit.alternate;
  return alt ? formatChordUnit(alt) : "";
});

/** 空单元（既无根音也无低音、非 N.C.）：画一个占位虚线块 */
const isBlank = computed(
  () =>
    !props.unit.noChord &&
    !props.unit.invisibleRoot &&
    !props.unit.root &&
    !props.unit.bass,
);

const widthPx = computed(() => props.cells * props.cellWidth);

const textSizeClass = computed(() =>
  props.unit.size === "small" ? "text-xs" : "text-sm",
);
</script>

<template>
  <div
    class="relative flex items-center justify-center select-none rounded transition-colors"
    :class="{
      'bg-primary/15 ring-1 ring-primary/40': active,
      'bg-primary/10': !active && selected,
      'hover:bg-primary/5': !active && !selected,
    }"
    :style="{ width: `${widthPx}px` }"
    :data-chord-block="
      measureIndex !== undefined && chordIndex !== undefined
        ? `${measureIndex}-${chordIndex}`
        : undefined
    "
  >
    <!-- N.C.：斜体灰字 -->
    <span
      v-if="unit.noChord"
      class="italic text-base-content/40 text-xs tracking-wide"
    >
      {{ text }}
    </span>

    <!-- 空单元：极淡的占位（可视作节拍占位） -->
    <span
      v-else-if="isBlank"
      class="w-full h-px bg-base-content/10"
      aria-hidden="true"
    />

    <!-- 小节级光标的高亮条（空小节时也能定位） -->
    <span
      v-if="active && (isBlank || unit.noChord)"
      class="absolute inset-y-1 left-0.5 w-0.5 bg-primary/50 rounded"
      aria-hidden="true"
    />

    <!-- 常规和弦 -->
    <template v-else>
      <!-- 不可见根音：只显示低音，前面加斜杠 -->
      <span
        v-if="unit.invisibleRoot"
        class="font-medium text-base-content/70"
        :class="textSizeClass"
      >
        {{ text }}
      </span>
      <span
        v-else
        class="font-semibold text-base-content leading-none"
        :class="textSizeClass"
      >
        {{ text }}
      </span>

      <!-- alternate：右上角小字 -->
      <sup
        v-if="alternateText"
        class="absolute -top-0.5 right-0.5 text-[9px] text-base-content/50"
      >
        {{ alternateText }}
      </sup>
    </template>
  </div>
</template>
