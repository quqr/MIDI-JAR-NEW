<template>
  <div class="midi-flow-container">
    <VueFlow
      :connection-radius="40"
      :min-zoom="0.3"
      :max-zoom="2"
      :fit-view-on-init="true"
      :default-edge-options="{ type: 'wire' }"
      :connect-on-click="false"
      class="midi-flow"
      @connect="handleConnect"
      @node-drag="onNodeDrag"
      @node-drag-stop="onNodeDragStop"
    >
      <template #node-input="inputNodeProps">
        <InputNode v-bind="inputNodeProps" />
      </template>

      <template #node-internal-output="outputNodeProps">
        <OutputNode v-bind="outputNodeProps" />
      </template>

      <template #node-physical-output="outputNodeProps">
        <OutputNode v-bind="outputNodeProps" />
      </template>

      <template #edge-wire="wireEdgeProps">
        <Wire v-bind="wireEdgeProps" />
      </template>

      <Background
        :gap="20"
        pattern-color="hsl(var(--color-base-content) / 0.06)"
      />

      <Controls position="top-right">
        <template #top-actions>
          <ControlButton title="Auto Layout" @click="handleAutoLayout">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class="w-5 h-5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zm0 9.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z"
              />
            </svg>
          </ControlButton>
        </template>
      </Controls>

      <MiniMap
        :node-color="miniMapNodeColor"
        :mask-color="'hsl(var(--color-base-content) / 0.08)'"
      />

      <template v-if="helperLines.length > 0">
        <svg class="helper-lines">
          <line
            v-for="(line, index) in helperLines"
            :key="index"
            :x1="line.type === 'vertical' ? line.position : 0"
            :y1="line.type === 'horizontal' ? line.position : 0"
            :x2="line.type === 'vertical' ? line.position : width"
            :y2="line.type === 'horizontal' ? line.position : height"
            :stroke="'hsl(var(--color-error))'"
            :stroke-width="1"
            :stroke-dasharray="'4 4'"
          />
        </svg>
      </template>
    </VueFlow>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from "vue";
import { VueFlow, useVueFlow } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls, ControlButton } from "@vue-flow/controls";
import { MiniMap } from "@vue-flow/minimap";
import type { Connection } from "@vue-flow/core";

import InputNode from "./InputNode.vue";
import OutputNode from "./OutputNode.vue";
import Wire from "./Wire.vue";
import { mapDevicesToNodes, mapWiresToEdges } from "./graphUtils";
import { useLayout } from "./useLayout";
import { useHelperLines } from "./useHelperLines";

import type { MidiInput, MidiOutput, MidiWire } from "@/types/midi";

const props = defineProps<{
  inputs: MidiInput[];
  outputs: MidiOutput[];
  wires: MidiWire[];
  onAddRoute: (input: string, output: string, type: string) => void;
  onDeleteRoute: (wire: MidiWire) => void;
}>();

const { fitView, setNodes, setEdges } = useVueFlow();
const { layout } = useLayout();
const { helperLines, onNodeDrag, onNodeDragStop } = useHelperLines();

const width = ref(2000);
const height = ref(2000);

const computedNodes = computed(() =>
  mapDevicesToNodes(props.inputs, props.outputs),
);
const computedEdges = computed(() =>
  mapWiresToEdges(props.wires, props.onDeleteRoute),
);

function handleAutoLayout() {
  const laidOutNodes = layout(computedNodes.value, computedEdges.value, "LR");
  setNodes(laidOutNodes);
  nextTick(() => {
    fitView({ padding: 0.2, duration: 300 });
  });
}

function handleConnect(connection: Connection) {
  const inputName = connection.source?.replace("input-", "") ?? "";
  const targetId = connection.target ?? "";

  let outputName: string;
  let type: string;

  if (targetId === "output-internal") {
    outputName = "internal";
    type = "internal";
  } else {
    outputName = targetId.replace("output-", "");
    type = "physical";
  }

  props.onAddRoute(inputName, outputName, type);
}

function miniMapNodeColor(node: { data?: { type?: string } }) {
  if (node.data?.type === "internal") return "hsl(var(--color-secondary))";
  if (node.data?.type === "physical") return "hsl(var(--color-neutral))";
  return "hsl(var(--color-primary))";
}

watch(
  [computedNodes, computedEdges],
  ([newNodes, newEdges]) => {
    setNodes(newNodes);
    setEdges(newEdges);
    nextTick(() => {
      handleAutoLayout();
    });
  },
  { deep: true },
);

onMounted(() => {
  setNodes(computedNodes.value);
  setEdges(computedEdges.value);
  nextTick(() => {
    if (computedNodes.value.length > 0) {
      handleAutoLayout();
    }
  });
});
</script>

<style scoped>
.midi-flow-container {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid hsl(var(--color-base-content) / 0.1);
}

.midi-flow {
  background: hsl(var(--color-base-200));
}

.helper-lines {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}
</style>

<style>
@import "@vue-flow/core/dist/style.css";
@import "@vue-flow/core/dist/theme-default.css";
@import "@vue-flow/controls/dist/style.css";
@import "@vue-flow/minimap/dist/style.css";

.vue-flow .vue-flow__handle {
  width: 14px;
  height: 14px;
  border: 3px solid hsl(var(--color-base-100));
  z-index: 10;
  transition: all 0.15s ease;
}

.vue-flow .vue-flow__handle:hover {
  width: 18px;
  height: 18px;
  box-shadow: 0 0 8px hsl(var(--color-primary) / 0.6);
}

.vue-flow .vue-flow__node {
  overflow: visible !important;
}
</style>
