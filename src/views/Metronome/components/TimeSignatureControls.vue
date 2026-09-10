<script setup lang="ts">
/**
 * 拍号控制：分子（1-12）+ 分母（2/4/8/16）。
 *
 * 分母按音乐习惯的音符时值理解——2=二分音符、4=四分、8=八分、16=十六分，
 * 预览区用 **Bravura 音乐字体**的 SMuFL 字形直接渲染对应音符，一眼即乐理语义。
 * 离散选项统一走 RangeSlider（ADR 0014）：刻度标签可直接点击跳转。
 */
import { computed } from "vue";
import RangeSlider from "@/components/common/RangeSlider.vue";
import type { RangeSliderValue } from "@/components/common/rangeSlider";
import { DENOMINATORS, NUMERATOR_MAX, NUMERATOR_MIN } from "../types";

const props = defineProps<{
  numerator: number;
  denominator: 2 | 4 | 8 | 16;
}>();

const emit = defineEmits<{
  "update:numerator": [value: number];
  "update:denominator": [value: 2 | 4 | 8 | 16];
}>();

/** 分母 → SMuFL 音符字形（Bravura 码位）：二分 E1D3 / 四分 E1D5 / 八分 E1D7 / 十六分 E1D9 */
const DENOMINATOR_GLYPH: Record<number, string> = {
  2: "\u{E1D3}",
  4: "\u{E1D5}",
  8: "\u{E1D7}",
  16: "\u{E1D9}",
};

const numeratorLabels = Array.from(
  { length: NUMERATOR_MAX - NUMERATOR_MIN + 1 },
  (_, i) => String(i + NUMERATOR_MIN),
);

const denominatorIndex = computed(() => {
  const index = DENOMINATORS.indexOf(props.denominator);
  return index < 0 ? 1 : index;
});

const denominatorGlyph = computed(
  () => DENOMINATOR_GLYPH[props.denominator] ?? "\u{E1D5}",
);

function onNumerator(value: RangeSliderValue): void {
  emit("update:numerator", Number(Array.isArray(value) ? value[0] : value));
}

function onDenominator(value: RangeSliderValue): void {
  const raw = Number(Array.isArray(value) ? value[0] : value);
  emit("update:denominator", DENOMINATORS[raw] ?? 4);
}
</script>

<template>
  <div class="flex items-stretch gap-4 sm:gap-5">
    <!-- 拍号预览：数字 + 音符时值字形 -->
    <div
      class="shrink-0 flex items-center gap-3 rounded-xl border border-base-content/10 bg-base-100 px-4"
    >
      <div class="flex flex-col items-center">
        <span class="text-3xl font-bold tabular-nums leading-none">
          {{ numerator }}
        </span>
        <span class="my-1.5 h-px w-7 bg-base-content/25" aria-hidden="true" />
        <span
          class="music-glyph flex h-8 items-center text-[30px] text-primary"
        >
          {{ denominatorGlyph }}
        </span>
      </div>
      <div
        class="hidden sm:flex flex-col gap-0.5 text-[11px] leading-tight text-base-content/40"
      >
        <span>{{ $t("metronome.signature.previewBeats") }}</span>
        <span>{{ $t("metronome.signature.previewUnit") }}</span>
      </div>
    </div>

    <div class="flex-1 min-w-0 flex flex-col justify-center gap-4">
      <div class="flex flex-col gap-1">
        <span class="text-xs text-base-content/60">
          {{ $t("metronome.signature.numerator") }}
        </span>
        <RangeSlider
          :model-value="numerator"
          :min="NUMERATOR_MIN"
          :max="NUMERATOR_MAX"
          :step="1"
          :tick-labels="numeratorLabels"
          :aria-label="$t('metronome.signature.numeratorAria')"
          @update:model-value="onNumerator"
        />
      </div>

      <div class="flex flex-col gap-1">
        <span class="text-xs text-base-content/60">
          {{ $t("metronome.signature.denominator") }}
        </span>
        <RangeSlider
          :model-value="denominatorIndex"
          :min="0"
          :max="DENOMINATORS.length - 1"
          :step="1"
          :tick-labels="DENOMINATORS.map((d) => String(d))"
          :aria-label="$t('metronome.signature.denominatorAria')"
          @update:model-value="onDenominator"
        />
      </div>
    </div>
  </div>
</template>
