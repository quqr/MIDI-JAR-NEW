<template>
  <div class="h-full flex flex-col overflow-hidden">
    <div
      class="flex items-center border-b px-2 py-1 gap-2 flex-wrap flex-shrink-0 text-sm"
      role="toolbar"
      :aria-label="t('settings.debugger')"
    >
      <button
        v-for="filter in filters"
        :key="filter.value"
        class="btn btn-sm"
        :class="activeFilter === filter.value ? 'btn-primary' : 'btn-outline'"
        :aria-pressed="activeFilter === filter.value"
        @click="activeFilter = filter.value"
      >
        {{ filter.label }}
      </button>
      <button class="btn btn-sm btn-outline btn-error" @click="clearLogs">
        {{ t("settings.debuggerSettings.clearMessages") }}
      </button>
      <div class="divider divider-horizontal mx-1"></div>

      <label class="cursor-pointer flex items-center gap-2">
        <input type="checkbox" class="toggle" v-model="autoScroll" />
        <span class="text-xs">{{
          t("settings.debuggerSettings.autoScroll") || "Auto Scroll"
        }}</span>
      </label>
    </div>

    <div
      class="flex-1 min-h-0 p-2 overflow-auto rounded-xl"
      ref="logContainer"
      role="log"
      aria-live="polite"
      aria-atomic="false"
      :aria-label="t('settings.debuggerSettings.messageLog')"
    >
      <div
        v-for="log in filteredLogs"
        :key="log.id"
        class="log-entry whitespace-pre-wrap break-words text-xs"
        :class="logTypeClass(log.type)"
      >
        <span class="text-base-content/70">[{{ log.timestamp }}]</span>
        <span class="badge badge-sm mx-1" :class="badgeClass(log.type)">
          {{ log.type.toUpperCase() }}
        </span>
        <span>{{ log.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { useMidiMessages } from "@/composables";
import { debuggerLogger, LogType } from "./debugger-logger";
import { formatMidiMessage } from "./utils";

const { t } = useI18n();

const autoScroll = ref(true);
const activeFilter = ref<LogType | "all">("all");
const logContainer = ref<HTMLElement | null>(null);

const filters = [
  { label: "All", value: "all" as const },
  { label: "Info", value: "info" as const },
  { label: "Warn", value: "warn" as const },
  { label: "Error", value: "error" as const },
  { label: "Success", value: "success" as const },
];

function logTypeClass(type: LogType): string {
  switch (type) {
    case "info":
      return "text-info";
    case "warn":
      return "text-warning";
    case "error":
      return "text-error";
    case "success":
      return "text-success";
    default:
      return "";
  }
}

function badgeClass(type: LogType): string {
  switch (type) {
    case "info":
      return "badge-outline badge-info";
    case "warn":
      return "badge-outline badge-warning";
    case "error":
      return "badge-outline badge-error";
    case "success":
      return "badge-outline badge-success";
    default:
      return "";
  }
}

const onMessages = (messages: Array<[number[], number, string]>) => {
  for (const [message, , device] of messages) {
    debuggerLogger.info(
      `[${device}] ${formatMidiMessage(message as [number, number, number])}`,
    );
  }
};

const filteredLogs = computed(() => {
  // 读取 logVersion 建立 Vue 依赖追踪——每次日志变更时此 ref 递增，触发重新计算
  void debuggerLogger.logVersion.value;
  return debuggerLogger.filterByType(activeFilter.value);
});

watch(
  filteredLogs,
  async () => {
    if (autoScroll.value && logContainer.value) {
      await nextTick();
      logContainer.value.scrollTo({
        top: logContainer.value.scrollHeight,
        behavior: "instant",
      });
    }
  },
  { deep: true },
);

const clearLogs = () => {
  debuggerLogger.clearLogs();
};

useMidiMessages(onMessages, "debugger");
</script>
