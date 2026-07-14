# ADR-001: Property System Design

**Status**: Proposed
**Date**: 2026-07-14
**Decision Makers**: Architecture Team
**Supersedes**: N/A

## Context

The initial implementation plan used simple TypeScript fields for element properties:

```typescript
class Note extends Element {
  pitch: Pitch;
  duration: Duration;
}
```

This approach works for basic CRUD but fails when:
- **Undo/redo**: No way to track which fields changed
- **Style inheritance**: Properties like color should inherit from parent/score
- **MusicXML round-trip**: Unknown properties lost during import/export
- **Multi-staff sync**: Changes must propagate to linked elements

MuseScore's `EngravingObject` uses a sophisticated property system with `getProperty(Pid)` / `setProperty(Pid, PropertyValue)`.

## Decision

We will implement a **property system with IDs and flags**:

```typescript
export enum PropertyId {
  PARENT, CHILDREN, SCORE,
  POS_X, POS_Y, WIDTH, HEIGHT,
  PITCH, DURATION, TIES,
  COLOR, VISIBLE, STYLE
}

export type PropertyValue = string | number | boolean | null | object;

export enum PropertyFlags {
  DEFAULT = 0,
  STYLED = 1,  // Inherited from style
  OWNED = 2,   // Explicitly set
  LINKED = 4   // Synced across staves
}
```

### Implementation

```typescript
export abstract class EngravingObject {
  private properties: Map<PropertyId, PropertyValue> = new Map();
  private propertyFlags: Map<PropertyId, PropertyFlags> = new Map();
  
  getProperty(pid: PropertyId): PropertyValue {
    // 1. Check if owned
    if (this.properties.has(pid)) {
      return this.properties.get(pid)!;
    }
    
    // 2. Check style inheritance
    if (this.isStyledProperty(pid)) {
      return this.score?.getStyle(this.getPropertyStyle(pid));
    }
    
    // 3. Check parent delegation
    const delegate = this.getPropertyDelegate(pid);
    if (delegate) {
      return delegate.getProperty(pid);
    }
    
    // 4. Return default
    return this.propertyDefault(pid);
  }
  
  setProperty(pid: PropertyId, value: PropertyValue): void {
    this.properties.set(pid, value);
    this.propertyFlags.set(pid, PropertyFlags.OWNED);
    
    // Track for undo/redo
    this.score?.undoStack?.pushPropertyChange(this, pid, value);
  }
}
```

## Consequences

### Positive

- **Undo/redo enabled**: Track property changes without field-by-field comparison
- **Style system works**: Notes inherit color/size from score style
- **MusicXML robust**: Unknown properties preserved in generic map
- **Testable**: Property access centralized in one method

### Negative

- **Complexity**: More boilerplate than simple fields
- **Type safety**: PropertyValue is union type, needs runtime checks
- **Learning curve**: Team must understand property system before contributing

### Neutral

- **Performance**: Map lookup slower than field access (acceptable for <10K elements)
- **Debugging**: Harder to inspect in DevTools (use `toJSON()` helper)

## Alternatives Considered

### Alternative 1: Simple TypeScript Fields

**Rejected because**:
- No undo/redo support without manual tracking
- Style inheritance requires per-property logic
- MusicXML unknown properties lost

### Alternative 2: Proxy-Based Tracking

```typescript
const note = reactive(new Note());
note.pitch = pitch; // Triggers tracking
```

**Rejected because**:
- Vue 3 reactivity system already used for UI
- Property system needs flags (OWNED, STYLED, LINKED)
- Proxy overhead on all property accesses

### Alternative 3: Immutable Data Structures

```typescript
class Note {
  constructor(readonly props: { pitch: Pitch; duration: Duration }) {}
  withPitch(pitch: Pitch): Note {
    return new Note({ ...this.props, pitch });
  }
}
```

**Rejected because**:
- MuseScore uses mutable DOM for performance
- Immutability conflicts with Pixi.js rendering (needs stable references)
- Undo/redo requires copy-on-write for entire score

## Implementation Plan

1. **Phase 1.5** (1 week):
   - Implement `PropertyId` enum
   - Implement `EngravingObject.getProperty/setProperty`
   - Add unit tests for ownership/inheritance

2. **Phase 2**:
   - Extend `EngravingItem` with position properties
   - Integrate with Pixi.js renderer

3. **Phase 4**:
   - Implement undo/redo using property change tracking

## References

- [MuseScore `EngravingObject` source](file:///home/loop/挂载点/F/Codes/MuseScore/src/engraving/dom/engravingobject.h#L125-L180)
- [SQL-ManyThing Query Trace](file:///home/loop/.hermes/manything/query_log.db) - Query #9: property system structure
- Related: ADR-005 (Link System)