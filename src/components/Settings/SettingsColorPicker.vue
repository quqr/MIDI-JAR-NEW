<template>
  <div class="flex items-center justify-between py-2.5">
    <div class="flex-1 min-w-0">
      <span v-if="label" :id="colorLabelId" class="text-sm">{{ label }}</span>
      <span
        v-if="description"
        class="text-xs text-base-content/70 block mt-0.5"
      >
        {{ description }}
      </span>
    </div>
    <input
      type="color"
      class="w-10 h-8 rounded cursor-pointer border border-base-300 flex-shrink-0 ml-4 transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-base-100 disabled:opacity-50 disabled:cursor-not-allowed"
      :value="modelValue"
      :disabled="disabled"
      :aria-labelledby="colorLabelId"
      @input="
        $emit('update:modelValue', ($event.target as HTMLInputElement).value)
      "
    />
  </div>
</template>

<script setup lang="ts">
import { useId } from "vue";

const id = useId();
const colorLabelId = `color-label-${id}`;

interface Props {
  modelValue: string | null;
  label?: string;
  description?: string;
  disabled?: boolean;
}

defineProps<Props>();
defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>
