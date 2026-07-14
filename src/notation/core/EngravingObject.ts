/**
 * EngravingObject — structural base class for all score elements.
 *
 * Inspired by MuseScore's EngravingObject: manages parent/child relationships,
 * the property system (getProperty/setProperty), and score context.
 *
 * @see docs/adr/001-property-system-design.md
 */

import { ElementType, typeName } from './ElementType';
import {
  PropertyId,
  PropertyValue,
  PropertyFlags,
  PropertyChange,
  PropertyChangeCallback,
  PropertyRegistry,
} from './property';

export class EngravingObject {
  /** Fixed element type — set by subclass constructor */
  readonly type: ElementType;

  private m_parent: EngravingObject | null = null;
  private m_children: EngravingObject[] = [];
  private m_score: ScoreContext | null = null;

  /** Owned property values */
  private properties = new Map<PropertyId, PropertyValue>();
  /** Property flags tracking ownership/inheritance/links */
  private propertyFlagsMap = new Map<PropertyId, PropertyFlags>();

  /** Linked objects (multi-staff sync) */
  private m_links: Set<EngravingObject> | null = null;

  /** Property change listeners (for undo/redo, reactivity) */
  private changeListeners: PropertyChangeCallback[] = [];

  constructor(type: ElementType, parent: EngravingObject | null = null) {
    this.type = type;
    if (parent) {
      this.setParent(parent);
    }
  }

  // ─── Type checks ──────────────────────────────────────────

  isType(t: ElementType): boolean {
    return this.type === t;
  }

  getTypeName(): string {
    return typeName(this.type);
  }

  // ─── Parent / Child ───────────────────────────────────────

  parent(): EngravingObject | null {
    return this.m_parent;
  }

  setParent(p: EngravingObject | null): void {
    if (this.m_parent === p) return;
    this.m_parent?.removeChild(this);
    this.m_parent = p;
    p?.addChild(this);
  }

  children(): readonly EngravingObject[] {
    return this.m_children;
  }

  protected addChild(child: EngravingObject): void {
    if (!this.m_children.includes(child)) {
      this.m_children.push(child);
    }
  }

  protected removeChild(child: EngravingObject): void {
    const idx = this.m_children.indexOf(child);
    if (idx >= 0) {
      this.m_children.splice(idx, 1);
    }
  }

  // ─── Score context ───────────────────────────────────────

  get score(): ScoreContext | null {
    return this.m_score;
  }

  setScore(score: ScoreContext | null): void {
    this.m_score = score;
    for (const child of this.m_children) {
      child.setScore(score);
    }
  }

  // ─── Property System ─────────────────────────────────────

  /**
   * Get a property value. Resolution order:
   * 1. Owned value (explicitly set)
   * 2. Style inheritance (if styled property and score has style)
   * 3. Parent delegation
   * 4. Default from registry
   */
  getProperty(pid: PropertyId): PropertyValue {
    // 1. Check owned value
    if (this.properties.has(pid)) {
      return this.properties.get(pid)!;
    }

    // 2. Check style inheritance
    if (PropertyRegistry.isStyled(pid)) {
      const styleId = PropertyRegistry.getStyleId(pid);
      if (styleId !== undefined && this.m_score) {
        const styleValue = this.m_score.getStyleValue(styleId);
        if (styleValue !== undefined) {
          return styleValue;
        }
      }
    }

    // 3. Check parent delegation
    if (this.m_parent) {
      const parentValue = this.m_parent.getProperty(pid);
      if (parentValue !== undefined) {
        return parentValue;
      }
    }

    // 4. Return default
    const def = PropertyRegistry.getDefault(pid);
    return def === undefined ? null : def;
  }

  /**
   * Set a property value. Marks it as OWNED and notifies listeners.
   */
  setProperty(pid: PropertyId, value: PropertyValue): void {
    const oldValue = this.getProperty(pid);
    this.properties.set(pid, value);
    this.propertyFlagsMap.set(pid, PropertyFlags.OWNED);

    // Notify listeners
    if (oldValue !== value) {
      this.notifyChange(pid, oldValue, value);
    }
  }

  /** Check if a property is explicitly owned (not inherited) */
  isPropertyOwned(pid: PropertyId): boolean {
    const flags = this.propertyFlagsMap.get(pid);
    return (flags ?? PropertyFlags.DEFAULT) === PropertyFlags.OWNED;
  }

  /** Get property flags */
  propertyFlags(pid: PropertyId): PropertyFlags {
    return this.propertyFlagsMap.get(pid) ?? PropertyFlags.DEFAULT;
  }

  /** Reset a property to its default/inherited value */
  resetProperty(pid: PropertyId): void {
    const oldValue = this.getProperty(pid);
    this.properties.delete(pid);
    this.propertyFlagsMap.delete(pid);
    const newValue = this.getProperty(pid);
    if (oldValue !== newValue) {
      this.notifyChange(pid, oldValue, newValue);
    }
  }

  /** Subscribe to property changes */
  onPropertyChange(callback: PropertyChangeCallback): () => void {
    this.changeListeners.push(callback);
    return () => {
      const idx = this.changeListeners.indexOf(callback);
      if (idx >= 0) this.changeListeners.splice(idx, 1);
    };
  }

  protected notifyChange(
    pid: PropertyId,
    oldValue: PropertyValue,
    newValue: PropertyValue,
  ): void {
    const change: PropertyChange = {
      target: this,
      propertyId: pid,
      oldValue,
      newValue,
      timestamp: Date.now(),
    };
    for (const cb of this.changeListeners) {
      cb(change);
    }
  }

  // ─── Link System ─────────────────────────────────────────

  links(): Set<EngravingObject> | null {
    return this.m_links;
  }

  linkTo(other: EngravingObject): void {
    if (!this.m_links) this.m_links = new Set();
    if (!other.m_links) other.m_links = new Set();
    this.m_links.add(other);
    other.m_links.add(this);
  }

  unlink(): void {
    if (!this.m_links) return;
    for (const linked of this.m_links) {
      linked.m_links?.delete(this);
    }
    this.m_links.clear();
  }

  isLinked(other?: EngravingObject): boolean {
    if (!this.m_links) return false;
    if (!other) return this.m_links.size > 0;
    return this.m_links.has(other);
  }

  // ─── Serialization ───────────────────────────────────────

  toJSON(): object {
    const props: Record<string, PropertyValue> = {};
    for (const [pid, value] of this.properties) {
      props[PropertyId[pid]] = value;
    }
    return {
      type: this.getTypeName(),
      properties: props,
      children: this.m_children.map((c) => c.toJSON()),
    };
  }
}

// Forward declaration for Score-like context — avoids circular import
// The actual Score class will import EngravingObject and implement this.
export interface ScoreContext {
  getStyleValue(styleId: import('./property').StyleId): PropertyValue | undefined;
}
