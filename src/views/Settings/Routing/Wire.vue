<template>
  <BaseEdge :id="id" :path="path" :marker-end="markerEnd" :style="edgeStyle" />

  <EdgeLabelRenderer>
    <div
      :style="deleteButtonStyle"
      class="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
    >
      <button
        class="btn btn-circle btn-xs btn-error shadow-md"
        @click="data?.onDelete?.(data.wire)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="3"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  </EdgeLabelRenderer>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from "@vue-flow/core";
import type { EdgeProps } from "@vue-flow/core";

const props = defineProps<EdgeProps>();

const [path] = getSmoothStepPath({
  sourceX: props.sourceX,
  sourceY: props.sourceY,
  targetX: props.targetX,
  targetY: props.targetY,
  sourcePosition: props.sourcePosition,
  targetPosition: props.targetPosition,
});

const markerEnd = "url(#vue-flow__arrowclosed)";

const edgeStyle = computed(() => ({
  stroke: props.data?.wire?.connected
    ? "hsl(var(--su))"
    : "hsl(var(--bc) / 0.4)",
  strokeWidth: 2,
  strokeDasharray: props.animated ? "8 4" : undefined,
  animation: props.animated ? "dashdraw 0.5s linear infinite" : undefined,
}));

const deleteButtonPosition = computed(() => {
  const svgPath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  svgPath.setAttribute("d", path);

  const totalLength = svgPath.getTotalLength();
  const point = svgPath.getPointAtLength(totalLength * 0.75);

  return { x: point.x, y: point.y };
});

const deleteButtonStyle = computed(() => ({
  transform: `translate(${deleteButtonPosition.value.x}px, ${deleteButtonPosition.value.y}px)`,
}));
</script>

<style scoped>
@keyframes dashdraw {
  from {
    stroke-dashoffset: 12;
  }
}
</style>
