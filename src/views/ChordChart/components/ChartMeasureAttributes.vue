<script setup lang="ts">
/**
 * 小节属性编辑区（上下文面板的「小节」页签）。
 *
 * 所有选择型控件一律用 `RangeSlider`（ADR 0014），不出现原生 select / radio。
 * 领域值（"T44" / "dc-al-coda" …）在组件边界处映射为 0..n-1 索引，
 * 数组下标同时充当「显示顺序」这一份真相源。
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import RangeSlider from "@/components/common/RangeSlider.vue";
import MusicGlyph from "@/components/common/MusicGlyph.vue";
import { optionsToRange } from "@/components/common/rangeSlider";

import {
  TIME_SIGNATURES,
  formatTimeSignature,
  defaultGrouping,
} from "../domain/grid";

import type {
  BarlineKind,
  BeatGrouping,
  ChartMeasure,
  EndingNumber,
  JumpCommand,
  RepeatMark,
  SectionMark,
  TimeSignature,
} from "../domain/types";

const props = defineProps<{
  /** 目标小节 */
  measure: ChartMeasure;
  /** 解析后的有效拍号（已处理「继承前小节」） */
  effectiveTimeSignature: TimeSignature;
  /** 段落记号；null = 无 */
  section: SectionMark | null;
  /** 谱面文字；空串 = 无 */
  text: string;
}>();

const emit = defineEmits<{
  (e: "patch", patch: Partial<Omit<ChartMeasure, "chords">>): void;
  (e: "section", mark: SectionMark | null): void;
  (e: "text", content: string): void;
  (e: "clear"): void;
}>();

const { t } = useI18n();

/* ── 选项表（数组下标即滑条值） ─────────────────────── */

const BARLINE_KINDS: readonly BarlineKind[] = [
  "single",
  "double",
  "repeat-start",
  "repeat-end",
  "final",
];

const ENDINGS: readonly (EndingNumber | null)[] = [null, 1, 2, 3];

const JUMPS: readonly (JumpCommand | null)[] = [
  null,
  "dc",
  "dc-al-fine",
  "dc-al-coda",
  "ds",
  "ds-al-fine",
  "ds-al-coda",
  "ds-al-1st",
];

const SECTIONS: readonly (SectionMark | null)[] = [
  null,
  "A",
  "B",
  "C",
  "D",
  "V",
  "i",
];

const PLAY_TIMES: readonly (number | null)[] = [null, 2, 3, 4, 6, 8];

const TIME_SIGNATURE_OPTIONS = TIME_SIGNATURES.map((ts) => ({
  value: ts,
  label: formatTimeSignature(ts),
}));

/* ── 标记读取 ─────────────────────────────────────── */

const mark = computed<RepeatMark | null>(() => props.measure.repeat);

const endingIndex = computed(() => ENDINGS.indexOf(mark.value?.ending ?? null));
const jumpIndex = computed(() => JUMPS.indexOf(mark.value?.jump ?? null));
const playTimesIndex = computed(() =>
  PLAY_TIMES.indexOf(mark.value?.playTimes ?? null),
);
const sectionIndex = computed(() => SECTIONS.indexOf(props.section));
const tsIndex = computed(() =>
  TIME_SIGNATURE_OPTIONS.findIndex(
    (o) => o.value === props.effectiveTimeSignature,
  ),
);
const barlineStartIndex = computed(() =>
  BARLINE_KINDS.indexOf(props.measure.barlineStart),
);
const barlineEndIndex = computed(() =>
  BARLINE_KINDS.indexOf(props.measure.barlineEnd),
);

/** 拍分组：null = 默认，否则用默认分组的各段前缀（如 3+2 / 4+3 的全部分段方案） */
const groupingOptions = computed<BeatGrouping[]>(() => {
  const base = defaultGrouping(props.effectiveTimeSignature);
  if (!base) return [null];
  return [null, base];
});
const groupingIndex = computed(() => {
  const g = props.measure.grouping;
  if (!g) return 0;
  return Math.max(
    0,
    groupingOptions.value.findIndex((o) => o?.join("+") === g.join("+")),
  );
});

/** 是否显示拍分组（仅奇数拍拍号有意义） */
const showGrouping = computed(() => groupingOptions.value.length > 1);

/* ── 变更 ─────────────────────────────────────────── */

/** 以「读改写」方式更新 repeat：全空时收敛为 null，避免存空对象 */
function patchRepeat(next: Partial<RepeatMark>): void {
  const base: RepeatMark = mark.value ?? {
    ending: null,
    segno: false,
    coda: false,
    fermata: false,
    jump: null,
    playTimes: null,
    end: false,
  };
  const merged: RepeatMark = { ...base, ...next };
  const allEmpty =
    merged.ending === null &&
    !merged.segno &&
    !merged.coda &&
    !merged.fermata &&
    merged.jump === null &&
    merged.playTimes === null &&
    !merged.end;
  emit("patch", { repeat: allEmpty ? null : merged });
}

function onIndex(
  value: number | number[],
  table: readonly unknown[],
  apply: (picked: unknown) => void,
): void {
  const raw = Number(Array.isArray(value) ? value[0] : value);
  const picked = table[raw];
  if (picked !== undefined) apply(picked);
}

function onTimeSignature(value: number | number[]): void {
  const raw = Number(Array.isArray(value) ? value[0] : value);
  const picked = TIME_SIGNATURE_OPTIONS[raw]?.value;
  if (picked) emit("patch", { timeSignature: picked });
}

function onGrouping(value: number | number[]): void {
  const raw = Number(Array.isArray(value) ? value[0] : value);
  emit("patch", { grouping: groupingOptions.value[raw] ?? null });
}

const endingLabels = computed(() => [
  t("chordChart.context.endingNone"),
  "1",
  "2",
  "3",
]);
const jumpLabels = computed(() => [
  t("chordChart.context.jumpNone"),
  ...JUMPS.slice(1).map((j) => t(`chordChart.jumpCommand.${j as JumpCommand}`)),
]);
const playTimesLabels = computed(() => [
  t("chordChart.context.playTimesNone"),
  ...PLAY_TIMES.slice(1).map((n) => `${n}×`),
]);
const sectionLabels = computed(() => [
  t("chordChart.context.sectionNone"),
  ...SECTIONS.slice(1).map((s) =>
    t(`chordChart.sectionMark.${s as SectionMark}`),
  ),
]);
const barlineLabels = computed(() =>
  BARLINE_KINDS.map((k) => t(`chordChart.barlineKind.${k}`)),
);
const tsLabels = computed(() => TIME_SIGNATURE_OPTIONS.map((o) => o.label));
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 拍号 -->
    <div class="flex flex-col gap-1">
      <span class="text-xs font-medium text-base-content/70">
        {{ t("chordChart.context.timeSignature") }}
      </span>
      <RangeSlider
        :model-value="tsIndex"
        v-bind="optionsToRange(TIME_SIGNATURE_OPTIONS)"
        :tick-labels="tsLabels"
        :max-tick-labels="6"
        size="sm"
        :aria-label="t('chordChart.context.timeSignature')"
        @update:model-value="onTimeSignature"
      />
    </div>

    <!-- 拍分组（仅奇数拍） -->
    <div v-if="showGrouping" class="flex flex-col gap-1">
      <span class="text-xs font-medium text-base-content/70">
        {{ t("chordChart.context.grouping") }}
      </span>
      <RangeSlider
        :model-value="groupingIndex"
        :min="0"
        :max="groupingOptions.length - 1"
        :step="1"
        :tick-labels="[
          t('chordChart.context.groupingDefault'),
          groupingOptions[1]?.join('+') ?? '',
        ]"
        size="sm"
        :aria-label="t('chordChart.context.grouping')"
        @update:model-value="onGrouping"
      />
    </div>

    <!-- 小节线 -->
    <div class="flex flex-col gap-2">
      <span class="text-xs font-medium text-base-content/70">
        {{ t("chordChart.context.barline") }}
      </span>
      <label class="flex flex-col gap-1 text-[11px] text-base-content/60">
        {{ t("chordChart.context.barlineStart") }}
        <RangeSlider
          :model-value="barlineStartIndex"
          v-bind="
            optionsToRange(BARLINE_KINDS.map((k) => ({ value: k, label: k })))
          "
          :tick-labels="barlineLabels"
          :max-tick-labels="3"
          size="xs"
          @update:model-value="
            (v) =>
              onIndex(v, BARLINE_KINDS, (p) =>
                emit('patch', { barlineStart: p as BarlineKind }),
              )
          "
        />
      </label>
      <label class="flex flex-col gap-1 text-[11px] text-base-content/60">
        {{ t("chordChart.context.barlineEnd") }}
        <RangeSlider
          :model-value="barlineEndIndex"
          v-bind="
            optionsToRange(BARLINE_KINDS.map((k) => ({ value: k, label: k })))
          "
          :tick-labels="barlineLabels"
          :max-tick-labels="3"
          size="xs"
          @update:model-value="
            (v) =>
              onIndex(v, BARLINE_KINDS, (p) =>
                emit('patch', { barlineEnd: p as BarlineKind }),
              )
          "
        />
      </label>
    </div>

    <!-- 结束句 -->
    <div class="flex flex-col gap-1">
      <span class="text-xs font-medium text-base-content/70">
        {{ t("chordChart.context.ending") }}
      </span>
      <RangeSlider
        :model-value="endingIndex"
        v-bind="
          optionsToRange(
            ENDINGS.map((e) => ({ value: String(e), label: String(e) })),
          )
        "
        :tick-labels="endingLabels"
        size="sm"
        :aria-label="t('chordChart.context.ending')"
        @update:model-value="
          (v) =>
            onIndex(v, ENDINGS, (p) =>
              patchRepeat({ ending: p as EndingNumber | null }),
            )
        "
      />
    </div>

    <!-- 跳转 -->
    <div class="flex flex-col gap-1">
      <span class="text-xs font-medium text-base-content/70">
        {{ t("chordChart.context.jumps") }}
      </span>
      <RangeSlider
        :model-value="jumpIndex"
        v-bind="
          optionsToRange(
            JUMPS.map((j) => ({ value: String(j), label: String(j) })),
          )
        "
        :tick-labels="jumpLabels"
        :max-tick-labels="4"
        size="sm"
        :aria-label="t('chordChart.context.jumps')"
        @update:model-value="
          (v) =>
            onIndex(v, JUMPS, (p) =>
              patchRepeat({ jump: p as JumpCommand | null }),
            )
        "
      />
    </div>

    <!-- 记号（布尔组） -->
    <div class="flex flex-col gap-1.5">
      <span class="text-xs font-medium text-base-content/70">
        {{ t("chordChart.context.marks") }}
      </span>
      <div class="flex flex-wrap gap-1.5">
        <button
          type="button"
          class="btn btn-xs"
          :class="
            mark?.segno ? 'btn-primary' : 'btn-ghost border border-base-300'
          "
          @click="patchRepeat({ segno: !mark?.segno })"
        >
          <MusicGlyph name="segno" :size="10" />
          {{ t("chordChart.context.segno") }}
        </button>
        <button
          type="button"
          class="btn btn-xs"
          :class="
            mark?.coda ? 'btn-primary' : 'btn-ghost border border-base-300'
          "
          @click="patchRepeat({ coda: !mark?.coda })"
        >
          <MusicGlyph name="coda" :size="10" />
          {{ t("chordChart.context.coda") }}
        </button>
        <button
          type="button"
          class="btn btn-xs"
          :class="
            mark?.fermata ? 'btn-primary' : 'btn-ghost border border-base-300'
          "
          @click="patchRepeat({ fermata: !mark?.fermata })"
        >
          <MusicGlyph name="fermata" :size="11" />
          {{ t("chordChart.context.fermata") }}
        </button>
        <button
          type="button"
          class="btn btn-xs"
          :class="
            mark?.end ? 'btn-primary' : 'btn-ghost border border-base-300'
          "
          @click="patchRepeat({ end: !mark?.end })"
        >
          {{ t("chordChart.context.endMark") }}
        </button>
      </div>
    </div>

    <!-- 反复次数 -->
    <div class="flex flex-col gap-1">
      <span class="text-xs font-medium text-base-content/70">
        {{ t("chordChart.context.playTimes") }}
      </span>
      <RangeSlider
        :model-value="playTimesIndex"
        v-bind="
          optionsToRange(
            PLAY_TIMES.map((n) => ({ value: String(n), label: String(n) })),
          )
        "
        :tick-labels="playTimesLabels"
        :max-tick-labels="4"
        size="sm"
        :aria-label="t('chordChart.context.playTimes')"
        @update:model-value="
          (v) =>
            onIndex(v, PLAY_TIMES, (p) =>
              patchRepeat({ playTimes: p as number | null }),
            )
        "
      />
    </div>

    <!-- 段落记号 -->
    <div class="flex flex-col gap-1">
      <span class="text-xs font-medium text-base-content/70">
        {{ t("chordChart.context.section") }}
      </span>
      <RangeSlider
        :model-value="sectionIndex"
        v-bind="
          optionsToRange(
            SECTIONS.map((s) => ({ value: String(s), label: String(s) })),
          )
        "
        :tick-labels="sectionLabels"
        size="sm"
        :aria-label="t('chordChart.context.section')"
        @update:model-value="
          (v) =>
            onIndex(v, SECTIONS, (p) =>
              emit('section', p as SectionMark | null),
            )
        "
      />
    </div>

    <!-- 谱面文字 -->
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-base-content/70">
        {{ t("chordChart.context.text") }}
      </span>
      <input
        type="text"
        class="input input-sm w-full"
        :value="text"
        :placeholder="t('chordChart.context.textPlaceholder')"
        @change="(e) => emit('text', (e.target as HTMLInputElement).value)"
      />
    </label>

    <!-- 清空 -->
    <button
      type="button"
      class="btn btn-sm btn-outline btn-error"
      @click="emit('clear')"
    >
      {{ t("chordChart.context.clearMeasure") }}
    </button>
  </div>
</template>
