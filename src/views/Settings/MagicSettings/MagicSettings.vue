<template>
  <SettingsSection>
    <div class="grid grid-cols-1 gap-4 m-4">
      <SettingsFieldGroup
        v-for="group in magicGroups"
        :key="group.titleKey"
        :fields="group.fields"
        :model="model"
        :title-key="group.titleKey"
        :icon="group.icon"
        i18n-prefix="settings.magicSettings"
        @update="update"
      />
    </div>
  </SettingsSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useSettingsStore } from "@/stores/settings";
import { SettingsFieldGroup, SettingsSection } from "@/components/Settings";
import type { SettingsFieldModel } from "@/components/Settings/schema";
import { magicGroups } from "./schema";

const settingsStore = useSettingsStore();

const model = computed(
  () => settingsStore.settings.magic as unknown as SettingsFieldModel,
);

function update(key: string, value: boolean | number | string | null) {
  settingsStore.updateSetting(`magic.${key}`, value);
}
</script>
