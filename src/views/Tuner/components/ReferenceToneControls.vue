<script setup lang="ts">
/**
 * 基准音调节控件 — 滑块 + 数字输入 + 预设按钮组（432/440/442）+ 恢复默认
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { A4_MIN, A4_MAX, A4_DEFAULT, A4_PRESETS } from "../types";
import { clampA4 } from "../utils/pitchMath";

const props = defineProps<{
  a4Frequency: number;
}>();

const emit = defineEmits<{
  (e: "update:a4Frequency", value: number): void;
}>();

const { t } = useI18n();

function setA4(value: number): void {
  emit("update:a4Frequency", clampA4(value));
}

/** 数字输入框的受控显示值 */
const numberModel = computed({
  get: () => props.a4Frequency,
  set: (v: number) => setA4(v),
});

function isPreset(preset: number): boolean {
  return props.a4Frequency === preset;
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 滑块 + 数字输入 -->
    <div class="flex items-end gap-4">
      <fieldset class="fieldset grow">
        <legend class="fieldset-legend text-xs">
          {{ t("tuner.reference.title") }}
          <span class="badge badge-ghost badge-xs ml-1">
            {{ A4_MIN }}–{{ A4_MAX }} Hz
          </span>
        </legend>
        <div class="flex items-center gap-3 w-full">
          <input
            type="range"
            class="range range-primary range-sm grow"
            :min="A4_MIN"
            :max="A4_MAX"
            :step="1"
            :value="a4Frequency"
            :aria-label="t('tuner.reference.sliderAria')"
            @input="setA4(Number(($event.target as HTMLInputElement).value))"
          />
          <span class="font-mono text-sm tabular-nums w-16 text-right">
            {{ a4Frequency }} Hz
          </span>
        </div>
      </fieldset>

      <label>
        <input
          v-model.number="numberModel"
          type="number"
          class="input input-sm w-20 font-mono tabular-nums"
          :min="A4_MIN"
          :max="A4_MAX"
          :step="1"
          :aria-label="t('tuner.reference.inputAria')"
        />
      </label>
    </div>

    <!-- 预设 + 恢复默认 -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="join">
        <button
          v-for="preset in A4_PRESETS"
          :key="preset"
          type="button"
          class="btn btn-sm join-item font-mono"
          :class="isPreset(preset) ? 'btn-primary' : 'btn-outline'"
          @click="setA4(preset)"
        >
          {{ preset }} Hz
        </button>
      </div>

      <button
        type="button"
        class="btn btn-ghost btn-sm"
        :disabled="a4Frequency === A4_DEFAULT"
        @click="setA4(A4_DEFAULT)"
      >
        {{ t("tuner.reference.reset") }}
      </button>
    </div>
  </div>
</template>
