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

      <div v-if="showHint" class="absolute top-6 left-6 right-6 z-20">
        <div class="alert alert-info shadow-lg">
          <div class="flex-1">
            <h3 class="font-bold mb-3">{{ t("routing.howToUse") }}</h3>
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <span class="badge badge-sm badge-primary">1</span>
                <span class="text-xs">{{ t("routing.hint1") }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="badge badge-sm badge-primary">2</span>
                <span class="text-xs">{{ t("routing.hint2") }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="badge badge-sm badge-primary">3</span>
                <span class="text-xs">{{ t("routing.hint3") }}</span>
              </div>
            </div>
          </div>
          <button class="btn btn-sm btn-ghost" @click="dismissHint">
            <Icon name="x" size="16" />
          </button>
        </div>
      </div>
    </div>
    <div
      class="flex items-center justify-between p-2 border-t border-base-300 bg-base-100"
    >
      <button class="btn btn-sm btn-outline" @click="refreshDevices">
        <Icon name="refresh" size="16" />
        {{ t("settings.routingSettings.refreshDevices") }}
      </button>
      <div class="divider divider-horizontal"></div>
      <button class="btn btn-sm btn-error" @click="handleClearRoutes">
        <Icon name="trash" size="16" />
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
import Icon from "@/components/Icon/Icon.vue";
import { useToast } from "@/composables/useToast";

const { t } = useI18n();
const routingStore = useMidiRoutingStore();
const { show } = useToast();

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

function handleClearRoutes() {
  clearRoutes();
  show(t("settings.routingSettings.clearAll"), "success");
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
