<template>
  <details
    class="collapse shadow-xl collapse-arrow bg-base-200/50 border border-base-200 rounded-xl mb-3"
    :open="defaultOpen"
  >
    <!-- <input type="checkbox" class="peer" /> -->
    <summary
      class="collapse-title text-base font-semibold flex items-center gap-2"
    >
      <span>{{ title }}</span>
    </summary>
    <div class="collapse-content pt-2 pb-1">
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
