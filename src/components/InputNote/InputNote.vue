<template>
  <div class="flex flex-row items-center gap-1">
    <input
      type="text"
      class="input input-bordered input-sm w-16 font-mono text-center"
      :value="modelValue"
      @input="handleChange(($event.target as HTMLInputElement).value)"
      @keydown="handleKeyPress"
      v-bind="$attrs"
    />
    <button
      v-if="learn"
      class="btn btn-sm"
      :class="learning ? 'btn-success' : 'btn-primary'"
      @click="learning = !learning"
    >
      {{ learning ? "..." : t("common.learn") }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { Note } from "tonal";
import { useMidiLearn } from "@/composables/useMidiLearn";
import { InternalMidiMessages } from "@/midi/MidiMessageManager";

export interface InputNoteProps {
  modelValue: string | null;
  withOctave?: boolean;
  learn?: boolean;
  namespace?: string;
}

const props = withDefaults(defineProps<InputNoteProps>(), {
  modelValue: null,
  withOctave: false,
  learn: false,
  namespace: "input-note",
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const { t } = useI18n();
const learning = ref(false);

const NOTES = "A B C D E F G".split(" ");
const ACCIDENTALS = "# b".split(" ");
const OCTAVES = "0 1 2 3 4 5 6 7 8 9".split(" ");

const handleKeyPress = (event: KeyboardEvent) => {
  const currentValue = props.modelValue?.toString() || "";
  const currentNote = Note.get(currentValue);

  if (currentNote.empty && NOTES.includes(event.key)) return;
  if (
    currentNote.letter &&
    (currentNote.oct === undefined || currentNote.oct === null) &&
    !currentNote.acc &&
    ACCIDENTALS.includes(event.key)
  )
    return;

  if (
    currentNote.letter &&
    (currentNote.oct === undefined || currentNote.oct === null) &&
    event.key === currentNote.acc[0]
  )
    return;

  if (
    props.withOctave &&
    currentNote.letter &&
    (currentNote.oct === undefined || currentNote.oct === null) &&
    OCTAVES.includes(event.key)
  )
    return;

  event.preventDefault();
};

const handleChange = (value: string) => {
  emit("update:modelValue", value);
};

const midiManager = props.learn
  ? new InternalMidiMessages(props.namespace)
  : null;

const handleLearn = (midi: number) => {
  const inputNote = Note.fromMidi(midi);
  const note = Note.get(inputNote);
  if (props.withOctave) {
    emit("update:modelValue", note.name);
  } else {
    emit("update:modelValue", note.pc);
  }
  learning.value = false;
};

const { startLearning, stopLearning } = useMidiLearn(midiManager, handleLearn);

onUnmounted(() => {
  if (midiManager) {
    midiManager.dispose();
  }
});

watch(learning, async (val) => {
  if (val) {
    await startLearning();
  } else {
    stopLearning();
  }
});
</script>
