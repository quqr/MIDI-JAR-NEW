<template>
  <div class="flex flex-col gap-1">
    <SettingsRange
      v-for="param in params"
      :key="param.key"
      :model-value="display[param.key]"
      :label="t(`scoreScroll.display.${param.key}`)"
      :min="DISPLAY_PARAM_RANGE.min"
      :max="DISPLAY_PARAM_RANGE.max"
      :step="DISPLAY_PARAM_RANGE.step"
      @update:model-value="(v) => store.updateDisplay(param.key, v)"
    />
    <SettingsToggle
      :model-value="display.showScanline"
      :label="t('scoreScroll.display.showScanline')"
      @update:model-value="(v) => store.updateDisplay('showScanline', v)"
    />
    <SettingsToggle
      :model-value="display.showReveal"
      :label="t('scoreScroll.display.showReveal')"
      @update:model-value="(v) => store.updateDisplay('showReveal', v)"
    />
    <SettingsToggle
      :model-value="display.showFlyIn"
      :label="t('scoreScroll.display.showFlyIn')"
      @update:model-value="(v) => store.updateDisplay('showFlyIn', v)"
    />
    <SettingsToggle
      :model-value="display.showGlow"
      :label="t('scoreScroll.display.showGlow')"
      @update:model-value="(v) => store.updateDisplay('showGlow', v)"
    />
    <SettingsColorPicker
      :model-value="display.glowColor"
      :label="t('scoreScroll.display.glowColor')"
      :disabled="!display.showGlow"
      @update:model-value="(v) => store.updateDisplay('glowColor', v)"
    />
  </div>
</template>

<script setup lang="ts">
/** 显示设置面板：扫描线/渐显、飞入、符头高光的参数与开关 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import SettingsRange from "@/components/Settings/SettingsRange.vue";
import SettingsToggle from "@/components/Settings/SettingsToggle.vue";
import SettingsColorPicker from "@/components/Settings/SettingsColorPicker.vue";
import { useScoreScrollStore } from "../stores/ScoreScroll";
import { DISPLAY_PARAM_RANGE } from "../constants";
import type { ScoreDisplaySettings } from "../types";

const { t } = useI18n();
const store = useScoreScrollStore();
const display = computed<ScoreDisplaySettings>(() => store.settings.display);

/** 0-100 数值型显示参数的键 */
type NumericDisplayKey = {
  [K in keyof ScoreDisplaySettings]: ScoreDisplaySettings[K] extends number
    ? K
    : never;
}[keyof ScoreDisplaySettings];

const params: { key: NumericDisplayKey }[] = [
  { key: "scanlinePosition" },
  { key: "snapPosition" },
  { key: "flyInDuration" },
  { key: "flyInDistance" },
  { key: "flyInScatter" },
  { key: "flyInDelay" },
  { key: "glowRange" },
  { key: "glowIntensity" },
  { key: "glowSize" },
];
</script>
