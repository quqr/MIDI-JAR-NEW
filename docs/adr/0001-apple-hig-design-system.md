# ADR-0001: Apple HIG Design System Adoption

- **Status:** Accepted
- **Date:** 2026-07-24
- **Decision Makers:** Trae Design + Project Owner
- **Supersedes:** None

## Context

The MIDI-JAR-NEW project is a desktop MIDI application (Tauri + Vue 3 + TypeScript) with multiple feature views: ChordDictionary, ChordDisplay, WaterfallPiano, Sampler, Settings (General, Cursor, Notation, ChordDictionary, ChordDisplay, WaterfallPiano, AdvancedDebug, Routing, Debugger), and a Home dashboard.

Prior to this refactoring, the UI suffered from:
- Inconsistent typography scales (ad-hoc `text-xs`, `text-sm`, `text-lg` with no system)
- Hardcoded hex colors scattered across components (violating the project constraint that all colors must use daisyUI CSS variables)
- No unified animation system (CSS transitions and ad-hoc keyframes with varying durations and easings)
- Inconsistent border-radius values (mixed `rounded-lg`, `rounded-box`, inline styles)
- No `prefers-reduced-motion` handling beyond a single global CSS media query
- No cohesive material/depth language (flat backgrounds, no glass, no shadow hierarchy)

The project already used daisyUI 5 + Tailwind CSS 4, which provided a theming foundation, but no theme was aligned to a recognized design language.

## Decision

Adopt **Apple Human Interface Guidelines (HIG)** as the project's design language, implemented as a layered design system on top of the existing daisyUI 5 + Tailwind CSS 4 + motion-v stack.

### Architecture: Four-Layer Design System

```
Layer 4: View Components (per-view Apple-ification)
    ↑ uses
Layer 3: Motion Presets (src/utils/motion.ts)
    ↑ uses
Layer 2: Apple Component Overrides (src/styles/apple-components.css)
    ↑ uses
Layer 1: Design Tokens + Apple Theme (src/styles/hig-tokens.css + themes/apple.css)
    ↑ built on
Layer 0: daisyUI 5 + Tailwind CSS 4
```

### Layer 1: Design Tokens + Theme

**HIG Tokens** (`src/styles/hig-tokens.css`):
- Typography scale: 11 levels (`text-hig-2xs` through `text-hig-5xl`), minimum 12px for readability, 13px+ for body text
- Radius scale: 4 levels (`rounded-hig-sm` 6px / `rounded-hig-md` 10px / `rounded-hig-lg` 14px / `rounded-hig-xl` 20px)
- Spacing scale: 8 levels on a 4px baseline (`gap-hig-1` through `gap-hig-8`)
- Easing curves: `--ease-hig-standard` cubic-bezier(0.2,0.8,0.2,1) / `--ease-hig-emphasized` cubic-bezier(0.3,0,0,1) / `--ease-hig-exit` cubic-bezier(0.4,0,1,1)
- Duration tokens: 80ms / 150ms / 220ms / 320ms (instant/fast/normal/slow)
- Shadow hierarchy: 6 levels (2xs through 2xl), with elevated opacity for dark mode
- Touch targets: 32px/36px/40px/44px minimums
- Status container colors: color-mix derived from daisyUI semantic colors (auto-adapts to theme)

**Apple Theme** (`src/styles/themes/apple.css`):
- Two daisyUI 5 themes: `apple` (light, default) and `appleDark` (dark, prefersdark)
- System colors: Blue #007AFF/#0A84FF, Green #34C759/#30D158, Red #FF3B30/#FF453A, Orange #FF9500/#FF9F0A
- System grays: #FFFFFF/#f2f2f7/#e5e5ea/#1d1d1f (light) / #1c1c1e/#2c2c2e/#3a3a3c/#f5f5f7 (dark)
- All exposed as daisyUI CSS variables (`--color-primary`, `--color-base-100`, etc.)

### Layer 2: Apple Component Overrides

`src/styles/apple-components.css` — scoped to `[data-theme="apple"], [data-theme="appleDark"]`:
- Button: 600 font-weight, HIG radius, shadow-xs, brightness-based hover/active states
- Card: HIG box radius, base-300 border, shadow-sm, transition on transform/shadow
- Modal: HIG radius, shadow-2xl, base-100 background
- Drawer: glass material (blur20 saturate180%)
- Menu: HIG item radius, 6% content-mix hover, 600 weight active
- Input/Select/Textarea: HIG radius, 44px min-height, Apple Blue focus ring (3px 30% primary halo)
- Toggle/Checkbox/Radio: primary color, smooth transitions
- Range: accent-color primary
- Table: base-200 header, hairline borders, 4% hover, tabular-nums for numbers
- Alert: status container backgrounds, HIG radius
- Badge: pill (9999px), 600 weight
- Glass: blur20 saturate180%, 72% base-100 translucent (68% in dark)
- Tabular: tabular-nums + JetBrains Mono

### Layer 3: Motion Presets

`src/utils/motion.ts` — single source of truth for all motion-v animations:
- Easing constants aligned to HIG
- Spring presets: soft (cards, stiffness 300/damping 26), gentle (panels/modals, 200/24), snappy (press, 500/30)
- Transition presets: micro/fast/panel/page/exit with HIG durations
- Animation presets: pageFade, pageSlide(direction), drawerRight/Left, sidebarCollapse, modal, overlayFade, cardHover
- Stagger orchestration: staggerContainer (60ms stagger, 40ms delay) + staggerItem
- `useMotionPresets().resolve(preset)`: automatically degrades to opacity-only, zero-duration transitions when `prefers-reduced-motion` is active

Motion components (`src/components/motion/`):
- `MotionPageTransition`: route-keyed AnimatePresence page transitions
- `MotionStaggerList` / `MotionListItem`: orchestrated list entrance animations
- `MotionDrawer`: animated side drawer with overlay
- `MotionModal`: animated modal with scale entrance

### Layer 4: View Apple-ification

All views refactored to use HIG tokens, motion presets, glass material, and daisyUI semantic colors:
- **Home + ModuleCard**: stagger grid, cardHover micro-interaction, HIG typography
- **ChordDictionary**: MotionDrawer for mobile, sidebarCollapse animation, glass sidebars, HIG typography
- **ChordDisplay**: AnimatePresence chord-name crossfade, glass alt-chords panel, HIG typography
- **WaterfallPiano**: glass floating toolbars, motion error modal, HIG typography (PixiJS engine untouched)
- **Sampler**: MotionStaggerList grid, cardHover, glass sidebar, radial-progress, HIG typography
- **Settings Layout**: glass navbar, motion.a nav items with spring.soft, MotionPageTransition
- **Routing**: segmented control, motion empty-state, motion modal, glass table headers (vue-flow untouched)
- **Debugger**: glass toolbar, HIG typography, no motion on high-frequency log entries
- **AdvancedDebug**: glass sticky toolbar, HIG typography, gap-hig-* spacing

### Key Decisions

1. **Multi-theme preserved**: All 35+ daisyUI themes retained; apple/appleDark added as defaults. Users can switch themes; Apple overrides only apply to apple/appleDark themes.

2. **No SVG piano**: Per project constraint, piano UI uses Canvas (PixiJS) exclusively. The refactoring did not touch PixiJS engine code.

3. **No hardcoded hex**: All UI colors use daisyUI CSS variables. The only hex values remaining are data defaults (e.g., track color fallback `#000000`) and Tauri window control close-button red (`#e81123`, platform-standard).

4. **Custom cursor preserved**: The custom cursor component was left untouched per explicit decision.

5. **System font stack**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto` for sans; `JetBrains Mono Variable` for monospace.

6. **Reduced-motion first**: Every motion preset flows through `useMotionPresets().resolve()` which checks `prefers-reduced-motion` and degrades to opacity-only transitions. The global CSS also has a `prefers-reduced-motion` media query as a safety net.

## Consequences

### Positive
- Consistent visual language across all views
- Type-safe animation system with single source of truth
- Automatic dark mode support via daisyUI theme switching
- Accessibility built-in (44px touch targets, focus rings, reduced-motion)
- No vendor lock-in — all built on daisyUI + Tailwind + motion-v
- Existing themes still work for users who prefer them

### Negative
- Apple overrides add CSS specificity complexity (`:is([data-theme="apple"], ...)` selectors)
- motion-v adds ~126KB to the bundle (gzipped ~41KB)
- Two glass definitions exist (base `.glass` in tailwind.css + Apple override in apple-components.css) — the Apple one wins via specificity for apple themes

### Risks
- daisyUI 5 `@plugin "daisyui/theme"` syntax must remain stable across updates
- PixiJS color adaptation assumes theme CSS variables are readable at runtime (validated in themeColors.ts)

## Alternatives Considered

1. **Material Design 3**: Rejected — less aligned with the macOS desktop target audience; Apple HIG feels native on the intended platform.

2. **Single custom theme (no daisyUI)**: Rejected — would lose daisyUI's component ecosystem and require rebuilding all component styles from scratch.

3. **CSS-in-JS animation (e.g., GSAP)**: Rejected — motion-v integrates natively with Vue's reactivity system and supports `prefers-reduced-motion` out of the box.

4. **Incremental per-view migration**: Rejected — inconsistent intermediate states would confuse users; full migration ensures coherence.
