<script setup lang="ts">
import type { ClassicKeyboardSizes } from "./constants";

interface Props {
  name: string;
  displayName: string;
  chroma: number;
  midi: number;
  offset: number;
  keyName: "none" | "octave" | "pitchClass" | "note";
  sizes: ClassicKeyboardSizes;
}

const props = defineProps<Props>();
</script>

<template>
  <g
    class="note black"
    :class="`note-${props.name} chroma-${props.chroma} midi-${props.midi}`"
    :transform="`translate(${props.offset},0)`"
  >
    <rect
      class="pianoKeyBackground"
      :width="props.sizes.BLACK_WIDTH"
      :height="props.sizes.BLACK_HEIGHT + props.sizes.RADIUS"
      x="0"
      :y="-props.sizes.RADIUS"
      :rx="props.sizes.RADIUS"
      :ry="props.sizes.RADIUS"
    />
    <rect
      class="pianoKey"
      :width="props.sizes.BLACK_WIDTH"
      :height="props.sizes.BLACK_HEIGHT + props.sizes.RADIUS"
      x="0"
      :y="-props.sizes.RADIUS"
      :rx="props.sizes.RADIUS"
      :ry="props.sizes.RADIUS"
    />
    <circle
      class="pianoTonic"
      :cx="props.sizes.BLACK_WIDTH / 2"
      :cy="props.sizes.BLACK_HEIGHT - props.sizes.BLACK_INFO_OFFSET"
      :r="props.sizes.TONIC_RADIUS"
    />
    <text
      class="pianoInfo"
      :x="props.sizes.BLACK_WIDTH / 2"
      :y="props.sizes.BLACK_HEIGHT - props.sizes.BLACK_INFO_OFFSET"
      text-anchor="middle"
      dominant-baseline="mathematical"
    />
    <text
      v-if="props.keyName !== 'none'"
      class="pianoKeyName"
      :x="props.sizes.BLACK_WIDTH / 2"
      :y="props.sizes.BLACK_HEIGHT - props.sizes.BLACK_NAME_OFFSET"
      text-anchor="middle"
      dominant-baseline="baseline"
    >
      {{ props.displayName }}
    </text>
  </g>
</template>


