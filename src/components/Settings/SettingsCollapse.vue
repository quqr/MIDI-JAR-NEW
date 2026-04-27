<template>
  <details
    class="collapse collapse-arrow bg-base-200/50 border border-base-200 rounded-xl mb-3 transition-all duration-200"
    :open="defaultOpen"
  >
    <summary
      class="collapse-title text-base font-semibold flex items-center gap-2"
    >
      <span>{{ title }}</span>
      <span v-if="badge" class="badge badge-sm badge-primary ml-auto">{{
        badge
      }}</span>
    </summary>
    <div class="collapse-content pt-2 pb-1 transition-all duration-200">
      <slot></slot>
    </div>
  </details>
</template>

<script setup lang="ts">
interface Props {
  title: string;
  defaultOpen?: boolean;
  badge?: string;
}

withDefaults(defineProps<Props>(), {
  defaultOpen: true,
  badge: "",
});
</script>
