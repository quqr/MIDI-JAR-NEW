<script setup lang="ts">
/**
 * 音高信息显示区 — daisyUI stats 布局（音名 / 频率 / 音分）
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { isInTune } from "../utils/pitchMath";

const props = defineProps<{
  noteName: string | null;
  freq: number | null;
  cents: number | null;
  active: boolean;
}>();

const { t } = useI18n();

const freqText = computed(() =>
  props.freq === null ? "—" : `${props.freq.toFixed(1)} Hz`,
);

const centsText = computed(() => {
  if (props.cents === null) return "—";
  const rounded = Math.round(props.cents);
  return rounded > 0 ? `+${rounded} ¢` : `${rounded} ¢`;
});

/** 音分 badge 颜色：准 → success，接近 → warning，其余 → neutral */
const centsBadgeClass = computed(() => {
  if (props.cents === null) return "badge-ghost";
  const quality = isInTune(props.cents);
  if (quality.exact) return "badge-success";
  if (quality.near) return "badge-warning";
  return "badge-neutral";
});
</script>

<template>
  <div class="stats stats-vertical sm:stats-horizontal w-full bg-base-200/40">
    <div class="stat">
      <div class="stat-title">{{ t("tuner.info.note") }}</div>
      <div class="stat-value text-3xl sm:text-4xl">
        {{ active && noteName ? noteName : "—" }}
      </div>
      <div class="stat-desc">{{ t("tuner.info.noteDesc") }}</div>
    </div>

    <div class="stat">
      <div class="stat-title">{{ t("tuner.info.frequency") }}</div>
      <div class="stat-value text-3xl sm:text-4xl font-mono">
        {{ active && freq !== null ? freqText : "—" }}
      </div>
      <div class="stat-desc">{{ t("tuner.info.frequencyDesc") }}</div>
    </div>

    <div class="stat">
      <div class="stat-title">{{ t("tuner.info.cents") }}</div>
      <div class="stat-value">
        <span
          class="badge badge-lg font-mono"
          :class="active ? centsBadgeClass : 'badge-ghost'"
        >
          {{ active && cents !== null ? centsText : "—" }}
        </span>
      </div>
      <div class="stat-desc">{{ t("tuner.info.centsDesc") }}</div>
    </div>
  </div>
</template>
