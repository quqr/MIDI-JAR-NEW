<template>
  <div
    class="chord-dictionary-module-provider flex flex-col flex-1 min-h-0 overflow-hidden"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { provide, reactive, watch } from "vue";
import type { KeySignatureConfig } from "@/helpers";

interface ChordDictionaryModuleContext {
  keySignature: KeySignatureConfig;
  midiNotes: number[];
  playedMidiNotes: number[];
  sustainedMidiNotes: number[];
  pitchClasses: string[];
  disableUpdate: boolean;
}

interface Props {
  keySignature?: KeySignatureConfig;
  midiNotes?: number[];
  playedMidiNotes?: number[];
  sustainedMidiNotes?: number[];
  pitchClasses?: string[];
  disableUpdate?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  midiNotes: () => [],
  playedMidiNotes: () => [],
  sustainedMidiNotes: () => [],
  pitchClasses: () => [],
  disableUpdate: false,
});

const contextValue: ChordDictionaryModuleContext = reactive({
  keySignature: props.keySignature!,
  midiNotes: props.midiNotes,
  playedMidiNotes: props.playedMidiNotes,
  sustainedMidiNotes: props.sustainedMidiNotes,
  pitchClasses: props.pitchClasses,
  disableUpdate: props.disableUpdate,
}) as ChordDictionaryModuleContext;

watch(
  () => props.keySignature,
  (v) => {
    if (v) contextValue.keySignature = v;
  },
  { deep: true },
);
watch(
  () => props.midiNotes,
  (v) => {
    contextValue.midiNotes = v;
  },
);
watch(
  () => props.playedMidiNotes,
  (v) => {
    contextValue.playedMidiNotes = v;
  },
);
watch(
  () => props.sustainedMidiNotes,
  (v) => {
    contextValue.sustainedMidiNotes = v;
  },
);
watch(
  () => props.pitchClasses,
  (v) => {
    contextValue.pitchClasses = v;
  },
);
watch(
  () => props.disableUpdate,
  (v) => {
    contextValue.disableUpdate = v;
  },
);

provide("chordDictionaryModule", contextValue);
</script>
