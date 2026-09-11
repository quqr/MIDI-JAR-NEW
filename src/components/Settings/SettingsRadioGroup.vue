<template>
  <fieldset class="fieldset w-full py-2.5 by-radio">
    <legend v-if="label" class="fieldset-legend pb-1 text-sm">
      {{ label }}
    </legend>
    <RangeSlider
      v-if="options.length > 0"
      :model-value="selectedIndex"
      :min="0"
      :max="options.length - 1"
      :step="1"
      :tick-labels="optionLabels"
      no-fill
      :disabled="disabled"
      :aria-label="label || t('common.selectAnOption')"
      @update:model-value="onSlide"
    />
    <span v-if="selectedHint" class="label text-base-content/70">{{
      selectedHint
    }}</span>
    <span v-else-if="description" class="label text-base-content/70">{{
      description
    }}</span>
  </fieldset>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import RangeSlider from "@/components/common/RangeSlider.vue";
import type { RangeSliderValue } from "@/components/common/rangeSlider";
import { optionIndexOf } from "@/components/common/rangeSlider";

const { t } = useI18n();

interface Props {
  modelValue: string | number;
  label?: string;
  description?: string;
  options: { value: string | number; label: string; hint?: string }[];
  disabled?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "update:modelValue": [value: string | number];
}>();

// 选项 → 索引滑条映射：组件值域 0..n-1，领域值不进入滑条
const selectedIndex = computed(() =>
  Math.max(0, optionIndexOf(props.options, props.modelValue)),
);
const optionLabels = computed(() => props.options.map((o) => o.label));
// radio 选项的 hint 无法挂在刻度上，改为显示当前选中项的 hint
const selectedHint = computed(() => props.options[selectedIndex.value]?.hint);

function onSlide(index: RangeSliderValue) {
  const option = props.options[Number(index)];
  if (option) emit("update:modelValue", option.value);
}
</script>
