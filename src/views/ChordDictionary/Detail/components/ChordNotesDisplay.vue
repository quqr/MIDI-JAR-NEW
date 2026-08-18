<template>
  <section
    class="w-full min-w-0 p-3 bg-base-200 rounded-xl mb-4 overflow-visible"
  >
    <h3
      class="text-xs font-semibold text-base-content/70 uppercase tracking-wide mb-2 px-1"
    >
      {{ t("chordDictionary.notation") }}
    </h3>
    <Notation
      class="mx-auto"
      :midi-notes="midi"
      :key-signature="keySignature"
      :staff-clef="staffClef"
      :staff-transpose="staffTranspose"
      :display="notationDisplay"
    />
  </section>
</template>

<script setup lang="ts">
import Notation from "@/components/Notation/Notation.vue";
import { useChordDetailContext } from "../composables/useChordDetail";

const { t, midi, keySignature, staffClef, staffTranspose, notationDisplay } =
  useChordDetailContext();
</script>
