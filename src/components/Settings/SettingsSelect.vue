<template>
  <div class="form-control w-full py-2.5">
    <label v-if="label" :for="selectId" class="label pb-1">
      <span class="label-text text-sm">{{ label }}</span>
    </label>
    <select
      :id="selectId"
      :class="[
        'select select-bordered select-sm w-full rounded-lg',
        { 'select-error': error },
      ]"
      :value="modelValue"
      :disabled="disabled"
      :aria-label="label || 'Select an option'"
      @change="
        $emit('update:modelValue', ($event.target as HTMLSelectElement).value)
      "
    >
      <option
        v-for="option in options"
        :key="String(option.value)"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
    <label v-if="error && errorMessage" class="label">
      <span class="label-text-alt text-error">{{ errorMessage }}</span>
    </label>
    <label v-else-if="description" class="label">
      <span class="label-text-alt text-base-content/70">{{ description }}</span>
    </label>
  </div>
</template>

<script setup lang="ts">
import { useId } from "vue";

const id = useId();

interface Props {
  modelValue: string | number;
  label?: string;
  description?: string;
  options: { value: string | number; label: string }[];
  disabled?: boolean;
  error?: boolean;
  errorMessage?: string;
}

const selectId = `select-${id}`;

defineProps<Props>();

defineEmits<{
  "update:modelValue": [value: string | number];
}>();
</script>
