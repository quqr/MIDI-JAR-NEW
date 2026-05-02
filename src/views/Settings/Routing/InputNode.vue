<template>
  <div
    class="midi-input-node bg-base-100 border-2 border-primary/30 shadow-sm rounded-lg overflow-visible"
    :class="{ 'border-primary shadow-primary/20': isActive }"
  >
    <div class="px-4 py-3">
      <span class="text-sm font-semibold text-base-content truncate">{{
        data.label
      }}</span>
    </div>
    <Handle type="source" :position="Position.Right" class="handle-source" />
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import type { NodeProps } from "@vue-flow/core";
import { useMidiActivity } from "@/composables/useMidiActivity";

const props = defineProps<NodeProps>();

const { isActive } = useMidiActivity(props.data.label as string);
</script>

<style scoped>
.midi-input-node {
  min-width: 160px;
  transition: all 0.2s ease;
  position: relative;
}

.midi-input-node:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.handle-source {
  width: 14px !important;
  height: 14px !important;
  background: hsl(var(--color-primary)) !important;
  border: 3px solid hsl(var(--color-base-100)) !important;
  right: -8px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  z-index: 10 !important;
  transition: all 0.15s ease;
}

.handle-source:hover {
  width: 18px !important;
  height: 18px !important;
  right: -10px !important;
  box-shadow: 0 0 8px hsl(var(--color-primary) / 0.6);
}
</style>
