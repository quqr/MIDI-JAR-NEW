<script setup lang="ts">
/**
 * 谱面网格容器：把 system 分页结果铺成若干行。
 *
 * 只读渲染（Step 5）。单元格宽由 `cellWidth` 单点控制，
 * 超宽时由本容器的横向滚动承接。
 */
import { computed } from "vue";

import ChartSystemRow from "./ChartSystemRow.vue";

import type { KeySignatureInfo } from "../domain/keySignature";
import type { ChartMeasure, SectionMark } from "../domain/types";

const props = defineProps<{
  /** system 分页结果（每项是若干小节索引） */
  systems: number[][];
  /** 全曲小节数组 */
  measures: ChartMeasure[];
  /** 每拍像素宽 */
  cellWidth: number;
  /** system 起始处的垂直间距表（key = system 索引） */
  systemSpacing: Record<number, 1 | 2 | 3>;
  /** 全曲调号（每行谱首显示） */
  keySig?: KeySignatureInfo;
  /** 排练记号表：key = 小节索引 */
  sectionsByMeasure?: Record<number, SectionMark>;
  /** 谱面文字表：key = 小节索引 */
  textsByMeasure?: Record<number, string>;
  /** 光标所在小节索引 */
  cursorMeasure?: number;
  /** 光标所在和弦索引；null = 小节级 */
  cursorChord?: number | null;
  /** 判断某和弦是否在选区内 */
  isSelected?: (measureIndex: number, chordIndex: number) => boolean;
}>();

const emit = defineEmits<{
  (e: "select", measureIndex: number, chordIndex: number): void;
}>();

/** 各 system 的行间距 */
const spacings = computed(() =>
  props.systems.map((_, i) => props.systemSpacing[i] ?? 0),
);
</script>

<template>
  <div class="overflow-x-auto">
    <div class="flex flex-col gap-3 min-w-max px-1 py-2">
      <ChartSystemRow
        v-for="(system, index) in systems"
        :key="index"
        :measure-indices="system"
        :measures="measures"
        :cell-width="cellWidth"
        :spacing="spacings[index]"
        :key-sig="keySig"
        :sections-by-measure="sectionsByMeasure"
        :texts-by-measure="textsByMeasure"
        :cursor-measure="cursorMeasure"
        :cursor-chord="cursorChord"
        :is-selected="isSelected"
        @select="(m, c) => emit('select', m, c)"
      />
    </div>
  </div>
</template>
