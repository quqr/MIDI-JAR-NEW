<template>
  <RouterLink
    v-if="chord"
    :to="to"
    class="chord-name-link link text-inherit no-underline hover:opacity-85 hover:underline"
  >
    <ChordName
      :chord="chord"
      :notation="notation"
      :hideRoot="hideRoot"
      :highlightAlterations="highlightAlterations"
      :latinSharpsFlats="latinSharpsFlats"
      :size="size"
    />
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { ChordName } from "@/components/ChordName/";
import type { Chord } from "@tonaljs/chord";
import type { ChordNameProps } from "@/components/ChordName/ChordName.vue";

export interface ChordNameLinkProps extends Partial<ChordNameProps> {
  chord: Chord | null;
  dictionaryUrl?: string;
  size?: 'xl' | '6xl';
}

const props = withDefaults(defineProps<ChordNameLinkProps>(), {
  dictionaryUrl: "/chord-dictionary/",
  chord: null,
  notation: "preferred",
  hideRoot: false,
  highlightAlterations: false,
  latinSharpsFlats: undefined,
  size: 'xl',
});

const to = computed(() => {
  if (!props.chord) return "";
  return `${props.dictionaryUrl}${encodeURIComponent(props.chord.tonic + props.chord.aliases[0])}`;
});
</script>
