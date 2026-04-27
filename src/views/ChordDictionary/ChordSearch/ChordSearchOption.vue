<template>
  <li
    class="px-3 py-1.5 rounded-md cursor-pointer text-sm transition-colors hover:bg-base-200 flex items-center justify-between"
    :class="{ 'bg-primary/10 text-primary font-semibold': selected }"
    @click="$emit('select', chord.tonic + chord.aliases[0])"
  >
    <ChordName :chord="chord" />
    <div v-if="parts" class="flex flex-col items-start">
      <span class="bg-success text-success-content px-1 rounded-l text-xs">{{
        parts[0]
      }}</span>
      <span class="italic text-xs text-base-content/70">{{ parts[1] }}</span>
    </div>
  </li>
</template>

<script setup lang="ts">
import type { Chord } from "@tonaljs/chord";
import ChordName from "@/components/ChordName/ChordName.vue";

interface Props {
  chord: Chord;
  parts?: [string, string];
  selected?: boolean;
}

defineProps<Props>();

defineEmits<{
  (e: "select", value: string): void;
}>();
</script>
