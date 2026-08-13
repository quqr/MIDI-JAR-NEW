<template>
  <div
    id="chordDisplay"
    class="relative h-full w-full grid grid-rows-[2fr_1fr]"
  >
    <!-- ===== 上方显示区域 (grid: 2列桌面, 1列移动端) ===== -->
    <div class="bg-base-100 grid grid-cols-2">
      <!-- 左侧：五线谱 -->
      <div
        v-if="displayNotation"
        class="flex flex-col items-center justify-center"
      >
        <Notation
          id="notation"
          class="items-center justify-center"
          :midiNotes="midiNotes"
          :keySignature="keySignature"
          :staffClef="staffClef"
          :staffTranspose="staffTranspose"
          :display="notationDisplay"
          :layout="notationLayout"
          :style="notationStyle"
        />
      </div>

      <!-- 右侧：和弦信息 -->
      <div class="flex flex-col">
        <!-- 和弦名称 -->
        <div
          v-if="displayChord"
          id="chord"
          class="flex flex-col flex-1 items-center justify-center text-center"
        >
          <div
            :key="chords[0]?.name ?? ''"
            class="flex flex-col items-center justify-center"
          >
            <ChordNameLink
              :chord="chords[0]"
              class="items-center justify-center"
              :notation="chordNotation"
              :highlightAlterations="highlightAlterations"
              size="6xl"
            />
          </div>
        </div>
        <!-- 和弦全名 -->
        <div
          v-if="displayName"
          id="name"
          class="flex-shrink-0 w-full flex items-center justify-center text-center text-base font-semibold"
        >
          {{ translatedChordName }}
        </div>
        <!-- 音程网格 -->
        <div
          v-if="displayIntervals"
          id="intervals"
          class="flex-shrink-0 w-full px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6 pt-2"
        >
          <ChordIntervals
            :intervals="chords[0]?.intervals ?? []"
            :pitchClasses="pitchClasses"
            :tonic="chords[0]?.tonic"
          />
        </div>
      </div>

      <!-- 浮动：备选和弦 + 声音开关 + 设置 -->
      <div
        class="absolute top-2 right-2 sm:top-3 sm:right-3 md:top-4 md:right-4 z-sticky flex flex-col gap-2 items-end"
      >
        <div
          v-if="displayAltChords && chords.length > 1"
          class="bg-base-100/80 backdrop-blur-xl rounded-btn p-2 sm:p-3"
          role="complementary"
          :aria-label="t('chordDisplay.altChords')"
        >
          <p class="mb-2 text-xs font-medium text-base-content/70">
            {{ t("chordDisplay.altChords") }}
          </p>
          <div
            class="flex flex-wrap gap-1.5 justify-end max-w-[180px] sm:max-w-[200px]"
          >
            <template v-for="(chord, index) in chords" :key="index">
              <button
                v-if="index > 0"
                type="button"
                class="btn btn-ghost btn-sm rounded-full"
              >
                <ChordNameLink
                  :chord="chord"
                  class="items-center justify-center"
                  :notation="chordNotation"
                  :highlightAlterations="highlightAlterations"
                />
              </button>
            </template>
          </div>
        </div>

        <!-- 声音开关 -->
        <div
          class="bg-base-100/80 backdrop-blur-xl rounded-btn px-3 py-2 flex items-center gap-2"
          role="group"
          :aria-label="t('chordDisplay.sound')"
        >
          <svg
            class="w-4 h-4 text-base-content"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path
              v-if="soundEnabled"
              d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"
            />
          </svg>
          <span class="text-xs text-base-content font-medium">{{
            t("chordDisplay.sound")
          }}</span>
          <input
            type="checkbox"
            class="toggle toggle-sm"
            :checked="soundEnabled"
            @change="toggleSound"
            :aria-label="
              soundEnabled
                ? t('chordDisplay.soundOn')
                : t('chordDisplay.soundOff')
            "
          />
        </div>

        <SettingsButton
          :aria-label="t('chordDisplay.openSettings')"
          @click="settingsOpen = true"
        />
      </div>
    </div>

    <!-- ===== 钢琴键盘 ===== -->
    <div v-if="displayKeyboard" class="bg-base-100 w-full h-full">
      <PianoKeyboard
        id="keyboard"
        class="w-full h-full"
        :sustained="sustainedMidiNotes"
        :played="combinedPlayedMidi"
        :midi="midiNotes"
        :chord="chords[0] ?? undefined"
        :keyboard="keyboard"
        :clickable="true"
        :sustain-mode="false"
        @note-click="onNoteClick"
      />
    </div>

    <SettingsDrawer v-model="settingsOpen" :title="t('chordDisplay.settings')">
      <ChordDisplayModuleSettings :module-id="moduleId" />
    </SettingsDrawer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { PianoKeyboard } from "@/components/PianoKeyboard";
import { Notation } from "@/components/Notation/";
import { ChordNameLink } from "@/components/ChordNameLink/";
import { ChordIntervals } from "@/components/ChordIntervals/";
import { SettingsButton } from "@/components/SettingsButton/";
import { SettingsDrawer } from "@/components/SettingsDrawer/";

import { useNotes } from "@/composables/";
import { useSettingsStore } from "@/stores";
import { useSamplerStore } from "@/stores/sampler";
import { useSamplerService } from "@/composables/useSamplerService";
import {
  mergeDisplayConfig,
  mergeLayoutConfig,
  mergeStyleConfig,
} from "@/components/Notation/utils";
import { defaultChordDisplaySettings } from "@/types";
import ChordDisplayModuleSettings from "@/views/Settings/ChordDisplaySettings/ChordDisplayModuleSettings.vue";
import type { StaffClef } from "@/components/Notation/types";

const { t } = useI18n();
const settingsOpen = ref(false);

const samplerStore = useSamplerStore();
const samplerService = useSamplerService();

const props = defineProps<{
  moduleId: string;
}>();

const settingsStore = useSettingsStore();

const moduleSettings = computed(() => {
  return (
    settingsStore.settings.chordDisplay.find(
      (m) => m.id === props.moduleId,
    ) ?? { ...defaultChordDisplaySettings, id: props.moduleId }
  );
});

const staffClef = computed<StaffClef>(
  () => settingsStore.settings.notation.staffClef,
);
const staffTranspose = computed(
  () => settingsStore.settings.notation.staffTranspose,
);
const notationDisplay = computed(() =>
  mergeDisplayConfig(settingsStore.settings.notation.display),
);
const notationLayout = computed(() =>
  mergeLayoutConfig(settingsStore.settings.notation.layout),
);
const notationStyle = computed(() =>
  mergeStyleConfig(settingsStore.settings.notation.style),
);

const {
  midiNotes,
  pitchClasses,
  sustainedMidiNotes,
  playedMidiNotes,
  clickedMidiNotes,
  chords,
  keySignature,
  toggleNote,
  clearClickedNotes,
} = useNotes({
  accidentals: () => settingsStore.settings.notation.accidentals,
  key: () => settingsStore.settings.notation.key,
  midiChannel: 0,
  useSustain: moduleSettings.value?.useSustain ?? true,
  detectOnRelease: moduleSettings.value?.detectOnRelease ?? true,
  disabledChords: settingsStore.settings.chordDictionary.disabled,
  namespace: `chord-display/${props.moduleId}`,
});

function onNoteClick(midi: number) {
  // toggleNote 是持久切换：点击同音则关闭，否则加入
  const wasOn = clickedMidiNotes.value.includes(midi);
  toggleNote(midi);
  if (samplerStore.soundEnabled && samplerStore.isReady) {
    if (!wasOn) {
      samplerService.noteOn(midi, 100);
    } else {
      samplerService.noteOff(midi);
    }
  }
}

const combinedPlayedMidi = computed(() => [
  ...playedMidiNotes.value,
  ...clickedMidiNotes.value,
]);

watch(
  () => props.moduleId,
  () => clearClickedNotes(),
);

const chordNotation = computed(
  () => moduleSettings.value?.chordNotation ?? "preferred",
);
const highlightAlterations = computed(
  () => moduleSettings.value?.highlightAlterations ?? false,
);
const displayKeyboard = computed(
  () => moduleSettings.value?.displayKeyboard ?? true,
);
const displayChord = computed(() => moduleSettings.value?.displayChord ?? true);
const displayName = computed(() => moduleSettings.value?.displayName ?? false);
const displayNotation = computed(
  () => moduleSettings.value?.displayNotation ?? false,
);
const displayAltChords = computed(
  () => moduleSettings.value?.displayAltChords ?? true,
);
const displayIntervals = computed(
  () => moduleSettings.value?.displayIntervals ?? true,
);
const keyboard = computed(() => moduleSettings.value?.keyboard);

const soundEnabled = computed(() => samplerStore.soundEnabled);

function toggleSound() {
  samplerStore.soundEnabled = !samplerStore.soundEnabled;
}

/** 翻译和弦全名（如 "C major seventh" → "C 大七和弦"） */
const translatedChordName = computed(() => {
  const name = chords.value[0]?.name;
  if (!name) return "";
  // 和弦名格式: "C major seventh" 或 "C major seventh flat five"
  // 第一个空格前是根音，之后是和弦类型描述
  const spaceIdx = name.indexOf(" ");
  if (spaceIdx === -1) return name;
  const tonic = name.slice(0, spaceIdx);
  const quality = name.slice(spaceIdx + 1);
  // 将空格和连字符替换为下划线以匹配 locale 键名
  const qualityKey = quality.replace(/[\s-]/g, "_");
  const translated = t(`chordDisplay.chordQualities.${qualityKey}`);
  // 如果翻译返回的是原始字符串（语言包中无此条目），回退使用英文
  if (
    translated === qualityKey ||
    translated.startsWith("chordDisplay.chordQualities.")
  ) {
    return name;
  }
  return `${tonic} ${translated}`;
});
</script>
