<template>
  <SettingsCollapse
    :title="t('WaterfallPiano.keyboard')"
    icon="piano"
    :default-open="true"
  >
    <SettingsToggle
      :model-value="settings.visible"
      :label="t('WaterfallPiano.keyboard')"
      @update:model-value="emit('update', 'visible', $event)"
    />
    <SettingsSelect
      :model-value="settings.theme ?? ''"
      :label="t('WaterfallPiano.pianoTheme')"
      :options="pianoThemeOptions"
      @update:model-value="onThemeChange"
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
      :min="0.1"
      :max="0.5"
      :step="0.05"
      @update:model-value="emit('update', 'heightRatio', $event)"
    />
    <SettingsRange
      :model-value="settings.blackKeyHeightRatio"
      :label="t('WaterfallPiano.blackKeyHeightRatio')"
      :min="0.3"
      :max="0.8"
      :step="0.02"
      @update:model-value="emit('update', 'blackKeyHeightRatio', $event)"
    />
    <SettingsRange
      :model-value="settings.keyCornerRadius"
      :label="t('WaterfallPiano.cornerRadius')"
      :min="0"
      :max="20"
      :step="1"
      @update:model-value="emit('update', 'keyCornerRadius', $event)"
    />
    <SettingsColorPicker
      :model-value="settings.whiteKeyColor"
      :label="t('WaterfallPiano.whiteKeyColor')"
      @update:model-value="onColorChange('whiteKeyColor', $event)"
    />
    <SettingsColorPicker
      :model-value="settings.blackKeyColor"
      :label="t('WaterfallPiano.blackKeyColor')"
      @update:model-value="onColorChange('blackKeyColor', $event)"
    />
    <SettingsColorPicker
      :model-value="settings.pressedKeyColor"
      :label="t('WaterfallPiano.pressedKeyColor')"
      @update:model-value="onColorChange('pressedKeyColor', $event)"
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
  createPianoThemeOptions,
} from "../../config/options";
import { getThemeColors, type PianoTheme } from "../../config/pianoThemes";
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
const pianoThemeOptions = computed(() => createPianoThemeOptions(t));

/**
 * 主题切换：同时更新 theme 字段和所有颜色字段，
 * 使颜色选择器立即反映主题色板。
 */
function onThemeChange(theme: string | number): void {
  const themeStr = String(theme);
  if (!themeStr) {
    emit("update", "theme", undefined);
    return;
  }
  const pianoTheme = themeStr as PianoTheme;
  emit("update", "theme", pianoTheme);

  const colors = getThemeColors(pianoTheme);
  if (colors) {
    emit("update", "whiteKeyColor", colors.whiteKeyColor);
    emit("update", "blackKeyColor", colors.blackKeyColor);
    emit("update", "pressedKeyColor", colors.pressedKeyColor);
    emit("update", "keyBorderColor", colors.keyBorderColor);
    emit("update", "separatorColor", colors.separatorColor);
  }
}

/**
 * 颜色单独修改时清除主题，切换为自定义模式。
 * 这样渲染器回退到独立颜色字段，用户的修改立即生效。
 */
function onColorChange(key: keyof KeyboardConfig, value: unknown): void {
  emit("update", key, value);
  emit("update", "theme", undefined);
}
</script>
