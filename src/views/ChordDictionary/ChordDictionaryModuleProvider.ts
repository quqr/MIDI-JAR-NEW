import { inject } from "vue";
import type { KeySignatureConfig } from "@/helpers";

export interface ChordDictionaryModuleContext {
  keySignature: KeySignatureConfig;
  midiNotes: number[];
  playedMidiNotes: number[];
  sustainedMidiNotes: number[];
  pitchClasses: string[];
  disableUpdate: boolean;
}

export function useChordDictionaryModule() {
  const context = inject<ChordDictionaryModuleContext>("chordDictionaryModule");
  if (!context) {
    throw new Error(
      "useChordDictionaryModule must be used within a ChordDictionaryModuleProvider",
    );
  }
  return context;
}
