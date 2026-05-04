import { Voice, StaveNote } from "vexflow";
import { Note } from "tonal";
import { getNoteInKeySignature } from "@/helpers";
import type {
  NotationDisplayConfig,
  NotationLayoutConfig,
  NotationStyleConfig,
} from "./types";
import {
  defaultDisplayConfig,
  defaultLayoutConfig,
  defaultStyleConfig,
} from "./types";

const NOTE_REGEX = /([a-g])(b|#)?(\d+)/i;
const NOTE_C4_MIDI = Note.midi("C4") as number;

type VexNote = {
  key: string;
  accidental: string | null;
  clef: "treble" | "bass";
  midi: number;
};

export const noteToVex = (note: string): VexNote | null => {
  const match = note.match(NOTE_REGEX);
  const midi = Note.midi(note);

  if (match && midi) {
    return {
      key: `${match[1]}${match[2] || ""}/${match[3]}`.toLowerCase(),
      accidental: match[2] || null,
      clef: midi >= NOTE_C4_MIDI ? "treble" : "bass",
      midi,
    };
  }
  return null;
};

export const getVoice = (
  notes: string[],
  clef: "treble" | "bass",
  filterClef = true,
) => {
  const voice = new Voice();

  let voiceNotes = notes
    .map(noteToVex)
    .filter((vn): vn is VexNote => vn !== null && (!filterClef || vn.clef === clef));

  voiceNotes = deduplicateVexNotes(voiceNotes);
  voiceNotes = sortVexNotes(voiceNotes);

  if (voiceNotes.length) {
    const staveNote = new StaveNote({
      keys: voiceNotes.map((vn) => vn.key),
      duration: "1",
      clef,
    });

    voice.addTickables([staveNote]);

    return voice;
  }

  return null;
};

function deduplicateVexNotes(notes: VexNote[]): VexNote[] {
  const seen = new Set<string>();
  return notes.filter((vn) => {
    if (seen.has(vn.key)) return false;
    seen.add(vn.key);
    return true;
  });
}

function sortVexNotes(notes: VexNote[]): VexNote[] {
  return [...notes].sort((a, b) => a.midi - b.midi);
}

export const getTransposedNotes = (
  midiNotes: number[],
  keySignatureNotes: readonly string[],
  transpose = 0,
) => {
  return midiNotes
    .map((m) => Note.fromMidi(m + transpose))
    .filter((m) => typeof m === "string")
    .map((n) => getNoteInKeySignature(n, keySignatureNotes));
};

export function mergeDisplayConfig(
  partial?: Partial<NotationDisplayConfig>,
): NotationDisplayConfig {
  return { ...defaultDisplayConfig, ...partial };
}

export function mergeLayoutConfig(
  partial?: Partial<NotationLayoutConfig>,
): NotationLayoutConfig {
  return { ...defaultLayoutConfig, ...partial };
}

export function mergeStyleConfig(
  partial?: Partial<NotationStyleConfig>,
): NotationStyleConfig {
  return { ...defaultStyleConfig, ...partial };
}
