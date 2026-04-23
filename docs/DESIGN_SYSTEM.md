# Design System

The app uses Tailwind CSS v4 through Vite. Styling should flow through the design-system layer in `src/index.css`, not through one-off hardcoded values in pages.

## Source Of Truth

- `:root` and `:root[data-theme='light']` define semantic runtime tokens such as `--text-main`, `--accent`, `--line-soft`, panel surfaces, shadows, and spacing.
- `@theme` exposes Tailwind tokens for colors, radii, shadows, typography, and tracking.
- `ds-*` classes are the canonical component API for layout primitives, panels, pills, display text, and buttons.
- Legacy `sport-*`, `app-*`, and `page-*` classes remain mapped to the same tokens while screens are migrated.

## Component Classes

- Use `ds-page`, `ds-page-narrow`, or `ds-page-md` for route containers.
- Use `ds-panel` for standard cards and `ds-panel-strong` for hero/feature panels.
- Use `ds-panel-pad`, `ds-panel-pad-compact`, and `ds-panel-pad-loft-top` for panel spacing.
- Use `ds-button ds-button-primary`, `ds-button-secondary`, `ds-button-ghost`, or `ds-button-danger` for actions.
- Use `ds-button-sm` only for intentionally compact controls.
- Use `ds-pill` and `ds-pill--compact` for small metadata labels.
- Use `ds-display` for uppercase sports display typography.

## React Components

Prefer the shared components from `src/components/ui/DesignSystem.jsx` when building or refactoring app screens:

- `PageShell` wraps route-level content and applies the correct page width/spacing.
- `Panel` wraps cards and feature panels with consistent surface, radius, and padding.
- `Button` renders primary, secondary, ghost, and danger actions with consistent sizing.
- `Pill` renders metadata badges and compact labels.
- `DisplayText` applies the sports display typography.

Use Tailwind utilities on these components for layout only, such as `grid`, `gap`, `w-full`, or responsive column definitions.

## Tailwind Usage Rules

- Prefer Tailwind utilities for layout only: grid, flex, responsive breakpoints, gaps, width, alignment, and visibility.
- Avoid hardcoded colors like `bg-emerald-500`, `text-slate-950`, or ad-hoc border colors in new UI. Add or reuse semantic tokens/classes instead.
- Avoid page-specific button sizing. Buttons should come from `ds-button*` classes and local layout wrappers should only control width.
- Avoid page-specific panel padding. Use `ds-panel-pad*` unless the component has a documented exception.
- If a visual pattern appears twice, promote it to `src/index.css` before tuning it in JSX.

## Migration Notes

The home page and auth surfaces now use the design-system layer first. Remaining routes can be migrated incrementally by replacing old aliases:

- `sport-panel` -> `ds-panel`
- `sport-panel-strong` -> `ds-panel-strong`
- `score-pill` -> `ds-pill`
- `sport-display` -> `ds-display`
- `page-shell` -> `ds-page`
- `page-panel-pad` -> `ds-panel-pad`
