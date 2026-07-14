# ADR-003: Layout Engine Scope

**Status**: Proposed
**Date**: 2026-07-14
**Decision Makers**: Architecture Team

## Context

The original plan specified:

> **排版策略**: 固定 4 小节/行，无避让

This approach works for simple monophonic melodies but fails on real-world scores:

1. **Note collisions**: Accidentals, dots, flags overlap
2. **Stem direction**: Must alternate based on staff position
3. **Beam grouping**: Complex rules for beamed notes
4. **Tuplet brackets**: Need measure context for positioning

MuseScore has sophisticated layout modules:
- `horizontalspacing.h` - Note/chord spacing algorithm
- `measurelayout.h` - Measure break decisions
- `stemlayout.h` - Stem direction/length
- `beamtremololayout.h` - Beam grouping

## Decision

We will implement **collision-aware layout** for MVP:

### Phase 2.5 Implementation

```
src/notation/layout/
├── LayoutEngine.ts           # Main dispatcher
├── HorizontalSpacing.ts      # Note spacing algorithm
├── StemDirection.ts          # Up/down logic
├── BeamLayout.ts             # Beam grouping rules
├── CollisionDetector.ts      # Overlap prevention
└── LayoutConstants.ts        # Spacing values (MuseScore defaults)
```

### Key Algorithms

#### 1. Horizontal Spacing

```typescript
export class HorizontalSpacing {
  static readonly SPATIUM = 10; // pixels (staff height / 4)
  static readonly MIN_NOTE_DISTANCE = 0.75 * this.SPATIUM;
  
  layoutMeasure(measure: Measure): LayoutResult {
    const segments = measure.segments;
    const positions: number[] = [];
    
    // Step 1: Calculate tick positions
    let currentX = 0;
    for (const seg of segments) {
      positions.push(currentX);
      currentX += this.noteWidth(seg) + this.MIN_NOTE_DISTANCE;
    }
    
    // Step 2: Check collisions (accidentals, dots, flags)
    for (let i = 1; i < segments.length; i++) {
      if (this.collides(segments[i-1], segments[i], positions)) {
        positions[i] = this.resolveCollision(positions[i-1], segments[i]);
      }
    }
    
    return { positions };
  }
  
  private collides(seg1: Segment, seg2: Segment, positions: number[]): boolean {
    // Bounding box overlap check
    const bbox1 = seg1.boundingBox();
    const bbox2 = seg2.boundingBox();
    return bbox1.overlaps(bbox2);
  }
}
```

#### 2. Stem Direction

```typescript
export class StemDirection {
  // MuseScore algorithm: stems down for notes above center line
  static calculate(note: Note): 'up' | 'down' {
    const staffLine = this.pitchToStaffLine(note.pitch);
    const centerLine = 3; // 4th line from bottom (0-indexed)
    
    if (staffLine > centerLine) {
      return 'down'; // Note above center → stem down
    } else if (staffLine < centerLine) {
      return 'up';   // Note below center → stem up
    } else {
      // Note on center line: use majority rule
      return this.majorityRule(note);
    }
  }
  
  private static majorityRule(note: Note): 'up' | 'down' {
    const chord = note.parent as Chord;
    const notesAboveCenter = chord.notes.filter(
      n => this.pitchToStaffLine(n.pitch) > 3
    );
    return notesAboveCenter.length > chord.notes.length / 2 ? 'down' : 'up';
  }
}
```

#### 3. Fixed Measure Breaks (Simplified for MVP)

```typescript
export class MeasureBreaker {
  constructor(private measuresPerLine: number = 4) {}
  
  breakMeasures(measures: Measure[]): MeasureBreak[] {
    const breaks: MeasureBreak[] = [];
    let currentLine = 0;
    
    for (let i = 0; i < measures.length; i++) {
      if (i > 0 && i % this.measuresPerLine === 0) {
        currentLine++;
      }
      breaks.push({
        measureIndex: i,
        line: currentLine,
        x: (i % this.measuresPerLine) * MEASURE_WIDTH,
        y: currentLine * LINE_HEIGHT
      });
    }
    
    return breaks;
  }
}
```

## Consequences

### Positive

- **Real-world scores work**: Collision avoidance prevents unreadable output
- **Stem direction correct**: Professional appearance
- **Future-proof**: Can upgrade to dynamic measure breaks later

### Negative

- **Complexity**: Layout engine is ~10% of total codebase
- **Performance**: Collision detection is O(n²) per measure
- **Testing**: Visual regression tests required

### Neutral

- **MVP scope**: Still using fixed 4 measures/line (easy to change later)
- **MuseScore compatibility**: Spacing values match MuseScore defaults

## Alternatives Considered

### Alternative 1: Fixed Spacing (Original Plan)

**Rejected because**:
- Unreadable on dense scores (e.g., Bach chorales)
- Professional users will reject it
- MuseScore test fixtures fail visual regression

### Alternative 2: Full MuseScore Layout Algorithm

Include:
- Dynamic measure breaks (optimize for page turns)
- System-level layout (vertical spacing)
- Tuplet positioning

**Rejected because**:
- ~3 months additional work
- MVP needs basic functionality first
- Can add incrementally in Phase 6

### Alternative 3: External Library (VexFlow Layout)

**Rejected because**:
- VexFlow layout not designed for Pixi.js
- Limited control (hard to customize)
- We need deep integration with Score DOM

## Implementation Plan

1. **Phase 2.5** (2 weeks):
   - Implement `HorizontalSpacing` (collision detection)
   - Implement `StemDirection`
   - Add unit tests with MuseScore test fixtures

2. **Phase 3**:
   - Integrate layout with MusicXML import
   - Add visual regression tests

3. **Phase 6 (post-MVP)**:
   - Add dynamic measure breaks
   - Add tuplet positioning

## References

- [MuseScore `horizontalspacing.h`](file:///home/loop/挂载点/F/Codes/MuseScore/src/engraving/rendering/score/horizontalspacing.h)
- [MuseScore `stemlayout.h`](file:///home/loop/挂载点/F/Codes/MuseScore/src/engraving/rendering/score/stemlayout.h)
- [Gould, "Behind Bars", pp. 33-47] - Engraving standards
- Related: ADR-001 (Property System), ADR-004 (Type System)