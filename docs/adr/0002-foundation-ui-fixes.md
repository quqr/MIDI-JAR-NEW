# ADR-0002: Foundation UI Fixes — Contrast, Card Hierarchy, Background Layering, Motion Restraint

- **Status:** Accepted
- **Date:** 2026-07-24
- **Decision Makers:** Trae Design + Project Owner
- **Supersedes:** Partially revises ADR-0001 §Layer 2 (Card default shadow) and §Layer 4 (page transition)

## Context

After adopting the Apple HIG design system (ADR-0001), the owner reported that the
result was visually weak: poor text contrast, no background hierarchy, flat UI
component layering, and janky animations/transitions. A code audit confirmed the
root causes all lived in the **shared foundation layer**, not in individual views:

1. **Card hierarchy** — `apple-components.css` gave every `.card` a default
   `box-shadow: var(--shadow-hig-sm)`. Interactive cards added
   `shadow-hig-md` on hover. The two shadows were too close to distinguish,
   so cards never felt like they "lifted". This contradicts the Apple design
   library `card.json` rule: *"1px border defines the edge; shadow appears only
   on elevated or floating moments."*

2. **Text contrast** — 22 occurrences of `text-base-content/40` and `/50`
   across views. On the apple light background (`#1d1d1f` on `#ffffff`),
   `/40` ≈ 2.6:1 and `/50` ≈ 3.5:1 — both fail WCAG AA for normal text.

3. **Background hierarchy** — daisyUI defaults the page background to
   `--color-base-100` (`#ffffff`). `ModuleCard` also used `bg-base-100`.
   Card and page were the **same white**, so cards disappeared into the
   background and survived only on their border.

4. **Motion** — `MotionPageTransition` used `AnimatePresence mode="wait"` with a
   `pageFade` preset that animated `y: 8 → 0` on every route change. The
   vertical shift plus exit-then-enter sequencing made page transitions feel
   janky. Separately, `ModuleCard` carried `hover:aura aura-rainbow` classes
   that are **not defined anywhere** in the codebase (`aura` only exists as a
   PixiJS note-glow concept) — dead decorative classes.

The owner's instruction was "fix page by page", but a `/grilling` session
confirmed that fixing these four issues *inside each view* would duplicate the
same edit across 10+ files and re-introduce the inconsistency that caused the
original bugs.

## Decision

Adopt a **foundation-first** repair strategy: fix the four issues once in the
shared layer, then verify and polish page by page. Five binding rules:

### Rule 1 — Strategy: foundation-first, then page-by-page verification
Shared tokens/overrides are fixed centrally (one source of truth). Each view is
then verified against the new foundation and receives only page-specific polish.
This is the inverse of the failed per-view approach.

### Rule 2 — Card: border-defined, shadow on hover only
- `.card` default: `1px solid var(--color-base-300)`, **no box-shadow**.
- Interactive cards opt into hover lift (border → `primary/50`, shadow →
  `--shadow-hig-md`, subtle `translateY`). Non-interactive cards stay flat.
- Aligns with Apple design library `card.json`.

### Rule 3 — Contrast ladder: floor /60 (WCAG AA)
| Role | Opacity of `--color-base-content` |
|------|-----------------------------------|
| Headings / titles | 100% |
| Body / primary | /80 |
| Secondary / labels | /70 |
| Muted / hints / placeholder | /60 (minimum) |

`/60` yields ≈ 4.8:1 on apple light and ≈ 6.6:1 on appleDark — both pass AA.
All existing `/40` and `/50` text usages are bumped to `/60`.

### Rule 4 — Background: Apple grouped (gray page, white cards)
- App content background → `--color-base-200` (`#f2f2f7` light / `#2c2c2e` dark),
  the iOS "grouped background".
- Cards / panels / inputs → `--color-base-100` (white), so they naturally lift
  off the gray grouped background.
- **Full-bleed visual pages** (`WaterfallPiano`, `ChordDisplay`) are exempt —
  they manage their own canvas background.

### Rule 5 — Motion: purposeful, not decorative
- `pageFade` becomes **opacity-only** (remove `y` translation) to eliminate
  vertical jitter on route changes.
- Keep `mode="wait"` fade-through (clean, no layout overlap issues).
- Retain hover/press micro-interactions (`cardHover`).
- Stagger entrance runs on first load only (no re-trigger on revisit).
- Remove dead `hover:aura aura-rainbow` classes from `ModuleCard`.

## Consequences

### Positive
- One edit per rule fixes the issue across every view — no duplication.
- Cards now have a clear default → hover depth jump.
- All text meets WCAG AA on both themes.
- White cards visibly separate from the grouped gray background.
- Page transitions are calm crossfades, not janky slides.

### Negative
- Setting the body background to `base-200` means every page must be re-verified:
  pages that assumed a white background may need their root surface set to
  `base-100` explicitly (handled in page-by-page verification).
- Removing the default `.card` shadow means non-interactive cards rely entirely
  on border + background contrast for definition (acceptable per Apple HIG).

## Alternatives Considered

1. **Strict page-by-page** — rejected: duplicates the same foundation fix across
   10+ files; reintroduces the inconsistency that caused the original bugs.
2. **Keep default card shadow, sharpen it** — rejected: a lighter default shadow
   still doesn't separate from the hover shadow clearly; violates the Apple
   "shadow only on float" rule.
3. **Contrast floor /50** — rejected: `/50` ≈ 3.5:1 on white still fails AA.
4. **Crossfade page transition with absolute positioning** — rejected: requires
   restructuring the layout shell to overlap exiting/entering pages; the
   opacity-only `mode="wait"` fade-through achieves the calm feel with far less
   risk.
