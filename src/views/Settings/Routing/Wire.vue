<template>
  <g>
    <path
      fill="none"
      stroke="transparent"
      :stroke-width="20"
      :d="path[0]"
      style="cursor: pointer"
    />
    <path
      :class="['vue-flow__connection', { animated: props.animated }]"
      fill="none"
      stroke="currentColor"
      :stroke-width="currentStrokeWidth"
      :d="path[0]"
      style="pointer-events: none"
    />
    <g
      :transform="`translate(${targetX}, ${targetY})`"
      class="wire-delete-btn"
      style="cursor: pointer; pointer-events: all"
    >
      <circle
        r="12"
        fill="color-mix(in oklch, var(--color-error) 85%, transparent)"
        stroke="color-mix(in oklch, var(--color-error) 50%, transparent)"
        :stroke-width="1.5"
      />
      <text
        text-anchor="middle"
        dominant-baseline="central"
        fill="#ffffff"
        font-size="12"
        font-weight="bold"
        style="pointer-events: none; user-select: none"
        >✕</text
      >
    </g>
    <g
      :transform="`translate(${path[1]}, ${path[2]})`"
      class="wire-delete-btn"
      style="cursor: pointer; pointer-events: all"
    >
      <circle
        r="14"
        fill="color-mix(in oklch, var(--color-error) 85%, transparent)"
        stroke="color-mix(in oklch, var(--color-error) 50%, transparent)"
        :stroke-width="1.5"
      />
      <text
        text-anchor="middle"
        dominant-baseline="central"
        fill="#ffffff"
        font-size="14"
        font-weight="bold"
        style="pointer-events: none; user-select: none"
        >✕</text
      >
    </g>
  </g>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { getBezierPath } from "@vue-flow/core";
import type { EdgeProps } from "@vue-flow/core";

const props = defineProps<EdgeProps>();

const path = computed(() =>
  getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  }),
);

const currentStrokeWidth = computed(() => {
  const style = props.style as { strokeWidth?: number } | undefined;
  return style?.strokeWidth ?? 2.5;
});
</script>

<style scoped>
.wire-delete-btn:hover {
  opacity: 1;
  filter: drop-shadow(
    0 0 6px color-mix(in oklch, var(--color-error) 60%, transparent)
  );
}
.wire-delete-btn:hover circle {
  fill: var(--color-error);
}
</style>
