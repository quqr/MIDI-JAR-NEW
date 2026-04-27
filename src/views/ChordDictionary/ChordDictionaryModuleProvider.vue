<template>
  <div class="chord-dictionary-module-provider">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { provide, reactive } from "vue";
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

provide("chordDictionaryModule", contextValue);
</script>
