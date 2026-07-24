<template>
  <div class="flex items-center gap-2">
    <label class="flex-1 text-base-content/70">{{ label }}</label>
    <span class="text-base-content/90 w-12 text-right tabular-nums">{{ formattedValue }}</span>
    <input
      type="range"
      :value="value"
      :min="min"
      :max="max"
      :step="step"
      class="range range-xs w-40"
      @input="emit('change', Number(($event.target as HTMLInputElement).value))"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
}>();

const emit = defineEmits<{
  (e: "change", v: number): void;
}>();

const formattedValue = computed(() => {
  if (props.step >= 1) return props.value.toFixed(0);
  if (props.step >= 0.01) return props.value.toFixed(2);
  return props.value.toFixed(4);
});
</script>
