<template>
  <div class="form-control w-full py-2.5">
    <label v-if="label" :for="inputId" class="label pb-1">
      <span class="label-text text-sm">{{ label }}</span>
    </label>
    <input
      :id="inputId"
      type="text"
      :class="[
        'input input-bordered input-sm w-full rounded-lg',
        { 'input-error': error },
      ]"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :aria-label="label || placeholder"
      @input="
        $emit('update:modelValue', ($event.target as HTMLInputElement).value)
      "
    />
    <label v-if="error && errorMessage" class="label">
      <span class="label-text-alt text-error">{{ errorMessage }}</span>
    </label>
    <label v-else-if="description" class="label">
      <span class="label-text-alt text-base-content/80">{{ description }}</span>
    </label>
  </div>
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
