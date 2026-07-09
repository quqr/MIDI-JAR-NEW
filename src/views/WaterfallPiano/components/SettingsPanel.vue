<template>
  <div class="p-4 space-y-3">
    <!-- 视觉设置 -->
    <SettingsCollapse
      :title="t('waterfallPiano.settingsGroups.visual')"
      :default-open="true"
    >
      <SettingsSelect
        :model-value="store.settings.particles.colorScheme"
        :label="t('waterfallPiano.colorScheme')"
        :options="colorSchemeOptions"
        @update:model-value="
          store.updateSetting('particles', 'colorScheme', $event)
        "
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
        @update:model-value="
          store.updateSetting('particles', 'lookAhead', $event)
        "
      />
      <SettingsRange
        :model-value="store.settings.particles.opacity"
        :label="t('waterfallPiano.particleOpacity')"
        :min="0.1"
        :max="1"
        :step="0.05"
        @update:model-value="
          store.updateSetting('particles', 'opacity', $event)
        "
      />
      <SettingsRange
        :model-value="store.settings.particles.cornerRadius"
        :label="t('waterfallPiano.cornerRadius')"
        :min="0"
        :max="20"
        :step="1"
        @update:model-value="
          store.updateSetting('particles', 'cornerRadius', $event)
        "
      />

      <!-- 命中线设置 -->
      <div class="divider text-xs text-base-content/50 my-1">
        {{ t("waterfallPiano.hitLineGroup") }}
      </div>
      <SettingsToggle
        :model-value="store.settings.particles.hitLine.visible"
        :label="t('waterfallPiano.hitLineVisible')"
        @update:model-value="
          store.updateSetting('particles', 'hitLine', {
            ...store.settings.particles.hitLine,
            visible: $event,
          })
        "
      />
      <SettingsColorPicker
        :model-value="store.settings.particles.hitLine.color"
        :label="t('waterfallPiano.hitLineColor')"
        @update:model-value="
          store.updateSetting('particles', 'hitLine', {
            ...store.settings.particles.hitLine,
            color: $event,
          })
        "
      />
      <SettingsRange
        :model-value="store.settings.particles.hitLine.thickness"
        :label="t('waterfallPiano.hitLineThickness')"
        :min="1"
        :max="10"
        :step="1"
        @update:model-value="
          store.updateSetting('particles', 'hitLine', {
            ...store.settings.particles.hitLine,
            thickness: $event,
          })
        "
      />

      <!-- 分组重置 -->
      <button
        class="btn btn-sm btn-ghost w-full mt-2"
        @click="store.resetGroup('particles')"
      >
        {{ t("common.resetToDefaults") }}
      </button>
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
      <SettingsRange
        :model-value="store.settings.keyboard.heightRatio"
        :label="t('waterfallPiano.keyboardHeightRatio')"
        :min="0.1"
        :max="0.5"
        :step="0.01"
        @update:model-value="
          store.updateSetting('keyboard', 'heightRatio', $event)
        "
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
        @update:model-value="
          store.updateSetting('keyboard', 'keyLabel', $event)
        "
      />
      <SettingsColorPicker
        :model-value="store.settings.keyboard.whiteKeyColor"
        :label="t('waterfallPiano.whiteKeyColor')"
        @update:model-value="
          store.updateSetting('keyboard', 'whiteKeyColor', $event)
        "
      />
      <SettingsColorPicker
        :model-value="store.settings.keyboard.blackKeyColor"
        :label="t('waterfallPiano.blackKeyColor')"
        @update:model-value="
          store.updateSetting('keyboard', 'blackKeyColor', $event)
        "
      />
      <SettingsColorPicker
        :model-value="store.settings.keyboard.pressedKeyColor"
        :label="t('waterfallPiano.pressedKeyColor')"
        @update:model-value="
          store.updateSetting('keyboard', 'pressedKeyColor', $event)
        "
      />
      <SettingsRange
        :model-value="store.settings.keyboard.keyCornerRadius"
        :label="t('waterfallPiano.keyCornerRadius')"
        :min="0"
        :max="10"
        :step="1"
        @update:model-value="
          store.updateSetting('keyboard', 'keyCornerRadius', $event)
        "
      />
      <SettingsRange
        :model-value="store.settings.keyboard.keyBorderWidth"
        :label="t('waterfallPiano.keyBorderWidth')"
        :min="0"
        :max="4"
        :step="0.5"
        @update:model-value="
          store.updateSetting('keyboard', 'keyBorderWidth', $event)
        "
      />
      <SettingsColorPicker
        v-if="store.settings.keyboard.keyBorderWidth > 0"
        :model-value="store.settings.keyboard.keyBorderColor"
        :label="t('waterfallPiano.keyBorderColor')"
        @update:model-value="
          store.updateSetting('keyboard', 'keyBorderColor', $event)
        "
      />
      <SettingsToggle
        :model-value="store.settings.keyboard.separatorEnabled"
        :label="t('waterfallPiano.keyboardSeparator')"
        @update:model-value="
          store.updateSetting('keyboard', 'separatorEnabled', $event)
        "
      />
      <SettingsColorPicker
        v-if="store.settings.keyboard.separatorEnabled"
        :model-value="store.settings.keyboard.separatorColor"
        :label="t('waterfallPiano.separatorColor')"
        @update:model-value="
          store.updateSetting('keyboard', 'separatorColor', $event)
        "
      />
      <SettingsRange
        v-if="store.settings.keyboard.separatorEnabled"
        :model-value="store.settings.keyboard.separatorThickness"
        :label="t('waterfallPiano.separatorThickness')"
        :min="1"
        :max="8"
        :step="1"
        @update:model-value="
          store.updateSetting('keyboard', 'separatorThickness', $event)
        "
      />

      <!-- 五线谱指示器 -->
      <div class="divider text-xs text-base-content/50 my-1">
        {{ t("waterfallPiano.advancedKeyboard") }}
      </div>
      <SettingsToggle
        :model-value="store.settings.keyboard.staffVisible"
        :label="t('waterfallPiano.staffVisible')"
        @update:model-value="
          store.updateSetting('keyboard', 'staffVisible', $event)
        "
      />
      <SettingsToggle
        :model-value="store.settings.keyboard.showNoteNames"
        :label="t('waterfallPiano.showNoteNames')"
        @update:model-value="
          store.updateSetting('keyboard', 'showNoteNames', $event)
        "
      />
      <SettingsSelect
        :model-value="store.settings.keyboard.synthesiaFlowDirection"
        :label="t('waterfallPiano.flowDirection')"
        :options="flowDirectionOptions"
        @update:model-value="
          store.updateSetting('keyboard', 'synthesiaFlowDirection', $event)
        "
      />

      <!-- 分组重置 -->
      <button
        class="btn btn-sm btn-ghost w-full mt-2"
        @click="store.resetGroup('keyboard')"
      >
        {{ t("common.resetToDefaults") }}
      </button>
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
        @update:model-value="
          store.updateSetting('audio', 'reverbAmount', $event)
        "
      />
      <SettingsToggle
        :model-value="store.settings.audio.sustain"
        :label="t('waterfallPiano.sustain')"
        @update:model-value="store.updateSetting('audio', 'sustain', $event)"
      />

      <!-- 物理建模钢琴参数 -->
      <template v-if="store.settings.audio.preset === 'physical-piano'">
        <div class="divider text-xs text-base-content/50 my-1">
          {{ t("waterfallPiano.physicalPianoParams") }}
        </div>
        <SettingsRange
          :model-value="store.settings.physicalPiano.brightness"
          :label="t('waterfallPiano.physicalBrightness')"
          :min="0"
          :max="1"
          :step="0.01"
          @update:model-value="
            store.updateSetting('physicalPiano', 'brightness', $event)
          "
        />
        <SettingsRange
          :model-value="store.settings.physicalPiano.resonance"
          :label="t('waterfallPiano.physicalResonance')"
          :min="0"
          :max="1"
          :step="0.01"
          @update:model-value="
            store.updateSetting('physicalPiano', 'resonance', $event)
          "
        />
        <SettingsRange
          :model-value="store.settings.physicalPiano.sustain"
          :label="t('waterfallPiano.physicalSustain')"
          :min="0"
          :max="1"
          :step="0.01"
          @update:model-value="
            store.updateSetting('physicalPiano', 'sustain', $event)
          "
        />
        <SettingsRange
          :model-value="store.settings.physicalPiano.decay"
          :label="t('waterfallPiano.physicalDecay')"
          :min="0"
          :max="1"
          :step="0.01"
          @update:model-value="
            store.updateSetting('physicalPiano', 'decay', $event)
          "
        />
        <SettingsRange
          :model-value="store.settings.physicalPiano.hammerHardness"
          :label="t('waterfallPiano.physicalHammerHardness')"
          :min="0"
          :max="1"
          :step="0.01"
          @update:model-value="
            store.updateSetting('physicalPiano', 'hammerHardness', $event)
          "
        />
        <SettingsRange
          :model-value="store.settings.physicalPiano.velocitySensitivity"
          :label="t('waterfallPiano.physicalVelocitySensitivity')"
          :min="0"
          :max="1"
          :step="0.01"
          @update:model-value="
            store.updateSetting('physicalPiano', 'velocitySensitivity', $event)
          "
        />
        <SettingsRange
          :model-value="store.settings.physicalPiano.polyphony"
          :label="t('waterfallPiano.physicalPolyphony')"
          :min="1"
          :max="32"
          :step="1"
          @update:model-value="
            store.updateSetting('physicalPiano', 'polyphony', $event)
          "
        />
        <SettingsRange
          :model-value="store.settings.physicalPiano.inharmonicity"
          :label="t('waterfallPiano.physicalInharmonicity')"
          :min="0"
          :max="1"
          :step="0.01"
          @update:model-value="
            store.updateSetting('physicalPiano', 'inharmonicity', $event)
          "
        />
        <SettingsRange
          :model-value="store.settings.physicalPiano.strikePosition"
          :label="t('waterfallPiano.physicalStrikePosition')"
          :min="0"
          :max="0.5"
          :step="0.001"
          @update:model-value="
            store.updateSetting('physicalPiano', 'strikePosition', $event)
          "
        />
        <SettingsRange
          :model-value="store.settings.physicalPiano.masterGain"
          :label="t('waterfallPiano.physicalMasterGain')"
          :min="0"
          :max="1"
          :step="0.01"
          @update:model-value="
            store.updateSetting('physicalPiano', 'masterGain', $event)
          "
        />
      </template>

      <!-- 分组重置 -->
      <button
        class="btn btn-sm btn-ghost w-full mt-2"
        @click="store.resetGroup('audio')"
      >
        {{ t("common.resetToDefaults") }}
      </button>
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
        @update:model-value="
          store.updateSetting('background', 'solidColor', $event)
        "
      />
      <SettingsSelect
        v-if="store.settings.background.type === 'preset'"
        :model-value="store.settings.background.presetTheme"
        :label="t('waterfallPiano.presetTheme')"
        :options="presetThemeOptions"
        @update:model-value="
          store.updateSetting('background', 'presetTheme', $event)
        "
      />
      <SettingsSelect
        v-if="store.settings.background.type === 'gradient'"
        :model-value="store.settings.background.gradientDirection"
        :label="t('waterfallPiano.gradientDirection')"
        :options="gradientDirectionOptions"
        @update:model-value="
          store.updateSetting('background', 'gradientDirection', $event)
        "
      />

      <!-- 自定义图片背景 -->
      <template v-if="store.settings.background.type === 'image'">
        <div class="form-control w-full">
          <label class="label py-1">
            <span class="label-text text-xs">{{
              t("waterfallPiano.uploadImage")
            }}</span>
          </label>
          <input
            type="file"
            accept="image/*"
            class="file-input file-input-bordered file-input-xs w-full"
            @change="onBackgroundImageUpload"
          />
        </div>
        <button
          v-if="store.settings.background.imageFile"
          class="btn btn-sm btn-ghost w-full"
          @click="store.updateSetting('background', 'imageFile', '')"
        >
          {{ t("waterfallPiano.clearImage") }}
        </button>
        <SettingsSelect
          :model-value="store.settings.background.imageFitMode"
          :label="t('waterfallPiano.imageFitMode')"
          :options="imageFitModeOptions"
          @update:model-value="
            store.updateSetting('background', 'imageFitMode', $event)
          "
        />
        <SettingsRange
          :model-value="store.settings.background.imageDarken"
          :label="t('waterfallPiano.imageDarken')"
          :min="0"
          :max="1"
          :step="0.05"
          @update:model-value="
            store.updateSetting('background', 'imageDarken', $event)
          "
        />
      </template>

      <!-- 高级背景效果 -->
      <div class="divider text-xs text-base-content/50 my-1">
        {{ t("waterfallPiano.advancedBackground") }}
      </div>

      <!-- 星空粒子 -->
      <SettingsToggle
        :model-value="store.settings.background.starfieldEnabled"
        :label="t('waterfallPiano.starfieldEnabled')"
        @update:model-value="
          store.updateSetting('background', 'starfieldEnabled', $event)
        "
      />
      <SettingsRange
        v-if="store.settings.background.starfieldEnabled"
        :model-value="store.settings.background.starfieldDensity"
        :label="t('waterfallPiano.starfieldDensity')"
        :min="0.1"
        :max="1"
        :step="0.05"
        @update:model-value="
          store.updateSetting('background', 'starfieldDensity', $event)
        "
      />

      <!-- 流体背景设置 -->
      <template v-if="store.settings.background.type === 'fluid'">
        <SettingsSelect
          :model-value="store.settings.background.fluidQuality"
          :label="t('waterfallPiano.fluidQuality')"
          :options="fluidQualityOptions"
          @update:model-value="
            store.updateSetting('background', 'fluidQuality', $event)
          "
        />
        <SettingsSelect
          :model-value="store.settings.background.fluidStyle"
          :label="t('waterfallPiano.fluidStyle')"
          :options="fluidStyleOptions"
          @update:model-value="
            store.updateSetting('background', 'fluidStyle', $event)
          "
        />
        <SettingsToggle
          :model-value="store.settings.background.fluidAdvanced"
          :label="t('waterfallPiano.fluidAdvanced')"
          @update:model-value="
            store.updateSetting('background', 'fluidAdvanced', $event)
          "
        />
        <template v-if="store.settings.background.fluidAdvanced">
          <!-- 发射源开关 -->
          <div class="divider text-xs text-base-content/50 my-1">
            {{ t("waterfallPiano.fluidEmissionSource") }}
          </div>
          <SettingsToggle
            :model-value="store.settings.background.fluidParams.HIT_EXPLOSION ?? true"
            :label="t('waterfallPiano.fluidHitExplosion')"
            @update:model-value="
              store.updateSetting('background', 'fluidParams', {
                ...store.settings.background.fluidParams,
                HIT_EXPLOSION: $event,
              })
            "
          />
          <SettingsToggle
            :model-value="store.settings.background.fluidParams.BLOCK_COVERAGE ?? false"
            :label="t('waterfallPiano.fluidBlockCoverage')"
            @update:model-value="
              store.updateSetting('background', 'fluidParams', {
                ...store.settings.background.fluidParams,
                BLOCK_COVERAGE: $event,
              })
            "
          />

          <!-- 流体旋钮 -->
          <div class="divider text-xs text-base-content/50 my-1">
            {{ t("waterfallPiano.fluidKnobs") }}
          </div>
          <SettingsRange
            :model-value="store.settings.background.fluidParams.SPLAT_RADIUS ?? 25"
            :label="t('waterfallPiano.fluidSplatRadius')"
            :min="1"
            :max="100"
            :step="1"
            @update:model-value="
              store.updateSetting('background', 'fluidParams', {
                ...store.settings.background.fluidParams,
                SPLAT_RADIUS: $event,
              })
            "
          />
          <SettingsRange
            :model-value="4 - (store.settings.background.fluidParams.DENSITY_DISSIPATION ?? 1)"
            :label="t('waterfallPiano.fluidTrailLength')"
            :min="0"
            :max="4"
            :step="0.1"
            @update:model-value="
              store.updateSetting('background', 'fluidParams', {
                ...store.settings.background.fluidParams,
                DENSITY_DISSIPATION: 4 - $event,
              })
            "
          />
          <SettingsRange
            :model-value="4 - (store.settings.background.fluidParams.VELOCITY_DISSIPATION ?? 0.2)"
            :label="t('waterfallPiano.fluidFlowPersistence')"
            :min="0"
            :max="4"
            :step="0.1"
            @update:model-value="
              store.updateSetting('background', 'fluidParams', {
                ...store.settings.background.fluidParams,
                VELOCITY_DISSIPATION: 4 - $event,
              })
            "
          />
          <SettingsToggle
            :model-value="store.settings.background.fluidParams.BLOOM ?? true"
            :label="t('waterfallPiano.fluidBloom')"
            @update:model-value="
              store.updateSetting('background', 'fluidParams', {
                ...store.settings.background.fluidParams,
                BLOOM: $event,
              })
            "
          />
          <SettingsRange
            v-if="store.settings.background.fluidParams.BLOOM ?? true"
            :model-value="store.settings.background.fluidParams.BLOOM_INTENSITY ?? 0.8"
            :label="t('waterfallPiano.fluidBloomIntensity')"
            :min="0.1"
            :max="2"
            :step="0.1"
            @update:model-value="
              store.updateSetting('background', 'fluidParams', {
                ...store.settings.background.fluidParams,
                BLOOM_INTENSITY: $event,
              })
            "
          />
          <SettingsRange
            :model-value="store.settings.background.fluidParams.SPLAT_COLOR_HUE ?? -1"
            :label="t('waterfallPiano.fluidSplatColorHue')"
            :min="-1"
            :max="1"
            :step="0.01"
            @update:model-value="
              store.updateSetting('background', 'fluidParams', {
                ...store.settings.background.fluidParams,
                SPLAT_COLOR_HUE: $event < 0 ? undefined : $event,
              })
            "
          />
          <div class="text-xs text-gray-500 mt-1">
            {{ t('waterfallPiano.fluidSplatColorHueHint') }}
          </div>
        </template>
      </template>

      <!-- 渐变流动动画 -->
      <SettingsToggle
        :model-value="store.settings.background.flowAnimation"
        :label="t('waterfallPiano.flowAnimation')"
        @update:model-value="
          store.updateSetting('background', 'flowAnimation', $event)
        "
      />
      <SettingsRange
        v-if="store.settings.background.flowAnimation"
        :model-value="store.settings.background.flowSpeed"
        :label="t('waterfallPiano.flowSpeed')"
        :min="0.1"
        :max="3"
        :step="0.1"
        @update:model-value="
          store.updateSetting('background', 'flowSpeed', $event)
        "
      />

      <!-- 分组重置 -->
      <button
        class="btn btn-sm btn-ghost w-full mt-2"
        @click="store.resetGroup('background')"
      >
        {{ t("common.resetToDefaults") }}
      </button>
    </SettingsCollapse>

    <!-- 全局重置按钮 -->
    <div class="pt-2">
      <button
        class="btn btn-sm btn-ghost w-full"
        @click="store.resetSettings()"
      >
        {{ t("common.resetAllToDefaults") }}
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
  { label: t("waterfallPiano.presets.physicalPiano"), value: "physical-piano" },
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
  { label: t("waterfallPiano.bgTypes.fluid"), value: "fluid" },
];

const presetThemeOptions = [
  { label: t("waterfallPiano.themes.nightSky"), value: "night-sky" },
  { label: t("waterfallPiano.themes.ocean"), value: "ocean" },
  { label: t("waterfallPiano.themes.sunset"), value: "sunset" },
  { label: t("waterfallPiano.themes.aurora"), value: "aurora" },
  { label: t("waterfallPiano.themes.forest"), value: "forest" },
];

const imageFitModeOptions = [
  { label: t("waterfallPiano.imageFitModes.cover"), value: "cover" },
  { label: t("waterfallPiano.imageFitModes.stretch"), value: "stretch" },
  { label: t("waterfallPiano.imageFitModes.center"), value: "center" },
  { label: t("waterfallPiano.imageFitModes.tile"), value: "tile" },
];

const gradientDirectionOptions = [
  {
    label: t("waterfallPiano.gradientDirections.vertical"),
    value: "linear-vertical",
  },
  {
    label: t("waterfallPiano.gradientDirections.horizontal"),
    value: "linear-horizontal",
  },
  { label: t("waterfallPiano.gradientDirections.radial"), value: "radial" },
];

const flowDirectionOptions = [
  { label: t("waterfallPiano.directions.down"), value: "down" },
  { label: t("waterfallPiano.directions.up"), value: "up" },
];

const fluidQualityOptions = [
  { label: t("waterfallPiano.fluidQualities.low"), value: "low" },
  { label: t("waterfallPiano.fluidQualities.medium"), value: "medium" },
  { label: t("waterfallPiano.fluidQualities.high"), value: "high" },
];

const fluidStyleOptions = [
  { label: t("waterfallPiano.fluidStyles.gentle"), value: "gentle" },
  { label: t("waterfallPiano.fluidStyles.standard"), value: "standard" },
  { label: t("waterfallPiano.fluidStyles.turbulent"), value: "turbulent" },
];

function onBackgroundImageUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string;
    store.updateSetting("background", "imageFile", dataUrl);
  };
  reader.readAsDataURL(file);
}
</script>
