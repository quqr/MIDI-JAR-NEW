<template>
  <header
    class="flex items-center justify-between gap-4 px-4 py-3 border-b border-base-300 bg-base-100"
  >
    <div class="min-w-0">
      <h2 class="text-lg font-bold text-base-content truncate">
        {{ title }}
      </h2>
      <p v-if="description" class="text-sm text-base-content/70 mt-0.5">
        {{ description }}
      </p>
      <slot />
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2 flex-shrink-0">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 标题 */
    title: string;
    /** 可选副标题/说明 */
    description?: string;
  }>(),
  { description: "" },
);
</script>
