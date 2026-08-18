<template>
  <div v-if="subsetChords.length || supersetChords.length" class="w-full mb-4">
    <details class="collapse collapse-arrow bg-base-200 rounded-xl" open>
      <summary
        class="collapse-title text-xs font-semibold text-base-content/70 uppercase tracking-wide min-h-0 py-2"
      >
        {{ t("chordDictionary.simplified") }} /
        {{ t("chordDictionary.extended") }}
      </summary>
      <div class="collapse-content pt-0 px-2 space-y-3">
        <div v-if="subsetChords.length">
          <h4
            class="text-xs font-medium text-base-content/70 uppercase tracking-wide mb-1.5"
          >
            {{ t("chordDictionary.simplified") }}
          </h4>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="(c, index) in subsetChords"
              :key="index"
              class="btn btn-sm btn-primary rounded-full"
              @click="goToChordDetail(c.tonic + c.aliases[0])"
            >
              <ChordName :chord="c" />
            </button>
          </div>
        </div>
        <div v-if="supersetChords.length">
          <h4
            class="text-xs font-medium text-base-content/70 uppercase tracking-wide mb-1.5"
          >
            {{ t("chordDictionary.extended") }}
          </h4>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="(c, index) in supersetChords"
              :key="index"
              class="btn btn-sm btn-primary rounded-full"
              @click="goToChordDetail(c.tonic + c.aliases[0])"
            >
              <ChordName :chord="c" />
            </button>
          </div>
        </div>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import ChordName from "@/components/ChordName/ChordName.vue";
import { useChordDetailContext } from "../composables/useChordDetail";

const { t, subsetChords, supersetChords, goToChordDetail } =
  useChordDetailContext();
</script>
