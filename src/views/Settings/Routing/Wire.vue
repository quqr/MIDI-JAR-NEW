<template>
  <g
    class="wire-edge"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <BaseEdge
      :id="id"
      :path="path"
      :marker-end="markerEnd"
      :style="edgeStyle"
    />

    <path
      :d="path"
      fill="none"
      stroke="transparent"
      stroke-width="20"
      class="wire-hitbox"
    />

    <EdgeLabelRenderer>
      <div
        v-if="hovered"
        :style="deleteButtonStyle"
        class="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
      >
        <button
          class="btn btn-circle btn-xs btn-error shadow-md wire-delete-btn"
          @click.stop="data?.onDelete?.(data.wire)"
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
  </g>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@vue-flow/core";
import type { EdgeProps } from "@vue-flow/core";

const props = defineProps<EdgeProps>();
const hovered = ref(false);

const [path, labelX, labelY] = getBezierPath({
  sourceX: props.sourceX,
  sourceY: props.sourceY,
  targetX: props.targetX,
  targetY: props.targetY,
  sourcePosition: props.sourcePosition,
  targetPosition: props.targetPosition,
  curvature: 0.4,
});

const markerEnd = computed(() => {
  return `url(#vueflow-arrow)`;
});

const edgeStyle = computed(() => {
  const connected = props.data?.wire?.connected;
  return {
    stroke: connected
      ? "hsl(var(--color-base-content) / 0.7)"
      : "hsl(var(--color-base-content) / 0.2)",
    strokeWidth: connected ? 4 : 2.5,
    transition: "stroke 0.2s, stroke-width 0.2s",
  };
});

const deleteButtonStyle = computed(() => ({
  transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
}));
</script>

<style scoped>
.wire-hitbox {
  cursor: pointer;
}

.wire-delete-btn {
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
