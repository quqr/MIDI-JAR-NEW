<template>
  <SettingsCollapse
    :title="t('WaterfallPiano.particles')"
    icon="sparkles"
    :default-open="true"
  >
    <SettingsSelect
      :model-value="settings.colorScheme"
      :label="t('WaterfallPiano.colorScheme')"
      :options="colorSchemeOptions"
      @update:model-value="emit('update', 'colorScheme', $event)"
    />
    <SettingsRange
      :model-value="settings.speed"
      :label="t('WaterfallPiano.speed')"
      :min="0"
      :max="5"
      :step="0.1"
      @update:model-value="emit('update', 'speed', $event)"
    />
    <SettingsRange
      :model-value="settings.lookAhead"
      :label="t('WaterfallPiano.lookAhead')"
      :min="0"
      :max="10"
      :step="0.5"
      @update:model-value="emit('update', 'lookAhead', $event)"
    />
    <SettingsRange
      :model-value="settings.opacity"
      :label="t('WaterfallPiano.opacity')"
      :min="0"
      :max="1"
      :step="0.05"
      @update:model-value="emit('update', 'opacity', $event)"
    />
    <SettingsRange
      :model-value="settings.cornerRadius"
      :label="t('WaterfallPiano.cornerRadius')"
      :min="0"
      :max="20"
      :step="1"
      @update:model-value="emit('update', 'cornerRadius', $event)"
    />
    <SettingsRange
      :model-value="settings.hitExplosionRadius"
      :label="t('WaterfallPiano.hitExplosionRadius')"
      :min="0"
      :max="0.1"
      :step="0.005"
      @update:model-value="emit('update', 'hitExplosionRadius', $event)"
    />
    <SettingsToggle
      :model-value="settings.hitLine.visible"
      :label="t('WaterfallPiano.hitLine')"
      @update:model-value="
        emit('update', 'hitLine', { ...settings.hitLine, visible: $event })
      "
    />
    <SettingsColorPicker
      v-if="settings.hitLine.visible"
      :model-value="settings.hitLine.color"
      :label="t('WaterfallPiano.hitLine')"
      @update:model-value="
        emit('update', 'hitLine', { ...settings.hitLine, color: $event })
      "
    />
    <SettingsRange
      v-if="settings.hitLine.visible"
      :model-value="settings.hitLine.thickness"
      :label="t('WaterfallPiano.hitLine')"
      :min="0"
      :max="10"
      :step="1"
      @update:model-value="
        emit('update', 'hitLine', { ...settings.hitLine, thickness: $event })
      "
    />
    <template v-if="settings.colorScheme === 'custom'">
      <SettingsColorPicker
        :model-value="settings.customColors.low"
        :label="t('WaterfallPiano.low')"
        @update:model-value="
          emit('update', 'customColors', {
            ...settings.customColors,
            low: $event,
          })
        "
      />
      <SettingsColorPicker
        :model-value="settings.customColors.mid"
        :label="t('WaterfallPiano.mid')"
        @update:model-value="
          emit('update', 'customColors', {
            ...settings.customColors,
            mid: $event,
          })
        "
      />
      <SettingsColorPicker
        :model-value="settings.customColors.high"
        :label="t('WaterfallPiano.high')"
        @update:model-value="
          emit('update', 'customColors', {
            ...settings.customColors,
            high: $event,
          })
        "
      />
    </template>
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
import { createColorSchemeOptions } from "../../config/options";
import type { ParticleConfig } from "../../types";

const props = defineProps<{
  settings: ParticleConfig;
}>();

const emit = defineEmits<{
  (e: "update", key: keyof ParticleConfig, value: unknown): void;
}>();

const { t } = useI18n();
const colorSchemeOptions = computed(() => createColorSchemeOptions(t));
</script>
