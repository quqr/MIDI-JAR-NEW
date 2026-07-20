<template>
  <SettingsCollapse
    :title="t('advancedDebug.notation.display.title')"
    icon="eye"
    :default-open="false"
  >
    <SettingsToggle
      :model-value="modelValue.clef"
      :label="t('advancedDebug.notation.display.clef')"
      @update:model-value="emit('update', 'clef', $event)"
    />
    <SettingsToggle
      :model-value="modelValue.keySignature"
      :label="t('advancedDebug.notation.display.keySignature')"
      @update:model-value="emit('update', 'keySignature', $event)"
    />
    <SettingsToggle
      :model-value="modelValue.keySignatureText"
      :label="t('advancedDebug.notation.display.keySignatureText')"
      @update:model-value="emit('update', 'keySignatureText', $event)"
    />
    <SettingsToggle
      :model-value="modelValue.barlines"
      :label="t('advancedDebug.notation.display.barlines')"
      @update:model-value="emit('update', 'barlines', $event)"
    />
    <SettingsToggle
      :model-value="modelValue.timeSignature"
      :label="t('advancedDebug.notation.display.timeSignature')"
      @update:model-value="emit('update', 'timeSignature', $event)"
    />
    <SettingsToggle
      :model-value="modelValue.noteNames"
      :label="t('advancedDebug.notation.display.noteNames')"
      @update:model-value="emit('update', 'noteNames', $event)"
    />
    <SettingsToggle
      :model-value="modelValue.staffLines"
      :label="t('advancedDebug.notation.display.staffLines')"
      @update:model-value="emit('update', 'staffLines', $event)"
    />
  </SettingsCollapse>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { SettingsCollapse, SettingsToggle } from "@/components/Settings";
import type { NotationDisplayConfig } from "@/components/Notation/types";

defineProps<{
  modelValue: NotationDisplayConfig;
}>();

const emit = defineEmits<{
  (e: "update", key: keyof NotationDisplayConfig, value: boolean): void;
}>();

const { t } = useI18n();
</script>
