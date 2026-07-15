# Domain Documentation

## Layout

**Single-context** — one `CONTEXT.md` at the repository root, with Architecture Decision Records (ADRs) in `docs/adr/`.

## Files

- `CONTEXT.md` — Project context, domain model, and key concepts
- `docs/adr/` — Architecture Decision Records

## Consumer Rules

1. Always read `CONTEXT.md` first when starting work on this repo
2. Check `docs/adr/` for relevant decisions before making architectural changes
3. Create new ADRs in `docs/adr/` using the format `NNNN-title.md` (e.g., `0001-use-tauri-for-desktop.md`)
