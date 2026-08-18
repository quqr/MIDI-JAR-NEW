<template>
  <SettingsSection>
    <div class="grid grid-cols-1 gap-4 m-4">
      <SettingsCollapse
        :title="t('settings.generalSettings.language')"
        icon="translate"
        :default-open="true"
      >
        <SettingsSelect
          :model-value="settingsStore.settings.general.language"
          :options="languageOptions"
          :description="t('settings.generalSettings.languageHint')"
          @update:model-value="handleLanguageChange"
        />
      </SettingsCollapse>

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
    </div>
  </SettingsSection>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useSettingsStore } from "@/stores/settings";
import {
  SettingsCollapse,
  SettingsSelect,
  SettingsSection,
} from "@/components/Settings";
import ThemePicker from "@/components/ThemePicker.vue";

const { t, locale } = useI18n();
const settingsStore = useSettingsStore();

const languageOptions = [
  { label: "English", value: "en" },
  { label: "简体中文", value: "zh" },
];

const handleLanguageChange = (value: string | number) => {
  settingsStore.updateSetting("general.language", value);
  locale.value = value as "en" | "zh";
};
</script>
