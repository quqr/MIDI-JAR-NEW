<template>
  <SettingsSection>
    <div class="grid grid-cols-1 gap-4 m-4">
      <SettingsFieldGroup
        :fields="generalGroup.fields"
        :model="model"
        :title-key="generalGroup.titleKey"
        :icon="generalGroup.icon"
        i18n-prefix="settings.generalSettings"
        @update="update"
      >
        <SettingsCollapse
          :title="t('settings.generalSettings.theme')"
          icon="palette"
          :default-open="true"
        >
          <p class="text-sm text-base-content/70 mb-4">
            {{ t("settings.generalSettings.themeHint") }}
          </p>
          <ThemePicker />
        </SettingsCollapse>
      </SettingsFieldGroup>
    </div>
  </SettingsSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useSettingsStore } from "@/stores/settings";
import {
  SettingsCollapse,
  SettingsFieldGroup,
  SettingsSection,
} from "@/components/Settings";
import type {
  SettingsFieldModel,
  SettingsGroupSchema,
} from "@/components/Settings/schema";
import ThemePicker from "@/components/ThemePicker.vue";

const { t, locale } = useI18n();
const settingsStore = useSettingsStore();

const generalGroup: SettingsGroupSchema = {
  titleKey: "settings.generalSettings.language",
  icon: "translate",
  fields: [
    {
      key: "language",
      control: "select",
      options: [
        { label: "English", value: "en" },
        { label: "简体中文", value: "zh" },
      ],
    },
  ],
};

const model = computed(
  () => settingsStore.settings.general as unknown as SettingsFieldModel,
);

function update(key: string, value: boolean | number | string | null) {
  settingsStore.updateSetting(`general.${key}`, value);
  if (key === "language") locale.value = value as "en" | "zh";
}
</script>
