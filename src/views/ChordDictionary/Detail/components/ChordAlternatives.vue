<template>
  <div v-if="alternativeChords.length" class="w-full mb-4">
    <details class="collapse collapse-arrow bg-base-200 rounded-lg">
      <summary
        class="collapse-title text-sm font-semibold text-base-content/70 uppercase tracking-wide min-h-0 py-2"
      >
        {{ t("chordDictionary.otherInterpretations") }}
      </summary>
      <div class="collapse-content pt-0 px-2">
        <ul class="w-full">
          <li
            v-for="altChord in alternativeChords"
            :key="altChord.symbol"
            class="px-3 py-1.5 hover:bg-base-300 rounded-lg cursor-pointer text-sm"
            @click="goToChordDetail(altChord.tonic + altChord.aliases[0])"
          >
            <ChordName :chord="altChord" />
          </li>
        </ul>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import ChordName from "@/components/ChordName/ChordName.vue";
import { useChordDetailContext } from "../composables/useChordDetail";

const { t, alternativeChords, goToChordDetail } = useChordDetailContext();
</script>
