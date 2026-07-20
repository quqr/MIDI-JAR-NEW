<template>
  <SettingsCollapse
    :title="t('advancedDebug.notation.layout.title')"
    icon="layout"
    :default-open="false"
  >
    <SettingsRange
      :model-value="modelValue.paddingTop"
      :label="t('advancedDebug.notation.layout.paddingTop')"
      :min="0"
      :max="300"
      :step="5"
      @update:model-value="emit('update', 'paddingTop', $event)"
    />
    <SettingsRange
      :model-value="modelValue.staveHeight"
      :label="t('advancedDebug.notation.layout.staveHeight')"
      :min="40"
      :max="500"
      :step="10"
      @update:model-value="emit('update', 'staveHeight', $event)"
    />
    <SettingsRange
      :model-value="modelValue.staveGap"
      :label="t('advancedDebug.notation.layout.staveGap')"
      :min="0"
      :max="200"
      :step="5"
      @update:model-value="emit('update', 'staveGap', $event)"
    />
    <SettingsRange
      :model-value="modelValue.textHeight"
      :label="t('advancedDebug.notation.layout.textHeight')"
      :min="0"
      :max="200"
      :step="5"
      @update:model-value="emit('update', 'textHeight', $event)"
    />
    <SettingsRange
      :model-value="modelValue.bottomPadding"
      :label="t('advancedDebug.notation.layout.bottomPadding')"
      :min="0"
      :max="200"
      :step="5"
      @update:model-value="emit('update', 'bottomPadding', $event)"
    />
    <SettingsRange
      :model-value="modelValue.sidePadding"
      :label="t('advancedDebug.notation.layout.sidePadding')"
      :min="0"
      :max="300"
      :step="5"
      @update:model-value="emit('update', 'sidePadding', $event)"
    />
    <SettingsRange
      :model-value="modelValue.clefWidth"
      :label="t('advancedDebug.notation.layout.clefWidth')"
      :min="10"
      :max="200"
      :step="5"
      @update:model-value="emit('update', 'clefWidth', $event)"
    />
    <SettingsRange
      :model-value="modelValue.noteWidth"
      :label="t('advancedDebug.notation.layout.noteWidth')"
      :min="20"
      :max="500"
      :step="10"
      @update:model-value="emit('update', 'noteWidth', $event)"
    />
    <SettingsRange
      :model-value="modelValue.keySignatureWidthPerAlteration"
      :label="
        t('advancedDebug.notation.layout.keySignatureWidthPerAlteration')
      "
      :description="
        t('advancedDebug.notation.layout.keySignatureWidthPerAlterationHint')
      "
      :min="20"
      :max="500"
      :step="10"
      @update:model-value="
        emit('update', 'keySignatureWidthPerAlteration', $event)
      "
    />
    <SettingsRange
      :model-value="modelValue.maxScale"
      :label="t('advancedDebug.notation.layout.maxScale')"
      :description="t('advancedDebug.notation.layout.maxScaleHint')"
      :min="0.1"
      :max="5"
      :step="0.1"
      @update:model-value="emit('update', 'maxScale', $event)"
    />
  </SettingsCollapse>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { SettingsCollapse, SettingsRange } from "@/components/Settings";
import type { NotationLayoutConfig } from "@/components/Notation/types";

defineProps<{
  modelValue: NotationLayoutConfig;
}>();

const emit = defineEmits<{
  (e: "update", key: keyof NotationLayoutConfig, value: number): void;
}>();

const { t } = useI18n();
</script>
