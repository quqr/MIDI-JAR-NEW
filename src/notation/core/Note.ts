/**
 * Note — a single pitch with duration.
 *
 * Compatible with existing MIDI-JAR-NEW useNotes composable via the
 * `midi` getter (Pitch → MIDI note number conversion).
 */

import { EngravingItem } from './EngravingItem';
import { EngravingObject } from './EngravingObject';
import { ElementType } from './ElementType';
import { PropertyId } from './property';
import { type Pitch, type Duration, pitchToMidi, type StemDirection } from './types';

export class Note extends EngravingItem {
  constructor(
    pitch: Pitch,
    duration: Duration,
    parent: EngravingObject | null = null,
  ) {
    super(ElementType.NOTE, parent);
    this.setProperty(PropertyId.PITCH, pitch);
    this.setProperty(PropertyId.DURATION, duration);
    this.setProperty(PropertyId.STEM_DIRECTION, 'up' as StemDirection);
  }

  get pitch(): Pitch {
    return this.getProperty(PropertyId.PITCH) as Pitch;
  }

  set pitch(value: Pitch) {
    this.setProperty(PropertyId.PITCH, value);
  }

  get duration(): Duration {
    return this.getProperty(PropertyId.DURATION) as Duration;
  }

  set duration(value: Duration) {
    this.setProperty(PropertyId.DURATION, value);
  }

  get stemDirection(): StemDirection {
    return this.getProperty(PropertyId.STEM_DIRECTION) as StemDirection;
  }

  set stemDirection(value: StemDirection) {
    this.setProperty(PropertyId.STEM_DIRECTION, value);
  }

  /** MIDI note number — compatible with existing useNotes composable */
  get midi(): number {
    return pitchToMidi(this.pitch);
  }

  /** Ticks (logical duration) */
  get ticks(): number {
    return this.duration.ticks;
  }
}
