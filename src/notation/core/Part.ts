/**
 * Part — an instrument/voice containing one or more staves.
 */

import { EngravingObject } from './EngravingObject';
import { ElementType } from './ElementType';
import { Staff } from './Staff';
import { Measure } from './Measure';

export class Part extends EngravingObject {
  private m_name: string;
  private m_staves: Staff[] = [];

  constructor(
    name: string = '',
    parent: EngravingObject | null = null,
  ) {
    super(ElementType.PART, parent);
    this.m_name = name;
  }

  get name(): string {
    return this.m_name;
  }

  setName(name: string): void {
    this.m_name = name;
  }

  get staves(): readonly Staff[] {
    return this.m_staves;
  }

  addStaff(staff: Staff): void {
    staff.setParent(this);
    this.m_staves.push(staff);
    if (this.score) {
      staff.setScore(this.score);
    }
  }

  /** Get all measures across all staves */
  getAllMeasures(): Measure[] {
    const measures: Measure[] = [];
    for (const staff of this.m_staves) {
      measures.push(...staff.measures);
    }
    return measures;
  }

  toJSON(): object {
    return {
      ...super.toJSON(),
      name: this.m_name,
      staves: this.m_staves.map((s) => s.toJSON()),
    };
  }
}
