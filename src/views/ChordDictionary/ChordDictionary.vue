<template>
  <ChordDictionaryModuleProvider
    :key-signature="keySignature"
    :midi-notes="midiNotesArray"
    :played-midi-notes="playedMidiNotesArray"
    :sustained-midi-notes="sustainedMidiNotesArray"
    :pitch-classes="pitchClassesArray"
    :disable-update="disableUpdate"
  >
    <ChordDictionaryToolbar :disable-update="disableUpdate" />

    <div class="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div class="flex flex-row flex-1 min-h-0 overflow-hidden">
        <div
          class="w-48 flex-shrink-0 overflow-y-auto border-r border-base-200"
        >
          <ChordDictionaryChromaMenu
            v-bind="chromaMenuProps"
            @select="handleChromaChange"
          />
        </div>

        <div
          class="w-56 flex-shrink-0 overflow-y-auto border-r border-base-200"
        >
          <ChordDictionaryChordMenu
            v-bind="chordMenuProps"
            @select="handleChordTypeChange"
          />
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto">
          <RouterView />
        </div>
      </div>
    </div>
  </ChordDictionaryModuleProvider>
</template>

<script setup lang="ts">
import { ref, computed, watch, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Chord, Note } from "tonal";

import { useSettingsStore } from "@/stores/settings";
import useNotes from "@/composables/useNotes";
import { NOTE_NAMES, getNoteInKeySignature } from "@/helpers";
import ChordDictionaryModuleProvider from "./ChordDictionaryModuleProvider.vue";
import ChordDictionaryToolbar from "./ChordDictionaryToolbar.vue";
import ChordDictionaryChromaMenu from "./ChordDictionaryChromaMenu.vue";
import ChordDictionaryChordMenu from "./ChordDictionaryChordMenu.vue";

interface Props {
  disableUpdate?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disableUpdate: false,
});

const settingsStore = useSettingsStore();
const router = useRouter();
const route = useRoute();

const {
  chords,
  midiNotes,
  playedMidiNotes,
  sustainedMidiNotes,
  pitchClasses,
  keySignature,
} = useNotes({
  key: () => settingsStore.settings.notation.key,
  accidentals: () => settingsStore.settings.notation.accidentals,
  midiChannel: 0,
  useSustain: true,
  detectOnRelease: false,
  disabledChords: settingsStore.settings.chordDictionary.disabled,
  namespace: "chord-dictionary",
});

const midiNotesArray = computed(() => midiNotes.value.slice());
const playedMidiNotesArray = computed(() => playedMidiNotes.value.slice());
const sustainedMidiNotesArray = computed(() =>
  sustainedMidiNotes.value.slice(),
);
const pitchClassesArray = computed(() => pitchClasses.value.slice());

const chroma = ref<number | null>(null);
const chordType = ref<string | null>(null);

const chromaMenuProps = computed(() => ({
  keySignature: keySignature.value,
  selected: chroma.value,
  filterChordsInKey: settingsStore.settings.chordDictionary.filterInKey,
}));

const chordMenuProps = computed(() => ({
  keySignature: keySignature.value,
  selected: chordType.value,
  chroma: chroma.value,
  groupBy: settingsStore.settings.chordDictionary.groupBy,
  disabledChords: settingsStore.settings.chordDictionary.disabled,
  hideDisabled: settingsStore.settings.chordDictionary.hideDisabled,
  filterChordsInKey: settingsStore.settings.chordDictionary.filterInKey,
}));

function navigateToChord(tonic: string | null, type: string | null) {
  if (!tonic || type === null) {
    router.push({ path: "/chord-dictionary" });
  } else {
    const name = encodeURIComponent(
      `${getNoteInKeySignature(tonic, keySignature.value.notes as string[])}${type}`,
    );
    router.push({ path: `/chord-dictionary/${name}` });
  }
}

function handleChromaChange(newChroma: number) {
  chroma.value = newChroma;
  if (settingsStore.settings.chordDictionary.filterInKey) {
    chordType.value = null;
    navigateToChord(NOTE_NAMES[newChroma], null);
  } else {
    navigateToChord(NOTE_NAMES[newChroma], chordType.value);
  }
}

function handleChordTypeChange(newChordType: string) {
  chordType.value = newChordType;
  navigateToChord(
    chroma.value !== null ? NOTE_NAMES[chroma.value] : null,
    newChordType,
  );
}

watchEffect(() => {
  if (settingsStore.settings.chordDictionary.interactive === "detect") {
    if (chords.value[0] && chords.value[0].tonic) {
      navigateToChord(chords.value[0].tonic, chords.value[0].aliases[0]);
    }
  }
});

const chordName = computed(() => route.params.chordName as string | undefined);

watch(chordName, (newName) => {
  const chord = newName ? Chord.get(newName) : null;

  if (chord && chord.tonic) {
    chroma.value = Note.chroma(chord.tonic) ?? null;
    chordType.value = chord.aliases[0];
  }
});
</script>
