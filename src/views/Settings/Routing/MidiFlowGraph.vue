<template>
  <div class="midi-flow-container h-full w-full">
    <VueFlow
      v-model:nodes="flowNodes"
      :edges="flowEdges"
      :connection-radius="40"
      :min-zoom="0.3"
      :max-zoom="2"
      :fit-view-on-init="true"
      :default-edge-options="{ type: 'wire' }"
      :connect-on-click="false"
      class="midi-flow"
      @connect="handleConnect"
      @edge-click="handleEdgeClick"
      @node-drag="onNodeDrag"
      @node-drag-stop="onDragStop"
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
        pattern-color="color-mix(in oklch, var(--color-base-content) 6%, transparent)"
      />

      <Controls position="top-right">
        <template #top-actions>
          <ControlButton
            title="Auto Layout"
            @click="handleAutoLayout"
          ></ControlButton>
        </template>
      </Controls>
    </VueFlow>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, watch, nextTick, onMounted } from "vue";
import { VueFlow, useVueFlow } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls, ControlButton } from "@vue-flow/controls";
import type {
  Connection,
  EdgeMouseEvent,
  Node,
  Edge,
  MarkerType,
} from "@vue-flow/core";

import InputNode from "./InputNode.vue";
import OutputNode from "./OutputNode.vue";
import Wire from "./Wire.vue";
import { mapDevicesToNodes, mapRoutesToEdges } from "./graphUtils";
import { useLayout } from "./useLayout";
import { useHelperLines } from "./useHelperLines";

import type {
  MidiInput,
  MidiOutput,
  MidiRoute,
  MidiWire,
} from "@/stores/midiRouting";
import { useMidiRoutingStore } from "@/stores/midiRouting";

const props = defineProps<{
  inputs: MidiInput[];
  outputs: MidiOutput[];
  routes: MidiRoute[];
  wires: MidiWire[];
  onAddRoute: (input: string, output: string, type: string) => void;
  onDeleteRoute: (route: MidiRoute) => void;
}>();

const routingStore = useMidiRoutingStore();
const { fitView, getViewport, setViewport } = useVueFlow();
const { layout } = useLayout();
const { onNodeDrag } = useHelperLines();

const flowNodes = ref<any[]>([]);
const flowEdges = shallowRef<Edge[]>([]);

function addFlowEdge(edge: Edge) {
  flowEdges.value = [...flowEdges.value, edge];
}

function removeFlowEdge(edgeId: string) {
  flowEdges.value = flowEdges.value.filter((e) => e.id !== edgeId);
}

const computedNodes = computed(() =>
  mapDevicesToNodes(props.inputs, props.outputs, routingStore.nodePositions),
);
const computedEdges = computed(() =>
  mapRoutesToEdges(props.routes, props.wires),
);

function persistViewport() {
  const vp = getViewport();
  routingStore.setViewport({ x: vp.x, y: vp.y, zoom: vp.zoom });
}

function handleAutoLayout() {
  const laidOutNodes = layout(computedNodes.value, computedEdges.value, "LR");
  flowNodes.value = laidOutNodes as Node[];
  for (const node of laidOutNodes) {
    routingStore.setNodePosition(node.id, { ...node.position });
  }
  nextTick(() => {
    fitView({ padding: 0.2, duration: 300 });
    nextTick(() => persistViewport());
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

  const route: MidiRoute = {
    input: inputName,
    output: outputName,
    type: type as "physical" | "internal",
    enabled: true,
  };
  const edgeId = `edge-${connection.source}-${targetId}`;

  const exists = flowEdges.value.some((e) => e.id === edgeId);
  if (!exists) {
    addFlowEdge({
      id: edgeId,
      source: connection.source ?? "",
      target: targetId,
      type: "wire",
      animated: true,
      markerEnd: {
        type: "arrowclosed" as MarkerType,
        color: "color-mix(in oklch, var(--color-base-content) 50%, transparent)",
      },
      style: { strokeWidth: 2.5 },
      data: { route },
    });
  }
}

function handleEdgeClick(edgeMouseEvent: EdgeMouseEvent) {
  const route = edgeMouseEvent.edge.data?.route as MidiRoute | undefined;
  if (route) {
    props.onDeleteRoute(route);
    removeFlowEdge(edgeMouseEvent.edge.id);
  }
}

function onDragStop({ nodes: draggedNodes }: { nodes: Node[] }) {
  for (const node of draggedNodes) {
    routingStore.setNodePosition(node.id, { ...node.position });
  }
  persistViewport();
}

watch(
  computedNodes,
  (newNodes) => {
    const existingMap = new Map(flowNodes.value.map((n) => [n.id, n]));
    flowNodes.value = newNodes.map((node) => {
      const existing = existingMap.get(node.id);
      if (existing) {
        return { ...node, position: existing.position };
      }
      return node;
    });
  },
  { immediate: true },
);

watch(
  computedEdges,
  (newEdges) => {
    const existingMap = new Map(flowEdges.value.map((e) => [e.id, e]));
    flowEdges.value = newEdges.map((edge) => {
      const existing = existingMap.get(edge.id);
      if (existing) {
        return {
          ...edge,
          animated: existing.animated || edge.animated,
          style: existing.style || edge.style,
        };
      }
      return edge;
    });
  },
  { immediate: true },
);

onMounted(() => {
  const hasSavedPositions = Object.keys(routingStore.nodePositions).length > 0;
  flowNodes.value = computedNodes.value as Node[];
  flowEdges.value = computedEdges.value;
  nextTick(() => {
    if (flowNodes.value.length > 0) {
      if (hasSavedPositions) {
        const savedViewport = routingStore.viewport;
        if (savedViewport) {
          setViewport(savedViewport, { duration: 300 });
        } else {
          fitView({ padding: 0.2, duration: 300 });
        }
      } else {
        handleAutoLayout();
      }
    }
  });
});
</script>

<style>
@import "@vue-flow/core/dist/style.css";
@import "@vue-flow/core/dist/theme-default.css";
@import "@vue-flow/controls/dist/style.css";
@import "@vue-flow/minimap/dist/style.css";

.vue-flow__handle {
  height: 24px;
  width: 8px;
  border-radius: 4px;
}
</style>
