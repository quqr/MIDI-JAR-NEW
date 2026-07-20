<template>
  <section v-if="chord" class="w-full p-3 bg-base-200 rounded-lg mb-4">
    <h3
      class="text-sm font-semibold text-base-content/60 uppercase tracking-wide mb-2 px-1"
    >
      {{ t("chordDictionary.intervals") }}
    </h3>
    <ChordIntervals
      class="text-2xl"
      :intervals="playedIntervals"
      :targets="chord.intervals"
      :pitch-classes="pitchClasses"
      :tonic="chord.tonic"
    />
  </section>
</template>

<script setup lang="ts">
import ChordIntervals from "@/components/ChordIntervals/ChordIntervals.vue";
import { useChordDetailContext } from "../composables/useChordDetail";

const { t, chord, playedIntervals, pitchClasses } = useChordDetailContext();
</script>
