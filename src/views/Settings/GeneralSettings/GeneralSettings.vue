<template>
  <SettingsSection :on-reset="handleReset">
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

      <SettingsCollapse
        :title="t('settings.generalSettings.startup')"
        icon="power"
        :default-open="true"
      >
        <SettingsToggle
          :model-value="settingsStore.settings.general.launchAtStartup"
          :label="t('settings.generalSettings.launchAtStartup')"
          @update:model-value="
            settingsStore.updateSetting('general.launchAtStartup', $event)
          "
        />
        <SettingsToggle
          :model-value="settingsStore.settings.general.startMinimized"
          :label="t('settings.generalSettings.startMinimized')"
          @update:model-value="
            settingsStore.updateSetting('general.startMinimized', $event)
          "
        />
      </SettingsCollapse>

      <SettingsCollapse
        :title="t('settings.generalSettings.overlayServer')"
        icon="server"
        :default-open="true"
      >
        <SettingsToggle
          :model-value="serverState.started"
          :label="t('settings.generalSettings.enableHttpWs')"
          @update:model-value="toggleServer"
        />
        <div class="flex items-center justify-between py-2.5">
          <span class="text-sm">{{
            t("settings.generalSettings.serverPort")
          }}</span>
          <input
            type="number"
            class="input input-bordered input-sm w-24 rounded-lg text-sm"
            :value="settingsStore.settings.server.port"
            @input="
              settingsStore.updateSetting(
                'server.port',
                Number(($event.target as HTMLInputElement).value),
              )
            "
          />
        </div>
      </SettingsCollapse>
    </div>
  </SettingsSection>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useSettingsStore } from "@/stores/settings";
import { useServerStateStore } from "@/stores/serverState";
import {
  SettingsCollapse,
  SettingsSelect,
  SettingsToggle,
  SettingsSection,
} from "@/components/Settings";
import ThemePicker from "@/components/ThemePicker.vue";

const { t, locale } = useI18n();
const settingsStore = useSettingsStore();
const serverStateStore = useServerStateStore();
const serverState = serverStateStore.state;

const languageOptions = [
  { label: "English", value: "en" },
  { label: "简体中文", value: "zh-CN" },
];

const handleLanguageChange = (value: string | number) => {
  settingsStore.updateSetting("general.language", value);
  locale.value = value as any;
};

const toggleServer = (enabled: boolean) => {
  serverStateStore.enable(enabled);
};

const handleReset = () => {
  settingsStore.resetSetting("general");
  settingsStore.resetSetting("server");
};
</script>
