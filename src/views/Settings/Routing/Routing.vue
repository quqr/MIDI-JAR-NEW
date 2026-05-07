<template>
  <div class="flex flex-col h-full">


    <div class="flex items-center gap-2">
      <button class="btn btn-sm btn-outline" @click="handleRefresh">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {{ t("settings.routingSettings.refreshDevices") }}
      </button>
      <button class="btn btn-sm btn-error" @click="handleClearAndRefresh">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
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
import { onMounted, onUnmounted } from "vue";
import { useMidiRoutingStore } from "@/stores/midiRouting";
import type { MidiRoute } from "@/stores/midiRouting";
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
}

async function handleClearAndRefresh() {
  await routingStore.clearRoutes();
  routingStore.clearNodePositions();
  routingStore.clearViewport();
  await routingStore.refreshDevices();
  routingStore.createDefaultRoutes();
}

onMounted(() => {
  routingStore.startPolling(3000);
});

onUnmounted(() => {
  routingStore.stopPolling();
});
</script>
