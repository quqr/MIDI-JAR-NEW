<template>
  <div class="chord-dictionary-chroma-menu p-4 h-full">
    <ul
      class="menu bg-base-100"
      role="tablist"
      :aria-label="t('chordDictionary.chromaNavigation')"
    >
      <li v-for="note in notesList" :key="note">
        <a
          class="rounded-lg"
          role="tab"
          :aria-selected="selected === getChroma(note)"
          :class="{
            'bg-primary text-primary-content': selected === getChroma(note),
          }"
          @click="handleSelect(note)"
        >
          {{ formatNote(note) }}
        </a>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Note } from "tonal";
import { useI18n } from "vue-i18n";
import type { KeySignatureConfig } from "@/helpers";
import {
  NOTE_NAMES,
  formatSharpsFlats,
  getNoteInKeySignature,
} from "@/helpers";

interface Props {
  keySignature: KeySignatureConfig;
  selected: number | null;
  filterChordsInKey: boolean;
}

interface Emits {
  (e: "select", chroma: number): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();

const notesList = computed(() => {
  return props.filterChordsInKey ? props.keySignature.scale : NOTE_NAMES;
});

function getChroma(note: string): number {
  return Note.chroma(note) as number;
}

function formatNote(note: string): string {
  return formatSharpsFlats(
    getNoteInKeySignature(note, props.keySignature.notes),
  );
}

function handleSelect(note: string) {
  const chroma = getChroma(note);
  emit("select", chroma);
}
</script>
