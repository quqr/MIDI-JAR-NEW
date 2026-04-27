<template>
  <div
    class="navbar bg-base-100/80 dark:bg-base-300/80 backdrop-blur-md px-4 rounded-b-xl border-b border-base-200 dark:border-base-300 z-50"
  >
    <div class="navbar-start">
      <AppBreadcrumb />
    </div>

    <div class="navbar-center hidden sm:flex">
      <div class="flex items-center gap-2 text-xs text-base-content/80">
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
        <Icon name="settings" size="20" />
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
import Icon from "@/components/Icon/Icon.vue";

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
      shortName:
        input.name.length > 12 ? input.name.slice(0, 10) + "…" : input.name,
      active: true,
    });
  });

  routingStore.outputs.forEach((output: any) => {
    devices.push({
      id: `output-${output.id}`,
      name: `${t("topBar.midiOutput")}: ${output.name}`,
      shortName:
        output.name.length > 12 ? output.name.slice(0, 10) + "…" : output.name,
      active: true,
    });
  });

  return devices;
});
</script>
