<script setup lang="ts">
import type { FlatKeyboardKeys } from "@/components/PianoKeyboard/types";
import type { FlatKeyboardSizes } from "./constants";

interface Props {
  keys: FlatKeyboardKeys;
  sizes: FlatKeyboardSizes;
}

const props = defineProps<Props>();
</script>

<template>
  <g class="labels" transform="translate(0,0)">
    <text
      v-for="noteDef in props.keys.notes"
      :key="noteDef.midi"
      class="pianoLabel label-${noteDef.midi}"
      :x="noteDef.labelOffset"
      :y="props.sizes.LABEL_HEIGHT - props.sizes.LABEL_OFFSET"
      text-anchor="middle"
    />
  </g>
</template>

<style>
@import "./flat.css";
</style>
