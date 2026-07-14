/**
 * Element Type System — inspired by MuseScore's ElementType enum.
 *
 * Each EngravingObject has a fixed ElementType. Type family predicates
 * (isChordRest, isDurationElement, etc.) enable polymorphic dispatch
 * without instanceof chains.
 *
 * @see docs/adr/004-type-system-granularity.md
 */

export enum ElementType {
  // ─── Core structural ───
  SCORE,
  PART,
  STAFF,
  MEASURE,
  SEGMENT,
  SYSTEM,

  // ─── Duration elements ───
  NOTE,
  REST,
  CHORD,
  TUPLET,

  // ─── Clef / key / time ───
  CLEF,
  KEYSIG,
  TIMESIG,
  BARLINE,

  // ─── Articulations ───
  ARTICULATION,
  FERMATA,
  ORNAMENT,

  // ─── Spanners ───
  SLUR,
  TIE,
  GLISSANDO,
  OTTAVA,
  PEDAL,
  HAIRPIN,
  VOLTA,

  // ─── Text ───
  TEMPO_TEXT,
  HARMONY,
  LYRICS,
  STAFF_TEXT,
  SYSTEM_TEXT,
  DYNAMIC,
  EXPRESSION,

  // ─── Layout ───
  SPACER,
  HBOX,
  VBox,
  PAGE,

  // ─── Other ───
  ACCIDENTAL,
  STEM,
  BEAM,
  LEDGER_LINE,
  INVALID,
}

// ─── Type Family Predicates ───────────────────────────────────
// Mirrors MuseScore's CONVERT macro pattern — centralized type checks.

/** Rest family: rest, multi-measure rest, measure repeat */
export function isRestFamily(type: ElementType): boolean {
  return type === ElementType.REST;
}

/** ChordRest: any rhythmic element that occupies a time slot */
export function isChordRest(type: ElementType): boolean {
  return isRestFamily(type) || type === ElementType.CHORD;
}

/** Duration element: ChordRest + Tuplet */
export function isDurationElement(type: ElementType): boolean {
  return isChordRest(type) || type === ElementType.TUPLET;
}

/** Slur/Tie family */
export function isSlurTie(type: ElementType): boolean {
  return type === ElementType.SLUR || type === ElementType.TIE;
}

/** Spanner: multi-element range objects */
export function isSpanner(type: ElementType): boolean {
  return (
    isSlurTie(type) ||
    type === ElementType.GLISSANDO ||
    type === ElementType.OTTAVA ||
    type === ElementType.PEDAL ||
    type === ElementType.HAIRPIN ||
    type === ElementType.VOLTA
  );
}

/** Box: layout containers */
export function isBox(type: ElementType): boolean {
  return (
    type === ElementType.HBOX ||
    type === ElementType.VBox ||
    type === ElementType.SPACER
  );
}

/** MeasureBase: Measure + Boxes */
export function isMeasureBase(type: ElementType): boolean {
  return type === ElementType.MEASURE || isBox(type);
}

/** Text family */
export function isTextBase(type: ElementType): boolean {
  return (
    type === ElementType.TEMPO_TEXT ||
    type === ElementType.HARMONY ||
    type === ElementType.LYRICS ||
    type === ElementType.STAFF_TEXT ||
    type === ElementType.SYSTEM_TEXT ||
    type === ElementType.DYNAMIC ||
    type === ElementType.EXPRESSION
  );
}

/** Articulation family */
export function isArticulationFamily(type: ElementType): boolean {
  return (
    type === ElementType.ARTICULATION ||
    type === ElementType.ORNAMENT ||
    type === ElementType.FERMATA
  );
}

/** Spatial element: has position/size in the layout */
export function isEngravingItem(type: ElementType): boolean {
  return (
    type !== ElementType.SCORE &&
    type !== ElementType.PART &&
    type !== ElementType.STAFF &&
    type !== ElementType.SYSTEM &&
    type !== ElementType.PAGE &&
    type !== ElementType.INVALID
  );
}

/** Human-readable name for debugging */
export function typeName(type: ElementType): string {
  return ElementType[type] ?? 'UNKNOWN';
}
