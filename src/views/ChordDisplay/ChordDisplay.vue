<template>
  <div id="chordDisplay" class="relative h-full w-full flex flex-col gap-3">
    <div class="flex-1 rounded-lg p-3 relative">
      <div class="flex flex-col md:flex-row h-full w-full gap-3">
        <div
          v-if="displayNotation"
          class="flex-1 min-w-0 flex items-center justify-center group relative"
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

        <div
          class="flex-1 flex flex-col gap-6 md:gap-20 items-center justify-center"
        >
          <div
            v-if="displayChord"
            id="chord"
            class="w-full flex items-center justify-center text-hig-3xl md:text-hig-4xl font-bold group relative"
          >
            <ChordNameLink
              :chord="chords[0]"
              class="items-center justify-center"
              :notation="chordNotation"
              :highlightAlterations="highlightAlterations"
            />
          </div>
          <div
            v-if="displayName"
            id="name"
            class="w-full text-center text-xl font-semibold"
          >
            {{ chords[0]?.name }}
          </div>
          <div
            v-if="displayIntervals"
            id="intervals"
            class="w-full flex items-center justify-center group relative"
          >
            <ChordIntervals
              :intervals="chords[0]?.intervals ?? []"
              :pitchClasses="pitchClasses"
              :tonic="chords[0]?.tonic"
            />
          </div>
        </div>
      </div>

      <div class="absolute top-2 right-2 z-10 flex flex-col gap-2 items-end">
        <SettingsButton
          :aria-label="t('chordDisplay.openSettings')"
          @click="settingsOpen = true"
        />
        <!-- 声音开关 -->
        <label
          v-if="displayKeyboard"
          class="flex items-center gap-1.5 cursor-pointer tooltip tooltip-left"
          :data-tip="
            samplerStore.soundEnabled
              ? t('sampler.soundOn')
              : t('sampler.soundOff')
          "
        >
          <input
            type="checkbox"
            class="toggle toggle-primary toggle-sm"
            :checked="samplerStore.soundEnabled"
            @change="samplerStore.soundEnabled = !samplerStore.soundEnabled"
          />
          <Icon name="speaker" :size="14" aria-hidden="true" />
        </label>
        <div
          v-if="displayAltChords"
          class="flex flex-col gap-2 items-end rounded-lg p-2 backdrop-blur-sm"
        >
          <template v-for="(chord, index) in chords" :key="index">
            <span v-if="index > 0" class="inline-flex">
              <ChordNameLink
                :chord="chord"
                class="items-center justify-center text-lg"
                :notation="chordNotation"
                :highlightAlterations="highlightAlterations"
              />
            </span>
          </template>
        </div>
      </div>
    </div>

    <div
      v-if="displayKeyboard"
      class="flex-shrink-0 rounded-lg p-2 group relative min-h-[150px] md:min-h-[200px]"
    >
      <CanvasPianoKeyboard
        id="keyboard"
        class="w-full h-full"
        :sustained="sustainedMidiNotes"
        :played="combinedPlayedMidi"
        :midi="midiNotes"
        :chord="chords[0] ?? undefined"
        :keyboard="keyboard"
        :clickable="true"
        :sustain-mode="true"
        @note-click="onNoteClick"
        @note-on="onNoteOn"
        @note-off="onNoteOff"
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
import { CanvasPianoKeyboard } from "@/components/CanvasPianoKeyboard";
import { Notation } from "@/components/Notation/";
import { ChordNameLink } from "@/components/ChordNameLink/";
import { ChordIntervals } from "@/components/ChordIntervals/";
import { SettingsButton } from "@/components/SettingsButton/";
import { SettingsDrawer } from "@/components/SettingsDrawer/";
import { Icon } from "@/components/Icon/";
import { useNotes } from "@/composables/";
import { useSettingsStore } from "@/stores";
import { useSamplerStore } from "@/stores/sampler";
import { useSamplerService } from "@/composables/useSamplerService";
import {
  mergeDisplayConfig,
  mergeLayoutConfig,
  mergeStyleConfig,
} from "@/components/Notation/utils";
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
  return settingsStore.settings.chordDisplay.find(
    (m) => m.id === props.moduleId,
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
  toggleNote(midi);
}

function onNoteOn(midi: number) {
  toggleNote(midi);
  if (samplerStore.soundEnabled && samplerStore.isReady) {
    samplerService.noteOn(midi, 100);
  }
}

function onNoteOff(midi: number) {
  if (samplerStore.soundEnabled && samplerStore.isReady) {
    samplerService.noteOff(midi);
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
  () => moduleSettings.value?.displayIntervals ?? false,
);
const keyboard = computed(() => moduleSettings.value?.keyboard);
</script>
