<template>
  <NotationFieldGroup
    group="layout"
    :model-value="mergedLayout"
    @update="update"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useSettingsStore } from "@/stores/settings";
import NotationFieldGroup from "./NotationFieldGroup.vue";
import { mergeLayoutConfig } from "./utils";

const settingsStore = useSettingsStore();

const mergedLayout = computed(() =>
  mergeLayoutConfig(settingsStore.settings.notation.layout),
);

function update(key: string, value: boolean | number | string | null) {
  const current: Record<string, number> = {
    ...settingsStore.settings.notation.layout,
  };
  current[key] = value as number;
  settingsStore.updateSetting("notation.layout", current);
}
</script>
