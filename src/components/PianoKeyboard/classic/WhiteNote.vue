<script setup lang="ts">
import { ref } from "vue";
import type { ClassicKeyboardSizes } from "./constants";

interface Props {
  name: string;
  displayName: string;
  chroma: number;
  midi: number;
  offset: number;
  keyName: "none" | "octave" | "pitchClass" | "note";
  sizes: ClassicKeyboardSizes;
  clickable?: boolean;
  sustainMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  clickable: false,
  sustainMode: false,
});
const emit = defineEmits<{
  click: [midi: number];
  noteOn: [midi: number];
  noteOff: [midi: number];
}>();

const pressed = ref(false);

function onPointerDown(e: MouseEvent | TouchEvent) {
  e.preventDefault();
  if (props.sustainMode) {
    pressed.value = true;
    emit("noteOn", props.midi);
  } else {
    emit("click", props.midi);
  }
}

function onPointerUp() {
  if (props.sustainMode && pressed.value) {
    pressed.value = false;
    emit("noteOff", props.midi);
  }
}

function onPointerLeave() {
  if (props.sustainMode && pressed.value) {
    pressed.value = false;
    emit("noteOff", props.midi);
  }
}
</script>

<template>
  <g
    class="note white"
    :class="[
      `note-${props.name} chroma-${props.chroma} midi-${props.midi}`,
      { 'cursor-pointer': props.clickable },
    ]"
    :transform="`translate(${props.offset},0)`"
  >
    <rect
      class="pianoKeyBackground"
      :width="props.sizes.WHITE_WIDTH"
      :height="props.sizes.WHITE_HEIGHT + props.sizes.RADIUS"
      x="0"
      :y="-props.sizes.RADIUS"
      :rx="props.sizes.RADIUS"
      :ry="props.sizes.RADIUS"
    />
    <rect
      class="pianoKey"
      :width="props.sizes.WHITE_WIDTH"
      :height="props.sizes.WHITE_HEIGHT + props.sizes.RADIUS"
      x="0"
      :y="-props.sizes.RADIUS"
      :rx="props.sizes.RADIUS"
      :ry="props.sizes.RADIUS"
      @mousedown="onPointerDown"
      @mouseup="onPointerUp"
      @mouseleave="onPointerLeave"
      @touchstart="onPointerDown"
      @touchend="onPointerUp"
      @click="!props.sustainMode && emit('click', props.midi)"
    />
    <circle
      class="pianoTonic"
      :cx="props.sizes.WHITE_WIDTH / 2"
      :cy="props.sizes.WHITE_HEIGHT - props.sizes.WHITE_INFO_OFFSET"
      :r="props.sizes.TONIC_RADIUS"
      style="pointer-events: none"
    />
    <text
      class="pianoInfo"
      :x="props.sizes.WHITE_WIDTH / 2"
      :y="props.sizes.WHITE_HEIGHT - props.sizes.WHITE_INFO_OFFSET"
      text-anchor="middle"
      dominant-baseline="mathematical"
      style="pointer-events: none"
    />
    <text
      v-if="props.keyName !== 'none'"
      class="pianoKeyName"
      :x="props.sizes.WHITE_WIDTH / 2"
      :y="props.sizes.WHITE_HEIGHT - props.sizes.WHITE_NAME_OFFSET"
      text-anchor="middle"
      dominant-baseline="baseline"
      style="pointer-events: none"
    >
      {{ props.displayName }}
    </text>
  </g>
</template>
