<template>
  <div class="flex flex-col h-full">
    <div class="flex items-center gap-2">
      <button class="btn btn-sm btn-outline" @click="handleRefresh">
        <Icon name="refresh" size="16" />
        {{ t("settings.routingSettings.refreshDevices") }}
      </button>
      <button class="btn btn-sm btn-error" @click="handleClearAndRefresh">
        <Icon name="x" size="16" />
        {{ t("settings.routingSettings.clearAll") }}
      </button>
    </div>
    <div class="flex-1 h-0 p-4">
      <MidiFlowGraph
        :inputs="inputs"
        :outputs="outputs"
        :routes="routes"
        :wires="wires"
        :on-add-route="handleAddRoute"
        :on-delete-route="handleDeleteRoute"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { onMounted, onUnmounted, onActivated } from "vue";
import { useMidiRoutingStore } from "@/stores/midiRouting";
import type { MidiRoute } from "@/stores/midiRouting";
import Icon from "@/components/Icon/Icon.vue";
import MidiFlowGraph from "./MidiFlowGraph.vue";

const { t } = useI18n();
const routingStore = useMidiRoutingStore();

const { inputs, outputs, wires, routes, addRoute, deleteRoute } = routingStore;

function handleAddRoute(input: string, output: string, type: string) {
  addRoute({
    input,
    output,
    type: type as "physical" | "internal",
    enabled: true,
  });
}

function handleDeleteRoute(route: MidiRoute) {
  deleteRoute(route);
}

async function handleRefresh() {
  await routingStore.refreshDevices();
  routingStore.createDefaultRoutes();
  routingStore.syncRoutesToMain();
}

async function handleClearAndRefresh() {
  await routingStore.clearRoutes();
  routingStore.clearNodePositions();
  routingStore.clearViewport();
  await routingStore.refreshDevices();
  routingStore.createDefaultRoutes();
  routingStore.syncRoutesToMain();
}

onMounted(async () => {
  await routingStore.initialize();
  routingStore.startPolling(3000);
});

onUnmounted(() => {
  routingStore.stopPolling();
});

onActivated(async () => {
  await routingStore.refreshDevices();
  routingStore.startPolling(3000);
});
</script>
