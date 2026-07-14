# Architecture Decision Records (ADRs)

This directory contains architectural decisions made during MuseScore notation module implementation.

## Index

- [ADR-001: Property System Design](./001-property-system-design.md) - Why we need Pid/PropertyValue abstraction
- [ADR-002: Multi-Pass MusicXML Import](./002-multipass-musicxml-import.md) - Why single-pass parsing fails
- [ADR-003: Layout Engine Scope](./003-layout-engine-scope.md) - Collision avoidance vs. fixed layout
- [ADR-004: Type System Granularity](./004-type-system-granularity.md) - How many element types for MVP
- [ADR-005: Link System Deferment](./005-link-system-deferment.md) - Multi-staff sync as post-MVP feature

## Process

Each ADR follows this structure:
1. **Status**: Proposed | Accepted | Deprecated | Superseded
2. **Context**: Problem statement
3. **Decision**: What we chose and why
4. **Consequences**: Impact on implementation
5. **Alternatives Considered**: Options we rejected

## Guidelines

- Create ADR before implementing major architectural changes
- Update status when decision changes
- Keep ADRs concise (< 2 pages)
- Link to relevant code/tests