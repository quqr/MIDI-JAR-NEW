<template>
  <div
    class="midi-output-node shadow-sm rounded-lg overflow-visible"
    :class="nodeClasses"
  >
    <Handle type="target" :position="Position.Left" :class="handleClass" />
    <div class="px-4 py-3">
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

const nodeClasses = computed(() => {
  if (isInternal.value) {
    return "bg-secondary/10 border-2 border-secondary/40";
  }
  return "bg-base-100 border-2 border-neutral/30";
});

const handleClass = computed(() => {
  if (isInternal.value) {
    return "handle-secondary";
  }
  return "handle-neutral";
});
</script>

<style scoped>
.midi-output-node {
  min-width: 160px;
  transition: all 0.2s ease;
  position: relative;
}

.midi-output-node:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

:deep(.vue-flow__handle) {
  width: 14px !important;
  height: 14px !important;
  border: 3px solid hsl(var(--color-base-100)) !important;
  left: -8px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  z-index: 10 !important;
  transition: all 0.15s ease;
}

:deep(.vue-flow__handle:hover) {
  width: 18px !important;
  height: 18px !important;
  left: -10px !important;
}

.handle-secondary {
  background: hsl(var(--color-secondary)) !important;
}

.handle-secondary:hover {
  box-shadow: 0 0 8px hsl(var(--color-secondary) / 0.6) !important;
}

.handle-neutral {
  background: hsl(var(--color-neutral)) !important;
}

.handle-neutral:hover {
  box-shadow: 0 0 8px hsl(var(--color-neutral) / 0.6) !important;
}
</style>
