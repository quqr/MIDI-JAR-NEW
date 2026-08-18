<template>
  <fieldset class="fieldset w-full py-2.5">
    <legend v-if="label" class="fieldset-legend pb-1 text-sm">
      {{ label }}
    </legend>
    <select
      :id="selectId"
      :class="['select select-sm w-full rounded-lg', { 'select-error': error }]"
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
    <span v-if="error && errorMessage" class="label text-error">{{
      errorMessage
    }}</span>
    <span v-else-if="description" class="label text-base-content/70">{{
      description
    }}</span>
  </fieldset>
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
