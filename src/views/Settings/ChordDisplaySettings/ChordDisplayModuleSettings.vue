<template>
  <SettingsSection>
    <div class="grid grid-cols-1 gap-4 m-4">
      <SettingsFieldGroup
        v-for="group in moduleGroups"
        :key="group.titleKey"
        :fields="group.fields"
        :model="moduleSettings as unknown as SettingsFieldModel"
        :title-key="group.titleKey"
        :icon="group.icon"
        i18n-prefix="settings.chordDisplaySettings"
        @update="update"
      />

      <NotationLayoutSettings />

      <NotationStyleSettings />
    </div>
  </SettingsSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useSettingsStore } from "@/stores/settings";
import { defaultChordDisplaySettings, ChordDisplaySettings } from "@/types";
import { SettingsFieldGroup, SettingsSection } from "@/components/Settings";
import type { SettingsFieldModel } from "@/components/Settings/schema";
import { moduleGroups } from "./moduleSchema";
import NotationLayoutSettings from "@/components/Notation/NotationLayoutSettings.vue";
import NotationStyleSettings from "@/components/Notation/NotationStyleSettings.vue";
import { setValueByPath } from "@/helpers";

const route = useRoute();
const settingsStore = useSettingsStore();

const props = withDefaults(
  defineProps<{
    moduleId?: string;
  }>(),
  {},
);

const routeModuleId = computed(() => route.params.moduleId as string);
const moduleId = computed(() => props.moduleId || routeModuleId.value);

const moduleSettings = computed<ChordDisplaySettings>(() => {
  const mod = settingsStore.settings.chordDisplay.find(
    (m) => m.id === moduleId.value,
  );
  return mod ?? { ...defaultChordDisplaySettings, id: moduleId.value };
});

function update(key: string, value: boolean | number | string | null) {
  const index = settingsStore.settings.chordDisplay.findIndex(
    (m) => m.id === moduleId.value,
  );
  if (index === -1) return;
  const updated = JSON.parse(
    JSON.stringify(settingsStore.settings.chordDisplay),
  ) as ChordDisplaySettings[];
  setValueByPath(updated[index], key, value);
  settingsStore.settings.chordDisplay = updated;
}
</script>
