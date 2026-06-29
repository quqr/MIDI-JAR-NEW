<script setup lang="ts">
import type {
  KeyboardSettings,
  ClassicKeyboardKeys,
} from "@/components/PianoKeyboard/types";
import type { ClassicKeyboardSizes } from "./constants";
import WhiteNote from "./WhiteNote.vue";
import BlackNote from "./BlackNote.vue";

interface Props {
  keys: ClassicKeyboardKeys;
  sizes: ClassicKeyboardSizes;
  keyboard: KeyboardSettings;
  clickable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  clickable: false,
});
const emit = defineEmits<{ click: [midi: number] }>();
</script>

<template>
  <g
    class="board"
    :transform="`translate(0,${props.keyboard.label === 'none' ? 0 : props.sizes.LABEL_HEIGHT})`"
    mask="url(#boardMask)"
  >
    <WhiteNote
      v-for="noteDef in props.keys.whites"
      :key="noteDef.midi"
      :name="noteDef.name"
      :display-name="noteDef.displayName"
      :chroma="noteDef.chroma"
      :midi="noteDef.midi"
      :offset="noteDef.offset"
      :key-name="props.keyboard.keyName"
      :sizes="props.sizes"
      :clickable="props.clickable"
      @click="emit('click', $event)"
    />
    <BlackNote
      v-for="noteDef in props.keys.blacks"
      :key="noteDef.midi"
      :name="noteDef.name"
      :display-name="noteDef.displayName"
      :chroma="noteDef.chroma"
      :midi="noteDef.midi"
      :offset="noteDef.offset"
      :key-name="props.keyboard.keyName"
      :sizes="props.sizes"
      :clickable="props.clickable"
      @click="emit('click', $event)"
    />
  </g>
</template>
