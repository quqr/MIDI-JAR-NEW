<template>
  <SettingsCollapse
    :title="t('WaterfallPiano.aura')"
    icon="sparkles"
    :default-open="false"
  >
    <SettingsToggle
      :model-value="settings.enabled"
      :label="t('WaterfallPiano.auraEnabled')"
      @update:model-value="emit('update', 'enabled', $event)"
    />
    <template v-if="settings.enabled">
      <SettingsRadioGroup
        :model-value="settings.style"
        :label="t('WaterfallPiano.auraStyle')"
        :options="auraStyleOptions"
        @update:model-value="emit('update', 'style', $event)"
      />
      <SettingsRadioGroup
        :model-value="settings.target"
        :label="t('WaterfallPiano.auraTarget')"
        :options="auraTargetOptions"
        @update:model-value="emit('update', 'target', $event)"
      />

      <!-- 第 1 层：Aura 区域 -->
      <div class="text-xs font-medium text-base-content/60 mt-2 mb-1 px-1">
        Area
      </div>
      <SettingsRange
        :model-value="settings.padding"
        :label="t('WaterfallPiano.auraPadding')"
        :min="0"
        :max="30"
        :step="1"
        @update:model-value="emit('update', 'padding', $event)"
      />

      <!-- 第 2 层：双层光晕 -->
      <div class="text-xs font-medium text-base-content/60 mt-2 mb-1 px-1">
        Glow Layers
      </div>
      <SettingsRange
        :model-value="settings.innerBlur"
        :label="t('WaterfallPiano.auraInnerBlur')"
        :min="0"
        :max="100"
        :step="1"
        @update:model-value="emit('update', 'innerBlur', $event)"
      />
      <SettingsRange
        :model-value="settings.innerOpacity"
        :label="t('WaterfallPiano.auraInnerOpacity')"
        :min="0"
        :max="100"
        :step="1"
        @update:model-value="emit('update', 'innerOpacity', $event)"
      />
      <SettingsRange
        :model-value="settings.outerBlur"
        :label="t('WaterfallPiano.auraOuterBlur')"
        :min="0"
        :max="100"
        :step="1"
        @update:model-value="emit('update', 'outerBlur', $event)"
      />
      <SettingsRange
        :model-value="settings.outerOpacity"
        :label="t('WaterfallPiano.auraOuterOpacity')"
        :min="0"
        :max="100"
        :step="1"
        @update:model-value="emit('update', 'outerOpacity', $event)"
      />

      <!-- 第 3 层：动画 -->
      <div class="text-xs font-medium text-base-content/60 mt-2 mb-1 px-1">
        Animation
      </div>
      <SettingsRange
        :model-value="settings.duration"
        :label="t('WaterfallPiano.auraDuration')"
        :min="0"
        :max="60"
        :step="1"
        @update:model-value="emit('update', 'duration', $event)"
      />
      <SettingsRange
        :model-value="settings.rotationRange"
        :label="t('WaterfallPiano.auraRotationRange')"
        :min="0"
        :max="1080"
        :step="15"
        @update:model-value="emit('update', 'rotationRange', $event)"
      />

      <!-- 第 4 层：光束形状（仅 conic 样式） -->
      <template v-if="settings.style !== 'glow'">
        <div class="text-xs font-medium text-base-content/60 mt-2 mb-1 px-1">
          Beam Shape
        </div>
        <SettingsRange
          :model-value="settings.beamAngle"
          :label="t('WaterfallPiano.auraBeamAngle')"
          :min="0"
          :max="360"
          :step="5"
          @update:model-value="emit('update', 'beamAngle', $event)"
        />
        <SettingsRange
          :model-value="settings.beamWidth"
          :label="t('WaterfallPiano.auraBeamWidth')"
          :min="0"
          :max="350"
          :step="5"
          @update:model-value="emit('update', 'beamWidth', $event)"
        />
      </template>

      <!-- 第 5 层：样式专属参数 -->
      <template v-if="settings.style === 'glow'">
        <div class="text-xs font-medium text-base-content/60 mt-2 mb-1 px-1">
          Glow Settings
        </div>
        <SettingsRange
          :model-value="settings.glowExtent"
          :label="t('WaterfallPiano.auraGlowExtent')"
          :min="0"
          :max="150"
          :step="5"
          @update:model-value="emit('update', 'glowExtent', $event)"
        />
        <SettingsRange
          :model-value="settings.glowPeakOpacity"
          :label="t('WaterfallPiano.auraGlowPeakOpacity')"
          :min="0"
          :max="100"
          :step="1"
          @update:model-value="emit('update', 'glowPeakOpacity', $event)"
        />
        <SettingsRange
          :model-value="settings.glowPeakBlur"
          :label="t('WaterfallPiano.auraGlowPeakBlur')"
          :min="0"
          :max="100"
          :step="1"
          @update:model-value="emit('update', 'glowPeakBlur', $event)"
        />
        <SettingsRange
          :model-value="settings.glowAfterPeakOpacity"
          :label="t('WaterfallPiano.auraGlowAfterPeakOpacity')"
          :min="0"
          :max="100"
          :step="1"
          @update:model-value="emit('update', 'glowAfterPeakOpacity', $event)"
        />
        <SettingsRange
          :model-value="settings.glowAfterPeakBlur"
          :label="t('WaterfallPiano.auraGlowAfterPeakBlur')"
          :min="0"
          :max="100"
          :step="1"
          @update:model-value="emit('update', 'glowAfterPeakBlur', $event)"
        />
      </template>

      <template v-if="settings.style === 'rainbow'">
        <div class="text-xs font-medium text-base-content/60 mt-2 mb-1 px-1">
          Rainbow Settings
        </div>
        <SettingsRange
          :model-value="settings.rainbowMargin"
          :label="t('WaterfallPiano.auraRainbowMargin')"
          :min="0"
          :max="50"
          :step="1"
          @update:model-value="emit('update', 'rainbowMargin', $event)"
        />
      </template>

      <template v-if="settings.style === 'dual'">
        <div class="text-xs font-medium text-base-content/60 mt-2 mb-1 px-1">
          Dual Settings
        </div>
        <SettingsRange
          :model-value="settings.dualOffRatio"
          :label="t('WaterfallPiano.auraDualOffRatio')"
          :min="0"
          :max="80"
          :step="1"
          @update:model-value="emit('update', 'dualOffRatio', $event)"
        />
        <SettingsRange
          :model-value="settings.dualOnRatio"
          :label="t('WaterfallPiano.auraDualOnRatio')"
          :min="0"
          :max="90"
          :step="1"
          @update:model-value="emit('update', 'dualOnRatio', $event)"
        />
      </template>

      <!-- 第 6 层：颜色 -->
      <template v-if="settings.style === 'custom'">
        <div class="text-xs font-medium text-base-content/60 mt-2 mb-1 px-1">
          Colors
        </div>
        <SettingsColorPicker
          :model-value="settings.primaryColor ?? '#6366f1'"
          :label="t('WaterfallPiano.auraPrimaryColor')"
          @update:model-value="emit('update', 'primaryColor', $event)"
        />
        <SettingsColorPicker
          :model-value="settings.backgroundColor ?? '#000000'"
          :label="t('WaterfallPiano.auraBackgroundColor')"
          @update:model-value="emit('update', 'backgroundColor', $event)"
        />
      </template>
    </template>
  </SettingsCollapse>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  SettingsCollapse,
  SettingsToggle,
  SettingsRange,
  SettingsColorPicker,
  SettingsRadioGroup,
} from "@/components/Settings";
import {
  createAuraStyleOptions,
  createAuraTargetOptions,
} from "../../config/options";
import type { AuraConfig } from "../../types";

defineProps<{
  settings: AuraConfig;
}>();

const emit = defineEmits<{
  (e: "update", key: keyof AuraConfig, value: unknown): void;
}>();

const { t } = useI18n();
const auraStyleOptions = computed(() => createAuraStyleOptions(t));
const auraTargetOptions = computed(() => createAuraTargetOptions(t));
</script>
