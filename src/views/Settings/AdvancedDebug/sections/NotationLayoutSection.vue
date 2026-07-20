<template>
  <SettingsCollapse
    v-if="isVisible"
    :title="t('advancedDebug.notation.layout.title')"
    icon="layout"
    :open="isOpen"
    :section-id="sectionId"
    @update:open="$emit('update:open', $event)"
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
    <SettingsRange
      :model-value="modelValue.noteStartXOffset"
      :label="t('advancedDebug.notation.layout.noteStartXOffset')"
      :description="t('advancedDebug.notation.layout.noteStartXOffsetHint')"
      :min="0"
      :max="100"
      :step="1"
      @update:model-value="emit('update', 'noteStartXOffset', $event)"
    />
    <SettingsRange
      :model-value="modelValue.minScaleRatio"
      :label="t('advancedDebug.notation.layout.minScaleRatio')"
      :description="t('advancedDebug.notation.layout.minScaleRatioHint')"
      :min="0.1"
      :max="1"
      :step="0.05"
      @update:model-value="emit('update', 'minScaleRatio', $event)"
    />
  </SettingsCollapse>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { SettingsCollapse, SettingsRange } from "@/components/Settings";
import type { NotationLayoutConfig } from "@/components/Notation/types";

interface Props {
  modelValue: NotationLayoutConfig;
  open?: boolean;
  sectionId?: string;
  searchQuery?: string;
}

const props = withDefaults(defineProps<Props>(), {
  open: undefined,
  sectionId: undefined,
  searchQuery: "",
});

const emit = defineEmits<{
  (e: "update", key: keyof NotationLayoutConfig, value: number): void;
  (e: "update:open", value: boolean): void;
}>();

const { t } = useI18n();

const isVisible = computed(() => {
  const q = props.searchQuery.trim().toLowerCase();
  if (!q) return true;
  return t("advancedDebug.notation.layout.title").toLowerCase().includes(q);
});

const isOpen = computed(() => {
  if (props.searchQuery.trim()) return true;
  return props.open;
});
</script>
