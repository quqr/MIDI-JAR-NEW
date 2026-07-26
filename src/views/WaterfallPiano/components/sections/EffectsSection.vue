<template>
  <SettingsCollapse
    :title="t('WaterfallPiano.effects')"
    icon="filter"
    :default-open="false"
  >
    <!-- AdvancedBloomFilter：应用到瀑布流层 -->
    <SettingsToggle
      :model-value="settings.advancedBloomEnabled"
      :label="t('WaterfallPiano.advancedBloomEnabled')"
      @update:model-value="emit('update', 'advancedBloomEnabled', $event)"
    />
    <template v-if="settings.advancedBloomEnabled">
      <SettingsRange
        :model-value="settings.advancedBloomThreshold"
        :label="t('WaterfallPiano.advancedBloomThreshold')"
        :min="0"
        :max="1"
        :step="0.05"
        @update:model-value="emit('update', 'advancedBloomThreshold', $event)"
      />
      <SettingsRange
        :model-value="settings.advancedBloomBloomScale"
        :label="t('WaterfallPiano.advancedBloomBloomScale')"
        :min="0"
        :max="5"
        :step="0.1"
        @update:model-value="
          emit('update', 'advancedBloomBloomScale', $event)
        "
      />
      <SettingsRange
        :model-value="settings.advancedBloomBlur"
        :label="t('WaterfallPiano.advancedBloomBlur')"
        :min="0"
        :max="20"
        :step="0.5"
        @update:model-value="emit('update', 'advancedBloomBlur', $event)"
      />
    </template>

    <div class="divider my-2" />

    <!-- BackdropBlurFilter：应用到流体层（模糊背景层） -->
    <SettingsToggle
      :model-value="settings.backdropBlurEnabled"
      :label="t('WaterfallPiano.backdropBlurEnabled')"
      @update:model-value="emit('update', 'backdropBlurEnabled', $event)"
    />
    <template v-if="settings.backdropBlurEnabled">
      <SettingsRange
        :model-value="settings.backdropBlurStrength"
        :label="t('WaterfallPiano.backdropBlurStrength')"
        :min="0"
        :max="20"
        :step="0.5"
        @update:model-value="emit('update', 'backdropBlurStrength', $event)"
      />
    </template>
  </SettingsCollapse>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { SettingsCollapse, SettingsToggle, SettingsRange } from "@/components/Settings";
import type { EffectsConfig } from "../../types";

defineProps<{
  settings: EffectsConfig;
}>();

const emit = defineEmits<{
  (e: "update", key: keyof EffectsConfig, value: unknown): void;
}>();

const { t } = useI18n();
</script>
