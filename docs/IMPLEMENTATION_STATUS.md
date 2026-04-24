# Implementation Status

Updated: 2026-04-24

This document answers two questions:

1. What is implemented and working today?
2. What is still next?

## 1. Product State Today

The app is already a usable football Prode platform with:

- seeded tournaments
- tournament predictions
- private leagues
- tournament and global leaderboards
- admin structure and results tooling
- auth, password recovery, and profile management

The current engine is not “all sports” yet. It is a football-focused engine wrapped in generic tournament metadata.

## 2. Working End To End

### 2.1 Identity And Account

Working:

- email/password registration
- email/password login
- logout
- Google OAuth when env vars are configured
- forgot-password flow
- reset-password flow
- profile editing
- avatar URL updates
- password change
- global ranking visibility toggle

### 2.2 Guest Experience

Working:

- browse home page without auth
- see featured tournament
- browse active tournaments
- see mode-aware rules on the landing page
- open tournament pages as a spectator
- switch light/dark mode
- switch language

### 2.3 Tournament Participation

Working:

- public tournament participation
- private tournament join with join code
- tournament-scope predictions
- prediction locking based on closing date/status
- tournament leaderboard
- spectator standings and knockout progress

### 2.4 League Participation

Working:

- create private league inside a tournament
- join league by code
- join league by invite link
- league-scope predictions
- copy an existing tournament or league prediction set into a private league scope
- league leaderboard
- regenerate league join code
- copy shareable invite link
- leave league
- owner delete league

### 2.5 Scoped Entry Model

Working:

- multiple prediction scopes per tournament
- tournament scope plus one or more league scopes
- copied league entries persist their own rows after the copy, so they can diverge safely later
- official primary-entry selection per user per tournament
- global rankings based on official entry only
- scope-aware score storage
- prediction deletion endpoint for clearing a scope before lock

### 2.6 Admin

Working:

- create tournaments from JSON structure input
- edit structure only before activity exists
- update tournament settings
- switch access between public/private
- manage tournament join code
- enable or disable prizes
- set entry fee and currency
- save group results
- save knockout results
- auto-recalculate scores on result save
- manual score recalculation

### 2.7 World Cup 2026 Support

Working:

- seeded World Cup 2026 data
- best-third-place Round of 32 handling
- valid bracket resolution based on third-place picks
- random-fill support that respects knockout consistency

### 2.8 Localization And Theming

Working:

- English, Spanish, Portuguese, Italian, and Dutch UI translation support
- browser language detection (first supported UI language in `navigator.languages`)
- regional locale formatting for dates and numbers when the browser supplies a matching regional tag; `languagechange` refreshes formatting
- English fallback
- dark and light themes
- persisted theme preference

### 2.9 Leaderboards And Board Switching

Working:

- shared `/leaderboard` hub for accessible tournament boards
- direct `/leaderboard/:id` links for tournament-specific entry points
- private league board switching inside the selected tournament
- global rankings separated from tournament and league boards

## 3. Automated Verification State

Working now:

- ESLint
- Prisma generate
- Prisma schema validation
- utility tests
- translation tests
- email helper tests
- API integration tests
- production build in CI

Command:

```bash
npm run verify
```

CI:

- GitHub Actions workflow runs `npm run verify`
- pushes to `main` also run `check-production-migrate` then `migrate-production` only when `PRODUCTION_DATABASE_URL` is set (gate job reads secret via `env` and outputs a boolean; migrate job `if` uses `needs` outputs)
- CI provisions PostgreSQL for tests

## 4. Design System State

The repo now has a real design-system layer:

- shared React primitives in `src/components/ui/DesignSystem.jsx`
- semantic runtime tokens and `ds-*` classes in `src/index.css`
- migration guide in `docs/DESIGN_SYSTEM.md`

Already migrated or aligned to the shared primitives:

- home
- navbar
- profile
- league page
- global leaderboard
- tournament page
- auth surfaces
- tournament leaderboard page
- prediction wizard
- league invite page
- admin page

Legacy alias classes still exist in CSS for compatibility, but the design system is now the default path for UI work.

## 5. Current Boundaries

The app is still limited by these product boundaries:

- only one tournament engine exists today
- the engine assumes group stage plus knockout
- seeded tournaments beyond World Cup 2026 are curated templates, not official imports
- payments and prize settlement are manual
- notifications and invites are not fully operationalized beyond copyable links and password-reset email support

## 6. Main Open Work

### 6.1 Format Engines

Still needed:

- playoff-only engine
- best-of-series engine
- league-table engine
- explicit format-family modeling instead of relying on one Prode engine

### 6.2 UI Consolidation

Still needed:

- continue removing old legacy styling aliases where shared components now exist
- finish mobile navigation consistency and small-screen polish
- keep sweeping for hardcoded user-facing copy where translations or API data should drive the UI

### 6.3 Imports And Operations

Still needed:

- official import pipeline
- idempotent external data refresh
- admin bulk import or validation tooling

### 6.4 Broader Testing

Still needed:

- browser E2E tests
- more edge-case API coverage
- regression coverage for admin structure editing and prediction locking UX

### 6.5 Prize Operations

Still needed:

- payment collection
- payout tracking
- settlement workflow

## 7. Recommended Immediate Next Steps

Recommended order:

1. add browser-level E2E smoke coverage for core user journeys
2. introduce explicit tournament format families
3. build import tooling for official tournament data
4. continue removing remaining legacy styling aliases and edge-case UI inconsistencies
5. add payment and payout operations if prizes become real-money workflows
