<script setup lang="ts">
import type { ClassicKeyboardKeys } from "@/components/PianoKeyboard/types";
import type { ClassicKeyboardSizes } from "./constants";

interface Props {
  keys: ClassicKeyboardKeys;
  sizes: ClassicKeyboardSizes;
}

const props = defineProps<Props>();
</script>

<template>
  <g class="labels" transform="translate(0,0)">
    <text
      v-for="noteDef in props.keys.labels"
      :key="noteDef.midi"
      class="pianoLabel label-${noteDef.midi}"
      :x="noteDef.labelOffset"
      :y="props.sizes.LABEL_HEIGHT - props.sizes.LABEL_OFFSET"
      text-anchor="middle"
    />
  </g>
</template>


