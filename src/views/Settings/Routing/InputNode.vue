<template>
  <div
    class="input-node rounded-lg border p-3 shadow-sm"
    :class="[
      isConnected && isDeviceOpened
        ? 'border-success bg-success/10'
        : 'border-base-300 bg-base-200',
      hasError ? 'border-error bg-error/10' : '',
      isActive ? 'activity-pulse ring-2 ring-primary/50' : '',
    ]"
  >
    <div class="flex items-center gap-2">
      <div
        class="h-3 w-3 rounded-full"
        :class="[
          isActive ? 'bg-primary animate-pulse' : '',
          !isActive && isConnected && isDeviceOpened ? 'bg-success' : '',
          !isActive && (!isConnected || !isDeviceOpened) ? 'bg-base-400' : '',
          hasError ? 'bg-error animate-pulse' : '',
        ]"
      />
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4 text-base-content/80"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 14l-7 7m0 0l-7-7m7 7V3"
        />
      </svg>
      <span class="font-medium text-sm">{{ data.label }}</span>
    </div>

    <div
      class="mt-1 text-xs"
      :class="hasError ? 'text-error' : 'text-base-content/80'"
    >
      <span v-if="hasError">Error</span>
      <span v-else-if="isConnected && isDeviceOpened">Connected</span>
      <span v-else-if="isConnected && !isDeviceOpened">Disconnected</span>
      <span v-else>Disconnected</span>
    </div>

    <Handle
      type="source"
      :position="Position.Right"
      class="w-3 h-3 bg-primary border-2 border-base-100"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, toRefs } from "vue";
import { Handle, Position } from "@vue-flow/core";
import { useMidiActivity } from "@/composables/useMidiActivity";
import type { NodeProps } from "@vue-flow/core";

interface DeviceData {
  name: string;
  connected: boolean;
  opened: boolean;
  error: boolean;
}

interface InputNodeData {
  label: string;
  status: string;
  device: DeviceData;
}

const props = defineProps<NodeProps<InputNodeData>>();

const { data } = toRefs(props);

const { isActive, triggerActivity } = useMidiActivity(props.data.label);

const isConnected = computed(() => props.data.device?.connected ?? false);
const isDeviceOpened = computed(() => props.data.device?.opened ?? false);
const hasError = computed(() => props.data.device?.error ?? false);

defineExpose({ triggerActivity });
</script>

<style scoped>
@keyframes activity-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(var(--color-primary), 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(var(--color-primary), 0);
  }
}

.activity-pulse {
  animation: activity-pulse 1.5s ease-in-out infinite;
}
</style>
