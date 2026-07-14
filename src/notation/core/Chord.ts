/**
 * Chord — a group of notes sounding simultaneously.
 *
 * In MusicXML and MuseScore, a Chord contains one or more Note elements
 * that share the same onset time and duration.
 */

import { EngravingItem } from './EngravingItem';
import { ElementType } from './ElementType';
import { PropertyId } from './property';
import { Note } from './Note';
import { type Duration, type StemDirection } from './types';
import type { EngravingObject } from './EngravingObject';

export class Chord extends EngravingItem {
  private m_notes: Note[] = [];
  private m_duration: Duration;

  constructor(
    duration: Duration,
    parent: EngravingObject | null = null,
  ) {
    super(ElementType.CHORD, parent);
    this.m_duration = duration;
    this.setProperty(PropertyId.DURATION, duration);
  }

  get notes(): readonly Note[] {
    return this.m_notes;
  }

  get duration(): Duration {
    return this.m_duration;
  }

  get ticks(): number {
    return this.duration.ticks;
  }

  get stemDirection(): StemDirection {
    if (this.m_notes.length > 0) {
      return this.m_notes[0].stemDirection;
    }
    return 'up';
  }

  set stemDirection(value: StemDirection) {
    for (const note of this.m_notes) {
      note.stemDirection = value;
    }
  }

  /** Add a note to this chord */
  addNote(note: Note): void {
    note.setParent(this);
    this.m_notes.push(note);
    if (this.score) {
      note.setScore(this.score);
    }
  }

  /** Remove a note from this chord */
  removeNote(note: Note): void {
    const idx = this.m_notes.indexOf(note);
    if (idx >= 0) {
      this.m_notes.splice(idx, 1);
      note.setParent(null);
    }
  }

  /** Get the highest pitch note in this chord */
  highestNote(): Note | null {
    if (this.m_notes.length === 0) return null;
    return this.m_notes.reduce((highest, note) =>
      note.midi > highest.midi ? note : highest,
    );
  }

  /** Get the lowest pitch note in this chord */
  lowestNote(): Note | null {
    if (this.m_notes.length === 0) return null;
    return this.m_notes.reduce((lowest, note) =>
      note.midi < lowest.midi ? note : lowest,
    );
  }

  toJSON(): object {
    return {
      ...super.toJSON(),
      notes: this.m_notes.map((n) => n.toJSON()),
    };
  }
}
