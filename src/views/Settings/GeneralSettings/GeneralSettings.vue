<template>
  <div>
    <div
      :class="[
        'alert mb-6',
        serverState.error
          ? 'alert-error'
          : serverState.started
            ? 'alert-success'
            : 'alert-info',
      ]"
    >
      <div class="flex items-center gap-2">
        <div
          :class="[
            'w-2 h-2 rounded-full',
            serverState.error
              ? 'bg-error'
              : serverState.started
                ? 'bg-success'
                : 'bg-base-300',
          ]"
        />
        <span class="text-sm font-medium">{{ serverStatus }}</span>
      </div>
    </div>

    <template v-if="serverState.started && serverState.addresses.length">
      <div class="mb-4">
        <span class="text-sm text-base-content/80 block mb-2">
          {{ t("settings.generalSettings.accessThrough") }}
        </span>
        <div class="flex flex-wrap gap-2">
          <a
            v-for="address in serverState.addresses"
            :key="address"
            :href="`http://${address}:${serverState.port}/`"
            target="_blank"
            class="badge badge-outline badge-sm hover:badge-primary"
          >
            {{ address }}:{{ serverState.port }}
          </a>
        </div>
      </div>
    </template>

    <div class="max-w-5xl mx-auto px-page-x">
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
        :default-open="false"
      >
        <p class="text-sm text-base-content/80 mb-4">
          {{ t("settings.generalSettings.themeHint") }}
        </p>
        <ThemePicker />
      </SettingsCollapse>

      <SettingsCollapse
        :title="t('settings.generalSettings.startup')"
        icon="power"
        :default-open="false"
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
        :default-open="false"
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
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useSettingsStore } from "@/stores/settings";
import { useServerStateStore } from "@/stores/serverState";
import {
  SettingsCollapse,
  SettingsSelect,
  SettingsToggle,
} from "@/components/Settings";
import ThemePicker from "@/components/ThemePicker.vue";
import { useToast } from "@/composables/useToast";

const { t, locale } = useI18n();
const settingsStore = useSettingsStore();
const serverStateStore = useServerStateStore();
const serverState = serverStateStore.state;
const { show } = useToast();

const serverStatus = computed(() => {
  if (serverState.error)
    return t("settings.generalSettings.serverErrored", {
      error: serverState.error,
    });
  if (serverState.started)
    return t("settings.generalSettings.serverRunning", {
      port: serverState.port,
    });
  return t("settings.generalSettings.serverStopped");
});

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
  show(
    enabled
      ? t("settings.generalSettings.enableHttpWs")
      : t("settings.generalSettings.serverStopped"),
    "success",
  );
};
</script>
