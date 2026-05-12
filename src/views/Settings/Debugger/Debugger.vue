<template>
  <div class="h-full flex flex-col overflow-hidden">
    <div class="flex items-center border-b px-2 py-1 gap-2 flex-wrap flex-shrink-0">
      <button
        class="btn btn-sm"
        :class="displayTimingClock ? 'btn-primary' : 'btn-outline'"
        @click="displayTimingClock = !displayTimingClock"
      >
        <Icon name="clock" size="16" class="mr-1" />
        {{ t("settings.debuggerSettings.midiClock") }}
      </button>

      <div class="divider divider-horizontal mx-1"></div>

      <button
        v-for="filter in filters"
        :key="filter.value"
        class="btn btn-sm"
        :class="activeFilter === filter.value ? 'btn-primary' : 'btn-outline'"
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

    <div class="flex-1 min-h-0 p-2 overflow-auto" ref="logContainer">
      <div
        v-for="log in filteredLogs"
        :key="log.id"
        class="log-entry whitespace-pre-wrap break-words"
        :class="logTypeClass(log.type)"
      >
        <span class="opacity-70">[{{ log.timestamp }}]</span>
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
import Icon from "@/components/Icon/Icon.vue";
import { useMidiMessages } from "@/composables";
import { logger, LogType } from "@/utils/logger";
import { MIDI_CLOCK_CMD, MIDI_SYSEX_CMD } from "./constants";
import { formatMidiMessage } from "./utils";

const { t } = useI18n();

const displayTimingClock = ref(false);
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

function shouldDisplayMessage(m: [number, number, number]) {
  const cmd = m[0] & 0xf0;

  if (cmd === MIDI_SYSEX_CMD) {
    if (!displayTimingClock.value && m[0] === MIDI_CLOCK_CMD) {
      return false;
    }
  }

  return true;
}

const onMessages = (messages: Array<[number[], number, string]>) => {
  for (const [message, , device] of messages) {
    if (shouldDisplayMessage(message as [number, number, number])) {
      logger.info(
        `[${device}] ${formatMidiMessage(message as [number, number, number])}`,
      );
    }
  }
};

const filteredLogs = computed(() => {
  return logger.filterByType(activeFilter.value);
});

watch(
  filteredLogs,
  async () => {
    if (autoScroll.value && logContainer.value) {
      await nextTick();
      logContainer.value.scrollTo({ top: logContainer.value.scrollHeight, behavior: 'instant' });
    }
  },
  { deep: true }
);

const clearLogs = () => {
  logger.clearLogs();
};

useMidiMessages(onMessages, "debugger");
</script>
