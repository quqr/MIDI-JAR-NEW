/**
 * Property System — inspired by MuseScore's EngravingObject property architecture.
 *
 * Each property is identified by a PropertyId enum value, with flags tracking
 * ownership (explicitly set vs. inherited from style) and linkage state.
 *
 * @see docs/adr/001-property-system-design.md
 */

// ─── Property ID ───────────────────────────────────────────────
// Mirrors MuseScore's `Pid` enum — each value identifies a unique property.

export enum PropertyId {
  // Structure
  PARENT,
  CHILDREN,
  SCORE,

  // Spatial (EngravingItem)
  POS_X,
  POS_Y,
  WIDTH,
  HEIGHT,
  VISIBLE,
  COLOR,

  // Note-specific
  PITCH,
  DURATION,
  TIES,
  STEM_DIRECTION,
  ACCIDENTAL,

  // Measure-specific
  TIME_SIGNATURE,
  KEY_SIGNATURE,
  CLEF,
  MEASURE_NUMBER,

  // Style
  STYLE,
}

// ─── Property Value ────────────────────────────────────────────
// Union type covering all possible property values.

export type PropertyValue = string | number | boolean | null | object;

// ─── Property Flags ────────────────────────────────────────────
// Tracks how a property was set — essential for undo/redo and style inheritance.

export enum PropertyFlags {
  /** Default state — no flags set */
  DEFAULT = 0,
  /** Property is inherited from score style */
  STYLED = 1 << 0,
  /** Property was explicitly set (not inherited) */
  OWNED = 1 << 1,
  /** Property is synced across linked objects */
  LINKED = 1 << 2,
}

// ─── Property Change Record ───────────────────────────────────
// Used by the undo/redo system to track changes.

export interface PropertyChange {
  target: object;
  propertyId: PropertyId;
  oldValue: PropertyValue;
  newValue: PropertyValue;
  timestamp: number;
}

// ─── Property Change Callback ─────────────────────────────────

export type PropertyChangeCallback = (change: PropertyChange) => void;

// ─── Style ID ──────────────────────────────────────────────────
// Maps a PropertyId to a named style value (MuseScore's `Sid`).

export enum StyleId {
  NOTE_COLOR,
  NOTE_SIZE,
  STAFF_DISTANCE,
  MEASURE_WIDTH,
  STEM_LENGTH,
  ACCIDENTAL_DISTANCE,
}

/**
 * Style property descriptor — defines which StyleId a PropertyId maps to
 * and whether the property is style-inheritable.
 */
export interface PropertyDescriptor {
  /** Whether this property can inherit from score style */
  isStyled: boolean;
  /** Which style value to inherit from (if styled) */
  styleId?: StyleId;
  /** Default value when no owned or styled value exists */
  defaultValue?: PropertyValue;
}

/**
 * Registry of property descriptors.
 * Each EngravingObject subclass populates this for its supported properties.
 */
export class PropertyRegistry {
  private static descriptors = new Map<PropertyId, PropertyDescriptor>();

  static register(pid: PropertyId, descriptor: PropertyDescriptor): void {
    this.descriptors.set(pid, descriptor);
  }

  static get(pid: PropertyId): PropertyDescriptor | undefined {
    return this.descriptors.get(pid);
  }

  static isStyled(pid: PropertyId): boolean {
    return this.descriptors.get(pid)?.isStyled ?? false;
  }

  static getStyleId(pid: PropertyId): StyleId | undefined {
    return this.descriptors.get(pid)?.styleId;
  }

  static getDefault(pid: PropertyId): PropertyValue | undefined {
    return this.descriptors.get(pid)?.defaultValue;
  }
}

// Register default descriptors for common properties
PropertyRegistry.register(PropertyId.VISIBLE, {
  isStyled: false,
  defaultValue: true,
});
PropertyRegistry.register(PropertyId.COLOR, {
  isStyled: true,
  styleId: StyleId.NOTE_COLOR,
  defaultValue: '#000000',
});
PropertyRegistry.register(PropertyId.POS_X, {
  isStyled: false,
  defaultValue: 0,
});
PropertyRegistry.register(PropertyId.POS_Y, {
  isStyled: false,
  defaultValue: 0,
});
