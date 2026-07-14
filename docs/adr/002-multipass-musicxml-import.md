# ADR-002: Multi-Pass MusicXML Import

**Status**: Proposed
**Date**: 2026-07-14
**Decision Makers**: Architecture Team

## Context

MusicXML format contains **forward references** that cannot be resolved in a single pass:

1. **Spanners**: Slurs, ties, hairpins defined at start position but need end position
2. **Grace notes**: Must attach to parent chord (defined later)
3. **Voice assignments**: Notes grouped into voices, voices assigned to staves
4. **Cross-staff notation**: Notes on staff 1 might belong to staff 2

MuseScore uses **two-pass import**:
- `importmusicxmlpass1.cpp` - Structural parsing
- `importmusicxmlpass2.cpp` - Element resolution

OSMD (OpenSheetMusicDisplay) handles this internally, but we need explicit control for:
- Error recovery (continue on malformed MusicXML)
- Partial import (extract only metadata)
- Round-trip testing (verify import → export → import)

## Decision

We will implement **two-pass MusicXML import**:

```typescript
export class MusicXmlImportPass1 {
  async parse(xmlString: string): Promise<ScoreMetadata> {
    // Extract structure only (no note-level data):
    // - Title, composer, tempo
    // - Part list → Part[]
    // - Measure count
    // - Time signatures, key signatures
    // - Clefs, staves
  }
}

export class MusicXmlImportPass2 {
  async parse(
    xmlString: string, 
    metadata: ScoreMetadata
  ): Promise<Score> {
    // Resolve forward references:
    // - Notes → voice assignments
    // - Spanners (slurs, ties) → start/end positions
    // - Grace notes → parent chords
    // - Cross-staff notation
  }
}
```

### Implementation Pattern

```typescript
export class OsmScoreAdapter {
  static async fromMusicXml(xmlString: string): Promise<Score> {
    // Pass 1: Structure
    const pass1 = new MusicXmlImportPass1();
    const metadata = await pass1.parse(xmlString);
    
    // Create empty score from metadata
    const score = new Score(metadata.config);
    
    // Pass 2: Element resolution
    const pass2 = new MusicXmlImportPass2();
    await pass2.parse(xmlString, score);
    
    return score;
  }
}
```

## Consequences

### Positive

- **Forward references resolved**: Slurs, ties, grace notes work correctly
- **Error recovery**: Pass 1 can succeed even if Pass 2 fails
- **Performance**: Pass 1 is fast for metadata extraction (no note parsing)
- **Testing**: Can test passes independently

### Negative

- **Complexity**: Two classes instead of one
- **Memory**: XML string kept in memory for both passes
- **OSMD duplication**: We're not using OSMD's internal multi-pass

### Neutral

- **OSMD integration**: Pass 1 could use OSMD's `Sheet.metadata`, Pass 2 uses full parsing

## Alternatives Considered

### Alternative 1: Single-Pass with Backpatching

```typescript
// During parsing:
const slurStart = new Slur(); // Created without end
pendingSlurs.push(slurStart);

// After parsing:
for (const slur of pendingSlurs) {
  slur.resolveEnd();
}
```

**Rejected because**:
- Complex backpatching logic (hard to debug)
- Error-prone (easy to forget unresolved references)
- Memory leak risk (pending list never cleared)

### Alternative 2: Full OSMD Delegation

```typescript
const osmd = new OpenSheetMusicDisplay(container);
await osmd.load(xmlString);
const score = OsmScoreAdapter.fromOsmSheet(osmd);
```

**Rejected because**:
- No control over import process
- Cannot implement custom error recovery
- Difficult to test import logic separately

### Alternative 3: SAX Streaming Parser

```typescript
const parser = new MusicXmlSaxParser();
parser.on('note', (note) => score.addNote(note));
parser.parse(xmlString);
```

**Rejected because**:
- Forward references require buffering anyway
- SAX complexity not worth it for <10MB files
- OSMD already uses DOM parser (well-tested)

## Implementation Plan

1. **Phase 3.5** (1 week):
   - Implement `MusicXmlImportPass1`
   - Implement `MusicXmlImportPass2`
   - Add unit tests with forward references

2. **Phase 3**:
   - Integrate passes into `OsmScoreAdapter`
   - Test with MuseScore test fixtures

## References

- [MuseScore `importmusicxmlpass1.cpp`](file:///home/loop/挂载点/F/Codes/MuseScore/src/importexport/musicxml/internal/import/importmusicxmlpass1.cpp)
- [MuseScore `importmusicxmlpass2.cpp`](file:///home/loop/挂载点/F/Codes/MuseScore/src/importexport/musicxml/internal/import/importmusicxmlpass2.cpp)
- [MusicXML 4.0 Specification](https://www.w3.org/2021/06/musicxml40/)
- Related: ADR-001 (Property System)