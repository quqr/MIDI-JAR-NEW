<template>
  <SettingsSection>
    <!-- ═══ 配置区 ═══ -->
    <div class="grid grid-cols-1 gap-4 m-4">
      <!-- ═══ 分类1a：记谱 - 显示参数 ═══ -->
      <NotationDisplaySection
        v-model:open="sectionOpen.notationDisplay"
        section-id="notation-display"
        :search-query="searchQuery"
        :model-value="notationDisplay"
        @update="updateNotationDisplay"
      />

      <!-- ═══ 分类1b：记谱 - 布局参数（放宽范围） ═══ -->
      <NotationLayoutSection
        v-model:open="sectionOpen.notationLayout"
        section-id="notation-layout"
        :search-query="searchQuery"
        :model-value="notationLayout"
        @update="updateNotationLayout"
      />

      <!-- ═══ 分类1c：记谱 - 样式参数（放宽范围） ═══ -->
      <NotationStyleSection
        v-model:open="sectionOpen.notationStyle"
        section-id="notation-style"
        :search-query="searchQuery"
        :model-value="notationStyle"
        @update="updateNotationStyle"
      />

      <!-- ═══ 分类2a：瀑布流 - 流体高级参数 ═══ -->
      <WaterfallFluidSection
        v-model:open="sectionOpen.waterfallFluid"
        section-id="waterfall-fluid"
        :search-query="searchQuery"
        :fluid-advanced="waterfallSettings.background.fluidAdvanced"
        :fluid-params="fluidParams"
        @update-bg="updateWaterfallBg"
        @update-fluid-param="updateFluidParam"
      />

      <!-- ═══ 分类2b：瀑布流 - 键盘高级参数 ═══ -->
      <WaterfallKeyboardSection
        v-model:open="sectionOpen.waterfallKeyboard"
        section-id="waterfall-keyboard"
        :search-query="searchQuery"
        :keyboard="waterfallSettings.keyboard"
        :flow-direction-options="flowDirectionOptions"
        @update-kb="updateWaterfallKb"
      />

      <!-- ═══ 分类2c：瀑布流 - MIDI文件高级参数 ═══ -->
      <WaterfallMidiFileSection
        v-model:open="sectionOpen.waterfallMidiFile"
        section-id="waterfall-midi-file"
        :search-query="searchQuery"
        :midi-file="waterfallSettings.midiFile"
        @update-track-color="updateTrackColor"
        @update-midi-file="updateWaterfallMidiFile"
      />

      <!-- ═══ 分类3：瀑布流 - 音频引擎高级参数 ═══ -->
      <WaterfallSoundSection
        v-model:open="sectionOpen.waterfallSound"
        section-id="waterfall-sound"
        :search-query="searchQuery"
        :sound-settings="soundSettings"
        :oscillator-type-options="oscillatorTypeOptions"
        @update-sound="updateSound"
        @update-envelope="updateEnvelope"
      />

      <!-- ═══ 分类4：缓存管理 ═══ -->
      <CacheManagementSection
        v-model:open="sectionOpen.cacheManagement"
        :search-query="searchQuery"
      />
    </div>

    <!-- ═══ 预设管理弹窗 ═══ -->
    <PresetManagerDialog
      :open="presetDialogOpen"
      :presets="presets.presets.value"
      :error="presets.error.value"
      @close="presetDialogOpen = false"
      @save="handlePresetSave"
      @apply="handlePresetApply"
      @rename="presets.renamePreset"
      @delete="presets.deletePreset"
      @export="presets.exportPresets"
      @import="handlePresetImport"
      @clear-error="presets.clearError"
    />
  </SettingsSection>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useSettingsStore } from "@/stores/settings";
import { useWaterfallPianoStore } from "@/views/WaterfallPiano/stores/WaterfallPiano";
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
import type { Settings } from "@/types";
import type { WaterfallPianoSettings } from "@/views/WaterfallPiano/types";

import NotationDisplaySection from "./sections/NotationDisplaySection.vue";
import NotationLayoutSection from "./sections/NotationLayoutSection.vue";
import NotationStyleSection from "./sections/NotationStyleSection.vue";
import WaterfallFluidSection from "./sections/WaterfallFluidSection.vue";
import WaterfallKeyboardSection from "./sections/WaterfallKeyboardSection.vue";
import WaterfallMidiFileSection from "./sections/WaterfallMidiFileSection.vue";
import WaterfallSoundSection from "./sections/WaterfallSoundSection.vue";
import CacheManagementSection from "./sections/CacheManagementSection.vue";
import PresetManagerDialog from "./components/PresetManagerDialog.vue";
import { useAdvancedDebugPresets } from "./composables/useAdvancedDebugPresets";

const { t } = useI18n();
const settingsStore = useSettingsStore();
const waterfallStore = useWaterfallPianoStore();

// ─── 搜索与折叠状态 ───
const searchQuery = ref("");
const sectionOpen = reactive({
  notationDisplay: true,
  notationLayout: true,
  notationStyle: true,
  waterfallFluid: true,
  waterfallKeyboard: true,
  waterfallMidiFile: true,
  waterfallSound: true,
  cacheManagement: true,
});

// ─── 通知系统 ───
type Notification = { type: "success" | "error"; message: string };
const notification = ref<Notification | null>(null);

function showNotification(type: Notification["type"], message: string): void {
  notification.value = { type, message };
  // 5 秒后自动消失
  setTimeout(() => {
    if (notification.value?.message === message) notification.value = null;
  }, 5000);
}

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
  key: keyof Omit<NotationStyleConfig, "layoutDimensions">,
  value: string | number | null,
) {
  const current: Partial<NotationStyleConfig> = {
    ...settingsStore.settings.notation.style,
  };
  (current as Record<string, string | number | null>)[key] = value;
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
  fluidSplatPerturbation:
    waterfallSettings.value.background.fluidParams?.fluidSplatPerturbation ??
    {},
  hitExplosionPerturbation:
    waterfallSettings.value.background.fluidParams?.hitExplosionPerturbation ??
    {},
  blockCoveragePerturbation:
    waterfallSettings.value.background.fluidParams?.blockCoveragePerturbation ??
    {},
  sustainedSplatPerturbation:
    waterfallSettings.value.background.fluidParams
      ?.sustainedSplatPerturbation ?? {},
}));

function updateWaterfallBg(key: string, value: unknown) {
  waterfallStore.updateSetting("background", key as never, value);
}

function updateFluidParam(key: keyof FluidAdvancedParams, value: unknown) {
  const current = { ...waterfallSettings.value.background.fluidParams };
  (current as Record<string, unknown>)[key] = value;
  waterfallStore.updateSetting("background", "fluidParams", current);
}

function updateWaterfallKb(key: string, value: unknown) {
  waterfallStore.updateSetting("keyboard", key as never, value);
}

function updateWaterfallMidiFile(key: string, value: unknown) {
  waterfallStore.updateSetting("midiFile", key as never, value);
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
  waterfallStore.updateSetting("sound", key as never, value);
}

function updateEnvelope(
  envType: "envelope" | "modulationEnvelope",
  key: string,
  value: number,
) {
  const current = { ...soundSettings.value[envType] };
  current[key as keyof typeof current] = value;
  waterfallStore.updateSetting("sound", envType as never, current);
}

const oscillatorTypeOptions = computed(() => [
  { value: "triangle", label: t("advancedDebug.sound.oscTypes.triangle") },
  { value: "sine", label: t("advancedDebug.sound.oscTypes.sine") },
  { value: "square", label: t("advancedDebug.sound.oscTypes.square") },
  { value: "sawtooth", label: t("advancedDebug.sound.oscTypes.sawtooth") },
]);

// ─── 预设管理 ───
const presetDialogOpen = ref(false);

function getNotationSnapshot(): Settings["notation"] {
  return structuredClone(settingsStore.settings.notation);
}

function setNotationSnapshot(notation: Settings["notation"]): void {
  settingsStore.updateSetting("notation", notation);
}

function getWaterfallSnapshot(): WaterfallPianoSettings {
  return structuredClone(waterfallStore.settings);
}

function setWaterfallSnapshot(settings: WaterfallPianoSettings): void {
  waterfallStore.settings = settings;
}

const presets = useAdvancedDebugPresets({
  getNotation: getNotationSnapshot,
  setNotation: setNotationSnapshot,
  getWaterfall: getWaterfallSnapshot,
  setWaterfall: setWaterfallSnapshot,
});

function handlePresetSave(name: string): void {
  if (presets.savePreset(name)) {
    showNotification("success", t("advancedDebug.presets.save"));
  } else if (presets.error.value) {
    showNotification("error", presets.error.value);
  }
}

function handlePresetApply(name: string): void {
  if (presets.applyPreset(name)) {
    showNotification("success", t("advancedDebug.presets.apply") + ": " + name);
    presetDialogOpen.value = false;
  } else if (presets.error.value) {
    showNotification("error", presets.error.value);
  }
}

async function handlePresetImport(file: File): Promise<void> {
  const count = await presets.importPresets(file, "merge");
  if (count > 0) {
    showNotification(
      "success",
      t("advancedDebug.presets.importSuccess", { count }),
    );
  } else {
    showNotification("error", t("advancedDebug.presets.importFailed"));
  }
}
</script>
