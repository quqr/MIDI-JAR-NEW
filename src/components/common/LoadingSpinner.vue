<template>
  <div
    class="flex flex-col items-center justify-center gap-3 py-12"
    role="status"
    :aria-label="label"
  >
    <span
      class="loading loading-spinner loading-lg text-primary"
      aria-hidden="true"
    ></span>
    <p v-if="label" class="text-sm text-base-content/60">{{ label }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label?: string;
}>();
</script>
