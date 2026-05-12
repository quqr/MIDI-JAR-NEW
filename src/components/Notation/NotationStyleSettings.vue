<template>
  <SettingsCollapse
    :title="t('settings.notationSettings.styleOptions')"
    icon="palette"
    :default-open="true"
  >
    <SettingsColorPicker
      :model-value="mergedStyle.backgroundColor"
      :label="t('settings.notationSettings.backgroundColor')"
      :description="t('settings.notationSettings.backgroundColorHint')"
      @update:model-value="update('backgroundColor', $event)"
    />
    <SettingsColorPicker
      :model-value="mergedStyle.staffLineColor"
      :label="t('settings.notationSettings.staffLineColor')"
      :description="t('settings.notationSettings.staffLineColorHint')"
      @update:model-value="update('staffLineColor', $event)"
    />
    <SettingsColorPicker
      :model-value="mergedStyle.noteColor"
      :label="t('settings.notationSettings.noteColor')"
      :description="t('settings.notationSettings.noteColorHint')"
      @update:model-value="update('noteColor', $event)"
    />
    <SettingsColorPicker
      :model-value="mergedStyle.noteHighlightColor"
      :label="t('settings.notationSettings.noteHighlightColor')"
      :description="t('settings.notationSettings.noteHighlightColorHint')"
      @update:model-value="update('noteHighlightColor', $event)"
    />
    <SettingsRange
      :model-value="mergedStyle.fontSize"
      :label="t('settings.notationSettings.fontSize')"
      :description="t('settings.notationSettings.fontSizeHint')"
      :min="6"
      :max="20"
      :step="1"
      @update:model-value="update('fontSize', $event)"
    />
  </SettingsCollapse>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useSettingsStore } from "@/stores/settings";
import {
  SettingsCollapse,
  SettingsRange,
  SettingsColorPicker,
} from "@/components/Settings";
import { mergeStyleConfig } from "./utils";

const { t } = useI18n();
const settingsStore = useSettingsStore();

const mergedStyle = computed(() =>
  mergeStyleConfig(settingsStore.settings.notation.style),
);

function update(key: string, value: string | number | null) {
  const current: Record<string, string | number | null> = {
    ...settingsStore.settings.notation.style,
  };
  current[key] = value;
  settingsStore.updateSetting("notation.style", current);
}
</script>
