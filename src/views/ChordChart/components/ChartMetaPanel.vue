<script setup lang="ts">
/**
 * 曲目元信息编辑面板（标题栏铅笔按钮展开）。
 *
 * 文本输入用 `@change`（失焦 / 回车提交）而非 `@input`：
 * `updateMeta` 每次调用都压入撤销快照，逐键提交会把撤销栈灌满无意义条目。
 * 离散选项（调 / 式 / 记法 / 反复次数）按 ADR 0014 一律 RangeSlider。
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import RangeSlider from "@/components/common/RangeSlider.vue";
import { optionsToRange } from "@/components/common/rangeSlider";
import { useChordChartStore } from "../stores/ChordChart";

import type { ChordNotation } from "../domain/types";

const TONICS: readonly string[] = [
  "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B",
];
const MODES: readonly ("major" | "minor")[] = ["major", "minor"];
const NOTATIONS: readonly ChordNotation[] = ["long", "short", "symbol"];
const REPEATS: readonly number[] = [1, 2, 3, 4, 5];

const { t } = useI18n();
const store = useChordChartStore();

/* ── 索引映射 ─────────────────────────────────────── */

const tonicIndex = computed(() =>
  Math.max(0, TONICS.indexOf(store.chart.meta.key.tonic)),
);
const modeIndex = computed(() =>
  Math.max(0, MODES.indexOf(store.chart.meta.key.mode)),
);
const notationIndex = computed(() =>
  Math.max(0, NOTATIONS.indexOf(store.chart.meta.notation)),
);
const repeatsIndex = computed(() =>
  Math.max(0, REPEATS.indexOf(store.chart.meta.repeats)),
);

function onIndex(
  value: number | number[],
  table: readonly unknown[],
  apply: (picked: unknown) => void,
): void {
  const raw = Number(Array.isArray(value) ? value[0] : value);
  const picked = table[raw];
  if (picked !== undefined) apply(picked);
}

function onTempo(event: Event): void {
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  if (!Number.isFinite(value)) return;
  const clamped = Math.max(40, Math.min(300, Math.round(value)));
  input.value = String(clamped);
  if (clamped !== store.chart.meta.tempo) {
    store.updateMeta({ tempo: clamped });
  }
}

const notationLabels = computed(() => [
  t("chordChart.metaPanel.notationLong"),
  t("chordChart.metaPanel.notationShort"),
  t("chordChart.metaPanel.notationSymbol"),
]);
const modeLabels = computed(() => [
  t("chordChart.metaPanel.major"),
  t("chordChart.metaPanel.minor"),
]);
</script>

<template>
  <div
    class="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-3 p-3 rounded-xl bg-base-200/40 border border-base-content/10"
  >
    <!-- 曲名（占两列） -->
    <label class="col-span-2 flex flex-col gap-1 text-[11px] text-base-content/60">
      {{ t("chordChart.metaPanel.title") }}
      <input
        type="text"
        class="input input-sm w-full"
        :value="store.chart.meta.title"
        :placeholder="t('chordChart.untitled')"
        @change="(e) => store.updateMeta({ title: (e.target as HTMLInputElement).value.trim() })"
      />
    </label>

    <!-- 作曲 -->
    <label class="flex flex-col gap-1 text-[11px] text-base-content/60">
      {{ t("chordChart.metaPanel.composer") }}
      <input
        type="text"
        class="input input-sm w-full"
        :value="store.chart.meta.composer"
        @change="(e) => store.updateMeta({ composer: (e.target as HTMLInputElement).value.trim() })"
      />
    </label>

    <!-- 风格 -->
    <label class="flex flex-col gap-1 text-[11px] text-base-content/60">
      {{ t("chordChart.metaPanel.style") }}
      <input
        type="text"
        class="input input-sm w-full"
        :value="store.chart.meta.style"
        :placeholder="'Medium Swing'"
        @change="(e) => store.updateMeta({ style: (e.target as HTMLInputElement).value.trim() })"
      />
    </label>

    <!-- 调号（主音，占两列） -->
    <label class="col-span-2 flex flex-col gap-1 text-[11px] text-base-content/60">
      {{ t("chordChart.metaPanel.key") }}
      <RangeSlider
        :model-value="tonicIndex"
        v-bind="optionsToRange(TONICS.map((n) => ({ value: n, label: n })))"
        :tick-labels="[...TONICS]"
        :max-tick-labels="6"
        size="xs"
        :aria-label="t('chordChart.metaPanel.key')"
        @update:model-value="
          (v) => onIndex(v, TONICS, (p) => store.updateMeta({ key: { ...store.chart.meta.key, tonic: p as string } }))
        "
      />
    </label>

    <!-- 调式 -->
    <label class="flex flex-col gap-1 text-[11px] text-base-content/60">
      {{ t("chordChart.metaPanel.mode") }}
      <RangeSlider
        :model-value="modeIndex"
        v-bind="optionsToRange(MODES.map((m) => ({ value: m, label: m })))"
        :tick-labels="modeLabels"
        size="xs"
        :aria-label="t('chordChart.metaPanel.mode')"
        @update:model-value="
          (v) => onIndex(v, MODES, (p) => store.updateMeta({ key: { ...store.chart.meta.key, mode: p as 'major' | 'minor' } }))
        "
      />
    </label>

    <!-- 速度 -->
    <label class="flex flex-col gap-1 text-[11px] text-base-content/60">
      {{ t("chordChart.metaPanel.tempo") }}
      <input
        type="number"
        min="40"
        max="300"
        class="input input-sm w-full tabular-nums"
        :value="store.chart.meta.tempo"
        @change="onTempo"
      />
    </label>

    <!-- 反复次数 -->
    <label class="flex flex-col gap-1 text-[11px] text-base-content/60">
      {{ t("chordChart.metaPanel.repeats") }}
      <RangeSlider
        :model-value="repeatsIndex"
        v-bind="optionsToRange(REPEATS.map((n) => ({ value: n, label: `${n}×` })))"
        :tick-labels="REPEATS.map((n) => `${n}×`)"
        size="xs"
        :aria-label="t('chordChart.metaPanel.repeats')"
        @update:model-value="
          (v) => onIndex(v, REPEATS, (p) => store.updateMeta({ repeats: p as number }))
        "
      />
    </label>

    <!-- 记法 -->
    <label class="flex flex-col gap-1 text-[11px] text-base-content/60">
      {{ t("chordChart.metaPanel.notation") }}
      <RangeSlider
        :model-value="notationIndex"
        v-bind="optionsToRange(NOTATIONS.map((n) => ({ value: n, label: n })))"
        :tick-labels="notationLabels"
        :max-tick-labels="3"
        size="xs"
        :aria-label="t('chordChart.metaPanel.notation')"
        @update:model-value="
          (v) => onIndex(v, NOTATIONS, (p) => store.updateMeta({ notation: p as ChordNotation }))
        "
      />
    </label>
  </div>
</template>
