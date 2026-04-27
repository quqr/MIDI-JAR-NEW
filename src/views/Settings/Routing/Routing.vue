<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="flex-1 p-4 relative">
      <MidiFlowGraph
        :inputs="inputs"
        :outputs="outputs"
        :wires="wires"
        :on-add-route="addRoute"
        :on-delete-route="deleteRoute"
      />

      <div
        v-if="showHint"
        class="absolute top-6 left-6 right-6 z-20"
      >
        <div class="alert alert-info shadow-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            class="stroke-current shrink-0 w-6 h-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <div>
            <h3 class="font-bold">{{ t("routing.howToUse") }}</h3>
            <div class="text-xs mt-1 space-y-1">
              <p>{{ t("routing.hint1") }}</p>
              <p>{{ t("routing.hint2") }}</p>
              <p>{{ t("routing.hint3") }}</p>
            </div>
          </div>
          <button class="btn btn-sm btn-ghost" @click="dismissHint">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              class="size-4"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
    <div
      class="flex items-center justify-between p-2 border-t border-base-300 bg-base-100"
    >
      <button class="btn btn-sm btn-outline" @click="refreshDevices">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        {{ t("settings.routingSettings.refreshDevices") }}
      </button>
      <div class="divider divider-horizontal"></div>
      <button class="btn btn-sm btn-error" @click="clearRoutes">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        {{ t("settings.routingSettings.clearAll") }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useMidiRoutingStore } from "@/stores/midiRouting";
import MidiFlowGraph from "./MidiFlowGraph.vue";

const { t } = useI18n();
const routingStore = useMidiRoutingStore();

const showHint = ref(true);
const HINT_STORAGE_KEY = "midi-jar-routing-hint-dismissed";

onMounted(() => {
  const dismissed = localStorage.getItem(HINT_STORAGE_KEY);
  if (dismissed === "true") {
    showHint.value = false;
  }
});

function dismissHint() {
  showHint.value = false;
  localStorage.setItem(HINT_STORAGE_KEY, "true");
}

const {
  inputs,
  outputs,
  wires,
  refreshDevices,
  addRoute,
  deleteRoute,
  clearRoutes,
} = routingStore;
</script>
