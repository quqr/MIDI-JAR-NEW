<template>
  <fieldset class="fieldset w-full py-2.5">
    <legend v-if="label" class="fieldset-legend pb-1 text-sm">
      {{ label }}
    </legend>
    <input
      :id="inputId"
      type="text"
      :class="['input input-sm w-full rounded-lg', { 'input-error': error }]"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :aria-label="label || placeholder"
      @input="
        $emit('update:modelValue', ($event.target as HTMLInputElement).value)
      "
    />
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
  modelValue: string;
  label?: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  errorMessage?: string;
}

const props = defineProps<Props>();

const inputId = `input-${id}`;

defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>
