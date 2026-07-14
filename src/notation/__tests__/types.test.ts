import { describe, it, expect } from 'vitest';
import {
  DurationType,
  createDuration,
  calculateTicks,
  pitchToMidi,
  midiToPitch,
  pitchEqual,
  type Pitch,
} from '../core/types';

describe('Duration and Pitch helpers', () => {
  describe('calculateTicks', () => {
    it('should calculate base ticks for each duration type', () => {
      expect(calculateTicks({ type: DurationType.WHOLE, dots: 0 })).toBe(1920);
      expect(calculateTicks({ type: DurationType.HALF, dots: 0 })).toBe(960);
      expect(calculateTicks({ type: DurationType.QUARTER, dots: 0 })).toBe(480);
      expect(calculateTicks({ type: DurationType.EIGHTH, dots: 0 })).toBe(240);
      expect(calculateTicks({ type: DurationType._16TH, dots: 0 })).toBe(120);
    });

    it('should add dots correctly', () => {
      // Dotted quarter = 480 + 240 = 720
      expect(calculateTicks({ type: DurationType.QUARTER, dots: 1 })).toBe(720);
      // Double dotted quarter = 480 + 240 + 120 = 840
      expect(calculateTicks({ type: DurationType.QUARTER, dots: 2 })).toBe(840);
    });

    it('should apply tuplet ratio', () => {
      // Triplet quarter = 480 * 2/3 = 320
      expect(
        calculateTicks({
          type: DurationType.QUARTER,
          dots: 0,
          tuplet: { actualNotes: 3, normalNotes: 2 },
        }),
      ).toBe(320);
    });
  });

  describe('createDuration', () => {
    it('should create a duration with correct ticks', () => {
      const d = createDuration(DurationType.QUARTER);
      expect(d.type).toBe(DurationType.QUARTER);
      expect(d.ticks).toBe(480);
      expect(d.dots).toBe(0);
    });

    it('should create a dotted duration', () => {
      const d = createDuration(DurationType.HALF, 1);
      expect(d.ticks).toBe(1440); // 960 + 480
    });
  });

  describe('pitchToMidi', () => {
    it('should convert C4 to MIDI 60', () => {
      expect(
        pitchToMidi({ step: 'C', octave: 4, alter: 0 }),
      ).toBe(60);
    });

    it('should convert A4 to MIDI 69', () => {
      expect(
        pitchToMidi({ step: 'A', octave: 4, alter: 0 }),
      ).toBe(69);
    });

    it('should handle sharps', () => {
      expect(
        pitchToMidi({ step: 'C', octave: 4, alter: 1 }),
      ).toBe(61); // C#4
    });

    it('should handle flats', () => {
      expect(
        pitchToMidi({ step: 'B', octave: 4, alter: -1 }),
      ).toBe(70); // Bb4
    });
  });

  describe('midiToPitch', () => {
    it('should convert MIDI 60 to C4', () => {
      const pitch = midiToPitch(60);
      expect(pitch.step).toBe('C');
      expect(pitch.octave).toBe(4);
      expect(pitch.alter).toBe(0);
    });

    it('should convert MIDI 69 to A4', () => {
      const pitch = midiToPitch(69);
      expect(pitch.step).toBe('A');
      expect(pitch.octave).toBe(4);
    });
  });

  describe('pitchEqual', () => {
    it('should return true for identical pitches', () => {
      const a: Pitch = { step: 'C', octave: 4, alter: 0 };
      const b: Pitch = { step: 'C', octave: 4, alter: 0 };
      expect(pitchEqual(a, b)).toBe(true);
    });

    it('should return false for different octaves', () => {
      const a: Pitch = { step: 'C', octave: 4, alter: 0 };
      const b: Pitch = { step: 'C', octave: 5, alter: 0 };
      expect(pitchEqual(a, b)).toBe(false);
    });

    it('should return false for different alters', () => {
      const a: Pitch = { step: 'C', octave: 4, alter: 0 };
      const b: Pitch = { step: 'C', octave: 4, alter: 1 };
      expect(pitchEqual(a, b)).toBe(false);
    });
  });
});
