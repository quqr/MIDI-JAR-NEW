<template>
  <SettingsCollapse
    :title="t('WaterfallPiano.keyboard')"
    icon="piano"
    :default-open="false"
  >
    <SettingsToggle
      :model-value="settings.visible"
      :label="t('WaterfallPiano.keyboard')"
      @update:model-value="emit('update', 'visible', $event)"
    />
    <SettingsSelect
      :model-value="settings.range"
      :label="t('WaterfallPiano.keyRange')"
      :options="keyRangeOptions"
      @update:model-value="emit('update', 'range', $event)"
    />
    <SettingsSelect
      :model-value="settings.keyLabel"
      :label="t('WaterfallPiano.keyLabel')"
      :options="keyLabelOptions"
      @update:model-value="emit('update', 'keyLabel', $event)"
    />
    <SettingsRange
      :model-value="settings.heightRatio"
      :label="t('WaterfallPiano.heightRatio')"
      :min="0"
      :max="0.5"
      :step="0.05"
      @update:model-value="emit('update', 'heightRatio', $event)"
    />
    <SettingsColorPicker
      :model-value="settings.whiteKeyColor"
      :label="t('WaterfallPiano.whiteKeyColor')"
      @update:model-value="emit('update', 'whiteKeyColor', $event)"
    />
    <SettingsColorPicker
      :model-value="settings.blackKeyColor"
      :label="t('WaterfallPiano.blackKeyColor')"
      @update:model-value="emit('update', 'blackKeyColor', $event)"
    />
    <SettingsColorPicker
      :model-value="settings.pressedKeyColor"
      :label="t('WaterfallPiano.pressedKeyColor')"
      @update:model-value="emit('update', 'pressedKeyColor', $event)"
    />
    <SettingsRange
      :model-value="settings.keyCornerRadius"
      :label="t('WaterfallPiano.cornerRadius')"
      :min="0"
      :max="20"
      :step="1"
      @update:model-value="emit('update', 'keyCornerRadius', $event)"
    />
    <SettingsToggle
      :model-value="settings.separatorEnabled"
      :label="t('WaterfallPiano.hitLine')"
      @update:model-value="emit('update', 'separatorEnabled', $event)"
    />
    <SettingsToggle
      :model-value="settings.showNoteNames"
      :label="t('WaterfallPiano.showNoteNames')"
      @update:model-value="emit('update', 'showNoteNames', $event)"
    />
  </SettingsCollapse>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  SettingsCollapse,
  SettingsToggle,
  SettingsSelect,
  SettingsRange,
  SettingsColorPicker,
} from "@/components/Settings";
import {
  createKeyRangeOptions,
  createKeyLabelOptions,
} from "../../config/options";
import type { KeyboardConfig } from "../../types";

defineProps<{
  settings: KeyboardConfig;
}>();

const emit = defineEmits<{
  (e: "update", key: keyof KeyboardConfig, value: unknown): void;
}>();

const { t } = useI18n();
const keyRangeOptions = computed(() => createKeyRangeOptions(t));
const keyLabelOptions = computed(() => createKeyLabelOptions(t));
</script>
