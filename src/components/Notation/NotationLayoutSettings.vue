<template>
  <SettingsCollapse
    :title="t('settings.notationSettings.layoutOptions')"
    icon="layout"
    :default-open="true"
  >
    <SettingsRange
      :model-value="mergedLayout.paddingTop"
      :label="t('settings.notationSettings.paddingTop')"
      :description="t('settings.notationSettings.paddingTopHint')"
      :min="10"
      :max="100"
      :step="5"
      @update:model-value="update('paddingTop', $event)"
    />
    <SettingsRange
      :model-value="mergedLayout.staveHeight"
      :label="t('settings.notationSettings.staveHeight')"
      :description="t('settings.notationSettings.staveHeightHint')"
      :min="80"
      :max="200"
      :step="10"
      @update:model-value="update('staveHeight', $event)"
    />
    <SettingsRange
      :model-value="mergedLayout.staveGap"
      :label="t('settings.notationSettings.staveGap')"
      :description="t('settings.notationSettings.staveGapHint')"
      :min="0"
      :max="60"
      :step="5"
      @update:model-value="update('staveGap', $event)"
    />
    <SettingsRange
      :model-value="mergedLayout.textHeight"
      :label="t('settings.notationSettings.textHeight')"
      :description="t('settings.notationSettings.textHeightHint')"
      :min="10"
      :max="60"
      :step="5"
      @update:model-value="update('textHeight', $event)"
    />
    <SettingsRange
      :model-value="mergedLayout.bottomPadding"
      :label="t('settings.notationSettings.bottomPadding')"
      :description="t('settings.notationSettings.bottomPaddingHint')"
      :min="10"
      :max="60"
      :step="5"
      @update:model-value="update('bottomPadding', $event)"
    />
    <SettingsRange
      :model-value="mergedLayout.sidePadding"
      :label="t('settings.notationSettings.sidePadding')"
      :description="t('settings.notationSettings.sidePaddingHint')"
      :min="20"
      :max="100"
      :step="5"
      @update:model-value="update('sidePadding', $event)"
    />
    <SettingsRange
      :model-value="mergedLayout.clefWidth"
      :label="t('settings.notationSettings.clefWidth')"
      :description="t('settings.notationSettings.clefWidthHint')"
      :min="30"
      :max="80"
      :step="5"
      @update:model-value="update('clefWidth', $event)"
    />
    <SettingsRange
      :model-value="mergedLayout.noteWidth"
      :label="t('settings.notationSettings.noteWidth')"
      :description="t('settings.notationSettings.noteWidthHint')"
      :min="60"
      :max="200"
      :step="10"
      @update:model-value="update('noteWidth', $event)"
    />
    <SettingsRange
      :model-value="mergedLayout.maxScale"
      :label="t('settings.notationSettings.maxScale')"
      :description="t('settings.notationSettings.maxScaleHint')"
      :min="0.5"
      :max="2"
      :step="0.1"
      @update:model-value="update('maxScale', $event)"
    />
  </SettingsCollapse>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useSettingsStore } from "@/stores/settings";
import { SettingsCollapse, SettingsRange } from "@/components/Settings";
import { mergeLayoutConfig } from "./utils";
import type { NotationLayoutConfig } from "./types";

const { t } = useI18n();
const settingsStore = useSettingsStore();

const mergedLayout = computed(() =>
  mergeLayoutConfig(settingsStore.settings.notation.layout),
);

function update(key: keyof NotationLayoutConfig, value: number) {
  const current: Record<string, number> = {
    ...settingsStore.settings.notation.layout,
  };
  current[key] = value;
  settingsStore.updateSetting("notation.layout", current);
}
</script>
