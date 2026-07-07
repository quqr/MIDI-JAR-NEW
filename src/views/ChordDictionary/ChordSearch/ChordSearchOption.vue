<template>
  <li
    class="px-3 py-1.5 rounded-lg cursor-pointer text-sm transition-colors hover:bg-base-300 flex items-center justify-between"
    :class="{ 'bg-primary/10 text-primary font-semibold': selected }"
    @click="$emit('select', chord.tonic + chord.aliases[0])"
  >
    <div class="flex items-center gap-2">
      <ChordName :chord="chord" />
      <span
        v-if="score && score > 0.2"
        class="badge badge-xs badge-ghost text-base-content/50"
      >
        {{ t("chordDictionary.fuzzy") }}
      </span>
    </div>
    <div v-if="parts" class="flex flex-col items-end ml-2">
      <span class="bg-success text-success-content px-1 rounded text-xs">{{
        parts[0]
      }}</span>
      <span class="italic text-xs text-base-content/70">{{ parts[1] }}</span>
    </div>
  </li>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { Chord } from "@tonaljs/chord";
import ChordName from "@/components/ChordName/ChordName.vue";

interface Props {
  chord: Chord;
  parts?: [string, string];
  selected?: boolean;
  score?: number;
}

defineProps<Props>();

defineEmits<{
  (e: "select", value: string): void;
}>();

const { t } = useI18n();
</script>
