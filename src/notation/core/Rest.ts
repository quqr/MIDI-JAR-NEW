/**
 * Rest — a silence with duration.
 */

import { EngravingItem } from './EngravingItem';
import { ElementType } from './ElementType';
import { PropertyId } from './property';
import { type Duration } from './types';
import type { EngravingObject } from './EngravingObject';

export class Rest extends EngravingItem {
  constructor(
    duration: Duration,
    parent: EngravingObject | null = null,
  ) {
    super(ElementType.REST, parent);
    this.setProperty(PropertyId.DURATION, duration);
  }

  get duration(): Duration {
    return this.getProperty(PropertyId.DURATION) as Duration;
  }

  set duration(value: Duration) {
    this.setProperty(PropertyId.DURATION, value);
  }

  get ticks(): number {
    return this.duration.ticks;
  }
}
