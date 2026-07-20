<template>
  <SettingsCollapse
    :title="t('advancedDebug.notation.style.title')"
    icon="palette"
    :default-open="false"
  >
    <SettingsColorPicker
      :model-value="modelValue.backgroundColor"
      :label="t('advancedDebug.notation.style.backgroundColor')"
      @update:model-value="emit('update', 'backgroundColor', $event)"
    />
    <SettingsColorPicker
      :model-value="modelValue.staffLineColor"
      :label="t('advancedDebug.notation.style.staffLineColor')"
      @update:model-value="emit('update', 'staffLineColor', $event)"
    />
    <SettingsColorPicker
      :model-value="modelValue.noteColor"
      :label="t('advancedDebug.notation.style.noteColor')"
      @update:model-value="emit('update', 'noteColor', $event)"
    />
    <SettingsColorPicker
      :model-value="modelValue.noteHighlightColor"
      :label="t('advancedDebug.notation.style.noteHighlightColor')"
      @update:model-value="emit('update', 'noteHighlightColor', $event)"
    />
    <SettingsRange
      :model-value="modelValue.fontSize"
      :label="t('advancedDebug.notation.style.fontSize')"
      :min="2"
      :max="60"
      :step="1"
      @update:model-value="emit('update', 'fontSize', $event)"
    />
  </SettingsCollapse>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import {
  SettingsCollapse,
  SettingsColorPicker,
  SettingsRange,
} from "@/components/Settings";
import type { NotationStyleConfig } from "@/components/Notation/types";

defineProps<{
  modelValue: NotationStyleConfig;
}>();

const emit = defineEmits<{
  (
    e: "update",
    key: keyof NotationStyleConfig,
    value: string | number | null,
  ): void;
}>();

const { t } = useI18n();
</script>
