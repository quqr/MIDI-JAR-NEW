<script setup lang="ts">
import type {
  KeyboardSettings,
  FlatNoteDef,
} from "@/components/PianoKeyboard/types";
import type { FlatKeyboardSizes } from "./constants";
import Note from "./Note.vue";

interface Props {
  keyboard: KeyboardSettings;
  notes: FlatNoteDef[];
  sizes: FlatKeyboardSizes;
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
</script>

<template>
  <g
    class="board"
    :transform="`translate(0,${props.keyboard.label === 'none' ? 0 : props.sizes.LABEL_HEIGHT})`"
  >
    <Note
      v-for="noteDef in props.notes"
      :key="noteDef.midi"
      :sizes="props.sizes"
      :name="noteDef.name"
      :display-name="noteDef.displayName"
      :chroma="noteDef.chroma"
      :midi="noteDef.midi"
      :offset="noteDef.offset"
      :key-name="props.keyboard.keyName"
      :is-black="noteDef.isBlack"
      class="note"
      :clickable="props.clickable"
      :sustain-mode="props.sustainMode"
      @click="emit('click', $event)"
      @note-on="emit('noteOn', $event)"
      @note-off="emit('noteOff', $event)"
    />
  </g>
</template>
