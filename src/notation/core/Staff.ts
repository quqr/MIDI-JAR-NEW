/**
 * Staff — a set of lines (usually 5) that holds measures.
 */

import { EngravingObject } from './EngravingObject';
import { ElementType } from './ElementType';
import { Measure } from './Measure';
import { type ClefType } from './types';

export class Staff extends EngravingObject {
  private m_clef: ClefType;
  private m_measures: Measure[] = [];

  constructor(
    clef: ClefType = 'treble',
    parent: EngravingObject | null = null,
  ) {
    super(ElementType.STAFF, parent);
    this.m_clef = clef;
  }

  get clef(): ClefType {
    return this.m_clef;
  }

  setClef(clef: ClefType): void {
    this.m_clef = clef;
  }

  get measures(): readonly Measure[] {
    return this.m_measures;
  }

  addMeasure(measure: Measure): void {
    measure.setParent(this);
    this.m_measures.push(measure);
    if (this.score) {
      measure.setScore(this.score);
    }
  }

  getMeasure(index: number): Measure | undefined {
    return this.m_measures[index];
  }

  toJSON(): object {
    return {
      ...super.toJSON(),
      clef: this.m_clef,
      measures: this.m_measures.map((m) => m.toJSON()),
    };
  }
}
