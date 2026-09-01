<template>
  <NotationFieldGroup
    group="style"
    :model-value="mergedStyle"
    @update="update"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useSettingsStore } from "@/stores/settings";
import NotationFieldGroup from "./NotationFieldGroup.vue";
import { mergeStyleConfig } from "./utils";
import type { NotationStyleConfig } from "./types";

const settingsStore = useSettingsStore();

const mergedStyle = computed(() =>
  mergeStyleConfig(settingsStore.settings.notation.style),
);

function update(key: string, value: boolean | number | string | null) {
  const current: Partial<NotationStyleConfig> = {
    ...settingsStore.settings.notation.style,
  };
  (current as Record<string, string | number | null>)[key] = value as
    | string
    | number
    | null;
  settingsStore.updateSetting("notation.style", current);
}
</script>
