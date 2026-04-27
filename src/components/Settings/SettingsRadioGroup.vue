<template>
  <div class="form-control w-full py-2.5">
    <label v-if="label" class="label pb-1">
      <span class="label-text text-sm">{{ label }}</span>
    </label>
    <div class="space-y-2">
      <label
        v-for="option in options"
        :key="String(option.value)"
        class="flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5 hover:bg-base-200/50 transition-colors"
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
        <span v-if="option.hint" class="text-xs text-base-content/80">
          {{ option.hint }}
        </span>
      </label>
    </div>
    <label v-if="description" class="label">
      <span class="label-text-alt text-base-content/80">{{ description }}</span>
    </label>
  </div>
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
