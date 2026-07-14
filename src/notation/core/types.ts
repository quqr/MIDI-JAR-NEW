/**
 * Core music notation types — Duration, Pitch, ScorePosition, etc.
 * Based on MusicXML standard definitions.
 */

// ─── Duration ──────────────────────────────────────────────────

export enum DurationType {
  WHOLE = 'whole',
  HALF = 'half',
  QUARTER = 'quarter',
  EIGHTH = 'eighth',
  _16TH = '16th',
  _32ND = '32nd',
  _64TH = '64th',
}

export interface Duration {
  type: DurationType;
  /** Logical time in ticks (480 PPQN = 1 quarter note) */
  ticks: number;
  /** Number of augmentation dots (0–3) */
  dots: number;
  /** Tuplet ratio if part of a tuplet group */
  tuplet?: {
    actualNotes: number;
    normalNotes: number;
  };
}

// ─── Pitch ────────────────────────────────────────────────────

export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export interface Pitch {
  step: Step;
  /** Octave number (0–9). Middle C = C4 in scientific pitch notation */
  octave: number;
  /** Chromatic alteration: -2 (double flat) to +2 (double sharp), 0 = natural */
  alter: number;
}

// ─── Position ─────────────────────────────────────────────────

export interface ScorePosition {
  /** Measure index (1-based, matching MusicXML convention) */
  measure: number;
  /** Beat offset within measure (0-based, in quarter note units) */
  beat: number;
  /** Staff index (0-based) */
  staff: number;
  /** Voice index (0-based; MVP uses 0 only) */
  voice: number;
}

// ─── Time Signature ───────────────────────────────────────────

export interface TimeSignature {
  beats: number;
  beatType: number;
  /** Measure number where this signature takes effect */
  measureNumber?: number;
}

// ─── Key Signature ────────────────────────────────────────────

export interface KeySignature {
  /** Circle of fifths position: -7 (7 flats) to +7 (7 sharps) */
  fifths: number;
  mode: 'major' | 'minor';
  measureNumber?: number;
}

// ─── Clef ─────────────────────────────────────────────────────

export type ClefType = 'treble' | 'bass' | 'alto' | 'tenor';

// ─── Score Config ─────────────────────────────────────────────

export interface ScoreConfig {
  title?: string;
  composer?: string;
  tempo?: number;
  timeSignatures: TimeSignature[];
  keySignature: KeySignature;
  clef: ClefType;
  /** MusicXML divisions (ticks per quarter note) */
  divisions: number;
}

// ─── Layout Position ──────────────────────────────────────────
// Output of the layout engine — pixel coordinates for rendering.

export interface LayoutPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Stem Direction ───────────────────────────────────────────

export type StemDirection = 'up' | 'down' | 'none';

// ─── Helper Functions ─────────────────────────────────────────

/** Base ticks for each duration type at 480 PPQN */
const DURATION_TICKS: Record<DurationType, number> = {
  [DurationType.WHOLE]: 1920,
  [DurationType.HALF]: 960,
  [DurationType.QUARTER]: 480,
  [DurationType.EIGHTH]: 240,
  [DurationType._16TH]: 120,
  [DurationType._32ND]: 60,
  [DurationType._64TH]: 30,
};

/** Calculate ticks for a duration including dots and tuplets */
export function calculateTicks(duration: Omit<Duration, 'ticks'>): number {
  let ticks = DURATION_TICKS[duration.type];

  // Add dots: each dot adds half the previous value
  let dotValue = ticks;
  for (let i = 0; i < duration.dots; i++) {
    dotValue /= 2;
    ticks += dotValue;
  }

  // Apply tuplet ratio
  if (duration.tuplet) {
    ticks = (ticks * duration.tuplet.normalNotes) / duration.tuplet.actualNotes;
  }

  return Math.round(ticks);
}

/** Create a simple duration from type and optional dots */
export function createDuration(
  type: DurationType,
  dots = 0,
  tuplet?: { actualNotes: number; normalNotes: number },
): Duration {
  const partial = { type, dots, tuplet };
  return { ...partial, ticks: calculateTicks(partial) };
}

/** Convert Pitch to MIDI note number */
export function pitchToMidi(pitch: Pitch): number {
  const stepToSemitone: Record<Step, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  // MIDI: C4 = 60, so octave offset = (octave + 1) * 12
  return (pitch.octave + 1) * 12 + stepToSemitone[pitch.step] + pitch.alter;
}

/** Convert MIDI note number to Pitch */
export function midiToPitch(midi: number): Pitch {
  const stepFromSemitone: Record<number, Step> = {
    0: 'C',
    2: 'D',
    4: 'E',
    5: 'F',
    7: 'G',
    9: 'A',
    11: 'B',
  };
  const octave = Math.floor(midi / 12) - 1;
  const semitone = midi % 12;
  const step = stepFromSemitone[semitone];
  const alter = step !== undefined ? 0 : semitone - findNearestNatural(semitone);
  return { step: step ?? 'C', octave, alter };
}

function findNearestNatural(semitone: number): number {
  const naturals = [0, 2, 4, 5, 7, 9, 11];
  let nearest = 0;
  let minDist = 12;
  for (const n of naturals) {
    const dist = Math.abs(semitone - n);
    if (dist < minDist) {
      minDist = dist;
      nearest = n;
    }
  }
  return nearest;
}

/** Check if two pitches are equal */
export function pitchEqual(a: Pitch, b: Pitch): boolean {
  return (
    a.step === b.step && a.octave === b.octave && a.alter === b.alter
  );
}
