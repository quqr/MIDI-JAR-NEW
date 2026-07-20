<template>
  <SettingsCollapse
    v-if="isVisible"
    :title="t('advancedDebug.waterfall.fluid.title')"
    icon="water"
    :open="isOpen"
    :section-id="sectionId"
    @update:open="$emit('update:open', $event)"
  >
    <SettingsToggle
      :model-value="fluidAdvanced"
      :label="t('advancedDebug.waterfall.fluid.fluidAdvanced')"
      :description="t('advancedDebug.waterfall.fluid.fluidAdvancedHint')"
      @update:model-value="emit('updateBg', 'fluidAdvanced', $event)"
    />
    <template v-if="fluidAdvanced">
      <SettingsRange
        :model-value="fluidParams.simResolution"
        :label="t('advancedDebug.waterfall.fluid.simResolution')"
        :min="32"
        :max="256"
        :step="32"
        @update:model-value="emit('updateFluidParam', 'simResolution', $event)"
      />
      <SettingsRange
        :model-value="fluidParams.splatRadius"
        :label="t('advancedDebug.waterfall.fluid.splatRadius')"
        :min="0.0001"
        :max="0.01"
        :step="0.0005"
        @update:model-value="emit('updateFluidParam', 'splatRadius', $event)"
      />
      <SettingsRange
        :model-value="fluidParams.splatColorHue"
        :label="t('advancedDebug.waterfall.fluid.splatColorHue')"
        :min="0"
        :max="1"
        :step="0.05"
        @update:model-value="emit('updateFluidParam', 'splatColorHue', $event)"
      />
      <SettingsRange
        :model-value="fluidParams.trailLength"
        :label="t('advancedDebug.waterfall.fluid.trailLength')"
        :description="t('advancedDebug.waterfall.fluid.trailLengthHint')"
        :min="0"
        :max="1"
        :step="0.05"
        @update:model-value="emit('updateFluidParam', 'trailLength', $event)"
      />
      <SettingsRange
        :model-value="fluidParams.flowPersistence"
        :label="t('advancedDebug.waterfall.fluid.flowPersistence')"
        :description="t('advancedDebug.waterfall.fluid.flowPersistenceHint')"
        :min="0"
        :max="1"
        :step="0.05"
        @update:model-value="emit('updateFluidParam', 'flowPersistence', $event)"
      />
      <SettingsToggle
        :model-value="fluidParams.bloom"
        :label="t('advancedDebug.waterfall.fluid.bloom')"
        @update:model-value="emit('updateFluidParam', 'bloom', $event)"
      />
      <SettingsRange
        v-if="fluidParams.bloom"
        :model-value="fluidParams.bloomIntensity"
        :label="t('advancedDebug.waterfall.fluid.bloomIntensity')"
        :min="0.1"
        :max="2"
        :step="0.1"
        @update:model-value="emit('updateFluidParam', 'bloomIntensity', $event)"
      />
      <SettingsToggle
        :model-value="fluidParams.hitExplosion"
        :label="t('advancedDebug.waterfall.fluid.hitExplosion')"
        :description="t('advancedDebug.waterfall.fluid.hitExplosionHint')"
        @update:model-value="emit('updateFluidParam', 'hitExplosion', $event)"
      />
      <SettingsToggle
        :model-value="fluidParams.blockCoverage"
        :label="t('advancedDebug.waterfall.fluid.blockCoverage')"
        :description="t('advancedDebug.waterfall.fluid.blockCoverageHint')"
        @update:model-value="emit('updateFluidParam', 'blockCoverage', $event)"
      />
    </template>
  </SettingsCollapse>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  SettingsCollapse,
  SettingsRange,
  SettingsToggle,
} from "@/components/Settings";
import type { FluidAdvancedParams } from "@/engine/fluid";

interface Props {
  fluidAdvanced: boolean;
  fluidParams: Required<FluidAdvancedParams>;
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
  (e: "updateBg", key: string, value: unknown): void;
  (
    e: "updateFluidParam",
    key: keyof FluidAdvancedParams,
    value: unknown,
  ): void;
  (e: "update:open", value: boolean): void;
}>();

const { t } = useI18n();

const isVisible = computed(() => {
  const q = props.searchQuery.trim().toLowerCase();
  if (!q) return true;
  return t("advancedDebug.waterfall.fluid.title").toLowerCase().includes(q);
});

const isOpen = computed(() => {
  if (props.searchQuery.trim()) return true;
  return props.open;
});
</script>
