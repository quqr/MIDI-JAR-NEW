<template>
  <button
    class="btn btn-sm btn-outline btn-circle tooltip tooltip-bottom"
    :data-tip="ariaLabel"
    :aria-label="ariaLabel"
    @click="$emit('click')"
  >
    <Icon name="settings" size="16" />
  </button>
</template>

<script setup lang="ts">
import Icon from "@/components/Icon/Icon.vue";

defineProps<{
  ariaLabel?: string;
}>();

defineEmits<{
  (e: "click"): void;
}>();
</script>
