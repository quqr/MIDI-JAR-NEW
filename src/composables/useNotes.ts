import { Note, Chord, Interval } from "tonal";
import { ref, shallowRef, readonly, watch } from "vue";

import {
  getMidiChannel,
  getMidiCommand,
  getMidiNote,
  getMidiValue,
  getKeySignature,
  getNoteInKeySignature,
  KeySignatureConfig,
  tokenizeChord,
} from "@/helpers";
import { detect } from "@/helpers/chord-detect";
import { useMidiMessage } from "./useMidiMessage";

const MIDI_CMD_NOTE_OFF = 0x80;
const MIDI_CMD_NOTE_ON = 0x90;
const MIDI_CHANNEL_ALL = 0;
const MIDI_CMD_CC = 0xb0;
const MIDI_CC_SUSTAIN = 0x40;

const midiSortCompareFn = (a: number, b: number) => a - b;

export interface UseNotesOptions {
  accidentals?: "flat" | "sharp";
  key?: string;
  midiChannel?: number;
  allowOmissions?: boolean;
  useSustain?: boolean;
  detectOnRelease?: boolean;
  disabledChords?: string[];
}

interface ChordInfo extends ReturnType<typeof Chord.getChord> {
  symbol: string;
  root: string;
  rootInterval: string;
  rootDegree: number;
}

function getChordInfo(
  chord: string,
  keySignatureNotes: readonly string[],
): ChordInfo | null {
  const [tonic, type, root] = tokenizeChord(chord);
  if (tonic) {
    const tonicInKey = getNoteInKeySignature(tonic, keySignatureNotes);
    const rootInKey = getNoteInKeySignature(root, keySignatureNotes);
    const c = Chord.getChord(type, tonicInKey);
    const rootInterval = Interval.distance(tonicInKey, rootInKey);
    const rootDegree = c.intervals.indexOf(rootInterval) + 1;
    return { ...c, symbol: chord, root, rootInterval, rootDegree };
  }
  return null;
}

function getChords(
  notes: string[],
  keySignatureNotes: readonly string[],
  allowOmissions: boolean,
  disabledChords: string[] = [],
) {
  return detect(notes, { allowOmissions, disabledChords }).map((n) =>
    getChordInfo(n, keySignatureNotes),
  );
}

interface InternalParams {
  keySignature: KeySignatureConfig;
  allowOmissions: boolean;
  useSustain: boolean;
  detectOnRelease: boolean;
  disabledChords?: string[];
}

export function useNotes({
  accidentals = "flat",
  key = "C",
  midiChannel = MIDI_CHANNEL_ALL,
  allowOmissions = false,
  useSustain = true,
  detectOnRelease = true,
  disabledChords = undefined,
}: UseNotesOptions = {}) {
  const keySignature = ref<KeySignatureConfig>(
    getKeySignature(key, accidentals === "sharp"),
  );
  const sustainedMidiNotes = ref<number[]>([]);
  const playedMidiNotes = ref<number[]>([]);
  const midiNotes = ref<number[]>([]);
  const notes = ref<string[]>([]);
  const pitchClasses = ref<string[]>([]);
  const chords = shallowRef<ReturnType<typeof getChords>>([]);
  const sustained = ref(false);
  const params = ref<InternalParams>({
    keySignature: keySignature.value,
    allowOmissions,
    useSustain,
    detectOnRelease,
    disabledChords,
  });

  const keySignatureNotes = () => keySignature.value.notes;

  const fromMidi = (m: number) =>
    getNoteInKeySignature(Note.fromMidi(m), keySignatureNotes());

  function updateFromMidi() {
    const currentMidiNotes = [
      ...sustainedMidiNotes.value,
      ...playedMidiNotes.value,
    ];
    currentMidiNotes.sort(midiSortCompareFn);
    const currentNotes = currentMidiNotes.map(fromMidi);
    const currentPitchClasses = currentNotes.map(Note.pitchClass);
    const currentChords = getChords(
      currentNotes,
      keySignatureNotes(),
      params.value.allowOmissions,
      params.value.disabledChords,
    );

    midiNotes.value = currentMidiNotes;
    notes.value = currentNotes;
    pitchClasses.value = currentPitchClasses;
    chords.value = currentChords;
  }

  function handleNoteOn(midi: number) {
    const newPlayedMidiNotes = [...playedMidiNotes.value, midi];
    const newSustainedMidiNotes = sustainedMidiNotes.value.filter(
      (m) => m !== midi,
    );
    const newMidiNotes = [...newSustainedMidiNotes, ...newPlayedMidiNotes];
    newMidiNotes.sort(midiSortCompareFn);
    const newNotes = newMidiNotes.map(fromMidi);
    const newPitchClasses = newNotes.map(Note.pitchClass);
    const newChords = getChords(
      newNotes,
      keySignatureNotes(),
      params.value.allowOmissions,
      params.value.disabledChords,
    );

    sustainedMidiNotes.value = newSustainedMidiNotes;
    playedMidiNotes.value = newPlayedMidiNotes;
    midiNotes.value = newMidiNotes;
    notes.value = newNotes;
    pitchClasses.value = newPitchClasses;
    chords.value = newChords;
  }

  function handleNoteOff(midi: number) {
    const newPlayedMidiNotes = playedMidiNotes.value.filter((m) => m !== midi);
    const newSustainedMidiNotes = sustained.value
      ? [...sustainedMidiNotes.value, midi]
      : sustainedMidiNotes.value;
    const newMidiNotes = [...newSustainedMidiNotes, ...newPlayedMidiNotes];
    newMidiNotes.sort(midiSortCompareFn);
    const newNotes = newMidiNotes.map(fromMidi);
    const newPitchClasses = newNotes.map(Note.pitchClass);
    const newChords = params.value.detectOnRelease
      ? getChords(
          newNotes,
          keySignatureNotes(),
          params.value.allowOmissions,
          params.value.disabledChords,
        )
      : chords.value;

    sustainedMidiNotes.value = newSustainedMidiNotes;
    playedMidiNotes.value = newPlayedMidiNotes;
    midiNotes.value = newMidiNotes;
    notes.value = newNotes;
    pitchClasses.value = newPitchClasses;
    chords.value = newChords;
  }

  function handleSustainOn() {
    if (!params.value.useSustain) return;
    sustained.value = true;
    sustainedMidiNotes.value = [];
  }

  function handleSustainOff() {
    if (!params.value.useSustain) return;
    sustained.value = false;
    sustainedMidiNotes.value = [];
    updateFromMidi();
  }

  const onMidiMessage = (message: number[]) => {
    const cmd = getMidiCommand(message);
    const ch = getMidiChannel(message);
    const midi = getMidiNote(message);
    const value = getMidiValue(message);

    if (
      cmd === MIDI_CMD_NOTE_ON &&
      value !== 0 &&
      (midiChannel === MIDI_CHANNEL_ALL || midiChannel === ch)
    ) {
      handleNoteOn(midi);
    }

    if (
      (cmd === MIDI_CMD_NOTE_OFF ||
        (cmd === MIDI_CMD_NOTE_ON && value === 0)) &&
      (midiChannel === MIDI_CHANNEL_ALL || midiChannel === ch)
    ) {
      handleNoteOff(midi);
    }

    if (
      cmd === MIDI_CMD_CC &&
      midi === MIDI_CC_SUSTAIN &&
      (midiChannel === MIDI_CHANNEL_ALL || midiChannel === ch)
    ) {
      if (value === 0) {
        handleSustainOff();
      }
      if (value === 127) {
        handleSustainOn();
      }
    }
  };

  watch([() => accidentals, () => key], () => {
    keySignature.value = getKeySignature(key, accidentals === "sharp");
    params.value.keySignature = keySignature.value;
    const newNotes = midiNotes.value.map((m: number) =>
      getNoteInKeySignature(Note.fromMidi(m), keySignature.value.notes),
    );
    notes.value = newNotes;
    pitchClasses.value = newNotes.map(Note.pitchClass);
    chords.value = getChords(
      newNotes,
      keySignature.value.notes,
      params.value.allowOmissions,
      params.value.disabledChords,
    );
  });

  watch(
    () => allowOmissions,
    (newValue) => {
      params.value.allowOmissions = newValue;
      chords.value = getChords(
        notes.value,
        keySignatureNotes(),
        newValue,
        params.value.disabledChords,
      );
    },
  );

  watch(
    () => disabledChords,
    (newValue) => {
      params.value.disabledChords = newValue;
      chords.value = getChords(
        notes.value,
        keySignatureNotes(),
        params.value.allowOmissions,
        newValue,
      );
    },
  );

  watch(
    () => useSustain,
    (newValue) => {
      params.value.useSustain = newValue;
      if (!newValue) {
        midiNotes.value = [...playedMidiNotes.value];
        midiNotes.value.sort(midiSortCompareFn);
        notes.value = midiNotes.value.map(fromMidi);
        pitchClasses.value = notes.value.map(Note.pitchClass);
        chords.value = getChords(
          notes.value,
          keySignatureNotes(),
          params.value.allowOmissions,
          params.value.disabledChords,
        );
        sustainedMidiNotes.value = [];
        sustained.value = false;
      }
    },
  );

  watch(
    () => detectOnRelease,
    (newValue) => {
      params.value.detectOnRelease = newValue;
    },
  );

  function clearNotes() {
    playedMidiNotes.value = [];
    sustainedMidiNotes.value = [];
    midiNotes.value = [];
    notes.value = [];
    pitchClasses.value = [];
    chords.value = [];
    sustained.value = false;
  }

  useMidiMessage(onMidiMessage);

  return {
    notes: readonly(notes),
    pitchClasses: readonly(pitchClasses),
    midiNotes: readonly(midiNotes),
    chords: readonly(chords),
    sustained: readonly(sustained),
    sustainedMidiNotes: readonly(sustainedMidiNotes),
    playedMidiNotes: readonly(playedMidiNotes),
    keySignature: readonly(keySignature),
    clearNotes,
  };
}

export default useNotes;
