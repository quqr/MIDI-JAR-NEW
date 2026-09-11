<script setup lang="ts">
/**
 * 一个小节的渲染单元。
 *
 * 结构：左侧小节线（barlineMetrics 条段）+ 和弦块序列（按 beats 分配宽度）
 * + 右侧小节线。宽度 = `renderCells * cellWidth + measureBarlineWidth(measure)`，
 * 后者与 `ChartSystemRow` 的行宽共用同一份真相源。
 *
 * 谱面记号层：
 * - 段落字母：左上角徽章
 * - Ending：顶部括线 + "N."
 * - 跳转 / Segno / Coda / Fermata / 反复次数 / END：右上角徽章链
 * - 谱面文字：底部左侧
 * 反复圆点用 Bravura 音乐字形（MusicGlyph / repeatDots）渲染。
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import MusicGlyph from "@/components/common/MusicGlyph.vue";
import ChordBlock from "./ChordBlock.vue";
import { measureCells, renderCells, restForCells } from "../domain/grid";
import { barlineParts, measureBarlineWidth } from "./barlineMetrics";

import type { ChartMeasure, SectionMark, TimeSignature } from "../domain/types";

const props = defineProps<{
  measure: ChartMeasure;
  /** 该小节在全曲中的索引（用于浮层锚点定位） */
  measureIndex: number;
  /** 该小节生效的拍号（已由父级 resolve） */
  timeSignature: TimeSignature;
  /** 每拍像素宽 */
  cellWidth: number;
  /** 排练记号字母；null = 无 */
  section?: SectionMark | null;
  /** 谱面文字；空串 = 无 */
  text?: string;
  /** 本小节的光标和弦索引；null = 光标不在本小节或为小节级 */
  activeChordIndex?: number | null;
  /** 本小节是否处于光标所在小节（用于小节级高亮） */
  isCursorMeasure?: boolean;
  /** 判断某个和弦是否在选区内 */
  isSelected?: (chordIndex: number) => boolean;
}>();

const emit = defineEmits<{
  (e: "select", chordIndex: number): void;
}>();

const { t } = useI18n();

/** 该小节画多少个 cell（取「已用」与「容量」的较大者，保证空小节也占满拍数） */
const cells = computed(() => renderCells(props.measure, props.timeSignature));

/** 该小节总容量（拍数） */
const capacity = computed(() => measureCells(props.timeSignature));

/** 每个和弦占用的 cell 数（= beats） */
const widths = computed(() =>
  props.measure.chords.map((c) => Math.max(1, Math.round(c.beats))),
);

const widthPx = computed(() => cells.value * props.cellWidth);

/** 根宽 = 和弦区 + 左右小节线（真相源在 barlineMetrics） */
const totalWidthPx = computed(
  () => widthPx.value + measureBarlineWidth(props.measure),
);

/** 末尾对齐：和弦总占用小于容量时，右侧留白 */
const trailingCells = computed(() => {
  const used = widths.value.reduce((sum, w) => sum + w, 0);
  return Math.max(0, cells.value - used);
});

/**
 * 空档休止符（iReal 行为：和弦未占满的拍画休止）。
 * 整小节全空 → 全休止符；局部空档 → 按剩余拍数取二分/四分休止。
 */
const trailingRest = computed(() =>
  trailingCells.value > 0 ? restForCells(trailingCells.value) : null,
);
const emptyMeasureRest = computed(() =>
  props.measure.chords.length === 0 ? restForCells(cells.value) : null,
);

/** 左右小节线的条段序列（结构 + 宽度同源） */
const leftParts = computed(() =>
  barlineParts(props.measure.barlineStart, true),
);
const rightParts = computed(() =>
  barlineParts(props.measure.barlineEnd, false),
);

/* ── 反复与跳转标记 ───────────────────────────────── */

const mark = computed(() => props.measure.repeat);
const ending = computed(() => mark.value?.ending ?? null);

/** 右上角徽章链是否有内容 */
const hasBadges = computed(() => {
  const m = mark.value;
  return (
    !!m && !!(m.jump || m.segno || m.coda || m.fermata || m.playTimes || m.end)
  );
});

/** 跳转指令的可读标签（D.C. al Coda …） */
const jumpLabel = computed(() =>
  mark.value?.jump ? t(`chordChart.jumpCommand.${mark.value.jump}`) : null,
);

const playTimes = computed(() => mark.value?.playTimes ?? null);
</script>

<template>
  <div
    class="relative flex items-stretch h-12 shrink-0"
    :style="{ width: `${totalWidthPx}px` }"
    :data-measure-cells="capacity"
    :data-measure-index="measureIndex"
  >
    <!-- 左小节线（条段序列） -->
    <div class="flex items-stretch shrink-0" aria-hidden="true">
      <div
        v-for="(p, i) in leftParts"
        :key="`l${i}`"
        class="flex items-center justify-center"
        :class="
          p.solid ? (p.w > 2 ? 'bg-base-content/70' : 'bg-base-content/30') : ''
        "
        :style="{ width: `${p.w}px` }"
      >
        <MusicGlyph
          v-if="p.dots"
          name="repeatDots"
          :size="8"
          class="text-base-content/70"
        />
      </div>
    </div>

    <!-- 和弦区 -->
    <div
      class="relative flex-1 flex items-center"
      :class="{ 'bg-primary/[0.04]': isCursorMeasure }"
    >
      <!-- 空小节：可点击的占位区，便于把光标放上来；中央画全小节休止符 -->
      <div
        v-if="measure.chords.length === 0"
        class="flex-1 h-full cursor-pointer flex items-center justify-center"
        :data-chord-block="`${measureIndex}-0`"
        @click="emit('select', 0)"
      >
        <MusicGlyph
          v-if="emptyMeasureRest"
          :name="emptyMeasureRest"
          :size="18"
          class="text-base-content/35"
        />
      </div>

      <ChordBlock
        v-for="(chord, index) in measure.chords"
        :key="index"
        :unit="chord"
        :cells="widths[index]"
        :cell-width="cellWidth"
        :active="activeChordIndex === index"
        :selected="isSelected ? isSelected(index) : false"
        :measure-index="measureIndex"
        :chord-index="index"
        class="cursor-pointer"
        @click="emit('select', index)"
      />

      <!-- 右侧空档：休止符（和弦未填满小节时，iReal 行为） -->
      <div
        v-if="trailingCells > 0"
        class="shrink-0 flex items-center justify-center"
        :style="{ width: `${trailingCells * cellWidth}px` }"
        aria-hidden="true"
      >
        <MusicGlyph
          v-if="trailingRest"
          :name="trailingRest"
          :size="18"
          class="text-base-content/35"
        />
      </div>

      <!-- 段落字母（左上角徽章） -->
      <span
        v-if="section"
        class="absolute top-1 left-1 h-3.5 min-w-3.5 px-1 flex items-center justify-center rounded bg-primary/10 text-primary text-[9px] font-bold leading-none"
      >
        {{ section }}
      </span>

      <!-- Ending 括线 + "N." -->
      <template v-if="ending">
        <div
          class="absolute inset-x-0 top-0 h-2.5 border-x border-t border-base-content/45 pointer-events-none"
          aria-hidden="true"
        />
        <span
          class="absolute top-0 left-1 text-[9px] leading-[10px] font-semibold text-primary/80 tabular-nums"
        >
          {{ ending }}.
        </span>
      </template>

      <!-- 右上角徽章链：跳转 / Segno / Coda / Fermata / 反复次数 / END -->
      <div
        v-if="hasBadges"
        class="absolute top-0 right-0.5 flex items-center gap-1 h-4 px-1 rounded-b bg-base-100/85 text-[9px] leading-none"
      >
        <span
          v-if="jumpLabel"
          class="font-semibold text-secondary max-w-[72px] truncate"
        >
          {{ jumpLabel }}
        </span>
        <MusicGlyph
          v-if="mark?.segno"
          name="segno"
          :size="9"
          class="text-primary/80"
        />
        <MusicGlyph
          v-if="mark?.coda"
          name="coda"
          :size="9"
          class="text-primary/80"
        />
        <MusicGlyph
          v-if="mark?.fermata"
          name="fermata"
          :size="10"
          class="text-primary/80"
        />
        <span
          v-if="playTimes"
          class="font-medium text-base-content/60 tabular-nums"
        >
          {{ playTimes }}×
        </span>
        <span v-if="mark?.end" class="font-bold text-error/80">
          {{ t("chordChart.context.endMark") }}
        </span>
      </div>

      <!-- 谱面文字（底部左侧） -->
      <span
        v-if="text"
        class="absolute bottom-0.5 left-1 right-1 text-[9px] text-base-content/55 italic truncate pointer-events-none"
      >
        {{ text }}
      </span>
    </div>

    <!-- 右小节线（条段序列） -->
    <div class="flex items-stretch shrink-0" aria-hidden="true">
      <div
        v-for="(p, i) in rightParts"
        :key="`r${i}`"
        class="flex items-center justify-center"
        :class="
          p.solid ? (p.w > 2 ? 'bg-base-content/70' : 'bg-base-content/30') : ''
        "
        :style="{ width: `${p.w}px` }"
      >
        <MusicGlyph
          v-if="p.dots"
          name="repeatDots"
          :size="8"
          class="text-base-content/70"
        />
      </div>
    </div>
  </div>
</template>
