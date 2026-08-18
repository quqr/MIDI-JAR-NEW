<template>
  <fieldset class="fieldset w-full py-2.5">
    <legend v-if="label" class="fieldset-legend pb-1 text-sm">
      {{ label }}
    </legend>
    <div class="space-y-2">
      <label
        v-for="option in options"
        :key="String(option.value)"
        class="flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5 hover:bg-base-200"
      >
        <input
          type="radio"
          :name="`radio-${label || 'group'}`"
          class="radio"
          :value="option.value"
          :checked="modelValue === option.value"
          @change="$emit('update:modelValue', option.value)"
        />
        <span class="text-sm">{{ option.label }}</span>
        <span v-if="option.hint" class="text-xs text-base-content/70">
          {{ option.hint }}
        </span>
      </label>
    </div>
    <span v-if="description" class="label text-base-content/70">{{
      description
    }}</span>
  </fieldset>
</template>

<script setup lang="ts">
interface Props {
  modelValue: string | number;
  label?: string;
  description?: string;
  options: { value: string | number; label: string; hint?: string }[];
}

defineProps<Props>();
defineEmits<{
  "update:modelValue": [value: string | number];
}>();
</script>
