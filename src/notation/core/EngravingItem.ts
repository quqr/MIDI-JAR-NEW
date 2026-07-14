/**
 * EngravingItem — spatial base class for elements that have on-page position.
 *
 * Extends EngravingObject with layout position (x, y, width, height),
 * visibility, and selection state. Inspired by MuseScore's EngravingItem.
 */

import { EngravingObject } from './EngravingObject';
import { ElementType } from './ElementType';
import { PropertyId } from './property';
import type { LayoutPosition } from './types';

export class EngravingItem extends EngravingObject {
  /** Layout position — filled by the layout engine */
  private m_layout: LayoutPosition | null = null;
  /** Selection state (UI only, not serialized) */
  private m_selected = false;

  constructor(type: ElementType, parent: EngravingObject | null = null) {
    super(type, parent);
  }

  // ─── Layout Position ─────────────────────────────────────

  get layout(): LayoutPosition | null {
    return this.m_layout;
  }

  setLayout(layout: LayoutPosition): void {
    this.m_layout = layout;
  }

  get x(): number {
    return this.m_layout?.x ?? (this.getProperty(PropertyId.POS_X) as number);
  }

  get y(): number {
    return this.m_layout?.y ?? (this.getProperty(PropertyId.POS_Y) as number);
  }

  get width(): number {
    return this.m_layout?.width ?? 0;
  }

  get height(): number {
    return this.m_layout?.height ?? 0;
  }

  // ─── Visibility ──────────────────────────────────────────

  get visible(): boolean {
    return this.getProperty(PropertyId.VISIBLE) as boolean;
  }

  set visible(value: boolean) {
    this.setProperty(PropertyId.VISIBLE, value);
  }

  // ─── Selection ───────────────────────────────────────────

  get selected(): boolean {
    return this.m_selected;
  }

  setSelected(value: boolean): void {
    this.m_selected = value;
  }

  // ─── Bounding Box ────────────────────────────────────────

  /** Check if a point is inside this element's bounding box */
  containsPoint(x: number, y: number): boolean {
    if (!this.m_layout) return false;
    return (
      x >= this.m_layout.x &&
      x <= this.m_layout.x + this.m_layout.width &&
      y >= this.m_layout.y &&
      y <= this.m_layout.y + this.m_layout.height
    );
  }

  /** Check bounding box overlap with another item */
  overlaps(other: EngravingItem): boolean {
    if (!this.m_layout || !other.m_layout) return false;
    return !(
      this.m_layout.x + this.m_layout.width < other.m_layout.x ||
      other.m_layout.x + other.m_layout.width < this.m_layout.x ||
      this.m_layout.y + this.m_layout.height < other.m_layout.y ||
      other.m_layout.y + other.m_layout.height < this.m_layout.y
    );
  }

  // ─── Serialization ───────────────────────────────────────

  toJSON(): object {
    return {
      ...super.toJSON(),
      layout: this.m_layout,
      visible: this.visible,
    };
  }
}
