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
    <circle
      :cx="targetX"
      :cy="targetY"
      fill="#fff"
      :r="4"
      stroke="currentColor"
      :stroke-width="1.5"
      style="pointer-events: none"
    />
    <g
      :transform="`translate(${path[1]}, ${path[2]})`"
      style="cursor: pointer; pointer-events: all"
    >
      <circle r="12" fill="hsl(var(--color-error) / 0.15)" stroke="hsl(var(--color-error) / 0.5)" :stroke-width="1" />
      <text
        text-anchor="middle"
        dominant-baseline="central"
        fill="hsl(var(--color-error))"
        font-size="11"
        font-weight="bold"
        style="pointer-events: none; user-select: none"
      >✕</text>
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
