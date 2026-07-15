import { ref, shallowRef } from "vue";
import { getChords } from "./useChordDetection";

const midiSortCompareFn = (a: number, b: number) => a - b;

export function useNoteState() {
  const sustainedMidiNotes = ref<number[]>([]);
  const playedMidiNotes = ref<number[]>([]);
  const clickedMidiNotes = ref<number[]>([]);
  const midiNotes = ref<number[]>([]);
  const notes = ref<string[]>([]);
  const pitchClasses = ref<string[]>([]);
  const chords = shallowRef<ReturnType<typeof getChords>>([]);
  const sustained = ref(false);

  function updateDerived(
    newMidiNotes: number[],
    newNotes: string[],
    newPitchClasses: string[],
    newChords: ReturnType<typeof getChords>,
  ) {
    midiNotes.value = newMidiNotes;
    notes.value = newNotes;
    pitchClasses.value = newPitchClasses;
    chords.value = newChords;
  }

  function clearAll() {
    sustainedMidiNotes.value = [];
    playedMidiNotes.value = [];
    clickedMidiNotes.value = [];
    midiNotes.value = [];
    notes.value = [];
    pitchClasses.value = [];
    chords.value = [];
    sustained.value = false;
  }

  function aggregateMidiNotes(): number[] {
    const combined = [
      ...sustainedMidiNotes.value,
      ...playedMidiNotes.value,
      ...clickedMidiNotes.value,
    ];
    combined.sort(midiSortCompareFn);
    return combined;
  }

  return {
    sustainedMidiNotes,
    playedMidiNotes,
    clickedMidiNotes,
    midiNotes,
    notes,
    pitchClasses,
    chords,
    sustained,
    updateDerived,
    clearAll,
    aggregateMidiNotes,
  };
}
