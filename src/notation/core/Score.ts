/**
 * Score — root node of the notation DOM.
 *
 * Contains parts, score config, and the style system.
 * Implements the Score interface from EngravingObject for style inheritance.
 */

import { EngravingObject } from './EngravingObject';
import { type ScoreContext } from './EngravingObject';
import { ElementType } from './ElementType';
import { Part } from './Part';
import { Measure } from './Measure';
import { type ScoreConfig, type ScorePosition } from './types';
import { type PropertyValue, StyleId } from './property';

export class Score extends EngravingObject implements ScoreContext {
  private m_config: ScoreConfig;
  private m_parts: Part[] = [];
  private m_styles = new Map<StyleId, PropertyValue>();

  constructor(config: ScoreConfig) {
    super(ElementType.SCORE, null);
    this.m_config = config;
    this.setScore(this); // Score is its own context
    this.initDefaultStyles();
  }

  get config(): ScoreConfig {
    return this.m_config;
  }

  get parts(): readonly Part[] {
    return this.m_parts;
  }

  addPart(part: Part): void {
    part.setParent(this);
    this.m_parts.push(part);
    part.setScore(this);
  }

  getPart(index: number): Part | undefined {
    return this.m_parts[index];
  }

  /** Get all measures across all parts/staves */
  getAllMeasures(): Measure[] {
    const measures: Measure[] = [];
    for (const part of this.m_parts) {
      measures.push(...part.getAllMeasures());
    }
    return measures;
  }

  /** Get a measure by 1-based number */
  getMeasure(measureNumber: number): Measure | undefined {
    for (const part of this.m_parts) {
      for (const staff of part.staves) {
        const measure = staff.measures.find((m) => m.number === measureNumber);
        if (measure) return measure;
      }
    }
    return undefined;
  }

  // ─── Style System ────────────────────────────────────────

  getStyleValue(styleId: StyleId): PropertyValue | undefined {
    return this.m_styles.get(styleId);
  }

  setStyle(styleId: StyleId, value: PropertyValue): void {
    this.m_styles.set(styleId, value);
  }

  private initDefaultStyles(): void {
    this.m_styles.set(StyleId.NOTE_COLOR, '#000000');
    this.m_styles.set(StyleId.NOTE_SIZE, 1.0);
    this.m_styles.set(StyleId.STAFF_DISTANCE, 10);
    this.m_styles.set(StyleId.MEASURE_WIDTH, 400);
    this.m_styles.set(StyleId.STEM_LENGTH, 35);
    this.m_styles.set(StyleId.ACCIDENTAL_DISTANCE, 5);
  }

  // ─── Time / Position Conversion ─────────────────────────

  /** Convert global tick to ScorePosition */
  tickToPosition(tick: number): ScorePosition {
    const measures = this.getAllMeasures();
    let remainingTicks = tick;
    for (const measure of measures) {
      const measureTicks = measure.durationTicks;
      if (remainingTicks < measureTicks) {
        return {
          measure: measure.number,
          beat: remainingTicks / 480,
          staff: 0,
          voice: 0,
        };
      }
      remainingTicks -= measureTicks;
    }
    // Past end of score
    const lastMeasure = measures[measures.length - 1];
    return {
      measure: lastMeasure?.number ?? 1,
      beat: 0,
      staff: 0,
      voice: 0,
    };
  }

  /** Convert ScorePosition to global tick */
  positionToTick(pos: ScorePosition): number {
    const measures = this.getAllMeasures();
    let tick = 0;
    for (const measure of measures) {
      if (measure.number === pos.measure) {
        tick += Math.round(pos.beat * 480);
        return tick;
      }
      tick += measure.durationTicks;
    }
    return tick;
  }

  // ─── Serialization ───────────────────────────────────────

  toJSON(): object {
    return {
      ...super.toJSON(),
      config: this.m_config,
      parts: this.m_parts.map((p) => p.toJSON()),
    };
  }

  static fromJSON(data: { config?: ScoreConfig } & Record<string, unknown>): Score {
    const config = data.config as ScoreConfig;
    const score = new Score(config);
    return score;
  }
}
