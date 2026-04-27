<template>
  <div
    class="navbar bg-base-100/80 dark:bg-base-300/80 backdrop-blur-md px-4 rounded-b-xl border-b border-base-200 dark:border-base-300 z-50"
  >
    <div class="navbar-start">
      <AppBreadcrumb />
    </div>

    <div class="navbar-center hidden sm:flex">
      <div class="flex items-center gap-2 text-xs text-base-content/60">
        <div
          class="flex items-center gap-1"
          v-for="device in midiDevices"
          :key="device.id"
          :title="device.name"
        >
          <div
            :class="[
              'w-2 h-2 rounded-full',
              device.active ? 'bg-success' : 'bg-base-content/30',
            ]"
          ></div>
          <span class="truncate max-w-24">{{ device.shortName }}</span>
        </div>
        <span v-if="midiDevices.length === 0" class="text-xs">
          {{ t("topBar.noMidiDevices") }}
        </span>
      </div>
    </div>

    <div class="navbar-end">
      <RouterLink
        to="/settings"
        class="btn btn-ghost btn-sm btn-circle transition-all duration-200 hover:bg-base-200"
        :title="$t('settings.title')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          class="size-[1.2em]"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </RouterLink>
      <ThemeSwitcher />
    </div>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useMidiRoutingStore } from "@/stores/midiRouting";
import AppBreadcrumb from "./AppBreadcrumb.vue";
import ThemeSwitcher from "@/components/ThemeSwitcher.vue";

const { t } = useI18n();
const routingStore = useMidiRoutingStore();

const midiDevices = computed(() => {
  const devices: Array<{
    id: string;
    name: string;
    shortName: string;
    active: boolean;
  }> = [];

  routingStore.inputs.forEach((input: any) => {
    devices.push({
      id: `input-${input.id}`,
      name: `${t("topBar.midiInput")}: ${input.name}`,
      shortName: input.name.length > 12 ? input.name.slice(0, 10) + "…" : input.name,
      active: true,
    });
  });

  routingStore.outputs.forEach((output: any) => {
    devices.push({
      id: `output-${output.id}`,
      name: `${t("topBar.midiOutput")}: ${output.name}`,
      shortName: output.name.length > 12 ? output.name.slice(0, 10) + "…" : output.name,
      active: true,
    });
  });

  return devices;
});
</script>
