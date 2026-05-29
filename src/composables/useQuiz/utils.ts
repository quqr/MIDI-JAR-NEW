import { Note, Chord, ChordType } from "tonal";
import { Chord as TChord } from "@tonaljs/chord";
import { isEqual, isSubsetOf, isSupersetOf } from "@tonaljs/pcset";

import {
  randomPick,
  getKeySignature,
  getNoteInKeySignature,
  KeySignatureConfig,
  NOTE_NAMES,
  levenshtein,
  getChordDegrees,
  stringRotate,
  removeIntervalWildcards,
} from "@/helpers";

export enum STATUSES {
  none = -1,
  different = 0,
  subset = 1,
  equal = 2,
  superset = 3,
}

export type Parameters = {
  key: string;
  accidentals: "flat" | "sharp";
  mode: "random" | "randomInKey";
  difficulty: 0 | 1 | 2 | 3 | 4 | 5;
  gameLength: number;
};

export type Game = {
  score: number;
  chords: TChord[];
  played: (TChord | null)[];
  succeeded: number;
};

export type GameState = {
  gameIndex: number;
  index: number;
  chord: TChord | null;
  status: STATUSES;
  score: number;
};

const IN_KEY_SCALE_CHROMA = "101011111101";

const SCORE_DIFFERENT = -1000;
const SCORE_COMPLEXITY = 500;
const SCORE_INVERSION = 100;
const SCORE_SUBSET = -750;
const SCORE_SUPERSET = 250;
const SCORE_ROOT = -250;

const COMPLEXITY_MAX = 5;
const INTERVAL_COMPLEXITY: Record<string, number> = {
  "1P": 0,
  "2m": 2,
  "2M": 1,
  "3m": 0,
  "3M": 0,
  "4P": 1,
  "4A": 2,
  "5d": 2,
  "5P": 0,
  "5A": 2,
  "6m": 2,
  "6M": 1,
  "7d": 0,
  "7M": 1,
  "7m": 1,
  "9d": 2,
  "9m": 1,
  "9M": 1,
  "9A": 2,
  "10m": 2,
  "11d": 2,
  "11P": 1,
  "11A": 2,
  "13m": 2,
  "13M": 1,
};

export function calculateComplexity(intervals: string[]): number {
  return intervals.reduce((complexity, interval) => {
    if (interval.endsWith("*")) return complexity;
    return complexity + (INTERVAL_COMPLEXITY[interval] ?? 1);
  }, 0);
}

export function getDictionaryChordsByComplexity(): Record<number, string[]> {
  return ChordType.all()
    .filter((chord) => chord.intervals.length > 2)
    .map((c) => ({
      ...c,
      complexity: calculateComplexity(c.intervals),
    }))
    .reduce(
      (acc, c) => {
        const complexity = Math.min(COMPLEXITY_MAX, c.complexity);
        acc[complexity] = acc[complexity] ?? [];
        acc[complexity].push(c.aliases[0]);
        return acc;
      },
      {} as Record<number, string[]>,
    );
}

export function calculateScore(
  chordComplexity: number,
  chordLev: number,
  subsetLev: number,
  supersetLev: number,
  differentRoot: boolean,
): number {
  return (
    SCORE_COMPLEXITY * chordComplexity +
    SCORE_INVERSION * chordLev +
    SCORE_SUBSET * subsetLev +
    SCORE_SUPERSET * supersetLev +
    SCORE_ROOT * (differentRoot ? 1 : 0)
  );
}

export function getGameState(
  gameIndex: number,
  index: number,
  target: TChord,
  played: TChord | null,
  pitchClasses: string[],
): GameState {
  if (!played || !played.tonic || !target.tonic)
    return { gameIndex, index, status: STATUSES.none, chord: null, score: 0 };

  if (Note.chroma(played.tonic) === Note.chroma(target.tonic)) {
    const targetIntervals = removeIntervalWildcards(target.intervals);
    const playedIntervals = removeIntervalWildcards(played.intervals);
    const chordComplexity = calculateComplexity(targetIntervals) + 1;
    const chordLev = levenshtein(
      playedIntervals,
      getChordDegrees(played, pitchClasses),
    );

    const targetLev = levenshtein(targetIntervals, playedIntervals);

    if (isSupersetOf(target.chroma)(played.chroma)) {
      return {
        gameIndex,
        index,
        status: STATUSES.superset,
        chord: played,
        score: calculateScore(
          chordComplexity,
          chordLev,
          0,
          targetLev,
          !!played.root,
        ),
      };
    }
    if (isEqual(target.chroma, played.chroma))
      return {
        gameIndex,
        index,
        status: STATUSES.equal,
        chord: played,
        score: calculateScore(chordComplexity, chordLev, 0, 0, !!played.root),
      };

    if (isSubsetOf(target.chroma)(played.chroma))
      return {
        gameIndex,
        index,
        status: STATUSES.subset,
        chord: played,
        score: calculateScore(
          chordComplexity,
          chordLev,
          targetLev,
          0,
          !!played.root,
        ),
      };
  }

  return {
    gameIndex,
    index,
    status: STATUSES.different,
    chord: played,
    score: SCORE_DIFFERENT,
  };
}

export function getRandomKeySignature(): KeySignatureConfig {
  return getKeySignature(randomPick(NOTE_NAMES), false);
}

export function getRandomChord(
  keySignature: KeySignatureConfig,
  chordComplexity: number,
): TChord {
  const chordTypes = ChordType.all().filter(
    (chord) =>
      chord.intervals.length > 2 &&
      Math.min(COMPLEXITY_MAX, calculateComplexity(chord.intervals)) <=
        chordComplexity,
  );

  const type = randomPick(chordTypes);
  const tonic = getNoteInKeySignature(
    randomPick(NOTE_NAMES),
    keySignature.notes,
  );

  return Chord.getChord(type.aliases[0], tonic);
}

export function getRandomChordInKey(
  keySignature: KeySignatureConfig,
  chordComplexity: number,
): TChord {
  const keyChroma = Note.chroma(keySignature.tonic) ?? 0;
  let chordTypes: ReturnType<typeof ChordType.all> = [];
  let tonic = keySignature.tonic;
  let retries = 0;

  while (!chordTypes.length && retries < 100) {
    tonic = randomPick(keySignature.scale);
    const chroma = Note.chroma(tonic) ?? 0;
    const scaleChroma = stringRotate(IN_KEY_SCALE_CHROMA, chroma - keyChroma);

    const isInKey = isSubsetOf(scaleChroma);

    chordTypes = ChordType.all().filter(
      (chord) =>
        chord.intervals.length > 2 &&
        Math.min(COMPLEXITY_MAX, calculateComplexity(chord.intervals)) <=
          chordComplexity &&
        isInKey(chord.chroma),
    );
    retries++;
  }

  const type = randomPick(chordTypes);

  return Chord.getChord(type.aliases[0], tonic);
}

export function generateChords(
  count: number,
  generator: (index: number, previous: TChord[]) => TChord,
): TChord[] {
  return Array(count)
    .fill(null)
    .reduce<TChord[]>((acc, _, index) => {
      let newChord: TChord;
      const previous = acc.length ? acc[acc.length - 1] : null;
      let retries = 0;
      do {
        newChord = generator(index, acc);
        retries++;
      } while (previous && previous.symbol === newChord.symbol && retries < 100);

      acc.push(newChord);
      return acc;
    }, []);
}

export function generateGame(parameters: Parameters): Game | null {
  if (parameters.mode === "random") {
    const keySignature = getRandomKeySignature();
    return {
      chords: generateChords(parameters.gameLength, () =>
        getRandomChord(keySignature, parameters.difficulty),
      ),
      score: 0,
      played: [],
      succeeded: 0,
    };
  }
  if (parameters.mode === "randomInKey") {
    const keySignature = getKeySignature(
      parameters.key,
      parameters.accidentals === "sharp",
    );
    return {
      chords: generateChords(parameters.gameLength, () =>
        getRandomChordInKey(keySignature, parameters.difficulty),
      ),
      score: 0,
      played: [],
      succeeded: 0,
    };
  }

  return null;
}
