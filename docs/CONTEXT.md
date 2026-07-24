# Apple HIG Refactoring — Context

## Overview

Full UI/layout/animation refactoring of the MIDI-JAR-NEW project to align with Apple Human Interface Guidelines. The refactoring established a four-layer design system (tokens → component overrides → motion presets → view application) on top of the existing daisyUI 5 + Tailwind CSS 4 + motion-v stack.

**Status:** Complete
**Build:** vite build succeeds (2.39s)
**TypeScript:** Zero new errors (one pre-existing error in `WaterfallPiano/engine/WaterfallEngine.ts:34` — unused variable, unrelated to this refactoring)

## Design System Architecture

### File Map

| Layer | File | Purpose |
|-------|------|---------|
| Tokens | `src/styles/hig-tokens.css` | Typography, radius, spacing, easing, duration, shadow, touch-target, status-container tokens |
| Theme | `src/styles/themes/apple.css` | `apple` (light, default) + `appleDark` (dark) daisyUI 5 themes with Apple system colors |
| Overrides | `src/styles/apple-components.css` | Apple-quality styling for all daisyUI components, scoped to `[data-theme="apple"]` |
| Entry | `src/styles/tailwind.css` | Imports tokens + theme + overrides; daisyUI plugin config; base styles; `.glass` utility; reduced-motion safety net |
| Motion | `src/utils/motion.ts` | All motion-v presets: easings, durations, springs, page/drawer/modal/card/stagger presets, `useMotionPresets()` with reduced-motion degradation |
| Motion UI | `src/components/motion/` | `MotionPageTransition`, `MotionStaggerList`, `MotionListItem`, `MotionDrawer`, `MotionModal` |

### Token Reference

**Typography** (`text-hig-*`):
- `2xs` 11px (badges only) / `xs` 12px (hints) / `sm` 13px (secondary) / `base` 14px (body) / `md` 16px (emphasis) / `lg` 18px (subtitle) / `xl` 22px (section) / `2xl` 28px (page) / `3xl` 36px (display) / `4xl` 48px (focus)

**Radius** (`rounded-hig-*`):
- `sm` 6px (inputs, badges) / `md` 10px (buttons, card elements) / `lg` 14px (cards, panels) / `xl` 20px (large containers, modals)

**Spacing** (`gap-hig-*` / `p-hig-*`):
- `1` 4px / `2` 8px / `3` 12px / `4` 16px / `5` 24px / `6` 32px / `7` 48px / `8` 64px

**Duration** (`duration-hig-*`):
- `instant` 80ms / `fast` 150ms / `normal` 220ms / `slow` 320ms

**Shadows** (`var(--shadow-hig-*)`):
- `2xs` / `xs` / `sm` / `md` / `lg` / `xl` / `2xl` (elevated opacity in dark mode)

**Status Containers** (`var(--hig-*-container)`):
- `success` / `warning` / `error` / `info` — color-mix derived from daisyUI semantic colors, auto-adapts to theme

### Motion Preset Reference

| Preset | Use Case | Key Properties |
|--------|----------|----------------|
| `cardHover` | Card hover/press | whileHover y:-4, whilePress scale:0.98, spring.soft |
| `modal` | Modal entrance | scale 0.96→1, spring.gentle |
| `overlayFade` | Drawer/modal backdrop | opacity 0→1, transition.fast |
| `pageFade` | Route transition | opacity+y, transition.page |
| `pageSlide(dir)` | Directional route | opacity+x, transition.page |
| `drawerRight`/`drawerLeft` | Side drawer | x slide, transition.panel |
| `sidebarCollapse` | Collapsible sidebar | width+opacity, transition.panel |
| `staggerContainer` | List orchestration | staggerChildren 60ms, delayChildren 40ms |
| `staggerItem` | List child | opacity+y 12→0 |

All presets flow through `useMotionPresets().resolve()` which degrades to opacity-only, zero-duration when `prefers-reduced-motion` is active.

## Views Refactored

| View | File | Key Changes |
|------|------|-------------|
| Home | `src/views/Home.vue` | Stagger grid, ModuleCard with cardHover |
| ModuleCard | `src/views/components/ModuleCard.vue` | motion.div cardHover, HIG typography, aura on hover |
| ChordDictionary | `src/views/ChordDictionary/` | MotionDrawer, sidebarCollapse, glass sidebars, HIG typography |
| ChordDisplay | `src/views/ChordDisplay/ChordDisplay.vue` | AnimatePresence chord crossfade, glass alt-chords, HIG typography |
| WaterfallPiano | `src/views/WaterfallPiano/WaterfallPiano.vue` | Glass floating toolbars, motion error modal (PixiJS untouched) |
| Sampler | `src/views/Sampler/Sampler.vue` | MotionStaggerList grid, cardHover, glass sidebar, HIG typography |
| Settings Layout | `src/views/Settings/Layout/SettingsLayout.vue` | Glass navbar, motion.a nav items, MotionPageTransition |
| Routing | `src/views/Settings/Routing/Routing.vue` | Segmented control, motion empty-state, motion modal, glass table (vue-flow untouched) |
| Debugger | `src/views/Settings/Debugger/Debugger.vue` | Glass toolbar, HIG typography (no motion on log entries) |
| AdvancedDebug | `src/views/Settings/AdvancedDebug/AdvancedDebug.vue` | Glass sticky toolbar, HIG typography, gap-hig-* spacing |
| App Shell | `src/App.vue` | MotionConfig with HIG transition + reduced-motion="user" |
| AppNavbar | `src/views/Layout/AppNavbar.vue` | Glass navbar, HIG radius/transitions, latency status dots |
| AppLayout | `src/views/Layout/AppLayout.vue` | MotionPageTransition on top-level routes |

## Constraints Honored

1. **Canvas piano only** — No SVG piano implementation; PixiJS engine code untouched
2. **daisyUI CSS variables** — All UI colors use `--color-*` variables; no hardcoded hex (except data defaults and platform-standard window controls)
3. **Piano settings** — `useThemeColors` and `gradientIntensity` fields preserved
4. **TypeScript** — Zero new errors/warnings introduced
5. **Custom cursor** — Left untouched per explicit decision
6. **Multi-theme** — All 35+ daisyUI themes retained; apple/appleDark are defaults

## Verification

- `vite build`: succeeds, 2.39s, all chunks generated
- `vue-tsc --noEmit`: zero errors in refactored files (one pre-existing error in `WaterfallPiano/engine/WaterfallEngine.ts:34`)
- No hardcoded hex colors in refactored views (verified via grep)
- No stale `components.d.ts` references (file does not exist in project)
- CSS import order verified: `tailwindcss` → `hig-tokens.css` → `apple.css` → `apple-components.css` → daisyUI plugin
