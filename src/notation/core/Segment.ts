/**
 * Segment — a time slice within a Measure containing ChordRest elements.
 *
 * Inspired by MuseScore's Segment: groups elements that share the same
 * onset tick within a measure.
 */

import { EngravingObject } from './EngravingObject';
import { ElementType } from './ElementType';
import { Chord } from './Chord';
import { Rest } from './Rest';
import type { EngravingItem } from './EngravingItem';

export class Segment extends EngravingObject {
  private m_tick: number;
  private m_elements: EngravingItem[] = [];

  constructor(tick: number, parent: EngravingObject | null = null) {
    super(ElementType.SEGMENT, parent);
    this.m_tick = tick;
  }

  get tick(): number {
    return this.m_tick;
  }

  get elements(): readonly EngravingItem[] {
    return this.m_elements;
  }

  /** Get all chords in this segment */
  get chords(): Chord[] {
    return this.m_elements.filter((e) => e.isType(ElementType.CHORD)) as Chord[];
  }

  /** Get all rests in this segment */
  get rests(): Rest[] {
    return this.m_elements.filter((e) => e.isType(ElementType.REST)) as Rest[];
  }

  /** Add a ChordRest element to this segment */
  addElement(element: EngravingItem): void {
    element.setParent(this);
    this.m_elements.push(element);
    if (this.score) {
      element.setScore(this.score);
    }
  }

  /** Remove an element from this segment */
  removeElement(element: EngravingItem): void {
    const idx = this.m_elements.indexOf(element);
    if (idx >= 0) {
      this.m_elements.splice(idx, 1);
      element.setParent(null);
    }
  }

  /** Total ticks consumed by elements in this segment */
  get durationTicks(): number {
    if (this.m_elements.length === 0) return 0;
    return Math.max(...this.m_elements.map((e) => {
      if (e instanceof Chord) return e.ticks;
      if (e instanceof Rest) return e.ticks;
      return 0;
    }));
  }

  toJSON(): object {
    return {
      ...super.toJSON(),
      tick: this.m_tick,
      elements: this.m_elements.map((e) => e.toJSON()),
    };
  }
}
