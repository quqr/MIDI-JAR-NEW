<template>
  <div id="chordDisplay" class="grid grid-rows-[5fr_3fr] h-full w-full gap-3">
    <div class="grid grid-cols-[1fr_2fr] bg-primary h-full w-full rounded-lg p-2 ">

      <div v-if="displayNotation" class="min-h-full w-full flex items-center justify-center">
        <Notation id="notation" class="items-center justify-center " :midiNotes="midiNotes as number[]"
          :keySignature="keySignature" :staffClef="staffClef" :staffTranspose="staffTranspose"
          :display="notationDisplay" />
      </div>

      <div class="grid grid-rows-[5fr_1fr_1fr_5fr] gap-3 min-h-full w-full items-center justify-items-center">

        <div v-if="displayChord" id="chord" class="min-h-[40px] w-full flex items-center justify-center">
          <ChordNameLink :chord="chords[0] as any" class="items-center justify-center" :notation="chordNotation"
            :highlightAlterations="highlightAlterations" />
        </div>
        <div v-if="displayName" id="name" class="min-h-[40px] w-full flex items-center justify-center">
          {{ chords[0]?.name }}
        </div>
        <div v-if="displayAltChords" class="min-h-[40px] w-full flex items-center justify-center">
          <template v-for="(chord, index) in chords" :key="index">
            <span v-if="index > 0" class="inline-flex  ">
              <ChordNameLink :chord="chord as any" class="items-center justify-center" :notation="chordNotation"
                :highlightAlterations="highlightAlterations" />
            </span>
          </template>
        </div>
        <div v-if="displayIntervals" id="intervals" class="min-h-[40px] w-full flex items-center justify-center">
          <ChordIntervals :intervals="chords[0]?.intervals as unknown as string[]"
            :pitchClasses="pitchClasses as unknown as string[]" :tonic="chords[0]?.tonic" />
        </div>
      </div>
    </div>
    <div v-if="displayKeyboard" w-full class="flex bg-secondary min-h-full min-w-full rounded-lg p-2">
      <PianoKeyboard id="keyboard" class="w-full h-full" :sustained="sustainedMidiNotes as unknown as number[]"
        :played="playedMidiNotes as unknown as number[]" :midi="midiNotes as unknown as number[]"
        :chord="chords[0] as any" :keySignature="keySignature as unknown as KeySignatureConfig" :keyboard="keyboard" />
    </div>

    <SettingsModal v-model="settingsOpen" :title="t('chordDisplay.settings')">
      <ChordDisplayModuleSettings :module-id="moduleId" />
    </SettingsModal>
  </div>
  <div class="absolute top-10 right-4 z-10">
    <SettingsButton :aria-label="t('chordDisplay.openSettings')" @click="settingsOpen = true" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { PianoKeyboard } from "@/components/PianoKeyboard/";
import { Notation } from "@/components/Notation/";
import { ChordNameLink } from "@/components/ChordNameLink/";
import { ChordIntervals } from "@/components/ChordIntervals/";
import { SettingsButton } from "@/components/SettingsButton/";
import { SettingsModal } from "@/components/SettingsModal/";
import { useNotes } from "@/composables/";
import { useSettingsStore } from "@/stores";
import ChordDisplayModuleSettings from "@/views/Settings/ChordDisplaySettings/ChordDisplayModuleSettings.vue";
import type { StaffClef } from "@/components/Notation/types";
import type { KeySignatureConfig } from "@/helpers";
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

const { t } = useI18n();
const settingsOpen = ref(false);

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
const notationDisplay = computed(
  () => settingsStore.settings.notation.display,
);

const {
  midiNotes,
  pitchClasses,
  sustainedMidiNotes,
  playedMidiNotes,
  chords,
  keySignature,
} = useNotes({
  accidentals: () => settingsStore.settings.notation.accidentals,
  key: () => settingsStore.settings.notation.key,
  midiChannel: 0,
  allowOmissions: moduleSettings.value?.allowOmissions ?? false,
  useSustain: moduleSettings.value?.useSustain ?? true,
  detectOnRelease: moduleSettings.value?.detectOnRelease ?? true,
  disabledChords: settingsStore.settings.chordDictionary.disabled,
  namespace: `chord-display/${props.moduleId}`,
});

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
