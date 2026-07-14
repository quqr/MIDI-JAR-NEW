/**
 * Measure — a bar of music containing Segments.
 *
 * Inspired by MuseScore's Measure: manages time signature, segments,
 * and provides tick-to-position conversion within the measure.
 */

import { EngravingObject } from './EngravingObject';
import { ElementType } from './ElementType';
import { Segment } from './Segment';
import { Chord } from './Chord';
import { Note } from './Note';
import { type TimeSignature, type ScorePosition } from './types';

export class Measure extends EngravingObject {
  private m_number: number;
  private m_timeSignature: TimeSignature;
  private m_segments: Segment[] = [];

  constructor(
    number: number,
    timeSignature: TimeSignature,
    parent: EngravingObject | null = null,
  ) {
    super(ElementType.MEASURE, parent);
    this.m_number = number;
    this.m_timeSignature = timeSignature;
  }

  get number(): number {
    return this.m_number;
  }

  get timeSignature(): TimeSignature {
    return this.m_timeSignature;
  }

  setTimeSignature(ts: TimeSignature): void {
    this.m_timeSignature = ts;
  }

  get segments(): readonly Segment[] {
    return this.m_segments;
  }

  /** Measure duration in ticks (based on time signature) */
  get durationTicks(): number {
    // beats * (divisions per beat) = ticks per measure
    // 480 PPQN: quarter note = 480, so 4/4 = 4 * 480 = 1920
    const beatTicks = 480 * (4 / this.m_timeSignature.beatType);
    return Math.round(beatTicks * this.m_timeSignature.beats);
  }

  /** Add a segment to this measure */
  addSegment(segment: Segment): void {
    segment.setParent(this);
    this.m_segments.push(segment);
    if (this.score) {
      segment.setScore(this.score);
    }
  }

  /** Remove a segment */
  removeSegment(segment: Segment): void {
    const idx = this.m_segments.indexOf(segment);
    if (idx >= 0) {
      this.m_segments.splice(idx, 1);
      segment.setParent(null);
    }
  }

  /** Insert a note at a specific tick position */
  insertNote(tick: number, note: Note): void {
    let segment = this.findOrCreateSegment(tick);
    let chord = segment.chords[0];
    if (!chord) {
      chord = new Chord(note.duration, segment);
      segment.addElement(chord);
    }
    chord.addNote(note);
  }

  /** Find or create a segment at the given tick */
  private findOrCreateSegment(tick: number): Segment {
    for (const seg of this.m_segments) {
      if (seg.tick === tick) return seg;
    }
    const seg = new Segment(tick, this);
    this.addSegment(seg);
    return seg;
  }

  /** Get all notes in this measure */
  getAllNotes(): Note[] {
    const notes: Note[] = [];
    for (const seg of this.m_segments) {
      for (const chord of seg.chords) {
        notes.push(...chord.notes);
      }
    }
    return notes;
  }

  /** Convert tick to ScorePosition within this measure */
  tickToPosition(tick: number): ScorePosition {
    return {
      measure: this.m_number,
      beat: tick / 480,
      staff: 0,
      voice: 0,
    };
  }

  /** Convert ScorePosition to tick within this measure */
  positionToTick(pos: ScorePosition): number {
    return Math.round(pos.beat * 480);
  }

  toJSON(): object {
    return {
      ...super.toJSON(),
      number: this.m_number,
      timeSignature: this.m_timeSignature,
      segments: this.m_segments.map((s) => s.toJSON()),
    };
  }
}
