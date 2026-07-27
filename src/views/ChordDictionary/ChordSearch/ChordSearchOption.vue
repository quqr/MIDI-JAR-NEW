<template>
  <li
    class="px-3 py-1.5 rounded-hig-md cursor-pointer text-hig-sm transition-colors hover:bg-base-300 flex items-center"
    :class="{ 'bg-base-300': active }"
    :data-active="active ? '' : undefined"
    @click="$emit('select', chord.tonic + chord.aliases[0])"
  >
    <ChordName :chord="chord" />
  </li>
</template>

<script setup lang="ts">
import type { Chord } from "@tonaljs/chord";
import ChordName from "@/components/ChordName/ChordName.vue";

interface Props {
  chord: Chord;
  active?: boolean;
}

defineProps<Props>();

defineEmits<{
  (e: "select", value: string): void;
}>();
</script>
