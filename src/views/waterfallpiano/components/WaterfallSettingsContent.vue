<template>
  <SettingsSection :show-reset="true" :on-reset="() => store.resetSettings()">
    <SettingsCollapse :title="t('waterfallPiano.particles')" :default-open="true">
      <SettingsSelect
        :model-value="settings.particles.colorScheme"
        :label="t('waterfallPiano.colorScheme')"
        :options="colorSchemeOptions"
        @update:model-value="store.updateSetting('particles', 'colorScheme', $event)"
      />
      <SettingsRange
        :model-value="settings.particles.speed"
        :label="t('waterfallPiano.speed')"
        :min="0.5" :max="5" :step="0.1"
        @update:model-value="store.updateSetting('particles', 'speed', $event)"
      />
      <SettingsRange
        :model-value="settings.particles.lookAhead"
        :label="t('waterfallPiano.lookAhead')"
        :min="1" :max="10" :step="0.5"
        @update:model-value="store.updateSetting('particles', 'lookAhead', $event)"
      />
      <SettingsRange
        :model-value="settings.particles.opacity"
        :label="t('waterfallPiano.opacity')"
        :min="0.1" :max="1" :step="0.05"
        @update:model-value="store.updateSetting('particles', 'opacity', $event)"
      />
      <SettingsRange
        :model-value="settings.particles.cornerRadius"
        :label="t('waterfallPiano.cornerRadius')"
        :min="0" :max="20" :step="1"
        @update:model-value="store.updateSetting('particles', 'cornerRadius', $event)"
      />
      <SettingsToggle
        :model-value="settings.particles.hitLine.visible"
        :label="t('waterfallPiano.hitLine')"
        @update:model-value="store.updateSetting('particles', 'hitLine', { ...settings.particles.hitLine, visible: $event })"
      />
      <SettingsColorPicker
        v-if="settings.particles.hitLine.visible"
        :model-value="settings.particles.hitLine.color"
        :label="t('waterfallPiano.hitLine')"
        @update:model-value="store.updateSetting('particles', 'hitLine', { ...settings.particles.hitLine, color: $event })"
      />
      <SettingsRange
        v-if="settings.particles.hitLine.visible"
        :model-value="settings.particles.hitLine.thickness"
        :label="t('waterfallPiano.hitLine')"
        :min="1" :max="10" :step="1"
        @update:model-value="store.updateSetting('particles', 'hitLine', { ...settings.particles.hitLine, thickness: $event })"
      />
      <template v-if="settings.particles.colorScheme === 'custom'">
        <SettingsColorPicker
          :model-value="settings.particles.customColors.low"
          :label="t('waterfallPiano.low')"
          @update:model-value="store.updateSetting('particles', 'customColors', { ...settings.particles.customColors, low: $event })"
        />
        <SettingsColorPicker
          :model-value="settings.particles.customColors.mid"
          :label="t('waterfallPiano.mid')"
          @update:model-value="store.updateSetting('particles', 'customColors', { ...settings.particles.customColors, mid: $event })"
        />
        <SettingsColorPicker
          :model-value="settings.particles.customColors.high"
          :label="t('waterfallPiano.high')"
          @update:model-value="store.updateSetting('particles', 'customColors', { ...settings.particles.customColors, high: $event })"
        />
      </template>
    </SettingsCollapse>

    <SettingsCollapse :title="t('waterfallPiano.background')" :default-open="false">
      <SettingsSelect
        :model-value="settings.background.type"
        :label="t('waterfallPiano.backgroundType')"
        :options="backgroundTypeOptions"
        @update:model-value="store.updateSetting('background', 'type', $event)"
      />
      <SettingsColorPicker
        v-if="settings.background.type === 'solid'"
        :model-value="settings.background.solidColor"
        :label="t('waterfallPiano.solidColor')"
        @update:model-value="store.updateSetting('background', 'solidColor', $event)"
      />
      <template v-if="settings.background.type === 'gradient'">
        <SettingsSelect
          :model-value="settings.background.gradientDirection"
          :label="t('waterfallPiano.gradient')"
          :options="gradientDirectionOptions"
          @update:model-value="store.updateSetting('background', 'gradientDirection', $event)"
        />
        <SettingsColorPicker
          :model-value="settings.background.gradientStart"
          :label="t('waterfallPiano.gradient')"
          @update:model-value="store.updateSetting('background', 'gradientStart', $event)"
        />
        <SettingsColorPicker
          :model-value="settings.background.gradientEnd"
          :label="t('waterfallPiano.gradient')"
          @update:model-value="store.updateSetting('background', 'gradientEnd', $event)"
        />
      </template>
      <SettingsSelect
        v-if="settings.background.type === 'preset'"
        :model-value="settings.background.presetTheme"
        :label="t('waterfallPiano.presetTheme')"
        :options="presetThemeOptions"
        @update:model-value="store.updateSetting('background', 'presetTheme', $event)"
      />
      <template v-if="settings.background.type === 'image'">
        <SettingsRange
          :model-value="settings.background.imageBlur"
          :label="t('waterfallPiano.image')"
          :min="0" :max="20" :step="1"
          @update:model-value="store.updateSetting('background', 'imageBlur', $event)"
        />
        <SettingsRange
          :model-value="settings.background.imageDarken"
          :label="t('waterfallPiano.opacity')"
          :min="0" :max="1" :step="0.05"
          @update:model-value="store.updateSetting('background', 'imageDarken', $event)"
        />
        <SettingsSelect
          :model-value="settings.background.imageFitMode"
          :label="t('waterfallPiano.image')"
          :options="imageFitModeOptions"
          @update:model-value="store.updateSetting('background', 'imageFitMode', $event)"
        />
      </template>
      <template v-if="settings.background.type === 'stars'">
        <SettingsToggle
          :model-value="settings.background.starfieldEnabled"
          :label="t('waterfallPiano.stars')"
          @update:model-value="store.updateSetting('background', 'starfieldEnabled', $event)"
        />
        <SettingsRange
          :model-value="settings.background.starfieldDensity"
          :label="t('waterfallPiano.stars')"
          :min="0.1" :max="1" :step="0.05"
          @update:model-value="store.updateSetting('background', 'starfieldDensity', $event)"
        />
      </template>
      <SettingsToggle
        :model-value="settings.background.flowAnimation"
        :label="t('waterfallPiano.background')"
        @update:model-value="store.updateSetting('background', 'flowAnimation', $event)"
      />
      <SettingsRange
        v-if="settings.background.flowAnimation"
        :model-value="settings.background.flowSpeed"
        :label="t('waterfallPiano.speed')"
        :min="0" :max="5" :step="0.1"
        @update:model-value="store.updateSetting('background', 'flowSpeed', $event)"
      />
      <SettingsToggle
        :model-value="settings.background.fluidEnabled"
        :label="t('waterfallPiano.fluidEnabled')"
        @update:model-value="store.updateSetting('background', 'fluidEnabled', $event)"
      />
      <template v-if="settings.background.fluidEnabled">
        <SettingsSelect
          :model-value="settings.background.fluidQuality"
          :label="t('waterfallPiano.fluidQuality')"
          :options="fluidQualityOptions"
          @update:model-value="store.updateSetting('background', 'fluidQuality', $event)"
        />
        <SettingsSelect
          :model-value="settings.background.fluidStyle"
          :label="t('waterfallPiano.fluidStyle')"
          :options="fluidStyleOptions"
          @update:model-value="store.updateSetting('background', 'fluidStyle', $event)"
        />
      </template>
    </SettingsCollapse>

    <SettingsCollapse :title="t('waterfallPiano.keyboard')" :default-open="false">
      <SettingsToggle
        :model-value="settings.keyboard.visible"
        :label="t('waterfallPiano.keyboard')"
        @update:model-value="store.updateSetting('keyboard', 'visible', $event)"
      />
      <SettingsSelect
        :model-value="settings.keyboard.range"
        :label="t('waterfallPiano.keyRange')"
        :options="keyRangeOptions"
        @update:model-value="store.updateSetting('keyboard', 'range', $event)"
      />
      <SettingsSelect
        :model-value="settings.keyboard.keyLabel"
        :label="t('waterfallPiano.keyLabel')"
        :options="keyLabelOptions"
        @update:model-value="store.updateSetting('keyboard', 'keyLabel', $event)"
      />
      <SettingsRange
        :model-value="settings.keyboard.heightRatio"
        :label="t('waterfallPiano.heightRatio')"
        :min="0.15" :max="0.5" :step="0.05"
        @update:model-value="store.updateSetting('keyboard', 'heightRatio', $event)"
      />
      <SettingsColorPicker
        :model-value="settings.keyboard.whiteKeyColor"
        :label="t('waterfallPiano.whiteKeyColor')"
        @update:model-value="store.updateSetting('keyboard', 'whiteKeyColor', $event)"
      />
      <SettingsColorPicker
        :model-value="settings.keyboard.blackKeyColor"
        :label="t('waterfallPiano.blackKeyColor')"
        @update:model-value="store.updateSetting('keyboard', 'blackKeyColor', $event)"
      />
      <SettingsColorPicker
        :model-value="settings.keyboard.pressedKeyColor"
        :label="t('waterfallPiano.pressedKeyColor')"
        @update:model-value="store.updateSetting('keyboard', 'pressedKeyColor', $event)"
      />
      <SettingsRange
        :model-value="settings.keyboard.keyCornerRadius"
        :label="t('waterfallPiano.cornerRadius')"
        :min="0" :max="20" :step="1"
        @update:model-value="store.updateSetting('keyboard', 'keyCornerRadius', $event)"
      />
      <SettingsToggle
        :model-value="settings.keyboard.separatorEnabled"
        :label="t('waterfallPiano.hitLine')"
        @update:model-value="store.updateSetting('keyboard', 'separatorEnabled', $event)"
      />
      <SettingsToggle
        :model-value="settings.keyboard.showNoteNames"
        :label="t('waterfallPiano.showNoteNames')"
        @update:model-value="store.updateSetting('keyboard', 'showNoteNames', $event)"
      />
    </SettingsCollapse>

    <SettingsCollapse :title="t('waterfallPiano.midiFile')" :default-open="false">
      <SettingsRange
        :model-value="settings.midiFile.playbackSpeed"
        :label="t('waterfallPiano.playbackSpeed')"
        :min="0.25" :max="3" :step="0.25"
        @update:model-value="store.updateSetting('midiFile', 'playbackSpeed', $event)"
      />
      <SettingsToggle
        :model-value="settings.midiFile.loop"
        :label="t('waterfallPiano.loop')"
        @update:model-value="store.updateSetting('midiFile', 'loop', $event)"
      />
      <SettingsToggle
        :model-value="settings.midiFile.showNoteNames"
        :label="t('waterfallPiano.showNoteNames')"
        @update:model-value="store.updateSetting('midiFile', 'showNoteNames', $event)"
      />
    </SettingsCollapse>
  </SettingsSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useWaterfallPianoStore } from "../stores/waterfallPiano";
import {
  SettingsSection,
  SettingsCollapse,
  SettingsToggle,
  SettingsSelect,
  SettingsRange,
  SettingsColorPicker,
} from "@/components/Settings";

const { t } = useI18n();
const store = useWaterfallPianoStore();
const settings = computed(() => store.settings);

const colorSchemeOptions = computed(() => [
  { value: "pitch", label: t("waterfallPiano.scheme.pitch") },
  { value: "hands", label: t("waterfallPiano.scheme.hands") },
  { value: "rainbow", label: t("waterfallPiano.scheme.rainbow") },
  { value: "warm", label: t("waterfallPiano.scheme.warm") },
  { value: "cool", label: t("waterfallPiano.scheme.cool") },
  { value: "neon", label: t("waterfallPiano.scheme.neon") },
  { value: "custom", label: t("waterfallPiano.customColors") },
]);

const backgroundTypeOptions = computed(() => [
  { value: "solid", label: t("waterfallPiano.solidColor") },
  { value: "gradient", label: t("waterfallPiano.gradient") },
  { value: "preset", label: t("waterfallPiano.preset") },
  { value: "image", label: t("waterfallPiano.image") },
  { value: "stars", label: t("waterfallPiano.stars") },
]);

const gradientDirectionOptions = computed(() => [
  { value: "linear-vertical", label: "↕" },
  { value: "linear-horizontal", label: "↔" },
  { value: "radial", label: "◉" },
]);

const presetThemeOptions = computed(() => [
  { value: "night-sky", label: "Night Sky" },
  { value: "ocean", label: "Ocean" },
  { value: "sunset", label: "Sunset" },
  { value: "aurora", label: "Aurora" },
  { value: "forest", label: "Forest" },
]);

const imageFitModeOptions = computed(() => [
  { value: "cover", label: "Cover" },
  { value: "stretch", label: "Stretch" },
  { value: "center", label: "Center" },
  { value: "tile", label: "Tile" },
]);

const fluidQualityOptions = computed(() => [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
]);

const fluidStyleOptions = computed(() => [
  { value: "gentle", label: "Gentle" },
  { value: "standard", label: "Standard" },
  { value: "turbulent", label: "Turbulent" },
]);

const keyRangeOptions = computed(() => [
  { value: "88", label: "88" },
  { value: "61", label: "61" },
  { value: "49", label: "49" },
  { value: "custom", label: "Custom" },
]);

const keyLabelOptions = computed(() => [
  { value: "none", label: "None" },
  { value: "note", label: "Note" },
  { value: "pitchClass", label: "Pitch Class" },
  { value: "octave", label: "Octave" },
]);
</script>
