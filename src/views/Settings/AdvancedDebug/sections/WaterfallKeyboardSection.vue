<template>
  <SettingsCollapse
    v-if="isVisible"
    :title="t('advancedDebug.waterfall.keyboard.title')"
    icon="keyboard"
    :open="isOpen"
    :section-id="sectionId"
    @update:open="$emit('update:open', $event)"
  >
    <template v-if="keyboard.range === 'custom'">
      <SettingsTextInput
        :model-value="keyboard.customFrom"
        :label="t('advancedDebug.waterfall.keyboard.customFrom')"
        @update:model-value="emit('updateKb', 'customFrom', $event)"
      />
      <SettingsTextInput
        :model-value="keyboard.customTo"
        :label="t('advancedDebug.waterfall.keyboard.customTo')"
        @update:model-value="emit('updateKb', 'customTo', $event)"
      />
    </template>
    <SettingsRange
      :model-value="keyboard.keyBorderWidth"
      :label="t('advancedDebug.waterfall.keyboard.keyBorderWidth')"
      :min="0"
      :max="5"
      :step="0.5"
      @update:model-value="emit('updateKb', 'keyBorderWidth', $event)"
    />
    <SettingsColorPicker
      :model-value="keyboard.keyBorderColor"
      :label="t('advancedDebug.waterfall.keyboard.keyBorderColor')"
      @update:model-value="emit('updateKb', 'keyBorderColor', $event)"
    />
    <SettingsRange
      :model-value="keyboard.gapBlur"
      :label="t('advancedDebug.waterfall.keyboard.gapBlur')"
      :min="0"
      :max="10"
      :step="0.5"
      @update:model-value="emit('updateKb', 'gapBlur', $event)"
    />
    <SettingsColorPicker
      :model-value="keyboard.separatorColor"
      :label="t('advancedDebug.waterfall.keyboard.separatorColor')"
      @update:model-value="emit('updateKb', 'separatorColor', $event)"
    />
    <SettingsRange
      :model-value="keyboard.separatorThickness"
      :label="t('advancedDebug.waterfall.keyboard.separatorThickness')"
      :min="1"
      :max="10"
      :step="1"
      @update:model-value="emit('updateKb', 'separatorThickness', $event)"
    />
    <SettingsToggle
      :model-value="keyboard.staffVisible"
      :label="t('advancedDebug.waterfall.keyboard.staffVisible')"
      @update:model-value="emit('updateKb', 'staffVisible', $event)"
    />
    <SettingsSelect
      :model-value="keyboard.synthesiaFlowDirection"
      :label="t('advancedDebug.waterfall.keyboard.synthesiaFlowDirection')"
      :options="flowDirectionOptions"
      @update:model-value="emit('updateKb', 'synthesiaFlowDirection', $event)"
    />
    <SettingsRange
      :model-value="keyboard.defaultVelocity"
      :label="t('advancedDebug.waterfall.keyboard.defaultVelocity')"
      :description="t('advancedDebug.waterfall.keyboard.defaultVelocityHint')"
      :min="0"
      :max="127"
      :step="1"
      @update:model-value="emit('updateKb', 'defaultVelocity', $event)"
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
  SettingsTextInput,
  SettingsToggle,
} from "@/components/Settings";

interface KeyboardSettings {
  range: string;
  customFrom: string;
  customTo: string;
  keyBorderWidth: number;
  keyBorderColor: string;
  gapBlur: number;
  separatorColor: string;
  separatorThickness: number;
  staffVisible: boolean;
  synthesiaFlowDirection: string;
  defaultVelocity: number;
}

interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  keyboard: KeyboardSettings;
  flowDirectionOptions: SelectOption[];
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
  (e: "updateKb", key: string, value: unknown): void;
  (e: "update:open", value: boolean): void;
}>();

const { t } = useI18n();

const isVisible = computed(() => {
  const q = props.searchQuery.trim().toLowerCase();
  if (!q) return true;
  return t("advancedDebug.waterfall.keyboard.title").toLowerCase().includes(q);
});

const isOpen = computed(() => {
  if (props.searchQuery.trim()) return true;
  return props.open;
});
</script>
