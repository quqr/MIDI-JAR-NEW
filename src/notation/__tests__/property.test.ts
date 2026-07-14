import { describe, it, expect } from 'vitest';
import {
  PropertyId,
  PropertyFlags,
  PropertyRegistry,
  StyleId,
} from '../core/property';
import { EngravingObject } from '../core/EngravingObject';
import { ElementType } from '../core/ElementType';

describe('Property System', () => {
  describe('PropertyRegistry', () => {
    it('should return default values for registered properties', () => {
      expect(PropertyRegistry.getDefault(PropertyId.VISIBLE)).toBe(true);
      expect(PropertyRegistry.getDefault(PropertyId.COLOR)).toBe('#000000');
      expect(PropertyRegistry.getDefault(PropertyId.POS_X)).toBe(0);
    });

    it('should identify styled properties', () => {
      expect(PropertyRegistry.isStyled(PropertyId.COLOR)).toBe(true);
      expect(PropertyRegistry.isStyled(PropertyId.VISIBLE)).toBe(false);
    });

    it('should return style ID for styled properties', () => {
      expect(PropertyRegistry.getStyleId(PropertyId.COLOR)).toBe(
        StyleId.NOTE_COLOR,
      );
      expect(PropertyRegistry.getStyleId(PropertyId.VISIBLE)).toBeUndefined();
    });
  });

  describe('EngravingObject property access', () => {
    it('should return default value when property not set', () => {
      const obj = new EngravingObject(ElementType.NOTE);
      expect(obj.getProperty(PropertyId.VISIBLE)).toBe(true);
      expect(obj.getProperty(PropertyId.COLOR)).toBe('#000000');
    });

    it('should set and get owned properties', () => {
      const obj = new EngravingObject(ElementType.NOTE);
      obj.setProperty(PropertyId.VISIBLE, false);
      expect(obj.getProperty(PropertyId.VISIBLE)).toBe(false);
      expect(obj.isPropertyOwned(PropertyId.VISIBLE)).toBe(true);
    });

    it('should track property flags', () => {
      const obj = new EngravingObject(ElementType.NOTE);
      expect(obj.propertyFlags(PropertyId.VISIBLE)).toBe(PropertyFlags.DEFAULT);
      obj.setProperty(PropertyId.COLOR, 'red');
      expect(obj.propertyFlags(PropertyId.COLOR)).toBe(PropertyFlags.OWNED);
    });

    it('should reset property to default', () => {
      const obj = new EngravingObject(ElementType.NOTE);
      obj.setProperty(PropertyId.VISIBLE, false);
      expect(obj.getProperty(PropertyId.VISIBLE)).toBe(false);
      obj.resetProperty(PropertyId.VISIBLE);
      expect(obj.getProperty(PropertyId.VISIBLE)).toBe(true);
      expect(obj.isPropertyOwned(PropertyId.VISIBLE)).toBe(false);
    });
  });

  describe('Property change notifications', () => {
    it('should notify listeners on property change', () => {
      const obj = new EngravingObject(ElementType.NOTE);
      const changes: { pid: PropertyId; oldVal: unknown; newVal: unknown }[] =
        [];

      obj.onPropertyChange((change) => {
        changes.push({
          pid: change.propertyId,
          oldVal: change.oldValue,
          newVal: change.newValue,
        });
      });

      obj.setProperty(PropertyId.VISIBLE, false);
      expect(changes).toHaveLength(1);
      expect(changes[0].pid).toBe(PropertyId.VISIBLE);
      expect(changes[0].oldVal).toBe(true);
      expect(changes[0].newVal).toBe(false);
    });

    it('should not notify when value does not change', () => {
      const obj = new EngravingObject(ElementType.NOTE);
      let callCount = 0;
      obj.onPropertyChange(() => callCount++);

      obj.setProperty(PropertyId.VISIBLE, true); // Same as default
      expect(callCount).toBe(0);
    });

    it('should allow unsubscribing from changes', () => {
      const obj = new EngravingObject(ElementType.NOTE);
      let callCount = 0;
      const unsub = obj.onPropertyChange(() => callCount++);

      obj.setProperty(PropertyId.VISIBLE, false);
      expect(callCount).toBe(1);

      unsub();
      obj.setProperty(PropertyId.VISIBLE, true);
      expect(callCount).toBe(1);
    });
  });
});
