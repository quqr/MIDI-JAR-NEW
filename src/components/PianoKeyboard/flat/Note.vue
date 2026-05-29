<script setup lang="ts">
import type { FlatKeyboardSizes } from "./constants";

interface Props {
  name: string;
  sizes: FlatKeyboardSizes;
  displayName: string;
  chroma: number;
  midi: number;
  offset: number;
  keyName: "none" | "octave" | "pitchClass" | "note";
  isBlack: boolean;
}

const props = defineProps<Props>();
</script>

<template>
  <g
    class="note"
    :class="[
      props.isBlack ? 'black' : 'white',
      `note-${props.name}`,
      `chroma-${props.chroma}`,
      `midi-${props.midi}`,
    ]"
    :transform="`translate(${props.offset},0)`"
  >
    <rect
      class="pianoKey"
      :width="props.sizes.WIDTH"
      :height="props.sizes.HEIGHT"
      x="0"
      y="0"
    />
    <circle
      class="pianoTonic"
      :cx="props.sizes.WIDTH / 2"
      :cy="props.sizes.HEIGHT - props.sizes.INFO_OFFSET"
      :r="props.sizes.TONIC_RADIUS"
    />
    <text
      class="pianoInfo"
      :x="props.sizes.WIDTH / 2"
      :y="props.sizes.HEIGHT - props.sizes.INFO_OFFSET"
      text-anchor="middle"
      dominant-baseline="mathematical"
    />
    <text
      v-if="props.keyName !== 'none'"
      class="pianoKeyName"
      :x="props.sizes.WIDTH / 2"
      :y="props.sizes.HEIGHT - props.sizes.NAME_OFFSET"
      text-anchor="middle"
      dominant-baseline="mathematical"
    >
      {{ props.displayName }}
    </text>
  </g>
</template>


