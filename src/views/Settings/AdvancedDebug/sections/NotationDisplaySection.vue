<template>
  <SettingsCollapse
    v-if="isVisible"
    :title="t('advancedDebug.notation.display.title')"
    icon="eye"
    :open="isOpen"
    :section-id="sectionId"
    @update:open="$emit('update:open', $event)"
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
    <SettingsToggle
      :model-value="modelValue.filterClef"
      :label="t('advancedDebug.notation.display.filterClef')"
      :description="t('advancedDebug.notation.display.filterClefHint')"
      @update:model-value="emit('update', 'filterClef', $event)"
    />
  </SettingsCollapse>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { SettingsCollapse, SettingsToggle } from "@/components/Settings";
import type { NotationDisplayConfig } from "@/components/Notation/types";

interface Props {
  modelValue: NotationDisplayConfig;
  /** 外部控制展开状态（v-model:open） */
  open?: boolean;
  /** 唯一标识，用于搜索过滤 */
  sectionId?: string;
  /** 搜索关键词，非空时仅当标题匹配才显示 */
  searchQuery?: string;
}

const props = withDefaults(defineProps<Props>(), {
  open: undefined,
  sectionId: undefined,
  searchQuery: "",
});

const emit = defineEmits<{
  (e: "update", key: keyof NotationDisplayConfig, value: boolean): void;
  (e: "update:open", value: boolean): void;
}>();

const { t } = useI18n();

const isVisible = computed(() => {
  const q = props.searchQuery.trim().toLowerCase();
  if (!q) return true;
  return t("advancedDebug.notation.display.title").toLowerCase().includes(q);
});

// 搜索激活时强制展开；否则使用外部 open 值
const isOpen = computed(() => {
  if (props.searchQuery.trim()) return true;
  return props.open;
});
</script>
