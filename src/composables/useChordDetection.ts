import { Chord, Interval } from "tonal";
import {
  getNoteInKeySignature,
} from "@/helpers";
import { detect } from "@/helpers/chord-detect";
import { tokenizeChord } from "@/helpers";

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

export function getChords(
  notes: string[],
  keySignatureNotes: readonly string[],
  allowOmissions: boolean,
  disabledChords: string[] = [],
) {
  return detect(notes, { allowOmissions, disabledChords }).map((n) =>
    getChordInfo(n, keySignatureNotes),
  );
}
