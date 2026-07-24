<template>
  <div class="flex items-center gap-2">
    <label class="flex-1 text-base-content/70">{{ label }}</label>
    <input
      type="checkbox"
      :checked="value"
      class="toggle toggle-xs toggle-primary"
      @change="emit('change', ($event.target as HTMLInputElement).checked)"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  value: boolean;
}>();

const emit = defineEmits<{
  (e: "change", v: boolean): void;
}>();
</script>
