<template>
  <SettingsSection :show-reset="true" :on-reset="() => store.resetSettings()">
    <div class="grid grid-cols-1 gap-4 m-4">
      <SettingsCollapse
        :title="t('WaterfallPiano.particles')"
        icon="sparkles"
        :default-open="true"
      >
        <SettingsSelect
          :model-value="settings.particles.colorScheme"
          :label="t('WaterfallPiano.colorScheme')"
          :options="colorSchemeOptions"
          @update:model-value="
            store.updateSetting('particles', 'colorScheme', $event)
          "
        />
        <SettingsRange
          :model-value="settings.particles.speed"
          :label="t('WaterfallPiano.speed')"
          :min="0.5"
          :max="5"
          :step="0.1"
          @update:model-value="
            store.updateSetting('particles', 'speed', $event)
          "
        />
        <SettingsRange
          :model-value="settings.particles.lookAhead"
          :label="t('WaterfallPiano.lookAhead')"
          :min="1"
          :max="10"
          :step="0.5"
          @update:model-value="
            store.updateSetting('particles', 'lookAhead', $event)
          "
        />
        <SettingsRange
          :model-value="settings.particles.opacity"
          :label="t('WaterfallPiano.opacity')"
          :min="0.1"
          :max="1"
          :step="0.05"
          @update:model-value="
            store.updateSetting('particles', 'opacity', $event)
          "
        />
        <SettingsRange
          :model-value="settings.particles.cornerRadius"
          :label="t('WaterfallPiano.cornerRadius')"
          :min="0"
          :max="20"
          :step="1"
          @update:model-value="
            store.updateSetting('particles', 'cornerRadius', $event)
          "
        />
        <SettingsRange
          :model-value="settings.particles.hitExplosionRadius"
          :label="t('WaterfallPiano.hitExplosionRadius')"
          :min="0.01"
          :max="0.1"
          :step="0.005"
          @update:model-value="
            store.updateSetting('particles', 'hitExplosionRadius', $event)
          "
        />
        <SettingsToggle
          :model-value="settings.particles.hitLine.visible"
          :label="t('WaterfallPiano.hitLine')"
          @update:model-value="
            store.updateSetting('particles', 'hitLine', {
              ...settings.particles.hitLine,
              visible: $event,
            })
          "
        />
        <SettingsColorPicker
          v-if="settings.particles.hitLine.visible"
          :model-value="settings.particles.hitLine.color"
          :label="t('WaterfallPiano.hitLine')"
          @update:model-value="
            store.updateSetting('particles', 'hitLine', {
              ...settings.particles.hitLine,
              color: $event,
            })
          "
        />
        <SettingsRange
          v-if="settings.particles.hitLine.visible"
          :model-value="settings.particles.hitLine.thickness"
          :label="t('WaterfallPiano.hitLine')"
          :min="1"
          :max="10"
          :step="1"
          @update:model-value="
            store.updateSetting('particles', 'hitLine', {
              ...settings.particles.hitLine,
              thickness: $event,
            })
          "
        />
        <template v-if="settings.particles.colorScheme === 'custom'">
          <SettingsColorPicker
            :model-value="settings.particles.customColors.low"
            :label="t('WaterfallPiano.low')"
            @update:model-value="
              store.updateSetting('particles', 'customColors', {
                ...settings.particles.customColors,
                low: $event,
              })
            "
          />
          <SettingsColorPicker
            :model-value="settings.particles.customColors.mid"
            :label="t('WaterfallPiano.mid')"
            @update:model-value="
              store.updateSetting('particles', 'customColors', {
                ...settings.particles.customColors,
                mid: $event,
              })
            "
          />
          <SettingsColorPicker
            :model-value="settings.particles.customColors.high"
            :label="t('WaterfallPiano.high')"
            @update:model-value="
              store.updateSetting('particles', 'customColors', {
                ...settings.particles.customColors,
                high: $event,
              })
            "
          />
        </template>
      </SettingsCollapse>

      <SettingsCollapse
        :title="t('WaterfallPiano.aura')"
        icon="sparkles"
        :default-open="false"
      >
        <SettingsToggle
          :model-value="settings.aura.enabled"
          :label="t('WaterfallPiano.auraEnabled')"
          @update:model-value="
            store.updateSetting('aura', 'enabled', $event)
          "
        />
        <SettingsRadioGroup
          :model-value="settings.aura.style"
          :label="t('WaterfallPiano.auraStyle')"
          :options="auraStyleOptions"
          @update:model-value="
            store.updateSetting('aura', 'style', $event)
          "
        />
        <SettingsRadioGroup
          :model-value="settings.aura.target"
          :label="t('WaterfallPiano.auraTarget')"
          :options="auraTargetOptions"
          @update:model-value="
            store.updateSetting('aura', 'target', $event)
          "
        />
        <SettingsRange
          :model-value="settings.aura.intensity"
          :label="t('WaterfallPiano.auraIntensity')"
          :min="0"
          :max="100"
          :step="1"
          @update:model-value="
            store.updateSetting('aura', 'intensity', $event)
          "
        />
        <SettingsRange
          :model-value="settings.aura.radius"
          :label="t('WaterfallPiano.auraRadius')"
          :min="0"
          :max="30"
          :step="1"
          @update:model-value="
            store.updateSetting('aura', 'radius', $event)
          "
        />
        <SettingsRange
          v-if="
            settings.aura.style === 'rainbow' ||
            settings.aura.style === 'dual'
          "
          :model-value="settings.aura.animationSpeed"
          :label="t('WaterfallPiano.auraAnimationSpeed')"
          :min="0.1"
          :max="3"
          :step="0.1"
          @update:model-value="
            store.updateSetting('aura', 'animationSpeed', $event)
          "
        />
        <SettingsColorPicker
          v-if="settings.aura.style === 'custom'"
          :model-value="settings.aura.primaryColor ?? '#6366f1'"
          :label="t('WaterfallPiano.auraPrimaryColor')"
          @update:model-value="
            store.updateSetting('aura', 'primaryColor', $event)
          "
        />
        <SettingsColorPicker
          v-if="
            settings.aura.style === 'custom' ||
            settings.aura.style === 'dual'
          "
          :model-value="settings.aura.backgroundColor ?? '#000000'"
          :label="t('WaterfallPiano.auraBackgroundColor')"
          @update:model-value="
            store.updateSetting('aura', 'backgroundColor', $event)
          "
        />
      </SettingsCollapse>

      <SettingsCollapse
        :title="t('WaterfallPiano.background')"
        icon="image"
        :default-open="false"
      >
        <SettingsColorPicker
          :model-value="settings.background.solidColor"
          :label="t('WaterfallPiano.solidColor')"
          @update:model-value="
            store.updateSetting('background', 'solidColor', $event)
          "
        />
        <SettingsToggle
          :model-value="settings.background.fluidEnabled"
          :label="t('WaterfallPiano.fluidEnabled')"
          @update:model-value="
            store.updateSetting('background', 'fluidEnabled', $event)
          "
        />
        <template v-if="settings.background.fluidEnabled">
          <SettingsRange
            :model-value="settings.background.fluidParams.simResolution ?? 128"
            :label="t('WaterfallPiano.fluidQuality')"
            :min="32"
            :max="256"
            :step="32"
            @update:model-value="
              store.updateSetting('background', 'fluidParams', {
                ...settings.background.fluidParams,
                simResolution: $event,
              })
            "
          />
          <SettingsSelect
            :model-value="settings.background.fluidStyle"
            :label="t('WaterfallPiano.fluidStyle')"
            :options="fluidStyleOptions"
            @update:model-value="
              store.updateSetting('background', 'fluidStyle', $event)
            "
          />
          <SettingsToggle
            :model-value="settings.background.fluidAdvanced"
            :label="t('WaterfallPiano.fluidAdvanced')"
            @update:model-value="
              store.updateSetting('background', 'fluidAdvanced', $event)
            "
          />
        </template>
      </SettingsCollapse>

      <SettingsCollapse
        v-if="
          settings.background.fluidEnabled && settings.background.fluidAdvanced
        "
        :title="t('WaterfallPiano.fluidAdvancedParams')"
        icon="droplet"
        :default-open="false"
      >
        <SettingsRange
          :model-value="settings.background.fluidParams.splatRadius ?? 0.005"
          :label="t('WaterfallPiano.splatRadius')"
          :min="0.0001"
          :max="0.01"
          :step="0.0005"
          @update:model-value="
            store.updateSetting('background', 'fluidParams', {
              ...settings.background.fluidParams,
              splatRadius: $event,
            })
          "
        />
        <SettingsRange
          :model-value="settings.background.fluidParams.splatColorHue ?? 0"
          :label="t('WaterfallPiano.splatColorHue')"
          :min="0"
          :max="1"
          :step="0.05"
          @update:model-value="
            store.updateSetting('background', 'fluidParams', {
              ...settings.background.fluidParams,
              splatColorHue: $event,
            })
          "
        />
        <SettingsRange
          :model-value="settings.background.fluidParams.trailLength ?? 0.5"
          :label="t('WaterfallPiano.trailLength')"
          :min="0"
          :max="1"
          :step="0.05"
          @update:model-value="
            store.updateSetting('background', 'fluidParams', {
              ...settings.background.fluidParams,
              trailLength: $event,
            })
          "
        />
        <SettingsRange
          :model-value="settings.background.fluidParams.flowPersistence ?? 0.5"
          :label="t('WaterfallPiano.flowPersistence')"
          :min="0"
          :max="1"
          :step="0.05"
          @update:model-value="
            store.updateSetting('background', 'fluidParams', {
              ...settings.background.fluidParams,
              flowPersistence: $event,
            })
          "
        />
        <SettingsToggle
          :model-value="settings.background.fluidParams.bloom ?? true"
          :label="t('WaterfallPiano.bloom')"
          @update:model-value="
            store.updateSetting('background', 'fluidParams', {
              ...settings.background.fluidParams,
              bloom: $event,
            })
          "
        />
        <SettingsRange
          v-if="settings.background.fluidParams.bloom !== false"
          :model-value="settings.background.fluidParams.bloomIntensity ?? 0.8"
          :label="t('WaterfallPiano.bloomIntensity')"
          :min="0.1"
          :max="2"
          :step="0.1"
          @update:model-value="
            store.updateSetting('background', 'fluidParams', {
              ...settings.background.fluidParams,
              bloomIntensity: $event,
            })
          "
        />
        <SettingsToggle
          :model-value="settings.background.fluidParams.hitExplosion ?? false"
          :label="t('WaterfallPiano.hitExplosion')"
          @update:model-value="
            store.updateSetting('background', 'fluidParams', {
              ...settings.background.fluidParams,
              hitExplosion: $event,
            })
          "
        />
        <SettingsToggle
          :model-value="settings.background.fluidParams.blockCoverage ?? false"
          :label="t('WaterfallPiano.blockCoverage')"
          @update:model-value="
            store.updateSetting('background', 'fluidParams', {
              ...settings.background.fluidParams,
              blockCoverage: $event,
            })
          "
        />
      </SettingsCollapse>

      <SettingsCollapse
        :title="t('WaterfallPiano.keyboard')"
        icon="piano"
        :default-open="false"
      >
        <SettingsToggle
          :model-value="settings.keyboard.visible"
          :label="t('WaterfallPiano.keyboard')"
          @update:model-value="
            store.updateSetting('keyboard', 'visible', $event)
          "
        />
        <SettingsSelect
          :model-value="settings.keyboard.range"
          :label="t('WaterfallPiano.keyRange')"
          :options="keyRangeOptions"
          @update:model-value="store.updateSetting('keyboard', 'range', $event)"
        />
        <SettingsSelect
          :model-value="settings.keyboard.keyLabel"
          :label="t('WaterfallPiano.keyLabel')"
          :options="keyLabelOptions"
          @update:model-value="
            store.updateSetting('keyboard', 'keyLabel', $event)
          "
        />
        <SettingsRange
          :model-value="settings.keyboard.heightRatio"
          :label="t('WaterfallPiano.heightRatio')"
          :min="0.15"
          :max="0.5"
          :step="0.05"
          @update:model-value="
            store.updateSetting('keyboard', 'heightRatio', $event)
          "
        />
        <SettingsColorPicker
          :model-value="settings.keyboard.whiteKeyColor"
          :label="t('WaterfallPiano.whiteKeyColor')"
          @update:model-value="
            store.updateSetting('keyboard', 'whiteKeyColor', $event)
          "
        />
        <SettingsColorPicker
          :model-value="settings.keyboard.blackKeyColor"
          :label="t('WaterfallPiano.blackKeyColor')"
          @update:model-value="
            store.updateSetting('keyboard', 'blackKeyColor', $event)
          "
        />
        <SettingsColorPicker
          :model-value="settings.keyboard.pressedKeyColor"
          :label="t('WaterfallPiano.pressedKeyColor')"
          @update:model-value="
            store.updateSetting('keyboard', 'pressedKeyColor', $event)
          "
        />
        <SettingsRange
          :model-value="settings.keyboard.keyCornerRadius"
          :label="t('WaterfallPiano.cornerRadius')"
          :min="0"
          :max="20"
          :step="1"
          @update:model-value="
            store.updateSetting('keyboard', 'keyCornerRadius', $event)
          "
        />
        <SettingsToggle
          :model-value="settings.keyboard.separatorEnabled"
          :label="t('WaterfallPiano.hitLine')"
          @update:model-value="
            store.updateSetting('keyboard', 'separatorEnabled', $event)
          "
        />
        <SettingsToggle
          :model-value="settings.keyboard.showNoteNames"
          :label="t('WaterfallPiano.showNoteNames')"
          @update:model-value="
            store.updateSetting('keyboard', 'showNoteNames', $event)
          "
        />
      </SettingsCollapse>

      <SettingsCollapse
        :title="t('WaterfallPiano.midiFile')"
        :default-open="false"
      >
        <SettingsRange
          :model-value="settings.midiFile.playbackSpeed"
          :label="t('WaterfallPiano.playbackSpeed')"
          :min="0.25"
          :max="3"
          :step="0.25"
          @update:model-value="
            store.updateSetting('midiFile', 'playbackSpeed', $event)
          "
        />
        <SettingsToggle
          :model-value="settings.midiFile.loop"
          :label="t('WaterfallPiano.loop')"
          @update:model-value="store.updateSetting('midiFile', 'loop', $event)"
        />
        <SettingsToggle
          :model-value="settings.midiFile.showNoteNames"
          :label="t('WaterfallPiano.showNoteNames')"
          @update:model-value="
            store.updateSetting('midiFile', 'showNoteNames', $event)
          "
        />
      </SettingsCollapse>
    </div>
  </SettingsSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useWaterfallPianoStore } from "../stores/WaterfallPiano";
import {
  SettingsSection,
  SettingsCollapse,
  SettingsToggle,
  SettingsSelect,
  SettingsRange,
  SettingsColorPicker,
  SettingsRadioGroup,
} from "@/components/Settings";

const { t } = useI18n();
const store = useWaterfallPianoStore();
const settings = computed(() => store.settings);

const colorSchemeOptions = computed(() => [
  { value: "pitch", label: t("WaterfallPiano.scheme.pitch") },
  { value: "hands", label: t("WaterfallPiano.scheme.hands") },
  { value: "rainbow", label: t("WaterfallPiano.scheme.rainbow") },
  { value: "warm", label: t("WaterfallPiano.scheme.warm") },
  { value: "cool", label: t("WaterfallPiano.scheme.cool") },
  { value: "neon", label: t("WaterfallPiano.scheme.neon") },
  { value: "custom", label: t("WaterfallPiano.customColors") },
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

const auraStyleOptions = computed(() => [
  { value: "none", label: t("WaterfallPiano.auraStyleNone") },
  { value: "glow", label: t("WaterfallPiano.auraStyleGlow") },
  { value: "rainbow", label: t("WaterfallPiano.auraStyleRainbow") },
  { value: "dual", label: t("WaterfallPiano.auraStyleDual") },
  { value: "custom", label: t("WaterfallPiano.auraStyleCustom") },
]);

const auraTargetOptions = computed(() => [
  { value: "triggered", label: t("WaterfallPiano.auraTargetTriggered") },
  { value: "all", label: t("WaterfallPiano.auraTargetAll") },
  { value: "off", label: t("WaterfallPiano.auraTargetOff") },
]);
</script>
