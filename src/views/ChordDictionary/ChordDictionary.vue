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

    <div class="flex flex-col lg:flex-row flex-1 overflow-hidden">
      <div class="lg:hidden">
        <div class="tabs tabs-boxed bg-base-200 p-2 mb-2 sticky top-0 z-10">
          <a
            role="tab"
            class="tab tab-sm flex-1"
            :class="{ 'tab-active': activeTab === 'chroma' }"
            @click="activeTab = 'chroma'"
            :aria-selected="activeTab === 'chroma'"
            :tabindex="activeTab === 'chroma' ? 0 : -1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-1">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.125 1.125 0 01-1.313-.684l-.194-.698a2.25 2.25 0 00-2.02-1.632H6.553a2.25 2.25 0 01-2.163-1.632l-.377-1.313a1.125 1.125 0 01.684-1.313l.698-.194a2.25 2.25 0 001.632-2.02V6.553a2.25 2.25 0 011.632-2.163l1.313-.377a1.125 1.125 0 011.313.684l.194.698a2.25 2.25 0 002.02 1.632h2.947a2.25 2.25 0 012.163 1.632l.377 1.313a1.125 1.125 0 01-.684 1.313l-.698.194z" />
            </svg>
            {{ $t("chordDictionary.chromaNavigation") }}
          </a>
          <a
            role="tab"
            class="tab tab-sm flex-1"
            :class="{ 'tab-active': activeTab === 'chords' }"
            @click="activeTab = 'chords'"
            :aria-selected="activeTab === 'chords'"
            :tabindex="activeTab === 'chords' ? 0 : -1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-1">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.125 1.125 0 01-1.313-.684l-.194-.698a2.25 2.25 0 00-2.02-1.632H6.553a2.25 2.25 0 01-2.163-1.632l-.377-1.313a1.125 1.125 0 01.684-1.313l.698-.194a2.25 2.25 0 001.632-2.02V6.553a2.25 2.25 0 011.632-2.163l1.313-.377a1.125 1.125 0 011.313.684l.194.698a2.25 2.25 0 002.02 1.632h2.947a2.25 2.25 0 012.163 1.632l.377 1.313a1.125 1.125 0 01-.684 1.313l-.698.194z" />
            </svg>
            {{ $t("chordDictionary.chordTypesNavigation") }}
          </a>
          <a
            role="tab"
            class="tab tab-sm flex-1"
            :class="{ 'tab-active': activeTab === 'detail' }"
            @click="activeTab = 'detail'"
            :aria-selected="activeTab === 'detail'"
            :tabindex="activeTab === 'detail' ? 0 : -1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-1">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            {{ $t("chordDictionary.matches") }}
          </a>
        </div>
      </div>

      <div
        class="hidden lg:block w-52 flex-shrink-0 border-r border-base-200 bg-base-200/50"
      >
        <ChordDictionaryChromaMenu
          :key-signature="keySignature"
          :selected="chroma"
          :filter-chords-in-key="
            settingsStore.settings.chordDictionary.filterInKey
          "
          @select="handleChromaChange"
        />
      </div>

      <div
        class="hidden lg:block w-72 flex-shrink-0 border-r border-base-200 bg-base-200/50"
      >
        <ChordDictionaryChordMenu
          :key-signature="keySignature"
          :selected="chordType"
          :chroma="chroma"
          :group-by="settingsStore.settings.chordDictionary.groupBy"
          :disabled-chords="settingsStore.settings.chordDictionary.disabled"
          :hide-disabled="settingsStore.settings.chordDictionary.hideDisabled"
          :filter-chords-in-key="
            settingsStore.settings.chordDictionary.filterInKey
          "
          @select="handleChordTypeChange"
        />
      </div>

      <div class="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
        <div
          v-show="activeTab === 'chroma'"
          class="lg:hidden w-full max-h-96 overflow-y-auto border-b border-base-200 bg-base-200/50"
        >
          <ChordDictionaryChromaMenu
            :key-signature="keySignature"
            :selected="chroma"
            :filter-chords-in-key="
              settingsStore.settings.chordDictionary.filterInKey
            "
            @select="handleChromaChange"
          />
        </div>
        <div
          v-show="activeTab === 'chords'"
          class="lg:hidden w-full max-h-96 overflow-y-auto border-b border-base-200 bg-base-200/50"
        >
          <ChordDictionaryChordMenu
            :key-signature="keySignature"
            :selected="chordType"
            :chroma="chroma"
            :group-by="settingsStore.settings.chordDictionary.groupBy"
            :disabled-chords="settingsStore.settings.chordDictionary.disabled"
            :hide-disabled="settingsStore.settings.chordDictionary.hideDisabled"
            :filter-chords-in-key="
              settingsStore.settings.chordDictionary.filterInKey
            "
            @select="handleChordTypeChange"
          />
        </div>
        <RouterView />
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

const { key, accidentals } = settingsStore.settings.notation;

const {
  chords,
  midiNotes,
  playedMidiNotes,
  sustainedMidiNotes,
  pitchClasses,
  keySignature,
} = useNotes({
  key,
  accidentals,
  midiChannel: 0,
  useSustain: true,
  detectOnRelease: false,
  disabledChords: settingsStore.settings.chordDictionary.disabled,
});

const midiNotesArray = computed(() => midiNotes.value.slice());
const playedMidiNotesArray = computed(() => playedMidiNotes.value.slice());
const sustainedMidiNotesArray = computed(() =>
  sustainedMidiNotes.value.slice(),
);
const pitchClassesArray = computed(() => pitchClasses.value.slice());

const chroma = ref<number | null>(null);
const chordType = ref<string | null>(null);
const activeTab = ref<"chroma" | "chords" | "detail">("detail");

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
