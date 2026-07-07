<template>
  <div class="flex flex-col h-full gap-4">
    <!-- 工具栏 -->
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <div class="flex items-center gap-2">
        <button class="btn btn-sm btn-outline" @click="handleRefresh">
          <Icon name="refresh" :size="16" aria-hidden="true" />
          {{ t("settings.routingSettings.refreshDevices") }}
        </button>
        <button
          class="btn btn-sm btn-error btn-outline"
          :aria-label="t('settings.routingSettings.clearAll')"
          @click="handleClearAndRefresh"
        >
          <Icon name="x" :size="16" aria-hidden="true" />
          {{ t("settings.routingSettings.clearAll") }}
        </button>
      </div>

      <!-- 视图切换 -->
      <div
        class="flex items-center gap-1 p-1 rounded-lg bg-base-200/50"
        role="tablist"
        :aria-label="t('settings.routingSettings.viewMode')"
      >
        <button
          class="btn btn-sm"
          :class="viewMode === 'matrix' ? 'btn-primary' : 'btn-ghost'"
          role="tab"
          :aria-selected="viewMode === 'matrix'"
          @click="viewMode = 'matrix'"
        >
          <Icon name="grid" :size="14" aria-hidden="true" />
          {{ t("settings.routingSettings.matrixView") }}
        </button>
        <button
          class="btn btn-sm"
          :class="viewMode === 'flow' ? 'btn-primary' : 'btn-ghost'"
          role="tab"
          :aria-selected="viewMode === 'flow'"
          @click="viewMode = 'flow'"
        >
          <Icon name="git-branch" :size="14" aria-hidden="true" />
          {{ t("settings.routingSettings.flowView") }}
        </button>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-if="inputs.length === 0 && outputs.length === 0"
      class="flex-1 flex flex-col items-center justify-center gap-4 text-base-content/50"
    >
      <Icon name="alert-circle" :size="48" aria-hidden="true" />
      <div class="text-center">
        <p class="text-lg font-medium">
          {{ t("settings.routingSettings.noDevicesTitle") }}
        </p>
        <p class="text-sm mt-1">
          {{ t("settings.routingSettings.noDevicesDesc") }}
        </p>
      </div>
      <button class="btn btn-primary btn-sm" @click="handleRefresh">
        <Icon name="refresh" :size="16" aria-hidden="true" />
        {{ t("settings.routingSettings.refreshDevices") }}
      </button>
    </div>

    <!-- 矩阵视图 -->
    <div
      v-else-if="viewMode === 'matrix'"
      class="flex-1 overflow-auto rounded-box border border-base-200 bg-base-100"
    >
      <table class="table table-zebra">
        <thead>
          <tr>
            <th class="sticky top-0 z-10 bg-base-200/80 backdrop-blur-sm">
              <span class="text-xs font-semibold uppercase tracking-wider text-base-content/60">
                {{ t("settings.routingSettings.inputOutput") }}
              </span>
            </th>
            <th
              v-for="output in outputs"
              :key="output.name"
              class="sticky top-0 z-10 bg-base-200/80 backdrop-blur-sm"
            >
              <div class="flex items-center gap-2 min-w-[120px]">
                <span
                  class="w-2 h-2 rounded-full flex-shrink-0"
                  :class="output.connected ? 'bg-success' : 'bg-base-content/30'"
                  :aria-label="output.connected ? $t('common.connected') : $t('common.disconnected')"
                ></span>
                <span class="text-xs font-semibold truncate" :title="output.name">
                  {{ output.name }}
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="input in inputs" :key="input.name">
            <td class="font-semibold">
              <div class="flex items-center gap-2 min-w-[150px]">
                <span
                  class="w-2 h-2 rounded-full flex-shrink-0"
                  :class="input.connected ? 'bg-success' : 'bg-base-content/30'"
                  :aria-label="input.connected ? $t('common.connected') : $t('common.disconnected')"
                ></span>
                <span class="text-sm truncate" :title="input.name">
                  {{ input.name }}
                </span>
              </div>
            </td>
            <td v-for="output in outputs" :key="output.name" class="text-center">
              <label class="inline-flex items-center cursor-pointer" :aria-label="`${input.name} → ${output.name}`">
                <input
                  type="checkbox"
                  class="toggle toggle-sm toggle-primary"
                  :checked="isConnected(input.name, output.name)"
                  :disabled="!input.connected || !output.connected"
                  @change="toggleConnection(input.name, output.name)"
                />
              </label>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 流程图视图（高级模式） -->
    <div v-else class="flex-1 h-0 p-4">
      <MidiFlowGraph
        :inputs="inputs"
        :outputs="outputs"
        :routes="routes"
        :wires="wires"
        :on-add-route="handleAddRoute"
        :on-delete-route="handleDeleteRoute"
      />
    </div>

    <!-- 清除路由确认对话框 -->
    <ConfirmDialog
      v-model="showClearConfirm"
      :title="t('settings.routingSettings.clearConfirmTitle')"
      :message="t('settings.routingSettings.confirmClear')"
      :confirm-label="t('settings.routingSettings.clearAll')"
      :cancel-label="t('common.cancel')"
      variant="error"
      @confirm="doClearAndRefresh"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { onMounted, onUnmounted, onActivated, onDeactivated } from "vue";
import { storeToRefs } from "pinia";
import { useMidiRoutingStore } from "@/stores/midiRouting";
import type { MidiRoute } from "@/stores/midiRouting";
import Icon from "@/components/Icon/Icon.vue";
import ConfirmDialog from "@/components/common/ConfirmDialog.vue";
import MidiFlowGraph from "./MidiFlowGraph.vue";

const { t } = useI18n();
const routingStore = useMidiRoutingStore();

const { inputs, outputs, wires, routes } = storeToRefs(routingStore);
const { addRoute, deleteRoute } = routingStore;

const viewMode = ref<"matrix" | "flow">("matrix");
const showClearConfirm = ref(false);

// 检查输入输出是否已连接
function isConnected(inputName: string, outputName: string): boolean {
  return routes.value.some(
    (r) => r.input === inputName && r.output === outputName && r.enabled,
  );
}

// 切换连接状态
function toggleConnection(inputName: string, outputName: string) {
  const existing = routes.value.find(
    (r) => r.input === inputName && r.output === outputName,
  );
  if (existing) {
    // 已存在则删除
    deleteRoute(existing);
  } else {
    // 不存在则添加
    addRoute({
      input: inputName,
      output: outputName,
      type: "physical",
      enabled: true,
    });
  }
}

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
  showClearConfirm.value = true;
}

async function doClearAndRefresh() {
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
  routingStore.cleanup();
});

onActivated(async () => {
  await routingStore.refreshDevices();
  routingStore.startPolling(3000);
});

onDeactivated(() => {
  routingStore.stopPolling();
});
</script>
