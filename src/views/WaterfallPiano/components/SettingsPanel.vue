<template>
  <div class="p-4 space-y-3">
    <!-- 视觉设置 -->
    <SettingsCollapse
      :title="t('waterfallPiano.settingsGroups.visual')"
      :default-open="true"
    >
      <SettingsSelect
        :model-value="store.settings.particles.style"
        :label="t('waterfallPiano.visualStyle')"
        :options="visualStyleOptions"
        @update:model-value="store.updateSetting('particles', 'style', $event)"
      />
      <SettingsSelect
        :model-value="store.settings.particles.colorScheme"
        :label="t('waterfallPiano.colorScheme')"
        :options="colorSchemeOptions"
        @update:model-value="store.updateSetting('particles', 'colorScheme', $event)"
      />
      <SettingsRange
        :model-value="store.settings.particles.speed"
        :label="t('waterfallPiano.realtimeSpeed')"
        :min="0.5"
        :max="8"
        :step="0.1"
        @update:model-value="store.updateSetting('particles', 'speed', $event)"
      />
      <SettingsRange
        :model-value="store.settings.particles.lookAhead"
        :label="t('waterfallPiano.lookAhead')"
        :min="1"
        :max="6"
        :step="0.5"
        @update:model-value="store.updateSetting('particles', 'lookAhead', $event)"
      />
      <SettingsRange
        :model-value="store.settings.particles.opacity"
        :label="t('waterfallPiano.particleOpacity')"
        :min="0.1"
        :max="1"
        :step="0.05"
        @update:model-value="store.updateSetting('particles', 'opacity', $event)"
      />
      <SettingsRange
        :model-value="store.settings.particles.cornerRadius"
        :label="t('waterfallPiano.cornerRadius')"
        :min="0"
        :max="20"
        :step="1"
        @update:model-value="store.updateSetting('particles', 'cornerRadius', $event)"
      />

      <!-- 命中线设置 -->
      <SettingsColorPicker
        :model-value="store.settings.particles.hitLineColor"
        :label="t('waterfallPiano.hitLineColor')"
        @update:model-value="store.updateSetting('particles', 'hitLineColor', $event)"
      />
      <SettingsToggle
        :model-value="store.settings.particles.hitLineGlow"
        :label="t('waterfallPiano.hitLineGlow')"
        @update:model-value="store.updateSetting('particles', 'hitLineGlow', $event)"
      />

      <!-- 粒子/混合模式额外设置 -->
      <template v-if="store.settings.particles.style !== 'blocks'">
        <SettingsSelect
          :model-value="store.settings.particles.shape"
          :label="t('waterfallPiano.particleShape')"
          :options="particleShapeOptions"
          @update:model-value="store.updateSetting('particles', 'shape', $event)"
        />
        <SettingsRange
          :model-value="store.settings.particles.size"
          :label="t('waterfallPiano.particleSize')"
          :min="2"
          :max="30"
          :step="1"
          @update:model-value="store.updateSetting('particles', 'size', $event)"
        />
        <SettingsRange
          :model-value="store.settings.particles.density"
          :label="t('waterfallPiano.particleDensity')"
          :min="1"
          :max="20"
          :step="1"
          @update:model-value="store.updateSetting('particles', 'density', $event)"
        />
        <SettingsToggle
          :model-value="store.settings.particles.trail"
          :label="t('waterfallPiano.trailEffect')"
          @update:model-value="store.updateSetting('particles', 'trail', $event)"
        />
      </template>
    </SettingsCollapse>

    <!-- 键盘设置 -->
    <SettingsCollapse
      :title="t('waterfallPiano.settingsGroups.keyboard')"
      :default-open="false"
    >
      <SettingsToggle
        :model-value="store.settings.keyboard.visible"
        :label="t('waterfallPiano.showKeyboard')"
        @update:model-value="store.updateSetting('keyboard', 'visible', $event)"
      />
      <SettingsSelect
        :model-value="store.settings.keyboard.range"
        :label="t('waterfallPiano.keyboardRange')"
        :options="keyboardRangeOptions"
        @update:model-value="store.updateSetting('keyboard', 'range', $event)"
      />
      <SettingsSelect
        :model-value="store.settings.keyboard.keyLabel"
        :label="t('waterfallPiano.keyLabel')"
        :options="keyLabelOptions"
        @update:model-value="store.updateSetting('keyboard', 'keyLabel', $event)"
      />
      <SettingsColorPicker
        :model-value="store.settings.keyboard.whiteKeyColor"
        :label="t('waterfallPiano.whiteKeyColor')"
        @update:model-value="store.updateSetting('keyboard', 'whiteKeyColor', $event)"
      />
      <SettingsColorPicker
        :model-value="store.settings.keyboard.blackKeyColor"
        :label="t('waterfallPiano.blackKeyColor')"
        @update:model-value="store.updateSetting('keyboard', 'blackKeyColor', $event)"
      />
      <SettingsColorPicker
        :model-value="store.settings.keyboard.pressedKeyColor"
        :label="t('waterfallPiano.pressedKeyColor')"
        @update:model-value="store.updateSetting('keyboard', 'pressedKeyColor', $event)"
      />
    </SettingsCollapse>

    <!-- 音频设置 -->
    <SettingsCollapse
      :title="t('waterfallPiano.settingsGroups.audio')"
      :default-open="false"
    >
      <SettingsSelect
        :model-value="store.settings.audio.preset"
        :label="t('waterfallPiano.audioPreset')"
        :options="audioPresetOptions"
        @update:model-value="store.updateSetting('audio', 'preset', $event)"
      />
      <SettingsRange
        :model-value="store.settings.audio.volume"
        :label="t('waterfallPiano.volume')"
        :min="0"
        :max="100"
        :step="1"
        @update:model-value="store.updateSetting('audio', 'volume', $event)"
      />
      <SettingsRange
        :model-value="store.settings.audio.reverbAmount"
        :label="t('waterfallPiano.reverbAmount')"
        :min="0"
        :max="100"
        :step="1"
        @update:model-value="store.updateSetting('audio', 'reverbAmount', $event)"
      />
      <SettingsToggle
        :model-value="store.settings.audio.sustain"
        :label="t('waterfallPiano.sustain')"
        @update:model-value="store.updateSetting('audio', 'sustain', $event)"
      />
    </SettingsCollapse>

    <!-- 背景设置 -->
    <SettingsCollapse
      :title="t('waterfallPiano.settingsGroups.background')"
      :default-open="false"
    >
      <SettingsSelect
        :model-value="store.settings.background.type"
        :label="t('waterfallPiano.backgroundType')"
        :options="backgroundTypeOptions"
        @update:model-value="store.updateSetting('background', 'type', $event)"
      />
      <SettingsColorPicker
        v-if="store.settings.background.type === 'solid'"
        :model-value="store.settings.background.solidColor"
        :label="t('waterfallPiano.backgroundColor')"
        @update:model-value="store.updateSetting('background', 'solidColor', $event)"
      />
      <SettingsSelect
        v-if="store.settings.background.type === 'preset'"
        :model-value="store.settings.background.presetTheme"
        :label="t('waterfallPiano.presetTheme')"
        :options="presetThemeOptions"
        @update:model-value="store.updateSetting('background', 'presetTheme', $event)"
      />
    </SettingsCollapse>

    <!-- 性能设置 -->
    <SettingsCollapse
      :title="t('waterfallPiano.settingsGroups.performance')"
      :default-open="false"
    >
      <SettingsSelect
        :model-value="store.settings.performance.quality"
        :label="t('waterfallPiano.quality')"
        :options="qualityOptions"
        @update:model-value="store.updateSetting('performance', 'quality', $event)"
      />
    </SettingsCollapse>

    <!-- 重置按钮 -->
    <div class="pt-2">
      <button class="btn btn-sm btn-ghost w-full" @click="store.resetSettings()">
        {{ t("common.resetToDefaults") }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useWaterfallPianoStore } from "../stores/waterfallPiano";
import {
  SettingsCollapse,
  SettingsToggle,
  SettingsSelect,
  SettingsRange,
  SettingsColorPicker,
} from "@/components/Settings";

const { t } = useI18n();
const store = useWaterfallPianoStore();

const visualStyleOptions = [
  { label: t("waterfallPiano.styles.blocks"), value: "blocks" },
  { label: t("waterfallPiano.styles.particles"), value: "particles" },
  { label: t("waterfallPiano.styles.hybrid"), value: "hybrid" },
];

const keyboardRangeOptions = [
  { label: "88", value: "88" },
  { label: "61", value: "61" },
  { label: "49", value: "49" },
  { label: t("waterfallPiano.custom"), value: "custom" },
];

const keyLabelOptions = [
  { label: t("waterfallPiano.keyLabels.none"), value: "none" },
  { label: t("waterfallPiano.keyLabels.note"), value: "note" },
  { label: t("waterfallPiano.keyLabels.pitchClass"), value: "pitchClass" },
  { label: t("waterfallPiano.keyLabels.octave"), value: "octave" },
];

const audioPresetOptions = [
  { label: t("waterfallPiano.presets.grandPiano"), value: "grand-piano" },
  { label: t("waterfallPiano.presets.electricPiano"), value: "electric-piano" },
  { label: t("waterfallPiano.presets.brightPiano"), value: "bright-piano" },
  { label: t("waterfallPiano.presets.mellowPiano"), value: "mellow-piano" },
  { label: t("waterfallPiano.presets.organ"), value: "organ" },
  { label: t("waterfallPiano.presets.synthPad"), value: "synth-pad" },
];

const particleShapeOptions = [
  { label: t("waterfallPiano.shapes.circle"), value: "circle" },
  { label: t("waterfallPiano.shapes.square"), value: "square" },
  { label: t("waterfallPiano.shapes.note"), value: "note" },
  { label: t("waterfallPiano.shapes.star"), value: "star" },
];

const colorSchemeOptions = [
  { label: t("waterfallPiano.colorSchemes.pitch"), value: "pitch" },
  { label: t("waterfallPiano.colorSchemes.hands"), value: "hands" },
  { label: t("waterfallPiano.colorSchemes.rainbow"), value: "rainbow" },
  { label: t("waterfallPiano.colorSchemes.warm"), value: "warm" },
  { label: t("waterfallPiano.colorSchemes.cool"), value: "cool" },
  { label: t("waterfallPiano.colorSchemes.neon"), value: "neon" },
  { label: t("waterfallPiano.colorSchemes.custom"), value: "custom" },
];

const backgroundTypeOptions = [
  { label: t("waterfallPiano.bgTypes.solid"), value: "solid" },
  { label: t("waterfallPiano.bgTypes.gradient"), value: "gradient" },
  { label: t("waterfallPiano.bgTypes.preset"), value: "preset" },
  { label: t("waterfallPiano.bgTypes.image"), value: "image" },
  { label: t("waterfallPiano.bgTypes.stars"), value: "stars" },
];

const presetThemeOptions = [
  { label: t("waterfallPiano.themes.nightSky"), value: "night-sky" },
  { label: t("waterfallPiano.themes.ocean"), value: "ocean" },
  { label: t("waterfallPiano.themes.sunset"), value: "sunset" },
  { label: t("waterfallPiano.themes.aurora"), value: "aurora" },
  { label: t("waterfallPiano.themes.forest"), value: "forest" },
];

const qualityOptions = [
  { label: t("waterfallPiano.qualityLevels.low"), value: "low" },
  { label: t("waterfallPiano.qualityLevels.medium"), value: "medium" },
  { label: t("waterfallPiano.qualityLevels.high"), value: "high" },
];
</script>
