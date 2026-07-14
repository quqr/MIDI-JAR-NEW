/**
 * Notation core module — public API
 */

// Property system
export {
  PropertyId,
  PropertyFlags,
} from './property';
export type {
  PropertyValue,
  PropertyChange,
  PropertyChangeCallback,
  PropertyDescriptor,
} from './property';
export { PropertyRegistry, StyleId } from './property';

// Type system
export {
  ElementType,
  typeName,
  isRestFamily,
  isChordRest,
  isDurationElement,
  isSlurTie,
  isSpanner,
  isBox,
  isMeasureBase,
  isTextBase,
  isArticulationFamily,
  isEngravingItem,
} from './ElementType';

// Core types
export { DurationType } from './types';
export type {
  Duration,
  Pitch,
  Step,
  ScorePosition,
  TimeSignature,
  KeySignature,
  ClefType,
  ScoreConfig,
  LayoutPosition,
  StemDirection,
} from './types';
export {
  calculateTicks,
  createDuration,
  pitchToMidi,
  midiToPitch,
  pitchEqual,
} from './types';

// DOM classes
export { EngravingObject } from './EngravingObject';
export type { ScoreContext } from './EngravingObject';
export { EngravingItem } from './EngravingItem';
export { Score } from './Score';
export { Part } from './Part';
export { Staff } from './Staff';
export { Measure } from './Measure';
export { Segment } from './Segment';
export { Chord } from './Chord';
export { Note } from './Note';
export { Rest } from './Rest';
