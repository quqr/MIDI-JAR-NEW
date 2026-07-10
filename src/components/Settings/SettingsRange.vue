<template>
  <div class="py-2.5">
    <div v-if="label" :id="rangeLabelId" class="text-sm font-medium mb-1">
      {{ label }}
    </div>
    <div v-if="description" class="text-xs text-base-content/60 mb-2">
      {{ description }}
    </div>
    <div class="flex items-center gap-2">
      <input
        type="range"
        class="range range-xs w-full"
        :min="min"
        :max="max"
        :step="step"
        :value="modelValue"
        :disabled="disabled"
        :aria-labelledby="rangeLabelId"
        @input="
          $emit(
            'update:modelValue',
            Number(($event.target as HTMLInputElement).value),
          )
        "
      />
      <span class="badge badge-sm badge-ghost">{{ displayValue }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useId, computed } from "vue";

const id = useId();
const rangeLabelId = `range-label-${id}`;

interface Props {
  modelValue: number;
  label?: string;
  description?: string;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
}

const props = defineProps<Props>();

defineEmits<{
  "update:modelValue": [value: number];
}>();

// 由 step 推导小数位，消除 3.0000000001 类浮点误差
const displayValue = computed(() => {
  const { step, modelValue } = props;
  if (modelValue == null) return "—";
  const precision = step >= 1 ? 0 : Math.max(0, Math.ceil(-Math.log10(step)));
  return modelValue.toFixed(precision);
});
</script>
