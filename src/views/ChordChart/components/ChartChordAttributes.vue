<script setup lang="ts">
/**
 * 和弦属性编辑区（上下文面板的「和弦」页签）。
 *
 * 只负责「对已有和弦做修饰」——增删由键盘 / 输入面板负责，
 * 本组件不承担输入。`beats` 与尺寸是这里的主要职能。
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import RangeSlider from "@/components/common/RangeSlider.vue";
import { optionsToRange } from "@/components/common/rangeSlider";

import { CHORD_BEATS_VALUES } from "../domain/empty";
import { formatChordUnitWithAlternate } from "../domain/chordText";

import type { ChordSize, ChordUnit } from "../domain/types";

const props = defineProps<{
  /** 目标和弦 */
  chord: ChordUnit;
}>();

const emit = defineEmits<{
  (e: "beats", value: ChordUnit["beats"]): void;
  (e: "size", value: ChordSize): void;
  (e: "alternate", text: string): void;
  (e: "toggleNoChord"): void;
  (e: "toggleInvisibleRoot"): void;
  (e: "delete"): void;
}>();

const { t } = useI18n();

const SIZES: readonly ChordSize[] = ["normal", "small"];

const beatIndex = computed(() => {
  const i = CHORD_BEATS_VALUES.indexOf(props.chord.beats);
  return i >= 0 ? i : CHORD_BEATS_VALUES.length - 1;
});

const beatLabels = computed(() =>
  CHORD_BEATS_VALUES.map((b) => t(`chordChart.beats.${b}`)),
);

const sizeIndex = computed(() => SIZES.indexOf(props.chord.size));
const sizeLabels = computed(() => [
  t("chordChart.context.sizeNormal"),
  t("chordChart.context.sizeSmall"),
]);

/** 当前和弦文本（作为「上面小和弦」输入框的初值） */
const alternateText = computed(() => {
  const alt = props.chord.alternate;
  return alt ? formatChordUnitWithAlternate({ ...alt, alternate: null }) : "";
});

function onBeats(value: number | number[]): void {
  const raw = Number(Array.isArray(value) ? value[0] : value);
  const picked = CHORD_BEATS_VALUES[raw];
  if (picked !== undefined) emit("beats", picked);
}

function onSize(value: number | number[]): void {
  const raw = Number(Array.isArray(value) ? value[0] : value);
  const picked = SIZES[raw];
  if (picked) emit("size", picked);
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 时长 -->
    <div class="flex flex-col gap-1">
      <span class="text-xs font-medium text-base-content/70">
        {{ t("chordChart.context.beats") }}
      </span>
      <RangeSlider
        :model-value="beatIndex"
        v-bind="
          optionsToRange(
            CHORD_BEATS_VALUES.map((b) => ({ value: b, label: String(b) })),
          )
        "
        :tick-labels="beatLabels"
        size="sm"
        :aria-label="t('chordChart.context.beats')"
        @update:model-value="onBeats"
      />
    </div>

    <!-- 尺寸 -->
    <div class="flex flex-col gap-1">
      <span class="text-xs font-medium text-base-content/70">
        {{ t("chordChart.context.size") }}
      </span>
      <RangeSlider
        :model-value="sizeIndex"
        v-bind="optionsToRange(SIZES.map((s) => ({ value: s, label: s })))"
        :tick-labels="sizeLabels"
        size="sm"
        :aria-label="t('chordChart.context.size')"
        @update:model-value="onSize"
      />
    </div>

    <!-- 上方小和弦 -->
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-base-content/70">
        {{ t("chordChart.context.alternate") }}
      </span>
      <input
        type="text"
        class="input input-sm w-full"
        :value="alternateText"
        :placeholder="t('chordChart.context.alternatePlaceholder')"
        @change="(e) => emit('alternate', (e.target as HTMLInputElement).value)"
      />
    </label>

    <!-- 布尔切换 -->
    <div class="flex flex-wrap gap-1.5">
      <button
        type="button"
        class="btn btn-xs"
        :class="
          chord.noChord ? 'btn-primary' : 'btn-ghost border border-base-300'
        "
        @click="emit('toggleNoChord')"
      >
        {{ t("chordChart.context.noChord") }}
      </button>
      <button
        type="button"
        class="btn btn-xs"
        :class="
          chord.invisibleRoot
            ? 'btn-primary'
            : 'btn-ghost border border-base-300'
        "
        @click="emit('toggleInvisibleRoot')"
      >
        {{ t("chordChart.context.invisibleRoot") }}
      </button>
    </div>

    <!-- 删除 -->
    <button
      type="button"
      class="btn btn-sm btn-outline btn-error"
      @click="emit('delete')"
    >
      {{ t("chordChart.context.deleteChord") }}
    </button>
  </div>
</template>
