<template>
  <div
    ref="graphContainer"
    class="w-full rounded-lg overflow-hidden"
    style="min-height: 500px; height: 70vh"
  >
    <VueFlow
      :nodes="nodes"
      :edges="edges"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      :fit-view="true"
      :pan-on-scroll="true"
      :zoom-on-scroll="true"
      :pan-on-drag="[1]"
      :nodes-draggable="false"
      :nodes-connectable="true"
      :elements-selectable="false"
      :zoom-on-double-click="false"
      @connect="handleConnect"
      @edges-change="handleEdgesChange"
      @move="handleMove"
    >
      <template #node-input="nodeProps">
        <InputNode v-bind="nodeProps" />
      </template>

      <template #node-output="nodeProps">
        <OutputNode v-bind="nodeProps" />
      </template>

      <template #edge-wire="edgeProps">
        <Wire v-bind="edgeProps" />
      </template>

      <Background />
      <Controls />
    </VueFlow>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { VueFlow, useVueFlow } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/controls/dist/style.css";
import type {
  Connection,
  EdgeChange,
  Node,
  NodeComponent,
} from "@vue-flow/core";
import type { MidiInput, MidiOutput, MidiWire, MidiRoute } from "@/types/midi";
import InputNode from "./InputNode.vue";
import OutputNode from "./OutputNode.vue";
import Wire from "./Wire.vue";
import { mapDevicesToNodes, mapWiresToEdges } from "./graphUtils";

const props = defineProps<{
  inputs: MidiInput[];
  outputs: MidiOutput[];
  wires: MidiWire[];
  onAddRoute: (route: MidiRoute) => void;
  onDeleteRoute: (route: MidiRoute) => void;
}>();

const graphContainer = ref<HTMLDivElement | null>(null);
const containerWidth = ref(800);

const nodeTypes: Record<string, NodeComponent> = {
  input: InputNode as unknown as NodeComponent,
  output: OutputNode as unknown as NodeComponent,
};

const edgeTypes = {
  wire: Wire,
};

const { setViewport, getViewport, project, fitView } = useVueFlow();

function limitViewport(currentNodes: Node[]) {
  const viewport = getViewport();
  if (!graphContainer.value || currentNodes.length === 0) return;

  const containerRect = graphContainer.value.getBoundingClientRect();

  const minX = Math.min(...currentNodes.map((n) => n.position.x));
  const maxX = Math.max(
    ...currentNodes.map((n) => n.position.x + (Number(n.width) || 180)),
  );
  const minY = Math.min(...currentNodes.map((n) => n.position.y));
  const maxY = Math.max(
    ...currentNodes.map((n) => n.position.y + (Number(n.height) || 60)),
  );

  const nodeRect = {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };

  const projectedViewSize = project({
    x: containerRect.width + viewport.x,
    y: containerRect.height + viewport.y,
  });

  const canvasSize = {
    x: nodeRect.width + nodeRect.x + 40,
    y: nodeRect.height + nodeRect.y + 80,
  };

  const maxViewportY = projectedViewSize.y - canvasSize.y;
  const maxViewportX = projectedViewSize.x - canvasSize.x;

  if (viewport.y > 0 || (maxViewportY >= 0 && viewport.y !== 0)) {
    setViewport({ x: 0, y: 0, zoom: 1 });
  } else if (maxViewportY < 0 && viewport.y < maxViewportY) {
    setViewport({ x: 0, y: maxViewportY, zoom: 1 });
  }

  if (viewport.x > 0 || (maxViewportX >= 0 && viewport.x !== 0)) {
    setViewport({ x: 0, y: viewport.y, zoom: 1 });
  } else if (maxViewportX < 0 && viewport.x < maxViewportX) {
    setViewport({ x: maxViewportX, y: viewport.y, zoom: 1 });
  }
}

function handleMove() {
  limitViewport(nodes.value);
}

function updateContainerWidth() {
  if (graphContainer.value) {
    containerWidth.value = graphContainer.value.getBoundingClientRect().width;
  }
}

const nodes = computed(() =>
  mapDevicesToNodes(props.inputs, props.outputs, containerWidth.value),
);

const edges = computed(() =>
  mapWiresToEdges(props.wires, (wire: MidiWire) => {
    props.onDeleteRoute(wire.route);
  }),
);

function handleConnect(connection: Connection) {
  if (connection.source && connection.target) {
    const inputName = connection.source.replace("input-", "");
    const outputName = connection.target.replace("output-", "");

    const output = props.outputs.find((o) => o.name === outputName);
    if (output) {
      props.onAddRoute({
        input: inputName,
        output: outputName,
        type: output.type as "physical" | "internal",
        enabled: true,
      });
    }
  }
}

function handleEdgesChange(changes: EdgeChange[]) {
  changes.forEach((change) => {
    if (change.type === "remove") {
      const edge = edges.value.find((e) => e.id === change.id);
      if (edge?.data?.route) {
        props.onDeleteRoute(edge.data.route);
      }
    }
  });
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  updateContainerWidth();
  if (graphContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      updateContainerWidth();
    });
    resizeObserver.observe(graphContainer.value);
  }
  setTimeout(() => fitView(), 100);
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});

watch(
  () => [props.inputs, props.outputs, props.wires],
  () => {
    setTimeout(() => fitView({ padding: 0.2 }), 50);
  },
  { deep: true },
);
</script>
