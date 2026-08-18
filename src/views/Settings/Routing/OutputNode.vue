<template>
  <div
    class="midi-output-node shadow-sm rounded-lg bg-base-100 border-2 border-secondary border-r-4"
  >
    <Handle type="target" :position="Position.Left" :class="handleClass" />
    <div class="flex items-center gap-2 px-4 py-3">
      <span class="text-sm font-semibold text-base-content truncate">{{
        displayName
      }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Handle, Position } from "@vue-flow/core";
import type { NodeProps } from "@vue-flow/core";

const props = defineProps<NodeProps>();

const displayName = computed(() => props.data.displayName || props.data.label);

const isInternal = computed(() => props.data.type === "internal");

const handleClass = computed(() => {
  if (isInternal.value) {
    return "handle-secondary";
  }
  return "handle-neutral";
});
</script>
