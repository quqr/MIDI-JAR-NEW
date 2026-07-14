import { describe, it, expect } from 'vitest';
import {
  Score,
  Part,
  Staff,
  Measure,
  Chord,
  Note,
  EngravingObject,
  ElementType,
  isChordRest,
  isDurationElement,
  isSlurTie,
  isSpanner,
  DurationType,
  createDuration,
  PropertyId,
  StyleId,
  type ScoreConfig,
  type Pitch,
} from '../core';

function createDefaultConfig(): ScoreConfig {
  return {
    title: 'Test Score',
    timeSignatures: [{ beats: 4, beatType: 4 }],
    keySignature: { fifths: 0, mode: 'major' },
    clef: 'treble',
    divisions: 480,
  };
}

describe('Score DOM', () => {
  describe('Score creation', () => {
    it('should create empty score with config', () => {
      const score = new Score(createDefaultConfig());
      expect(score.parts).toHaveLength(0);
      expect(score.config.title).toBe('Test Score');
      expect(score.config.divisions).toBe(480);
    });

    it('should initialize default styles', () => {
      const score = new Score(createDefaultConfig());
      expect(score.getStyleValue(StyleId.NOTE_COLOR)).toBe('#000000');
      expect(score.getStyleValue(StyleId.STAFF_DISTANCE)).toBe(10);
    });
  });

  describe('Part / Staff / Measure hierarchy', () => {
    it('should build a complete score hierarchy', () => {
      const score = new Score(createDefaultConfig());
      const part = new Part('Piano');
      const staff = new Staff('treble');
      const measure = new Measure(1, { beats: 4, beatType: 4 });

      staff.addMeasure(measure);
      part.addStaff(staff);
      score.addPart(part);

      expect(score.parts).toHaveLength(1);
      expect(score.parts[0].staves).toHaveLength(1);
      expect(score.parts[0].staves[0].measures).toHaveLength(1);
      expect(score.parts[0].staves[0].measures[0].number).toBe(1);
    });

    it('should propagate score context to children', () => {
      const score = new Score(createDefaultConfig());
      const part = new Part('Piano');
      score.addPart(part);

      expect(part.score).toBe(score);
    });

    it('should get measure by number', () => {
      const score = new Score(createDefaultConfig());
      const part = new Part('Piano');
      const staff = new Staff('treble');
      const measure1 = new Measure(1, { beats: 4, beatType: 4 });
      const measure2 = new Measure(2, { beats: 4, beatType: 4 });

      staff.addMeasure(measure1);
      staff.addMeasure(measure2);
      part.addStaff(staff);
      score.addPart(part);

      expect(score.getMeasure(1)).toBe(measure1);
      expect(score.getMeasure(2)).toBe(measure2);
      expect(score.getMeasure(3)).toBeUndefined();
    });
  });

  describe('Measure duration', () => {
    it('should calculate 4/4 measure duration as 1920 ticks', () => {
      const measure = new Measure(1, { beats: 4, beatType: 4 });
      expect(measure.durationTicks).toBe(1920);
    });

    it('should calculate 3/4 measure duration as 1440 ticks', () => {
      const measure = new Measure(1, { beats: 3, beatType: 4 });
      expect(measure.durationTicks).toBe(1440);
    });

    it('should calculate 6/8 measure duration as 1440 ticks', () => {
      const measure = new Measure(1, { beats: 6, beatType: 8 });
      expect(measure.durationTicks).toBe(1440);
    });
  });

  describe('Note and Chord', () => {
    it('should create a note with pitch and duration', () => {
      const pitch: Pitch = { step: 'C', octave: 4, alter: 0 };
      const duration = createDuration(DurationType.QUARTER);
      const note = new Note(pitch, duration);

      expect(note.type).toBe(ElementType.NOTE);
      expect(note.pitch.step).toBe('C');
      expect(note.midi).toBe(60);
      expect(note.ticks).toBe(480);
    });

    it('should create a chord and add notes', () => {
      const duration = createDuration(DurationType.QUARTER);
      const chord = new Chord(duration);
      const note1 = new Note(
        { step: 'C', octave: 4, alter: 0 },
        duration,
      );
      const note2 = new Note(
        { step: 'E', octave: 4, alter: 0 },
        duration,
      );

      chord.addNote(note1);
      chord.addNote(note2);

      expect(chord.notes).toHaveLength(2);
      expect(chord.lowestNote()?.midi).toBe(60); // C4
      expect(chord.highestNote()?.midi).toBe(64); // E4
    });

    it('should remove notes from chord', () => {
      const duration = createDuration(DurationType.QUARTER);
      const chord = new Chord(duration);
      const note = new Note(
        { step: 'C', octave: 4, alter: 0 },
        duration,
      );

      chord.addNote(note);
      expect(chord.notes).toHaveLength(1);

      chord.removeNote(note);
      expect(chord.notes).toHaveLength(0);
    });
  });

  describe('Segment and Measure integration', () => {
    it('should insert note into measure at tick position', () => {
      const measure = new Measure(1, { beats: 4, beatType: 4 });
      const note = new Note(
        { step: 'C', octave: 4, alter: 0 },
        createDuration(DurationType.QUARTER),
      );

      measure.insertNote(0, note);

      expect(measure.segments).toHaveLength(1);
      expect(measure.segments[0].tick).toBe(0);
      expect(measure.segments[0].chords).toHaveLength(1);
      expect(measure.segments[0].chords[0].notes).toHaveLength(1);
    });

    it('should group notes at same tick into same chord', () => {
      const measure = new Measure(1, { beats: 4, beatType: 4 });
      const note1 = new Note(
        { step: 'C', octave: 4, alter: 0 },
        createDuration(DurationType.QUARTER),
      );
      const note2 = new Note(
        { step: 'E', octave: 4, alter: 0 },
        createDuration(DurationType.QUARTER),
      );

      measure.insertNote(0, note1);
      measure.insertNote(0, note2);

      expect(measure.segments).toHaveLength(1);
      expect(measure.segments[0].chords[0].notes).toHaveLength(2);
    });

    it('should create separate segments for different ticks', () => {
      const measure = new Measure(1, { beats: 4, beatType: 4 });
      const note1 = new Note(
        { step: 'C', octave: 4, alter: 0 },
        createDuration(DurationType.QUARTER),
      );
      const note2 = new Note(
        { step: 'D', octave: 4, alter: 0 },
        createDuration(DurationType.QUARTER),
      );

      measure.insertNote(0, note1);
      measure.insertNote(480, note2); // Next beat

      expect(measure.segments).toHaveLength(2);
    });

    it('should get all notes from measure', () => {
      const measure = new Measure(1, { beats: 4, beatType: 4 });
      measure.insertNote(
        0,
        new Note(
          { step: 'C', octave: 4, alter: 0 },
          createDuration(DurationType.QUARTER),
        ),
      );
      measure.insertNote(
        480,
        new Note(
          { step: 'D', octave: 4, alter: 0 },
          createDuration(DurationType.QUARTER),
        ),
      );

      const notes = measure.getAllNotes();
      expect(notes).toHaveLength(2);
    });
  });

  describe('Tick / Position conversion', () => {
    it('should convert tick to position within measure', () => {
      const measure = new Measure(1, { beats: 4, beatType: 4 });
      const pos = measure.tickToPosition(480);
      expect(pos.measure).toBe(1);
      expect(pos.beat).toBe(1);
    });

    it('should convert position to tick within measure', () => {
      const measure = new Measure(1, { beats: 4, beatType: 4 });
      const tick = measure.positionToTick({
        measure: 1,
        beat: 2,
        staff: 0,
        voice: 0,
      });
      expect(tick).toBe(960);
    });
  });

  describe('Style inheritance', () => {
    it('should inherit styled properties from score', () => {
      const score = new Score(createDefaultConfig());
      const part = new Part('Piano');
      const staff = new Staff('treble');
      const measure = new Measure(1, { beats: 4, beatType: 4 });

      staff.addMeasure(measure);
      part.addStaff(staff);
      score.addPart(part);

      // Change score style
      score.setStyle(StyleId.NOTE_COLOR, 'blue');

      // Note should inherit from score
      const note = new Note(
        { step: 'C', octave: 4, alter: 0 },
        createDuration(DurationType.QUARTER),
        measure,
      );
      measure.insertNote(0, note);

      // COLOR is styled, so it should inherit from score
      expect(note.getProperty(PropertyId.COLOR)).toBe('blue');
    });

    it('should override styled property with owned value', () => {
      const score = new Score(createDefaultConfig());
      const note = new Note(
        { step: 'C', octave: 4, alter: 0 },
        createDuration(DurationType.QUARTER),
      );
      note.setScore(score);

      score.setStyle(StyleId.NOTE_COLOR, 'blue');
      expect(note.getProperty(PropertyId.COLOR)).toBe('blue');

      // Override with owned value
      note.setProperty(PropertyId.COLOR, 'red');
      expect(note.getProperty(PropertyId.COLOR)).toBe('red');
      expect(note.isPropertyOwned(PropertyId.COLOR)).toBe(true);
    });
  });

  describe('Link system', () => {
    it('should link and unlink objects', () => {
      const obj1 = new EngravingObject(ElementType.NOTE);
      const obj2 = new EngravingObject(ElementType.NOTE);

      expect(obj1.isLinked()).toBe(false);

      obj1.linkTo(obj2);
      expect(obj1.isLinked()).toBe(true);
      expect(obj1.isLinked(obj2)).toBe(true);
      expect(obj2.isLinked(obj1)).toBe(true);

      obj1.unlink();
      expect(obj1.isLinked()).toBe(false);
      expect(obj2.isLinked()).toBe(false);
    });
  });

  describe('Type family predicates', () => {
    it('should identify ChordRest types', () => {
      expect(isChordRest(ElementType.CHORD)).toBe(true);
      expect(isChordRest(ElementType.REST)).toBe(true);
      expect(isChordRest(ElementType.NOTE)).toBe(false);
    });

    it('should identify DurationElement types', () => {
      expect(isDurationElement(ElementType.CHORD)).toBe(true);
      expect(isDurationElement(ElementType.TUPLET)).toBe(true);
      expect(isDurationElement(ElementType.NOTE)).toBe(false);
    });

    it('should identify SlurTie types', () => {
      expect(isSlurTie(ElementType.SLUR)).toBe(true);
      expect(isSlurTie(ElementType.TIE)).toBe(true);
      expect(isSlurTie(ElementType.GLISSANDO)).toBe(false);
    });

    it('should identify Spanner types', () => {
      expect(isSpanner(ElementType.SLUR)).toBe(true);
      expect(isSpanner(ElementType.HAIRPIN)).toBe(true);
      expect(isSpanner(ElementType.NOTE)).toBe(false);
    });
  });

  describe('EngravingItem spatial', () => {
    it('should set and get layout position', () => {
      const note = new Note(
        { step: 'C', octave: 4, alter: 0 },
        createDuration(DurationType.QUARTER),
      );
      note.setLayout({ x: 100, y: 50, width: 20, height: 40 });

      expect(note.x).toBe(100);
      expect(note.y).toBe(50);
      expect(note.width).toBe(20);
      expect(note.height).toBe(40);
    });

    it('should detect point containment', () => {
      const note = new Note(
        { step: 'C', octave: 4, alter: 0 },
        createDuration(DurationType.QUARTER),
      );
      note.setLayout({ x: 0, y: 0, width: 100, height: 100 });

      expect(note.containsPoint(50, 50)).toBe(true);
      expect(note.containsPoint(150, 150)).toBe(false);
    });

    it('should detect bounding box overlap', () => {
      const note1 = new Note(
        { step: 'C', octave: 4, alter: 0 },
        createDuration(DurationType.QUARTER),
      );
      note1.setLayout({ x: 0, y: 0, width: 50, height: 50 });

      const note2 = new Note(
        { step: 'D', octave: 4, alter: 0 },
        createDuration(DurationType.QUARTER),
      );
      note2.setLayout({ x: 40, y: 40, width: 50, height: 50 });

      expect(note1.overlaps(note2)).toBe(true);

      note2.setLayout({ x: 100, y: 100, width: 50, height: 50 });
      expect(note1.overlaps(note2)).toBe(false);
    });

    it('should toggle visibility', () => {
      const note = new Note(
        { step: 'C', octave: 4, alter: 0 },
        createDuration(DurationType.QUARTER),
      );
      expect(note.visible).toBe(true);
      note.visible = false;
      expect(note.visible).toBe(false);
    });
  });

  describe('Serialization', () => {
    it('should serialize score to JSON', () => {
      const score = new Score(createDefaultConfig());
      const part = new Part('Piano');
      score.addPart(part);

      const json = score.toJSON() as any;
      expect(json.type).toBe('SCORE');
      expect(json.config.title).toBe('Test Score');
      expect(json.parts).toHaveLength(1);
    });

    it('should serialize note with properties', () => {
      const note = new Note(
        { step: 'C', octave: 4, alter: 0 },
        createDuration(DurationType.QUARTER),
      );
      note.visible = false;

      const json = note.toJSON() as any;
      expect(json.type).toBe('NOTE');
      expect(json.visible).toBe(false);
    });
  });
});
