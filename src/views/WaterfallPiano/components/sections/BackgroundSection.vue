<template>
  <SettingsCollapse
    :title="t('WaterfallPiano.background')"
    icon="image"
    :default-open="false"
  >
    <SettingsColorPicker
      :model-value="settings.solidColor"
      :label="t('WaterfallPiano.solidColor')"
      @update:model-value="emit('update', 'solidColor', $event)"
    />
    <SettingsToggle
      :model-value="settings.fluidEnabled"
      :label="t('WaterfallPiano.fluidEnabled')"
      @update:model-value="emit('update', 'fluidEnabled', $event)"
    />
    <template v-if="settings.fluidEnabled">
      <SettingsRange
        :model-value="settings.fluidParams.simResolution ?? 128"
        :label="t('WaterfallPiano.fluidQuality')"
        :min="0"
        :max="256"
        :step="32"
        @update:model-value="
          emit('update', 'fluidParams', {
            ...settings.fluidParams,
            simResolution: $event,
          })
        "
      />
      <SettingsSelect
        :model-value="settings.fluidStyle"
        :label="t('WaterfallPiano.fluidStyle')"
        :options="fluidStyleOptions"
        @update:model-value="emit('update', 'fluidStyle', $event)"
      />
      <SettingsToggle
        :model-value="settings.fluidAdvanced"
        :label="t('WaterfallPiano.fluidAdvanced')"
        @update:model-value="emit('update', 'fluidAdvanced', $event)"
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
import { createFluidStyleOptions } from "../../config/options";
import type { BackgroundConfig } from "../../types";

defineProps<{
  settings: BackgroundConfig;
}>();

const emit = defineEmits<{
  (e: "update", key: keyof BackgroundConfig, value: unknown): void;
}>();

const { t } = useI18n();
const fluidStyleOptions = computed(() => createFluidStyleOptions(t));
</script>
