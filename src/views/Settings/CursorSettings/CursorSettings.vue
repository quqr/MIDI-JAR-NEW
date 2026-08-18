<template>
  <SettingsSection>
    <div class="grid grid-cols-1 gap-4 m-4">
      <SettingsCollapse
        :title="t('settings.cursorSettings.general')"
        icon="cursor"
        :default-open="true"
      >
        <SettingsToggle
          :model-value="settingsStore.settings.cursor.enabled"
          :label="t('settings.cursorSettings.enabled')"
          :description="t('settings.cursorSettings.enabledHint')"
          @update:model-value="
            settingsStore.updateSetting('cursor.enabled', $event)
          "
        />
      </SettingsCollapse>

      <SettingsCollapse
        :title="t('settings.cursorSettings.hoverSettings')"
        icon="visible"
        :default-open="true"
      >
        <SettingsSelect
          :model-value="settingsStore.settings.cursor.hoverMode"
          :label="t('settings.cursorSettings.hoverMode')"
          :options="hoverModeOptions"
          :description="t('settings.cursorSettings.hoverModeHint')"
          @update:model-value="
            settingsStore.updateSetting('cursor.hoverMode', $event)
          "
        />
      </SettingsCollapse>

      <SettingsCollapse
        :title="t('settings.cursorSettings.sizeSettings')"
        icon="maximize"
        :default-open="true"
      >
        <SettingsRange
          :model-value="settingsStore.settings.cursor.innerSize"
          :label="t('settings.cursorSettings.innerSize')"
          :description="t('settings.cursorSettings.innerSizeHint')"
          :min="4"
          :max="32"
          :step="2"
          @update:model-value="
            settingsStore.updateSetting('cursor.innerSize', $event)
          "
        />
        <SettingsRange
          :model-value="settingsStore.settings.cursor.outerSize"
          :label="t('settings.cursorSettings.outerSize')"
          :description="t('settings.cursorSettings.outerSizeHint')"
          :min="20"
          :max="80"
          :step="2"
          @update:model-value="
            settingsStore.updateSetting('cursor.outerSize', $event)
          "
        />
      </SettingsCollapse>

      <SettingsCollapse
        :title="t('settings.cursorSettings.colorSettings')"
        icon="palette"
        :default-open="true"
      >
        <SettingsSelect
          :model-value="settingsStore.settings.cursor.innerColorSource"
          :label="t('settings.cursorSettings.innerColorSource')"
          :options="colorSourceOptions"
          @update:model-value="
            settingsStore.updateSetting('cursor.innerColorSource', $event)
          "
        />
        <SettingsColorPicker
          v-if="settingsStore.settings.cursor.innerColorSource === 'custom'"
          :model-value="settingsStore.settings.cursor.innerColor"
          :label="t('settings.cursorSettings.innerColor')"
          :description="t('settings.cursorSettings.innerColorHint')"
          @update:model-value="
            settingsStore.updateSetting('cursor.innerColor', $event)
          "
        />
        <SettingsThemeColorPicker
          v-else
          :model-value="settingsStore.settings.cursor.innerColor"
          :label="t('settings.cursorSettings.innerColorTheme')"
          @update:model-value="
            settingsStore.updateSetting('cursor.innerColor', $event)
          "
        />

        <SettingsSelect
          :model-value="settingsStore.settings.cursor.outerColorSource"
          :label="t('settings.cursorSettings.outerColorSource')"
          :options="colorSourceOptions"
          @update:model-value="
            settingsStore.updateSetting('cursor.outerColorSource', $event)
          "
        />
        <SettingsColorPicker
          v-if="settingsStore.settings.cursor.outerColorSource === 'custom'"
          :model-value="settingsStore.settings.cursor.outerColor"
          :label="t('settings.cursorSettings.outerColor')"
          :description="t('settings.cursorSettings.outerColorHint')"
          @update:model-value="
            settingsStore.updateSetting('cursor.outerColor', $event)
          "
        />
        <SettingsThemeColorPicker
          v-else
          :model-value="settingsStore.settings.cursor.outerColor"
          :label="t('settings.cursorSettings.outerColorTheme')"
          @update:model-value="
            settingsStore.updateSetting('cursor.outerColor', $event)
          "
        />

        <SettingsSelect
          :model-value="settingsStore.settings.cursor.hoverRingColorSource"
          :label="t('settings.cursorSettings.hoverRingColorSource')"
          :options="colorSourceOptions"
          @update:model-value="
            settingsStore.updateSetting('cursor.hoverRingColorSource', $event)
          "
        />
        <SettingsColorPicker
          v-if="settingsStore.settings.cursor.hoverRingColorSource === 'custom'"
          :model-value="settingsStore.settings.cursor.hoverRingColor"
          :label="t('settings.cursorSettings.hoverRingColor')"
          :description="t('settings.cursorSettings.hoverRingColorHint')"
          @update:model-value="
            settingsStore.updateSetting('cursor.hoverRingColor', $event)
          "
        />
        <SettingsThemeColorPicker
          v-else
          :model-value="settingsStore.settings.cursor.hoverRingColor"
          :label="t('settings.cursorSettings.hoverRingColorTheme')"
          @update:model-value="
            settingsStore.updateSetting('cursor.hoverRingColor', $event)
          "
        />
      </SettingsCollapse>

      <SettingsCollapse
        :title="t('settings.cursorSettings.animationSettings')"
        icon="sparkles"
        :default-open="true"
      >
        <SettingsRange
          :model-value="settingsStore.settings.cursor.followDuration"
          :label="t('settings.cursorSettings.followDuration')"
          :description="t('settings.cursorSettings.followDurationHint')"
          :min="0"
          :max="500"
          :step="10"
          @update:model-value="
            settingsStore.updateSetting('cursor.followDuration', $event)
          "
        />
        <SettingsRange
          :model-value="settingsStore.settings.cursor.hoverDuration"
          :label="t('settings.cursorSettings.hoverDuration')"
          :description="t('settings.cursorSettings.hoverDurationHint')"
          :min="0"
          :max="800"
          :step="10"
          @update:model-value="
            settingsStore.updateSetting('cursor.hoverDuration', $event)
          "
        />
        <SettingsRange
          :model-value="settingsStore.settings.cursor.pulseScale"
          :label="t('settings.cursorSettings.pulseScale')"
          :description="t('settings.cursorSettings.pulseScaleHint')"
          :min="0.2"
          :max="1"
          :step="0.05"
          @update:model-value="
            settingsStore.updateSetting('cursor.pulseScale', $event)
          "
        />
      </SettingsCollapse>

      <SettingsCollapse
        :title="t('settings.cursorSettings.advancedSettings')"
        icon="cog"
        :default-open="true"
      >
        <SettingsSelect
          :model-value="settingsStore.settings.cursor.blendMode"
          :label="t('settings.cursorSettings.blendMode')"
          :options="blendModeOptions"
          :description="t('settings.cursorSettings.blendModeHint')"
          @update:model-value="
            settingsStore.updateSetting('cursor.blendMode', $event)
          "
        />
      </SettingsCollapse>
    </div>
  </SettingsSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useSettingsStore } from "@/stores/settings";
import {
  SettingsCollapse,
  SettingsToggle,
  SettingsSelect,
  SettingsRange,
  SettingsColorPicker,
  SettingsThemeColorPicker,
  SettingsSection,
} from "@/components/Settings";

const { t } = useI18n();
const settingsStore = useSettingsStore();

const colorSourceOptions = computed(() => [
  {
    label: t("settings.cursorSettings.colorSourceOptions.custom"),
    value: "custom",
  },
  {
    label: t("settings.cursorSettings.colorSourceOptions.theme"),
    value: "theme",
  },
]);

const hoverModeOptions = computed(() => [
  {
    label: t("settings.cursorSettings.hoverModeOptions.cover"),
    value: "cover",
  },
  {
    label: t("settings.cursorSettings.hoverModeOptions.border"),
    value: "border",
  },
  { label: t("settings.cursorSettings.hoverModeOptions.none"), value: "none" },
]);

const blendModeOptions = computed(() => [
  {
    label: t("settings.cursorSettings.blendModeOptions.normal"),
    value: "normal",
  },
  {
    label: t("settings.cursorSettings.blendModeOptions.exclusion"),
    value: "exclusion",
  },
  {
    label: t("settings.cursorSettings.blendModeOptions.difference"),
    value: "difference",
  },
  {
    label: t("settings.cursorSettings.blendModeOptions.multiply"),
    value: "multiply",
  },
  {
    label: t("settings.cursorSettings.blendModeOptions.screen"),
    value: "screen",
  },
]);
</script>
