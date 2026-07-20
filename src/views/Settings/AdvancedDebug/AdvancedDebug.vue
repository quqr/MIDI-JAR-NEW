<template>
  <SettingsSection :on-reset="resetAll">
    <div class="grid grid-cols-1 gap-4 m-4">
      <!-- ═══ 分类1a：记谱 - 显示参数 ═══ -->
      <NotationDisplaySection
        :model-value="notationDisplay"
        @update="updateNotationDisplay"
      />

      <!-- ═══ 分类1b：记谱 - 布局参数（放宽范围） ═══ -->
      <NotationLayoutSection
        :model-value="notationLayout"
        @update="updateNotationLayout"
      />

      <!-- ═══ 分类1c：记谱 - 样式参数（放宽范围） ═══ -->
      <NotationStyleSection
        :model-value="notationStyle"
        @update="updateNotationStyle"
      />

      <!-- ═══ 分类2a：瀑布流 - 流体高级参数 ═══ -->
      <WaterfallFluidSection
        :fluid-advanced="waterfallSettings.background.fluidAdvanced"
        :fluid-params="fluidParams"
        @update-bg="updateWaterfallBg"
        @update-fluid-param="updateFluidParam"
      />

      <!-- ═══ 分类2b：瀑布流 - 键盘高级参数 ═══ -->
      <WaterfallKeyboardSection
        :keyboard="waterfallSettings.keyboard"
        :flow-direction-options="flowDirectionOptions"
        @update-kb="updateWaterfallKb"
      />

      <!-- ═══ 分类2c：瀑布流 - MIDI文件高级参数 ═══ -->
      <WaterfallMidiFileSection
        :midi-file="waterfallSettings.midiFile"
        @update-track-color="updateTrackColor"
      />

      <!-- ═══ 分类3：瀑布流 - 音频引擎高级参数 ═══ -->
      <WaterfallSoundSection
        :sound-settings="soundSettings"
        :oscillator-type-options="oscillatorTypeOptions"
        @update-sound="updateSound"
        @update-envelope="updateEnvelope"
      />
    </div>
  </SettingsSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useSettingsStore } from "@/stores/settings";
import { useWaterfallPianoStore } from "@/views/WaterfallPiano/stores/WaterfallPiano";
import { defaultWaterfallSettings } from "@/views/WaterfallPiano/constants";
import { defaultNotationSettings } from "@/types";
import {
  mergeDisplayConfig,
  mergeLayoutConfig,
  mergeStyleConfig,
} from "@/components/Notation/utils";
import { SettingsSection } from "@/components/Settings";
import type { FluidAdvancedParams } from "@/engine/fluid";
import type {
  NotationDisplayConfig,
  NotationLayoutConfig,
  NotationStyleConfig,
} from "@/components/Notation/types";

import NotationDisplaySection from "./sections/NotationDisplaySection.vue";
import NotationLayoutSection from "./sections/NotationLayoutSection.vue";
import NotationStyleSection from "./sections/NotationStyleSection.vue";
import WaterfallFluidSection from "./sections/WaterfallFluidSection.vue";
import WaterfallKeyboardSection from "./sections/WaterfallKeyboardSection.vue";
import WaterfallMidiFileSection from "./sections/WaterfallMidiFileSection.vue";
import WaterfallSoundSection from "./sections/WaterfallSoundSection.vue";

const { t } = useI18n();
const settingsStore = useSettingsStore();
const waterfallStore = useWaterfallPianoStore();

// ─── Notation - Display ───
const notationDisplay = computed<NotationDisplayConfig>(() =>
  mergeDisplayConfig(settingsStore.settings.notation?.display),
);

function updateNotationDisplay(
  key: keyof NotationDisplayConfig,
  value: boolean,
) {
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

function updateNotationStyle(
  key: keyof NotationStyleConfig,
  value: string | number | null,
) {
  const current: Record<string, string | number | null> = {
    ...settingsStore.settings.notation.style,
  };
  current[key] = value;
  settingsStore.updateSetting("notation.style", current);
}

// ─── WaterfallPiano ───
const waterfallSettings = computed(() => waterfallStore.settings);

const fluidParams = computed<Required<FluidAdvancedParams>>(() => ({
  simResolution:
    waterfallSettings.value.background.fluidParams?.simResolution ?? 128,
  splatRadius:
    waterfallSettings.value.background.fluidParams?.splatRadius ?? 0.005,
  splatColorHue:
    waterfallSettings.value.background.fluidParams?.splatColorHue ?? 0,
  trailLength:
    waterfallSettings.value.background.fluidParams?.trailLength ?? 0.5,
  flowPersistence:
    waterfallSettings.value.background.fluidParams?.flowPersistence ?? 0.5,
  bloom: waterfallSettings.value.background.fluidParams?.bloom ?? true,
  bloomIntensity:
    waterfallSettings.value.background.fluidParams?.bloomIntensity ?? 0.8,
  hitExplosion:
    waterfallSettings.value.background.fluidParams?.hitExplosion ?? true,
  blockCoverage:
    waterfallSettings.value.background.fluidParams?.blockCoverage ?? false,
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

function updateEnvelope(
  envType: "envelope" | "modulationEnvelope",
  key: string,
  value: number,
) {
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
  settingsStore.updateSetting("notation.display", {
    ...defaultNotationSettings.display,
  });
  settingsStore.updateSetting("notation.layout", {
    ...defaultNotationSettings.layout,
  });
  settingsStore.updateSetting("notation.style", {
    ...defaultNotationSettings.style,
  });

  // Reset waterfall
  const sound = { ...defaultWaterfallSettings.sound };
  const bg = {
    ...defaultWaterfallSettings.background,
    fluidParams: { ...defaultWaterfallSettings.background.fluidParams },
  };
  const kb = { ...defaultWaterfallSettings.keyboard };
  waterfallStore.updateSetting("background", "fluidAdvanced", bg.fluidAdvanced);
  waterfallStore.updateSetting("background", "fluidParams", bg.fluidParams);
  Object.entries(kb).forEach(([k, v]) =>
    waterfallStore.updateSetting("keyboard", k as any, v),
  );
  Object.entries(sound).forEach(([k, v]) =>
    waterfallStore.updateSetting("sound", k as any, v),
  );
}
</script>
