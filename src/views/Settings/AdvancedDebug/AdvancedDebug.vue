<template>
  <SettingsSection :on-reset="resetAll">
    <!-- ═══ 分类1a：记谱 - 显示参数 ═══ -->
    <SettingsCollapse
      :title="t('advancedDebug.notation.display.title')"
      icon="eye"
      :default-open="false"
    >
      <SettingsToggle
        :model-value="notationDisplay.clef"
        :label="t('advancedDebug.notation.display.clef')"
        @update:model-value="updateNotationDisplay('clef', $event)"
      />
      <SettingsToggle
        :model-value="notationDisplay.keySignature"
        :label="t('advancedDebug.notation.display.keySignature')"
        @update:model-value="updateNotationDisplay('keySignature', $event)"
      />
      <SettingsToggle
        :model-value="notationDisplay.keySignatureText"
        :label="t('advancedDebug.notation.display.keySignatureText')"
        @update:model-value="updateNotationDisplay('keySignatureText', $event)"
      />
      <SettingsToggle
        :model-value="notationDisplay.barlines"
        :label="t('advancedDebug.notation.display.barlines')"
        @update:model-value="updateNotationDisplay('barlines', $event)"
      />
      <SettingsToggle
        :model-value="notationDisplay.timeSignature"
        :label="t('advancedDebug.notation.display.timeSignature')"
        @update:model-value="updateNotationDisplay('timeSignature', $event)"
      />
      <SettingsToggle
        :model-value="notationDisplay.noteNames"
        :label="t('advancedDebug.notation.display.noteNames')"
        @update:model-value="updateNotationDisplay('noteNames', $event)"
      />
      <SettingsToggle
        :model-value="notationDisplay.staffLines"
        :label="t('advancedDebug.notation.display.staffLines')"
        @update:model-value="updateNotationDisplay('staffLines', $event)"
      />
    </SettingsCollapse>

    <!-- ═══ 分类1b：记谱 - 布局参数（放宽范围） ═══ -->
    <SettingsCollapse
      :title="t('advancedDebug.notation.layout.title')"
      icon="layout"
      :default-open="false"
    >
      <SettingsRange
        :model-value="notationLayout.paddingTop"
        :label="t('advancedDebug.notation.layout.paddingTop')"
        :min="0"
        :max="300"
        :step="5"
        @update:model-value="updateNotationLayout('paddingTop', $event)"
      />
      <SettingsRange
        :model-value="notationLayout.staveHeight"
        :label="t('advancedDebug.notation.layout.staveHeight')"
        :min="40"
        :max="500"
        :step="10"
        @update:model-value="updateNotationLayout('staveHeight', $event)"
      />
      <SettingsRange
        :model-value="notationLayout.staveGap"
        :label="t('advancedDebug.notation.layout.staveGap')"
        :min="0"
        :max="200"
        :step="5"
        @update:model-value="updateNotationLayout('staveGap', $event)"
      />
      <SettingsRange
        :model-value="notationLayout.textHeight"
        :label="t('advancedDebug.notation.layout.textHeight')"
        :min="0"
        :max="200"
        :step="5"
        @update:model-value="updateNotationLayout('textHeight', $event)"
      />
      <SettingsRange
        :model-value="notationLayout.bottomPadding"
        :label="t('advancedDebug.notation.layout.bottomPadding')"
        :min="0"
        :max="200"
        :step="5"
        @update:model-value="updateNotationLayout('bottomPadding', $event)"
      />
      <SettingsRange
        :model-value="notationLayout.sidePadding"
        :label="t('advancedDebug.notation.layout.sidePadding')"
        :min="0"
        :max="300"
        :step="5"
        @update:model-value="updateNotationLayout('sidePadding', $event)"
      />
      <SettingsRange
        :model-value="notationLayout.clefWidth"
        :label="t('advancedDebug.notation.layout.clefWidth')"
        :min="10"
        :max="200"
        :step="5"
        @update:model-value="updateNotationLayout('clefWidth', $event)"
      />
      <SettingsRange
        :model-value="notationLayout.noteWidth"
        :label="t('advancedDebug.notation.layout.noteWidth')"
        :min="20"
        :max="500"
        :step="10"
        @update:model-value="updateNotationLayout('noteWidth', $event)"
      />
      <SettingsRange
        :model-value="notationLayout.keySignatureWidthPerAlteration"
        :label="t('advancedDebug.notation.layout.keySignatureWidthPerAlteration')"
        :description="t('advancedDebug.notation.layout.keySignatureWidthPerAlterationHint')"
        :min="20"
        :max="500"
        :step="10"
        @update:model-value="updateNotationLayout('keySignatureWidthPerAlteration', $event)"
      />
      <SettingsRange
        :model-value="notationLayout.maxScale"
        :label="t('advancedDebug.notation.layout.maxScale')"
        :description="t('advancedDebug.notation.layout.maxScaleHint')"
        :min="0.1"
        :max="5"
        :step="0.1"
        @update:model-value="updateNotationLayout('maxScale', $event)"
      />
    </SettingsCollapse>

    <!-- ═══ 分类1c：记谱 - 样式参数（放宽范围） ═══ -->
    <SettingsCollapse
      :title="t('advancedDebug.notation.style.title')"
      icon="palette"
      :default-open="false"
    >
      <SettingsColorPicker
        :model-value="notationStyle.backgroundColor"
        :label="t('advancedDebug.notation.style.backgroundColor')"
        @update:model-value="updateNotationStyle('backgroundColor', $event)"
      />
      <SettingsColorPicker
        :model-value="notationStyle.staffLineColor"
        :label="t('advancedDebug.notation.style.staffLineColor')"
        @update:model-value="updateNotationStyle('staffLineColor', $event)"
      />
      <SettingsColorPicker
        :model-value="notationStyle.noteColor"
        :label="t('advancedDebug.notation.style.noteColor')"
        @update:model-value="updateNotationStyle('noteColor', $event)"
      />
      <SettingsColorPicker
        :model-value="notationStyle.noteHighlightColor"
        :label="t('advancedDebug.notation.style.noteHighlightColor')"
        @update:model-value="updateNotationStyle('noteHighlightColor', $event)"
      />
      <SettingsRange
        :model-value="notationStyle.fontSize"
        :label="t('advancedDebug.notation.style.fontSize')"
        :min="2"
        :max="60"
        :step="1"
        @update:model-value="updateNotationStyle('fontSize', $event)"
      />
    </SettingsCollapse>

    <!-- ═══ 分类2a：瀑布流 - 流体高级参数 ═══ -->
    <SettingsCollapse
      :title="t('advancedDebug.waterfall.fluid.title')"
      icon="water"
      :default-open="false"
    >
      <SettingsToggle
        :model-value="waterfallSettings.background.fluidAdvanced"
        :label="t('advancedDebug.waterfall.fluid.fluidAdvanced')"
        :description="t('advancedDebug.waterfall.fluid.fluidAdvancedHint')"
        @update:model-value="updateWaterfallBg('fluidAdvanced', $event)"
      />
      <template v-if="waterfallSettings.background.fluidAdvanced">
        <SettingsRange
          :model-value="fluidParams.simResolution"
          :label="t('advancedDebug.waterfall.fluid.simResolution')"
          :min="32"
          :max="256"
          :step="32"
          @update:model-value="updateFluidParam('simResolution', $event)"
        />
        <SettingsRange
          :model-value="fluidParams.splatRadius"
          :label="t('advancedDebug.waterfall.fluid.splatRadius')"
          :min="0.0001"
          :max="0.01"
          :step="0.0005"
          @update:model-value="updateFluidParam('splatRadius', $event)"
        />
        <SettingsRange
          :model-value="fluidParams.splatColorHue"
          :label="t('advancedDebug.waterfall.fluid.splatColorHue')"
          :min="0"
          :max="1"
          :step="0.05"
          @update:model-value="updateFluidParam('splatColorHue', $event)"
        />
        <SettingsRange
          :model-value="fluidParams.trailLength"
          :label="t('advancedDebug.waterfall.fluid.trailLength')"
          :description="t('advancedDebug.waterfall.fluid.trailLengthHint')"
          :min="0"
          :max="1"
          :step="0.05"
          @update:model-value="updateFluidParam('trailLength', $event)"
        />
        <SettingsRange
          :model-value="fluidParams.flowPersistence"
          :label="t('advancedDebug.waterfall.fluid.flowPersistence')"
          :description="t('advancedDebug.waterfall.fluid.flowPersistenceHint')"
          :min="0"
          :max="1"
          :step="0.05"
          @update:model-value="updateFluidParam('flowPersistence', $event)"
        />
        <SettingsToggle
          :model-value="fluidParams.bloom"
          :label="t('advancedDebug.waterfall.fluid.bloom')"
          @update:model-value="updateFluidParam('bloom', $event)"
        />
        <SettingsRange
          v-if="fluidParams.bloom"
          :model-value="fluidParams.bloomIntensity"
          :label="t('advancedDebug.waterfall.fluid.bloomIntensity')"
          :min="0.1"
          :max="2"
          :step="0.1"
          @update:model-value="updateFluidParam('bloomIntensity', $event)"
        />
        <SettingsToggle
          :model-value="fluidParams.hitExplosion"
          :label="t('advancedDebug.waterfall.fluid.hitExplosion')"
          :description="t('advancedDebug.waterfall.fluid.hitExplosionHint')"
          @update:model-value="updateFluidParam('hitExplosion', $event)"
        />
        <SettingsToggle
          :model-value="fluidParams.blockCoverage"
          :label="t('advancedDebug.waterfall.fluid.blockCoverage')"
          :description="t('advancedDebug.waterfall.fluid.blockCoverageHint')"
          @update:model-value="updateFluidParam('blockCoverage', $event)"
        />
      </template>
    </SettingsCollapse>

    <!-- ═══ 分类2b：瀑布流 - 键盘高级参数 ═══ -->
    <SettingsCollapse
      :title="t('advancedDebug.waterfall.keyboard.title')"
      icon="keyboard"
      :default-open="false"
    >
      <template v-if="waterfallSettings.keyboard.range === 'custom'">
        <SettingsTextInput
          :model-value="waterfallSettings.keyboard.customFrom"
          :label="t('advancedDebug.waterfall.keyboard.customFrom')"
          @update:model-value="updateWaterfallKb('customFrom', $event)"
        />
        <SettingsTextInput
          :model-value="waterfallSettings.keyboard.customTo"
          :label="t('advancedDebug.waterfall.keyboard.customTo')"
          @update:model-value="updateWaterfallKb('customTo', $event)"
        />
      </template>
      <SettingsRange
        :model-value="waterfallSettings.keyboard.keyBorderWidth"
        :label="t('advancedDebug.waterfall.keyboard.keyBorderWidth')"
        :min="0"
        :max="5"
        :step="0.5"
        @update:model-value="updateWaterfallKb('keyBorderWidth', $event)"
      />
      <SettingsColorPicker
        :model-value="waterfallSettings.keyboard.keyBorderColor"
        :label="t('advancedDebug.waterfall.keyboard.keyBorderColor')"
        @update:model-value="updateWaterfallKb('keyBorderColor', $event)"
      />
      <SettingsRange
        :model-value="waterfallSettings.keyboard.gapBlur"
        :label="t('advancedDebug.waterfall.keyboard.gapBlur')"
        :min="0"
        :max="10"
        :step="0.5"
        @update:model-value="updateWaterfallKb('gapBlur', $event)"
      />
      <SettingsColorPicker
        :model-value="waterfallSettings.keyboard.separatorColor"
        :label="t('advancedDebug.waterfall.keyboard.separatorColor')"
        @update:model-value="updateWaterfallKb('separatorColor', $event)"
      />
      <SettingsRange
        :model-value="waterfallSettings.keyboard.separatorThickness"
        :label="t('advancedDebug.waterfall.keyboard.separatorThickness')"
        :min="1"
        :max="10"
        :step="1"
        @update:model-value="updateWaterfallKb('separatorThickness', $event)"
      />
      <SettingsToggle
        :model-value="waterfallSettings.keyboard.staffVisible"
        :label="t('advancedDebug.waterfall.keyboard.staffVisible')"
        @update:model-value="updateWaterfallKb('staffVisible', $event)"
      />
      <SettingsSelect
        :model-value="waterfallSettings.keyboard.synthesiaFlowDirection"
        :label="t('advancedDebug.waterfall.keyboard.synthesiaFlowDirection')"
        :options="flowDirectionOptions"
        @update:model-value="updateWaterfallKb('synthesiaFlowDirection', $event)"
      />
    </SettingsCollapse>

    <!-- ═══ 分类2c：瀑布流 - MIDI文件高级参数 ═══ -->
    <SettingsCollapse
      :title="t('advancedDebug.waterfall.midiFile.title')"
      icon="file-music"
      :default-open="false"
    >
      <div class="py-2.5">
        <div class="text-sm font-medium mb-1">{{ t('advancedDebug.waterfall.midiFile.selectedTracks') }}</div>
        <div class="text-xs text-base-content/60 mb-2">{{ t('advancedDebug.waterfall.midiFile.selectedTracksHint') }}</div>
        <div v-if="waterfallSettings.midiFile.selectedTracks.length" class="flex flex-wrap gap-1">
          <span
            v-for="track in waterfallSettings.midiFile.selectedTracks"
            :key="track"
            class="badge badge-sm badge-outline"
          >{{ track }}</span>
        </div>
        <div v-else class="text-xs text-base-content/40">{{ t('advancedDebug.waterfall.midiFile.noTracks') }}</div>
      </div>
      <div class="py-2.5">
        <div class="text-sm font-medium mb-2">{{ t('advancedDebug.waterfall.midiFile.trackColors') }}</div>
        <div class="space-y-1">
          <SettingsColorPicker
            v-for="(color, idx) in waterfallSettings.midiFile.trackColors"
            :key="idx"
            :model-value="color"
            :label="t('advancedDebug.waterfall.midiFile.trackColorN', { n: idx + 1 })"
            @update:model-value="updateTrackColor(idx, $event)"
          />
        </div>
      </div>
    </SettingsCollapse>

    <!-- ═══ 分类3：瀑布流 - 音频引擎高级参数 ═══ -->
    <SettingsCollapse
      :title="t('advancedDebug.sound.title')"
      icon="speaker"
      :default-open="false"
    >
      <!-- 基础参数 -->
      <SettingsRange
        :model-value="soundSettings.volume"
        :label="t('advancedDebug.sound.volume')"
        :min="0"
        :max="1"
        :step="0.05"
        @update:model-value="updateSound('volume', $event)"
      />
      <SettingsRange
        :model-value="soundSettings.reverbAmount"
        :label="t('advancedDebug.sound.reverbAmount')"
        :description="t('advancedDebug.sound.reverbAmountHint')"
        :min="0"
        :max="1"
        :step="0.05"
        @update:model-value="updateSound('reverbAmount', $event)"
      />
      <SettingsRange
        :model-value="soundSettings.reverbDecay"
        :label="t('advancedDebug.sound.reverbDecay')"
        :min="0.5"
        :max="8"
        :step="0.5"
        @update:model-value="updateSound('reverbDecay', $event)"
      />
      <SettingsToggle
        :model-value="soundSettings.sustain"
        :label="t('advancedDebug.sound.sustain')"
        @update:model-value="updateSound('sustain', $event)"
      />
      <SettingsToggle
        :model-value="soundSettings.velocitySensitivity"
        :label="t('advancedDebug.sound.velocitySensitivity')"
        @update:model-value="updateSound('velocitySensitivity', $event)"
      />

      <!-- 合成器参数 -->
      <div class="divider text-xs text-base-content/50">{{ t('advancedDebug.sound.synthParams') }}</div>

      <SettingsRange
        :model-value="soundSettings.harmonicity"
        :label="t('advancedDebug.sound.harmonicity')"
        :min="0.5"
        :max="10"
        :step="0.5"
        @update:model-value="updateSound('harmonicity', $event)"
      />
      <SettingsRange
        :model-value="soundSettings.modulationIndex"
        :label="t('advancedDebug.sound.modulationIndex')"
        :min="1"
        :max="50"
        :step="1"
        @update:model-value="updateSound('modulationIndex', $event)"
      />
      <SettingsSelect
        :model-value="soundSettings.oscillatorType"
        :label="t('advancedDebug.sound.oscillatorType')"
        :options="oscillatorTypeOptions"
        @update:model-value="updateSound('oscillatorType', $event)"
      />

      <!-- 包络参数 -->
      <div class="divider text-xs text-base-content/50">{{ t('advancedDebug.sound.envelope') }}</div>

      <SettingsRange
        :model-value="soundSettings.envelope.attack"
        :label="t('advancedDebug.sound.attack')"
        :min="0.001"
        :max="1"
        :step="0.001"
        @update:model-value="updateEnvelope('envelope', 'attack', $event)"
      />
      <SettingsRange
        :model-value="soundSettings.envelope.decay"
        :label="t('advancedDebug.sound.decay')"
        :min="0.01"
        :max="2"
        :step="0.01"
        @update:model-value="updateEnvelope('envelope', 'decay', $event)"
      />
      <SettingsRange
        :model-value="soundSettings.envelope.sustain"
        :label="t('advancedDebug.sound.sustainLevel')"
        :min="0"
        :max="1"
        :step="0.05"
        @update:model-value="updateEnvelope('envelope', 'sustain', $event)"
      />
      <SettingsRange
        :model-value="soundSettings.envelope.release"
        :label="t('advancedDebug.sound.release')"
        :min="0.01"
        :max="5"
        :step="0.01"
        @update:model-value="updateEnvelope('envelope', 'release', $event)"
      />

      <!-- 调制包络参数 -->
      <div class="divider text-xs text-base-content/50">{{ t('advancedDebug.sound.modEnvelope') }}</div>

      <SettingsRange
        :model-value="soundSettings.modulationEnvelope.attack"
        :label="t('advancedDebug.sound.modAttack')"
        :min="0.001"
        :max="1"
        :step="0.001"
        @update:model-value="updateEnvelope('modulationEnvelope', 'attack', $event)"
      />
      <SettingsRange
        :model-value="soundSettings.modulationEnvelope.decay"
        :label="t('advancedDebug.sound.modDecay')"
        :min="0.01"
        :max="2"
        :step="0.01"
        @update:model-value="updateEnvelope('modulationEnvelope', 'decay', $event)"
      />
      <SettingsRange
        :model-value="soundSettings.modulationEnvelope.sustain"
        :label="t('advancedDebug.sound.modSustain')"
        :min="0"
        :max="1"
        :step="0.05"
        @update:model-value="updateEnvelope('modulationEnvelope', 'sustain', $event)"
      />
      <SettingsRange
        :model-value="soundSettings.modulationEnvelope.release"
        :label="t('advancedDebug.sound.modRelease')"
        :min="0.01"
        :max="5"
        :step="0.01"
        @update:model-value="updateEnvelope('modulationEnvelope', 'release', $event)"
      />
    </SettingsCollapse>
  </SettingsSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useSettingsStore } from "@/stores/settings";
import { useWaterfallPianoStore } from "@/views/waterfallpiano/stores/waterfallPiano";
import { defaultWaterfallSettings } from "@/views/waterfallpiano/constants";
import { defaultNotationSettings } from "@/types";
import {
  mergeDisplayConfig,
  mergeLayoutConfig,
  mergeStyleConfig,
} from "@/components/Notation/utils";
import type { FluidAdvancedParams } from "@/engine/fluid";
import type {
  NotationDisplayConfig,
  NotationLayoutConfig,
  NotationStyleConfig,
} from "@/components/Notation/types";
import {
  SettingsCollapse,
  SettingsRange,
  SettingsToggle,
  SettingsSelect,
  SettingsColorPicker,
  SettingsTextInput,
  SettingsSection,
} from "@/components/Settings";

const { t } = useI18n();
const settingsStore = useSettingsStore();
const waterfallStore = useWaterfallPianoStore();

// ─── Notation - Display ───
const notationDisplay = computed<NotationDisplayConfig>(() =>
  mergeDisplayConfig(settingsStore.settings.notation?.display),
);

function updateNotationDisplay(key: keyof NotationDisplayConfig, value: boolean) {
  const current: Record<string, boolean> = {
    ...settingsStore.settings.notation.display,
  };
  current[key] = value;
  settingsStore.updateSetting("notation.display", current);
}

// ─── Notation - Layout ───
const notationLayout = computed<NotationLayoutConfig>(() =>
  mergeLayoutConfig(settingsStore.settings.notation?.layout),
);

function updateNotationLayout(key: keyof NotationLayoutConfig, value: number) {
  const current: Record<string, number> = {
    ...settingsStore.settings.notation.layout,
  };
  current[key] = value;
  settingsStore.updateSetting("notation.layout", current);
}

// ─── Notation - Style ───
const notationStyle = computed<NotationStyleConfig>(() =>
  mergeStyleConfig(settingsStore.settings.notation?.style),
);

function updateNotationStyle(key: keyof NotationStyleConfig, value: string | number | null) {
  const current: Record<string, string | number | null> = {
    ...settingsStore.settings.notation.style,
  };
  current[key] = value;
  settingsStore.updateSetting("notation.style", current);
}

// ─── WaterfallPiano ───
const waterfallSettings = computed(() => waterfallStore.settings);

const fluidParams = computed<Required<FluidAdvancedParams>>(() => ({
  simResolution: waterfallSettings.value.background.fluidParams?.simResolution ?? 128,
  splatRadius: waterfallSettings.value.background.fluidParams?.splatRadius ?? 0.005,
  splatColorHue: waterfallSettings.value.background.fluidParams?.splatColorHue ?? 0,
  trailLength: waterfallSettings.value.background.fluidParams?.trailLength ?? 0.5,
  flowPersistence: waterfallSettings.value.background.fluidParams?.flowPersistence ?? 0.5,
  bloom: waterfallSettings.value.background.fluidParams?.bloom ?? true,
  bloomIntensity: waterfallSettings.value.background.fluidParams?.bloomIntensity ?? 0.8,
  hitExplosion: waterfallSettings.value.background.fluidParams?.hitExplosion ?? true,
  blockCoverage: waterfallSettings.value.background.fluidParams?.blockCoverage ?? false,
}));

function updateWaterfallBg(key: string, value: unknown) {
  waterfallStore.updateSetting("background", key as any, value);
}

function updateFluidParam(key: keyof FluidAdvancedParams, value: unknown) {
  const current = { ...waterfallSettings.value.background.fluidParams };
  (current as Record<string, unknown>)[key] = value;
  waterfallStore.updateSetting("background", "fluidParams", current);
}

function updateWaterfallKb(key: string, value: unknown) {
  waterfallStore.updateSetting("keyboard", key as any, value);
}

function updateTrackColor(index: number, color: string | null) {
  const colors = [...waterfallSettings.value.midiFile.trackColors];
  colors[index] = color ?? "#000000";
  waterfallStore.updateSetting("midiFile", "trackColors", colors);
}

const flowDirectionOptions = computed(() => [
  { value: "up", label: t("advancedDebug.waterfall.keyboard.flowUp") },
  { value: "down", label: t("advancedDebug.waterfall.keyboard.flowDown") },
]);

// ─── SoundEngine ───
const soundSettings = computed(() => waterfallSettings.value.sound);

function updateSound(key: string, value: unknown) {
  waterfallStore.updateSetting("sound", key as any, value);
}

function updateEnvelope(envType: "envelope" | "modulationEnvelope", key: string, value: number) {
  const current = { ...soundSettings.value[envType] };
  current[key as keyof typeof current] = value;
  waterfallStore.updateSetting("sound", envType as any, current);
}

const oscillatorTypeOptions = computed(() => [
  { value: "triangle", label: t("advancedDebug.sound.oscTypes.triangle") },
  { value: "sine", label: t("advancedDebug.sound.oscTypes.sine") },
  { value: "square", label: t("advancedDebug.sound.oscTypes.square") },
  { value: "sawtooth", label: t("advancedDebug.sound.oscTypes.sawtooth") },
]);

// ─── Reset ───
function resetAll() {
  // Reset notation to defaults (display + layout + style)
  settingsStore.updateSetting("notation.display", { ...defaultNotationSettings.display });
  settingsStore.updateSetting("notation.layout", { ...defaultNotationSettings.layout });
  settingsStore.updateSetting("notation.style", { ...defaultNotationSettings.style });

  // Reset waterfall
  const sound = { ...defaultWaterfallSettings.sound };
  const bg = { ...defaultWaterfallSettings.background, fluidParams: { ...defaultWaterfallSettings.background.fluidParams } };
  const kb = { ...defaultWaterfallSettings.keyboard };
  waterfallStore.updateSetting("background", "fluidAdvanced", bg.fluidAdvanced);
  waterfallStore.updateSetting("background", "fluidParams", bg.fluidParams);
  Object.entries(kb).forEach(([k, v]) => waterfallStore.updateSetting("keyboard", k as any, v));
  Object.entries(sound).forEach(([k, v]) => waterfallStore.updateSetting("sound", k as any, v));
}
</script>
