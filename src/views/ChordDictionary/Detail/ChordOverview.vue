<template>
  <div
    class="flex flex-col items-center p-4 max-w-[var(--hig-container-max)] mx-auto"
  >
    <!-- Header -->
    <div class="text-center mb-6">
      <Icon
        name="music"
        class="size-12 mx-auto text-primary/60 mb-3"
        :size="48"
      />
      <h2 class="text-hig-xl font-semibold mb-1">
        {{ t("chordDictionary.emptyTitle") }}
      </h2>
      <p class="text-hig-sm text-base-content/70">
        {{ t("chordDictionary.emptyHelp") }}
      </p>
    </div>

    <!-- Recent chords -->
    <section v-if="recentChords.length" class="w-full mb-6">
      <h3
        class="text-hig-xs font-semibold text-base-content/70 uppercase tracking-wide mb-2 flex items-center gap-2"
      >
        <Icon name="clock" :size="14" />
        {{ t("chordDictionary.previousChords") }}
      </h3>
      <div
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2"
      >
        <button
          v-for="chord in recentChords"
          :key="chord.aliases[0]"
          class="btn btn-sm btn-outline justify-start gap-1 font-normal normal-case truncate"
          @click="goToChord(chord.tonic + chord.aliases[0])"
        >
          <ChordName :chord="chord" class="truncate" />
        </button>
      </div>
    </section>

    <!-- Common chords by category -->
    <MotionStaggerList class="w-full">
      <MotionListItem
        v-for="category in commonChordCategories"
        :key="category.label"
        class="w-full mb-5 block"
      >
        <h3
          class="text-hig-xs font-semibold text-base-content/70 uppercase tracking-wide mb-2"
        >
          {{ category.label }}
        </h3>
        <div
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2"
        >
          <button
            v-for="entry in category.chords"
            :key="entry.name"
            class="chord-card btn btn-sm bg-base-200/50 hover:bg-base-200 border border-base-300 justify-start gap-2 font-normal normal-case"
            @click="goToChord(entry.name)"
          >
            <span class="truncate font-medium text-hig-sm">{{
              entry.display
            }}</span>
            <span
              class="text-hig-2xs text-base-content/70 font-mono ml-auto whitespace-nowrap"
            >
              {{ entry.intervals }}
            </span>
          </button>
        </div>
      </MotionListItem>
    </MotionStaggerList>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { Chord } from "tonal";
import type { Chord as TChord } from "@tonaljs/chord";
import Icon from "@/components/Icon/Icon.vue";
import ChordName from "@/components/ChordName/ChordName.vue";
import { MotionStaggerList, MotionListItem } from "@/components/motion";

const { t } = useI18n();
const router = useRouter();

interface CommonChordEntry {
  name: string;
  display: string;
  intervals: string;
}

interface ChordCategory {
  label: string;
  chords: CommonChordEntry[];
}

// Common chord types to show in the overview
const COMMON_CHORDS: ChordCategory[] = [
  {
    label: "Major",
    chords: [
      { name: "C", display: "C", intervals: "1-3-5" },
      { name: "D", display: "D", intervals: "1-3-5" },
      { name: "E", display: "E", intervals: "1-3-5" },
      { name: "F", display: "F", intervals: "1-3-5" },
      { name: "G", display: "G", intervals: "1-3-5" },
      { name: "A", display: "A", intervals: "1-3-5" },
      { name: "B", display: "B", intervals: "1-3-5" },
    ],
  },
  {
    label: "Minor",
    chords: [
      { name: "Cm", display: "Cm", intervals: "1-♭3-5" },
      { name: "Dm", display: "Dm", intervals: "1-♭3-5" },
      { name: "Em", display: "Em", intervals: "1-♭3-5" },
      { name: "Fm", display: "Fm", intervals: "1-♭3-5" },
      { name: "Gm", display: "Gm", intervals: "1-♭3-5" },
      { name: "Am", display: "Am", intervals: "1-♭3-5" },
      { name: "Bm", display: "Bm", intervals: "1-♭3-5" },
    ],
  },
  {
    label: "Dominant 7th",
    chords: [
      { name: "C7", display: "C7", intervals: "1-3-5-♭7" },
      { name: "D7", display: "D7", intervals: "1-3-5-♭7" },
      { name: "E7", display: "E7", intervals: "1-3-5-♭7" },
      { name: "F7", display: "F7", intervals: "1-3-5-♭7" },
      { name: "G7", display: "G7", intervals: "1-3-5-♭7" },
      { name: "A7", display: "A7", intervals: "1-3-5-♭7" },
      { name: "B7", display: "B7", intervals: "1-3-5-♭7" },
    ],
  },
  {
    label: "Major 7th",
    chords: [
      { name: "Cmaj7", display: "Cmaj7", intervals: "1-3-5-7" },
      { name: "Dmaj7", display: "Dmaj7", intervals: "1-3-5-7" },
      { name: "Emaj7", display: "Emaj7", intervals: "1-3-5-7" },
      { name: "Fmaj7", display: "Fmaj7", intervals: "1-3-5-7" },
      { name: "Gmaj7", display: "Gmaj7", intervals: "1-3-5-7" },
      { name: "Amaj7", display: "Amaj7", intervals: "1-3-5-7" },
      { name: "Bmaj7", display: "Bmaj7", intervals: "1-3-5-7" },
    ],
  },
  {
    label: "Minor 7th",
    chords: [
      { name: "Cm7", display: "Cm7", intervals: "1-♭3-5-♭7" },
      { name: "Dm7", display: "Dm7", intervals: "1-♭3-5-♭7" },
      { name: "Em7", display: "Em7", intervals: "1-♭3-5-♭7" },
      { name: "Fm7", display: "Fm7", intervals: "1-♭3-5-♭7" },
      { name: "Gm7", display: "Gm7", intervals: "1-♭3-5-♭7" },
      { name: "Am7", display: "Am7", intervals: "1-♭3-5-♭7" },
      { name: "Bm7", display: "Bm7", intervals: "1-♭3-5-♭7" },
    ],
  },
  {
    label: "Diminished / Augmented / Suspended",
    chords: [
      { name: "Cdim", display: "Cdim", intervals: "1-♭3-♭5" },
      { name: "Caug", display: "Caug", intervals: "1-3-♯5" },
      { name: "Csus2", display: "Csus2", intervals: "1-2-5" },
      { name: "Csus4", display: "Csus4", intervals: "1-4-5" },
      { name: "Cdim7", display: "Cdim7", intervals: "1-♭3-♭5-♭♭7" },
      { name: "Cm7b5", display: "Cm7♭5", intervals: "1-♭3-♭5-♭7" },
      { name: "Caug7", display: "Caug7", intervals: "1-3-♯5-♭7" },
    ],
  },
];

const commonChordCategories = computed(() => COMMON_CHORDS);

// Recent chords from the search history stored in session
const recentChords = computed<TChord[]>(() => {
  try {
    const stored = sessionStorage.getItem("chord-dictionary-recent");
    if (stored) {
      const names: string[] = JSON.parse(stored);
      return names
        .map((name) => {
          try {
            return Chord.get(name);
          } catch {
            return null;
          }
        })
        .filter((c): c is TChord => c !== null && c.tonic !== null)
        .slice(0, 10);
    }
  } catch {
    // ignore
  }
  return [];
});

function goToChord(name: string) {
  // Store in recent history
  try {
    const stored = sessionStorage.getItem("chord-dictionary-recent");
    const recent: string[] = stored ? JSON.parse(stored) : [];
    const existing = recent.indexOf(name);
    if (existing >= 0) recent.splice(existing, 1);
    recent.unshift(name);
    sessionStorage.setItem(
      "chord-dictionary-recent",
      JSON.stringify(recent.slice(0, 20)),
    );
  } catch {
    // ignore
  }
  router.push({ path: `/chord-dictionary/${encodeURIComponent(name)}` });
}
</script>
