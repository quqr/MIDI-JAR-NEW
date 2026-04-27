<template>
  <div
    class="output-node rounded-lg border-2 px-3 py-2 min-w-[160px]"
    :class="[typeClasses, connected ? '' : 'opacity-60']"
  >
    <div class="flex items-center gap-2">
      <div class="flex items-center gap-1.5">
        <svg
          v-if="type === 'physical'"
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
            d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
          />
        </svg>
        <svg
          v-else-if="type === 'internal'"
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
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
        <svg
          v-else-if="type === 'websocket'"
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
            d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
          />
        </svg>
        <div :class="['badge badge-sm gap-1', badgeClasses]">
          {{ label }}
        </div>
      </div>
    </div>

    <div class="text-xs mt-1.5 flex items-center gap-1.5">
      <div
        class="w-2 h-2 rounded-full"
        :class="connected ? 'bg-success' : 'bg-error'"
      ></div>
      <span class="opacity-80">{{ status }}</span>
    </div>

    <div v-if="error" class="mt-1.5">
      <div class="badge badge-error badge-xs gap-1">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        Error
      </div>
    </div>

    <Handle type="target" :position="Position.Left" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Handle, Position } from "@vue-flow/core";

const props = defineProps<{
  data: {
    label: string;
    type: "physical" | "internal" | "websocket";
    status: string;
    device: {
      name: string;
      type: string;
      connected: boolean;
      opened: boolean;
      error: boolean;
    };
  };
}>();

const label = computed(() => props.data.label);
const type = computed(() => props.data.type);
const status = computed(() => props.data.status);
const connected = computed(() => props.data.device.connected);
const error = computed(() => props.data.device.error);

const typeClasses = computed(() => {
  switch (props.data.type) {
    case "physical":
      return "border-primary bg-base-200";
    case "internal":
      return "border-accent bg-base-200";
    case "websocket":
      return "border-info bg-base-200";
    default:
      return "border-base-300 bg-base-200";
  }
});

const badgeClasses = computed(() => {
  switch (props.data.type) {
    case "physical":
      return "badge-primary";
    case "internal":
      return "badge-accent";
    case "websocket":
      return "badge-info";
    default:
      return "badge-ghost";
  }
});
</script>
