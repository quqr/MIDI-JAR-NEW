<script setup lang="ts">
/**
 * 编辑工具条：小节结构（插入 / 追加 / 删除）+ 整曲移调 + 显示缩放 + 撤销重做。
 *
 * 编辑动作直接走 store（与 ChartContextPanel 同一模式）；
 * 移调拼写偏好复用全局 `settings.notation.accidentals`，不另立规则。
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { Icon } from "@/components/Icon";
import RangeSlider from "@/components/common/RangeSlider.vue";
import { optionsToRange } from "@/components/common/rangeSlider";
import { useSettingsStore } from "@/stores/settings";

import { useChordChartStore } from "../stores/ChordChart";

const props = defineProps<{
  /** 每拍像素宽（受缩放控制） */
  cellWidth: number;
}>();

const emit = defineEmits<{
  (e: "update:cellWidth", value: number): void;
}>();

const { t } = useI18n();
const store = useChordChartStore();
const settingsStore = useSettingsStore();

/* ── 移调 ─────────────────────────────────────────── */

function transpose(semitones: number): void {
  store.transposeChartSemitones(
    semitones,
    settingsStore.settings.notation.accidentals,
  );
}

/* ── 缩放（离散档位，ADR 0014：离散选项一律 RangeSlider） ── */

const ZOOM_LEVELS: readonly number[] = [20, 24, 28, 34, 40];

const zoomIndex = computed(() => {
  const hit = ZOOM_LEVELS.indexOf(props.cellWidth);
  return hit >= 0 ? hit : ZOOM_LEVELS.indexOf(28);
});

const zoomLabels = computed(() => ZOOM_LEVELS.map((z) => `${z}px`));

function onZoom(value: number | number[]): void {
  const raw = Number(Array.isArray(value) ? value[0] : value);
  const picked = ZOOM_LEVELS[raw];
  if (picked !== undefined) emit("update:cellWidth", picked);
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
    <!-- 小节结构 -->
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="btn btn-ghost btn-xs gap-1"
        :title="t('chordChart.toolbar.insertMeasure')"
        @click="store.insertMeasure(store.cursor.measureIndex)"
      >
        <Icon name="plus" :size="12" />
        {{ t("chordChart.toolbar.insertMeasure") }}
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-xs gap-1"
        :title="t('chordChart.toolbar.appendMeasure')"
        @click="store.appendMeasure()"
      >
        <Icon name="chevrons-down" :size="12" />
        {{ t("chordChart.toolbar.appendMeasure") }}
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-xs gap-1 text-error/80"
        :title="t('chordChart.toolbar.deleteMeasure')"
        @click="store.removeMeasure(store.cursor.measureIndex)"
      >
        <Icon name="trash" :size="12" />
        {{ t("chordChart.toolbar.deleteMeasure") }}
      </button>
    </div>

    <div class="w-px h-4 bg-base-content/10" aria-hidden="true" />

    <!-- 整曲移调 -->
    <div class="flex items-center gap-1">
      <span class="text-[11px] text-base-content/50">
        {{ t("chordChart.toolbar.transpose") }}
      </span>
      <button
        type="button"
        class="btn btn-ghost btn-xs btn-square"
        :title="t('chordChart.toolbar.transposeDown')"
        :aria-label="t('chordChart.toolbar.transposeDown')"
        @click="transpose(-1)"
      >
        <Icon name="minus" :size="12" />
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-xs btn-square"
        :title="t('chordChart.toolbar.transposeUp')"
        :aria-label="t('chordChart.toolbar.transposeUp')"
        @click="transpose(1)"
      >
        <Icon name="plus" :size="12" />
      </button>
    </div>

    <div class="w-px h-4 bg-base-content/10" aria-hidden="true" />

    <!-- 缩放 -->
    <label class="flex items-center gap-2">
      <span class="text-[11px] text-base-content/50 shrink-0">
        {{ t("chordChart.toolbar.zoom") }}
      </span>
      <RangeSlider
        :model-value="zoomIndex"
        v-bind="
          optionsToRange(
            ZOOM_LEVELS.map((z) => ({ value: z, label: `${z}px` })),
          )
        "
        :tick-labels="zoomLabels"
        :max-tick-labels="5"
        size="xs"
        class="w-32"
        :aria-label="t('chordChart.toolbar.zoom')"
        @update:model-value="onZoom"
      />
    </label>

    <!-- 撤销 / 重做 -->
    <div class="ml-auto flex items-center gap-1">
      <button
        type="button"
        class="btn btn-ghost btn-xs btn-square"
        :disabled="!store.canUndo"
        :title="t('chordChart.undo')"
        :aria-label="t('chordChart.undo')"
        @click="store.undo()"
      >
        <Icon name="arrow-left" :size="12" />
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-xs btn-square"
        :disabled="!store.canRedo"
        :title="t('chordChart.redo')"
        :aria-label="t('chordChart.redo')"
        @click="store.redo()"
      >
        <Icon name="arrow-right" :size="12" />
      </button>
    </div>
  </div>
</template>
