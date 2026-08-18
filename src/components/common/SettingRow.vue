<template>
  <div class="flex items-center justify-between gap-4 py-2.5">
    <div class="flex-1 min-w-0">
      <div class="text-sm text-base-content">{{ title }}</div>
      <div v-if="description" class="text-xs text-base-content/70 mt-0.5">
        {{ description }}
      </div>
      <slot name="label" />
    </div>
    <div class="flex items-center gap-2 flex-shrink-0 ml-4">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 左侧标签 */
    title: string;
    /** 可选说明文字 */
    description?: string;
  }>(),
  { description: "" },
);
</script>
