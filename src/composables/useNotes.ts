import { Note } from "tonal";
import { watch } from "vue";

import { getNoteInKeySignature } from "@/helpers";

import { useNoteConfig, resolveOption } from "./useNoteConfig";
import { useNoteState } from "./useNoteState";
import { getChords } from "./useChordDetection";
import { createMidiHandler } from "./useMidiHandler";
import { useMidiMessage } from "./useMidiMessage";

export interface UseNotesOptions {
  accidentals?: "flat" | "sharp" | (() => "flat" | "sharp");
  key?: string | (() => string);
  midiChannel?: number;
  allowOmissions?: boolean | (() => boolean);
  useSustain?: boolean | (() => boolean);
  detectOnRelease?: boolean | (() => boolean);
  disabledChords?: string[] | (() => string[]);
  namespace?: string;
}

export function useNotes({
  accidentals = "flat",
  key = "C",
  midiChannel = 0,
  allowOmissions = false,
  useSustain = true,
  detectOnRelease = true,
  disabledChords = undefined,
  namespace = "debugger",
}: UseNotesOptions = {}) {
  // ── Configuration ────────────────────────────────────────────────
  const config = useNoteConfig({
    accidentals,
    key,
    midiChannel,
    allowOmissions,
    useSustain,
    detectOnRelease,
    disabledChords,
    namespace,
  });

  const { keySignature, midiChannel: channel, namespace: ns } = config;

  // ── State ────────────────────────────────────────────────────────
  const state = useNoteState();

  // ── Derived computations ─────────────────────────────────────────
  const keySignatureNotes = () => keySignature.value.notes;

  const fromMidi = (m: number) =>
    getNoteInKeySignature(Note.fromMidi(m), keySignatureNotes());

  function recomputeChords(currentNotes: string[]) {
    return getChords(
      currentNotes,
      keySignatureNotes(),
      resolveOption(allowOmissions, false),
      resolveOption(disabledChords, undefined) ?? [],
    );
  }

  function recomputeFromMidiNotes() {
    const currentMidiNotes = state.aggregateMidiNotes();
    const currentNotes = currentMidiNotes.map(fromMidi);
    const currentPitchClasses = currentNotes.map(Note.pitchClass);
    const currentChords = recomputeChords(currentNotes);

    state.updateDerived(
      currentMidiNotes,
      currentNotes,
      currentPitchClasses,
      currentChords,
    );
  }

  // ── Event handlers ───────────────────────────────────────────────
  function handleNoteOn(midi: number) {
    state.clickedMidiNotes.value = [];
    state.playedMidiNotes.value = [...state.playedMidiNotes.value, midi];
    state.sustainedMidiNotes.value =
      state.sustainedMidiNotes.value.filter((m) => m !== midi);
    recomputeFromMidiNotes();
  }

  function handleNoteOff(midi: number) {
    state.playedMidiNotes.value =
      state.playedMidiNotes.value.filter((m) => m !== midi);
    if (state.sustained.value) {
      state.sustainedMidiNotes.value = [
        ...state.sustainedMidiNotes.value,
        midi,
      ];
    }
    recomputeFromMidiNotes();
    if (resolveOption(detectOnRelease, true)) {
      state.chords.value = recomputeChords(state.notes.value);
    }
  }

  function handleSustainOn() {
    if (!resolveOption(useSustain, true)) return;
    state.sustained.value = true;
    state.sustainedMidiNotes.value = [];
  }

  function handleSustainOff() {
    if (!resolveOption(useSustain, true)) return;
    state.sustained.value = false;
    state.sustainedMidiNotes.value = [];
    recomputeFromMidiNotes();
  }

  // ── User interaction ─────────────────────────────────────────────
  function toggleNote(midi: number) {
    state.playedMidiNotes.value = [];
    state.sustainedMidiNotes.value = [];
    state.sustained.value = false;

    const idx = state.clickedMidiNotes.value.indexOf(midi);
    if (idx >= 0) {
      state.clickedMidiNotes.value =
        state.clickedMidiNotes.value.filter((m) => m !== midi);
    } else {
      state.clickedMidiNotes.value = [...state.clickedMidiNotes.value, midi];
    }
    recomputeFromMidiNotes();
  }

  function clearClickedNotes() {
    if (state.clickedMidiNotes.value.length === 0) return;
    state.clickedMidiNotes.value = [];
    recomputeFromMidiNotes();
  }

  function clearNotes() {
    state.clearAll();
  }

  // ── MIDI message routing ─────────────────────────────────────────
  const onMidiMessage = createMidiHandler(channel, {
    onNoteOn: handleNoteOn,
    onNoteOff: handleNoteOff,
    onSustainOn: handleSustainOn,
    onSustainOff: handleSustainOff,
  });

  useMidiMessage(onMidiMessage, ns);

  // ── Reactive config updates ──────────────────────────────────────
  watch(
    [config.accidentalsGetter, config.keyGetter],
    () => {
      const newNotes = state.midiNotes.value.map(fromMidi);
      const newPitchClasses = newNotes.map(Note.pitchClass);
      const newChords = recomputeChords(newNotes);

      state.notes.value = newNotes;
      state.pitchClasses.value = newPitchClasses;
      state.chords.value = newChords;
    },
  );

  watch(config.allowOmissionsGetter, () => {
    state.chords.value = recomputeChords(state.notes.value);
  });

  watch(config.disabledChordsGetter, () => {
    state.chords.value = recomputeChords(state.notes.value);
  });

  watch(config.useSustainGetter, (newValue) => {
    if (!newValue) {
      state.sustainedMidiNotes.value = [];
      state.sustained.value = false;
      recomputeFromMidiNotes();
    }
  });

  watch(config.detectOnReleaseGetter, () => {
    // No immediate action needed; flag used on next note-off
  });

  // ── Public API ───────────────────────────────────────────────────
  return {
    notes: state.notes,
    pitchClasses: state.pitchClasses,
    midiNotes: state.midiNotes,
    chords: state.chords,
    sustained: state.sustained,
    sustainedMidiNotes: state.sustainedMidiNotes,
    playedMidiNotes: state.playedMidiNotes,
    clickedMidiNotes: state.clickedMidiNotes,
    keySignature,
    clearNotes,
    clearClickedNotes,
    toggleNote,
  };
}

export default useNotes;
