<script setup lang="ts">
/**
 * 一条 system（谱行）：横向排布若干小节。
 *
 * 高度按 system 间隔（`systemSpacing`）留出上间距。
 * 首期不做自动缩放：cellWidth 固定，超宽时由外层横向滚动承接。
 */
import { computed } from "vue";

import ChartMeasureCell from "./ChartMeasureCell.vue";
import MusicGlyph from "@/components/common/MusicGlyph.vue";
import { measureBarlineWidth } from "./barlineMetrics";
import {
  formatTimeSignature,
  measureCells,
  resolveTimeSignature,
} from "../domain/grid";

import type { KeySignatureInfo } from "../domain/keySignature";
import type { ChartMeasure, SectionMark } from "../domain/types";

const props = defineProps<{
  /** 该 system 含有的小节索引 */
  measureIndices: number[];
  /** 全曲小节数组（按索引取用） */
  measures: ChartMeasure[];
  /** 每拍像素宽 */
  cellWidth: number;
  /** 该 system 上方的额外间隔（1|2|3 格；缺失 = 0） */
  spacing?: number;
  /** 全曲调号（每行谱首显示，与 iReal 一致） */
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

/** 上间距像素（每格 = 0.75rem ≈ 12px） */
const spacingPx = computed(() => (props.spacing ?? 0) * 12);

/** 逐小节解析拍号（iReal 支持逐小节换拍号） */
const cells = computed(() =>
  props.measureIndices.map((i) => ({
    measureIndex: i,
    measure: props.measures[i],
    ts: resolveTimeSignature(props.measures, i),
  })),
);

/** 该行总宽（小节线宽度与单元格模板共用 barlineMetrics 真相源） */
const totalWidth = computed(() =>
  cells.value.reduce(
    (sum, c) =>
      sum +
      measureCells(c.ts) * props.cellWidth +
      measureBarlineWidth(c.measure),
    0,
  ),
);

/**
 * 行首或行内拍号变化标记：
 * 首行首小节是 4/4 时不标（默认拍号），其余与前一拍号不同才标。
 */
const showTimeSignature = computed(() =>
  cells.value.map((c, idx) => {
    const prev = idx > 0 ? cells.value[idx - 1].ts : null;
    if (idx === 0) return c.ts !== "T44";
    return prev !== c.ts;
  }),
);

/** 拍号文本（复用 grid 的格式化，避免第二套） */
function tsLabel(ts: string): string {
  return formatTimeSignature(ts as never);
}

/** 拍号拆成分子/分母（叠置显示用） */
function tsParts(ts: string): [string, string] {
  const label = tsLabel(ts);
  const i = label.indexOf("/");
  return [label.slice(0, i), label.slice(i + 1)];
}

/**
 * 某小节内的和弦选中判定。
 *
 * 不能写成模板里的箭头函数：可选 prop `isSelected` 在闭包内无法被 TS
 * 收窄（TS2722 "possibly undefined"）。这里显式捕获一次即可。
 */
function makeSelectedChecker(measureIndex: number) {
  const checker = props.isSelected;
  if (!checker) return undefined;
  return (chordIndex: number): boolean => checker(measureIndex, chordIndex);
}
</script>

<template>
  <div class="flex items-start" :style="{ paddingTop: `${spacingPx}px` }">
    <!-- 行首 gutter：调号列（每行谱首，与 iReal 一致）+ 叠置拍号 -->
    <div class="w-16 shrink-0 flex items-center justify-end gap-1.5 pr-1.5">
      <span
        v-if="keySig && keySig.count > 0"
        class="flex items-center gap-px text-base-content/70"
        :aria-label="`${keySig.count} ${keySig.accidental === 'sharp' ? 'sharps' : 'flats'}`"
      >
        <MusicGlyph
          v-for="i in keySig.count"
          :key="i"
          :name="keySig.accidental === 'sharp' ? 'sharp' : 'flat'"
          :size="11"
        />
      </span>
      <span
        v-if="cells.length && showTimeSignature[0]"
        class="flex flex-col items-center leading-[1.02] font-bold text-base-content/75 tabular-nums text-[13px]"
      >
        <span>{{ tsParts(cells[0].ts)[0] }}</span>
        <span>{{ tsParts(cells[0].ts)[1] }}</span>
      </span>
    </div>

    <div class="flex items-stretch" :style="{ width: `${totalWidth}px` }">
      <div
        v-for="(cell, idx) in cells"
        :key="cell.measureIndex"
        class="relative"
      >
        <!-- 行内拍号变化：叠置小数字（iReal 画在小节线上方） -->
        <span
          v-if="idx > 0 && showTimeSignature[idx]"
          class="absolute -top-3.5 left-0.5 flex flex-col items-center leading-[1] text-[9px] font-semibold text-primary/80 tabular-nums"
        >
          <span>{{ tsParts(cell.ts)[0] }}</span>
          <span>{{ tsParts(cell.ts)[1] }}</span>
        </span>

        <ChartMeasureCell
          :measure="cell.measure"
          :measure-index="cell.measureIndex"
          :time-signature="cell.ts"
          :cell-width="cellWidth"
          :section="sectionsByMeasure?.[cell.measureIndex] ?? null"
          :text="textsByMeasure?.[cell.measureIndex] ?? ''"
          :active-chord-index="
            cursorMeasure === cell.measureIndex ? (cursorChord ?? null) : null
          "
          :is-cursor-measure="cursorMeasure === cell.measureIndex"
          :is-selected="makeSelectedChecker(cell.measureIndex)"
          @select="(ci) => emit('select', cell.measureIndex, ci)"
        />
      </div>
    </div>
  </div>
</template>
