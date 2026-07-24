<template>
  <SettingsCollapse
    :title="t('WaterfallPiano.fluidAdvancedParams')"
    icon="droplet"
    :default-open="false"
  >
    <SettingsRange
      :model-value="fluidParams.splatRadius ?? 0.0001"
      :label="t('WaterfallPiano.splatRadius')"
      :min="0"
      :max="0.01"
      :step="0.0001"
      @update:model-value="emit('update', 'splatRadius', $event)"
    />
    <SettingsRange
      :model-value="fluidParams.splatColorHue ?? 0"
      :label="t('WaterfallPiano.splatColorHue')"
      :min="0"
      :max="1"
      :step="0.05"
      @update:model-value="emit('update', 'splatColorHue', $event)"
    />
    <SettingsRange
      :model-value="fluidParams.trailLength ?? 0.2"
      :label="t('WaterfallPiano.trailLength')"
      :min="0"
      :max="1"
      :step="0.05"
      @update:model-value="emit('update', 'trailLength', $event)"
    />
    <SettingsRange
      :model-value="fluidParams.flowPersistence ?? 0.2"
      :label="t('WaterfallPiano.flowPersistence')"
      :min="0"
      :max="1"
      :step="0.05"
      @update:model-value="emit('update', 'flowPersistence', $event)"
    />
    <SettingsToggle
      :model-value="fluidParams.bloom ?? true"
      :label="t('WaterfallPiano.bloom')"
      @update:model-value="emit('update', 'bloom', $event)"
    />
    <SettingsRange
      v-if="fluidParams.bloom !== false"
      :model-value="fluidParams.bloomIntensity ?? 0.8"
      :label="t('WaterfallPiano.bloomIntensity')"
      :min="0"
      :max="2"
      :step="0.1"
      @update:model-value="emit('update', 'bloomIntensity', $event)"
    />
    <SettingsToggle
      :model-value="fluidParams.hitExplosion ?? false"
      :label="t('WaterfallPiano.hitExplosion')"
      @update:model-value="emit('update', 'hitExplosion', $event)"
    />
    <SettingsToggle
      :model-value="fluidParams.blockCoverage ?? false"
      :label="t('WaterfallPiano.blockCoverage')"
      @update:model-value="emit('update', 'blockCoverage', $event)"
    />

    <!-- 随机扰动：每个发射点独立控制 -->
    <div class="divider my-2" />
    <p
      class="text-hig-xs font-medium uppercase tracking-wide text-base-content/70 mb-1"
    >
      {{ t("WaterfallPiano.perturbation") }}
    </p>

    <SettingsRange
      :model-value="fluidParams.fluidSplatPerturbation?.positionJitter ?? 0.5"
      :label="
        t('WaterfallPiano.fluidSplatPerturbation') +
        ' · ' +
        t('WaterfallPiano.positionJitter')
      "
      :min="0"
      :max="1"
      :step="0.05"
      @update:model-value="
        emit('update', 'fluidSplatPerturbation', {
          ...fluidParams.fluidSplatPerturbation,
          positionJitter: $event,
        })
      "
    />
    <SettingsRange
      :model-value="fluidParams.fluidSplatPerturbation?.forceJitter ?? 0.5"
      :label="
        t('WaterfallPiano.fluidSplatPerturbation') +
        ' · ' +
        t('WaterfallPiano.forceJitter')
      "
      :min="0"
      :max="1"
      :step="0.05"
      @update:model-value="
        emit('update', 'fluidSplatPerturbation', {
          ...fluidParams.fluidSplatPerturbation,
          forceJitter: $event,
        })
      "
    />
    <SettingsRange
      :model-value="fluidParams.fluidSplatPerturbation?.colorJitter ?? 0.5"
      :label="
        t('WaterfallPiano.fluidSplatPerturbation') +
        ' · ' +
        t('WaterfallPiano.colorJitter')
      "
      :min="0"
      :max="1"
      :step="0.05"
      @update:model-value="
        emit('update', 'fluidSplatPerturbation', {
          ...fluidParams.fluidSplatPerturbation,
          colorJitter: $event,
        })
      "
    />

    <SettingsRange
      :model-value="fluidParams.hitExplosionPerturbation?.positionJitter ?? 0.5"
      :label="
        t('WaterfallPiano.hitExplosionPerturbation') +
        ' · ' +
        t('WaterfallPiano.positionJitter')
      "
      :min="0"
      :max="1"
      :step="0.05"
      @update:model-value="
        emit('update', 'hitExplosionPerturbation', {
          ...fluidParams.hitExplosionPerturbation,
          positionJitter: $event,
        })
      "
    />
    <SettingsRange
      :model-value="fluidParams.hitExplosionPerturbation?.forceJitter ?? 0.5"
      :label="
        t('WaterfallPiano.hitExplosionPerturbation') +
        ' · ' +
        t('WaterfallPiano.forceJitter')
      "
      :min="0"
      :max="1"
      :step="0.05"
      @update:model-value="
        emit('update', 'hitExplosionPerturbation', {
          ...fluidParams.hitExplosionPerturbation,
          forceJitter: $event,
        })
      "
    />
    <SettingsRange
      :model-value="fluidParams.hitExplosionPerturbation?.colorJitter ?? 0.5"
      :label="
        t('WaterfallPiano.hitExplosionPerturbation') +
        ' · ' +
        t('WaterfallPiano.colorJitter')
      "
      :min="0"
      :max="1"
      :step="0.05"
      @update:model-value="
        emit('update', 'hitExplosionPerturbation', {
          ...fluidParams.hitExplosionPerturbation,
          colorJitter: $event,
        })
      "
    />

    <SettingsRange
      :model-value="
        fluidParams.blockCoveragePerturbation?.positionJitter ?? 0.5
      "
      :label="
        t('WaterfallPiano.blockCoveragePerturbation') +
        ' · ' +
        t('WaterfallPiano.positionJitter')
      "
      :min="0"
      :max="1"
      :step="0.05"
      @update:model-value="
        emit('update', 'blockCoveragePerturbation', {
          ...fluidParams.blockCoveragePerturbation,
          positionJitter: $event,
        })
      "
    />
    <SettingsRange
      :model-value="fluidParams.blockCoveragePerturbation?.forceJitter ?? 0.5"
      :label="
        t('WaterfallPiano.blockCoveragePerturbation') +
        ' · ' +
        t('WaterfallPiano.forceJitter')
      "
      :min="0"
      :max="1"
      :step="0.05"
      @update:model-value="
        emit('update', 'blockCoveragePerturbation', {
          ...fluidParams.blockCoveragePerturbation,
          forceJitter: $event,
        })
      "
    />
    <SettingsRange
      :model-value="fluidParams.blockCoveragePerturbation?.colorJitter ?? 0.5"
      :label="
        t('WaterfallPiano.blockCoveragePerturbation') +
        ' · ' +
        t('WaterfallPiano.colorJitter')
      "
      :min="0"
      :max="1"
      :step="0.05"
      @update:model-value="
        emit('update', 'blockCoveragePerturbation', {
          ...fluidParams.blockCoveragePerturbation,
          colorJitter: $event,
        })
      "
    />

    <SettingsRange
      :model-value="
        fluidParams.sustainedSplatPerturbation?.positionJitter ?? 0.5
      "
      :label="
        t('WaterfallPiano.sustainedSplatPerturbation') +
        ' · ' +
        t('WaterfallPiano.positionJitter')
      "
      :min="0"
      :max="1"
      :step="0.05"
      @update:model-value="
        emit('update', 'sustainedSplatPerturbation', {
          ...fluidParams.sustainedSplatPerturbation,
          positionJitter: $event,
        })
      "
    />
    <SettingsRange
      :model-value="fluidParams.sustainedSplatPerturbation?.forceJitter ?? 0.5"
      :label="
        t('WaterfallPiano.sustainedSplatPerturbation') +
        ' · ' +
        t('WaterfallPiano.forceJitter')
      "
      :min="0"
      :max="1"
      :step="0.05"
      @update:model-value="
        emit('update', 'sustainedSplatPerturbation', {
          ...fluidParams.sustainedSplatPerturbation,
          forceJitter: $event,
        })
      "
    />
    <SettingsRange
      :model-value="fluidParams.sustainedSplatPerturbation?.colorJitter ?? 0.5"
      :label="
        t('WaterfallPiano.sustainedSplatPerturbation') +
        ' · ' +
        t('WaterfallPiano.colorJitter')
      "
      :min="0"
      :max="1"
      :step="0.05"
      @update:model-value="
        emit('update', 'sustainedSplatPerturbation', {
          ...fluidParams.sustainedSplatPerturbation,
          colorJitter: $event,
        })
      "
    />
  </SettingsCollapse>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import {
  SettingsCollapse,
  SettingsToggle,
  SettingsRange,
} from "@/components/Settings";
import type { FluidAdvancedParams } from "@/engine/fluid";

defineProps<{
  fluidParams: FluidAdvancedParams;
}>();

const emit = defineEmits<{
  (e: "update", key: keyof FluidAdvancedParams, value: unknown): void;
}>();

const { t } = useI18n();
</script>
