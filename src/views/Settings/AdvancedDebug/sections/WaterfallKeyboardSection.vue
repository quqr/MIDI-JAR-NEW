<template>
  <SettingsCollapse
    :title="t('advancedDebug.waterfall.keyboard.title')"
    icon="keyboard"
    :default-open="false"
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
  </SettingsCollapse>
</template>

<script setup lang="ts">
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
}

interface SelectOption {
  value: string;
  label: string;
}

defineProps<{
  keyboard: KeyboardSettings;
  flowDirectionOptions: SelectOption[];
}>();

const emit = defineEmits<{
  (e: "updateKb", key: string, value: unknown): void;
}>();

const { t } = useI18n();
</script>
