<template>
  <div
    class="flex flex-col items-center justify-center gap-4 py-12 px-6 text-center"
    role="status"
  >
    <div class="opacity-40">
      <slot name="icon">
        <Icon v-if="icon" :name="icon" :size="48" aria-hidden="true" />
      </slot>
    </div>
    <div class="space-y-1">
      <p class="text-lg font-medium text-base-content/70">{{ title }}</p>
      <p v-if="description" class="text-sm text-base-content/50 max-w-sm">
        {{ description }}
      </p>
    </div>
    <slot name="action" />
  </div>
</template>

<script setup lang="ts">
import Icon from "@/components/Icon/Icon.vue";
import type { IconName } from "@/components/Icon/types";

defineProps<{
  title: string;
  description?: string;
  icon?: IconName;
}>();
</script>
