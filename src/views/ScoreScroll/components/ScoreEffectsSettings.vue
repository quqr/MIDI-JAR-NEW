<template>
  <div class="flex flex-col gap-1">
    <SettingsRange
      v-for="param in params"
      :key="param.key"
      :model-value="effects[param.key]"
      :label="t(`scoreScroll.effects.${param.key}`)"
      :min="EFFECT_PARAM_RANGE.min"
      :max="EFFECT_PARAM_RANGE.max"
      :step="EFFECT_PARAM_RANGE.step"
      @update:model-value="(v) => store.updateEffects(param.key, v)"
    />
  </div>
</template>

<script setup lang="ts">
/** 特效参数面板：原站 8 个特效参数 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import SettingsRange from "@/components/Settings/SettingsRange.vue";
import { useScoreScrollStore } from "../stores/ScoreScroll";
import { EFFECT_PARAM_RANGE } from "../constants";
import type { ScoreEffectSettings } from "../types";

const { t } = useI18n();
const store = useScoreScrollStore();

const effects = computed<ScoreEffectSettings>(() => store.settings.effects);

const params: { key: keyof ScoreEffectSettings }[] = [
  { key: "driftInDistance" },
  { key: "scatterRange" },
  { key: "fragmentDelay" },
  { key: "highlightRange" },
  { key: "highlightIntensity" },
  { key: "highlightSize" },
  { key: "scanlinePosition" },
  { key: "snapPosition" },
];
</script>
