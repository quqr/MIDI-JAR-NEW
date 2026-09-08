<template>
  <div class="flex flex-col gap-1">
    <SettingsRange
      v-for="param in params"
      :key="param.key"
      :model-value="display[param.key]"
      :label="t(`scoreScroll.display.${param.key}`)"
      :min="param.range.min"
      :max="param.range.max"
      :step="param.range.step"
      @update:model-value="(v) => store.updateDisplay(param.key, v)"
    />
    <SettingsToggle
      :model-value="display.showScanline"
      :label="t('scoreScroll.display.showScanline')"
      @update:model-value="(v) => store.updateDisplay('showScanline', v)"
    />
    <SettingsToggle
      :model-value="display.showFlyIn"
      :label="t('scoreScroll.display.showFlyIn')"
      @update:model-value="(v) => store.updateDisplay('showFlyIn', v)"
    />
    <SettingsToggle
      :model-value="display.showFlyOut"
      :label="t('scoreScroll.display.showFlyOut')"
      @update:model-value="(v) => store.updateDisplay('showFlyOut', v)"
    />
    <SettingsRange
      :model-value="display.flyOutDuration"
      :label="t('scoreScroll.display.flyOutDuration')"
      :min="EFFECT_PARAM_RANGE.min"
      :max="EFFECT_PARAM_RANGE.max"
      :step="DISPLAY_PARAM_RANGE.step"
      :disabled="!display.showFlyOut"
      @update:model-value="(v) => store.updateDisplay('flyOutDuration', v)"
    />
    <SettingsRange
      :model-value="display.flyOutDistance"
      :label="t('scoreScroll.display.flyOutDistance')"
      :min="EFFECT_PARAM_RANGE.min"
      :max="EFFECT_PARAM_RANGE.max"
      :step="DISPLAY_PARAM_RANGE.step"
      :disabled="!display.showFlyOut"
      @update:model-value="(v) => store.updateDisplay('flyOutDistance', v)"
    />
    <SettingsRange
      :model-value="display.flyOutScatter"
      :label="t('scoreScroll.display.flyOutScatter')"
      :min="EFFECT_PARAM_RANGE.min"
      :max="EFFECT_PARAM_RANGE.max"
      :step="DISPLAY_PARAM_RANGE.step"
      :disabled="!display.showFlyOut"
      @update:model-value="(v) => store.updateDisplay('flyOutScatter', v)"
    />
    <SettingsRange
      :model-value="display.flyOutDelay"
      :label="t('scoreScroll.display.flyOutDelay')"
      :min="EFFECT_PARAM_RANGE.min"
      :max="EFFECT_PARAM_RANGE.max"
      :step="DISPLAY_PARAM_RANGE.step"
      :disabled="!display.showFlyOut"
      @update:model-value="(v) => store.updateDisplay('flyOutDelay', v)"
    />
    <SettingsToggle
      :model-value="display.showGlow"
      :label="t('scoreScroll.display.showGlow')"
      @update:model-value="(v) => store.updateDisplay('showGlow', v)"
    />
    <SettingsColorPicker
      :model-value="display.tintColor"
      :label="t('scoreScroll.display.tintColor')"
      :disabled="!display.showGlow"
      @update:model-value="(v) => store.updateDisplay('tintColor', v)"
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
import { DISPLAY_PARAM_RANGE, EFFECT_PARAM_RANGE } from "../constants";
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

const params: {
  key: NumericDisplayKey;
  range: { min: number; max: number; step: number };
}[] = [
  // 百分比类：0-100
  { key: "scanlinePosition", range: DISPLAY_PARAM_RANGE },
  { key: "snapPosition", range: DISPLAY_PARAM_RANGE },
  // 世界坐标量纲类：0-200（200 档 = 原 100 档映射的翻倍上限）
  { key: "flyInDuration", range: EFFECT_PARAM_RANGE },
  { key: "flyInDistance", range: EFFECT_PARAM_RANGE },
  { key: "flyInScatter", range: EFFECT_PARAM_RANGE },
  { key: "flyInDelay", range: EFFECT_PARAM_RANGE },
  { key: "glowRange", range: EFFECT_PARAM_RANGE },
  // 染色强度是插值百分比，超过 100 无意义
  { key: "glowIntensity", range: DISPLAY_PARAM_RANGE },
];
</script>
