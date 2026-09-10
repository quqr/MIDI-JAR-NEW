<script setup lang="ts">
/**
 * 上下文按钮面板（对应 iReal 的 context menu）。
 *
 * 随光标位置**动态切换作用域**：
 * - 光标在小节上（`chordIndex === null`）→ 小节属性
 * - 光标落在某个和弦上 → 和弦属性
 *
 * 面板本身不持有音乐状态，全部通过 store 读写；每条变更在 store 内
 * 各自入历史栈（`pushHistory`），因此这里可以放心地「一次点击一次提交」。
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { resolveTimeSignature } from "../domain/grid";

import ChartChordAttributes from "./ChartChordAttributes.vue";
import ChartMeasureAttributes from "./ChartMeasureAttributes.vue";

import type { ChordSize, ChordUnit } from "../domain/types";
import { useChordChartStore } from "../stores/ChordChart";

const props = defineProps<{
  /** 目标小节索引 */
  measureIndex: number;
  /** 目标和弦索引；null = 小节级 */
  chordIndex: number | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const { t } = useI18n();
const store = useChordChartStore();

const scope = computed<"measure" | "chord">(() =>
  props.chordIndex === null ? "measure" : "chord",
);

const measure = computed(
  () => store.chart.measures[props.measureIndex] ?? null,
);

const chord = computed<ChordUnit | null>(() => {
  if (props.chordIndex === null) return null;
  return measure.value?.chords[props.chordIndex] ?? null;
});

/** 有效拍号（已处理「继承前小节」） */
const effectiveTimeSignature = computed(() =>
  resolveTimeSignature(store.chart.measures, props.measureIndex),
);

const section = computed(() => store.sectionAt(props.measureIndex));
const text = computed(() => store.textAt(props.measureIndex));

/* ── 小节级回调 ───────────────────────────────────── */

function onPatch(patch: Parameters<typeof store.updateMeasure>[1]): void {
  store.updateMeasure(props.measureIndex, patch);
}

function onSection(mark: Parameters<typeof store.setSectionAt>[1]): void {
  store.setSectionAt(props.measureIndex, mark);
}

function onText(content: string): void {
  store.setTextAt(props.measureIndex, content);
}

function onClearMeasure(): void {
  store.clearMeasure(props.measureIndex);
  emit("close");
}

/* ── 和弦级回调 ───────────────────────────────────── */

function onBeats(beats: ChordUnit["beats"]): void {
  if (props.chordIndex === null) return;
  store.changeChordBeats(props.measureIndex, props.chordIndex, beats);
}

function onSize(size: ChordSize): void {
  if (props.chordIndex === null || !chord.value) return;
  // store 侧只有 toggle；同态点击不产生变更
  if (chord.value.size !== size) {
    store.toggleChordSizeAt(props.measureIndex, props.chordIndex);
  }
}

function onAlternate(value: string): void {
  if (props.chordIndex === null) return;
  store.setAlternateAt(props.measureIndex, props.chordIndex, value);
}

function onToggleNoChord(): void {
  if (props.chordIndex === null || !chord.value) return;
  store.putChord(props.measureIndex, props.chordIndex, {
    ...chord.value,
    noChord: !chord.value.noChord,
  });
}

function onToggleInvisibleRoot(): void {
  if (props.chordIndex === null || !chord.value) return;
  store.putChord(props.measureIndex, props.chordIndex, {
    ...chord.value,
    invisibleRoot: !chord.value.invisibleRoot,
  });
}

function onDeleteChord(): void {
  if (props.chordIndex === null) return;
  store.deleteChord(props.measureIndex, props.chordIndex);
  emit("close");
}
</script>

<template>
  <div
    class="flex w-72 flex-col gap-3 rounded-lg border border-base-300 bg-base-100 p-3 shadow-lg"
  >
    <!-- 头：作用域切换显示 -->
    <div class="flex items-center justify-between gap-2">
      <div class="flex min-w-0 flex-col">
        <span class="truncate text-sm font-semibold">
          {{
            scope === "measure"
              ? t("chordChart.context.titleMeasure")
              : t("chordChart.context.titleChord")
          }}
        </span>
        <span class="text-[11px] text-base-content/50">
          {{ t("chordChart.context.scopeMeasure") }} {{ measureIndex + 1 }}
          <template v-if="scope === 'chord'">
            · {{ t("chordChart.context.scopeChord") }}
            {{ (chordIndex ?? 0) + 1 }}</template
          >
        </span>
      </div>
      <button
        type="button"
        class="btn btn-xs btn-ghost btn-square"
        :aria-label="t('chordChart.context.close')"
        @click="emit('close')"
      >
        ✕
      </button>
    </div>

    <div class="divider my-0" />

    <!-- 和弦级 -->
    <ChartChordAttributes
      v-if="scope === 'chord' && chord"
      :chord="chord"
      @beats="onBeats"
      @size="onSize"
      @alternate="onAlternate"
      @toggle-no-chord="onToggleNoChord"
      @toggle-invisible-root="onToggleInvisibleRoot"
      @delete="onDeleteChord"
    />

    <!-- 小节级 -->
    <ChartMeasureAttributes
      v-else-if="measure"
      :measure="measure"
      :effective-time-signature="effectiveTimeSignature"
      :section="section"
      :text="text"
      @patch="onPatch"
      @section="onSection"
      @text="onText"
      @clear="onClearMeasure"
    />
  </div>
</template>
