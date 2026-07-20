<template>
  <div ref="detailRef" class="flex flex-col items-center p-4">
    <EmptyChordDetail
      v-if="!chordName || !chord"
      :chord-name="chordName ?? undefined"
    />

    <template v-else>
      <!-- Core: Chord name + toggle -->
      <h1
        class="flex justify-center items-center border-b border-base-200 mb-1 py-2 w-full flex-wrap gap-3"
      >
        <ChordName
          :chord="chord"
          :class="[
            'text-[min(64px,6vw)] flex-grow-0 flex-shrink-0 justify-center font-bold leading-tight',
            { 'opacity-50': isDisabled },
          ]"
        />
        <label
          v-if="!disableUpdate"
          class="flex items-center gap-2 cursor-pointer text-sm"
        >
          <input
            type="checkbox"
            class="toggle toggle-primary toggle-sm"
            :checked="!isDisabled"
            @change="toggleDisabled(!isDisabled)"
          />
          {{ t("chordDictionary.disableEnableChord") }}
        </label>
      </h1>

      <div
        class="text-center text-[min(24px,4vw)] font-normal leading-tight text-base-content/60 mb-3"
      >
        {{ chord.name }}
      </div>

      <!-- Core: Piano keyboard -->
      <PianoKeyboard
        class="w-full my-4 p-3 sm:p-4 bg-base-200 rounded-lg"
        :targets="midi"
        :played="playedMidiNotes"
        :sustained="sustainedMidiNotes"
        :midi="midiNotes"
        :chord="chord"
        :keyboard="keyboardSettings"
      />

      <!-- Core: Intervals -->
      <ChordIntervalsTable />

      <!-- Core: Notation -->
      <ChordNotesDisplay />

      <!-- Secondary: Aliases -->
      <ChordAliases />

      <!-- Tertiary: Other interpretations -->
      <ChordAlternatives />

      <!-- Tertiary: Inversions -->
      <ChordInversions />

      <!-- Exploratory: Simplified & Extended -->
      <ChordRelated />
    </template>
  </div>
</template>

<script setup lang="ts">
import ChordName from "@/components/ChordName/ChordName.vue";
import PianoKeyboard from "@/components/PianoKeyboard/PianoKeyboard.vue";
import EmptyChordDetail from "./EmptyChordDetail.vue";
import ChordIntervalsTable from "./components/ChordIntervalsTable.vue";
import ChordNotesDisplay from "./components/ChordNotesDisplay.vue";
import ChordAliases from "./components/ChordAliases.vue";
import ChordAlternatives from "./components/ChordAlternatives.vue";
import ChordInversions from "./components/ChordInversions.vue";
import ChordRelated from "./components/ChordRelated.vue";
import { useChordDetail } from "./composables/useChordDetail";

const {
  detailRef,
  chordName,
  chord,
  isDisabled,
  disableUpdate,
  t,
  midi,
  midiNotes,
  playedMidiNotes,
  sustainedMidiNotes,
  keyboardSettings,
  toggleDisabled,
} = useChordDetail();

defineExpose({ detailRef });
</script>
