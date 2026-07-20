<template>
  <SettingsCollapse
    v-if="isVisible"
    :title="t('advancedDebug.notation.style.title')"
    icon="palette"
    :open="isOpen"
    :section-id="sectionId"
    @update:open="$emit('update:open', $event)"
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
    <SettingsSelect
      :model-value="modelValue.noteDuration"
      :label="t('advancedDebug.notation.style.noteDuration')"
      :description="t('advancedDebug.notation.style.noteDurationHint')"
      :options="noteDurationOptions"
      @update:model-value="emit('update', 'noteDuration', $event)"
    />
  </SettingsCollapse>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  SettingsCollapse,
  SettingsColorPicker,
  SettingsRange,
  SettingsSelect,
} from "@/components/Settings";
import type { NotationStyleConfig } from "@/components/Notation/types";

interface Props {
  modelValue: NotationStyleConfig;
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
  (
    e: "update",
    key: keyof NotationStyleConfig,
    value: string | number | null,
  ): void;
  (e: "update:open", value: boolean): void;
}>();

const { t } = useI18n();

const isVisible = computed(() => {
  const q = props.searchQuery.trim().toLowerCase();
  if (!q) return true;
  return t("advancedDebug.notation.style.title").toLowerCase().includes(q);
});

const isOpen = computed(() => {
  if (props.searchQuery.trim()) return true;
  return props.open;
});

// VexFlow 时值字符串选项
const noteDurationOptions = computed(() => [
  { value: "1", label: "1 · ♩ 全音符" },
  { value: "2", label: "2 · 二分音符" },
  { value: "4", label: "4 · ♩ 四分音符" },
  { value: "8", label: "8 · ♫ 八分音符" },
  { value: "16", label: "16 · 十六分音符" },
  { value: "32", label: "32 · 三十二分音符" },
]);
</script>
