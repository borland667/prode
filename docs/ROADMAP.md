# Roadmap

This document tracks the most important next steps after the current Prode implementation.

## Current State

What is already in place:

- multi-tournament football catalog seed data
- tournament-mode-aware rules and scoring display
- World Cup 2026 best-third-place Round of 32 flow
- public and private tournaments
- private leagues inside tournaments
- email/password auth, Google OAuth, forgot-password, and reset-password
- profile editing and password change
- admin tournament builder and safe structure editing
- admin results entry and automatic score persistence
- bilingual UI with browser-language detection
- light and dark sports-oriented themes

## Priority Next Steps

### 1. Additional Tournament Engines

The biggest product gap is format support beyond the current football-style Prode engine.

Priority work:

- add a seeded-playoff engine for tournaments without groups
- add support for best-of-series rounds
- support league-table formats where standings matter more than knockout brackets
- model tournament format families explicitly instead of assuming one shared bracket engine

Examples this would unlock:

- NBA playoffs
- NHL playoffs
- MLB postseason
- UEFA Champions League league-phase or similar hybrid formats

### 2. Official Data Import Pipelines

Today, World Cup 2026 is the strongest seed and the rest are curated format-compatible templates.

Next-step work:

- define a repeatable import format for tournaments, teams, groups, and rounds
- support idempotent imports from official sources or curated files
- separate demo seed data from production import workflows
- add validation tooling for bracket-slot consistency

### 3. Automated Testing And CI

QA is still largely manual and documented in `docs/QA_CHECKLIST.md`, but the repo now has a CI baseline for lint, Prisma schema validation, core unit tests, and production build verification.

Next-step work:

- add API tests for auth, tournament access, predictions, leagues, and scoring
- add UI smoke tests for primary user flows
- expand CI beyond the current unit-test layer into broader behavioral tests
- block merges on failing checks where branch protection is enabled

### 4. Prize And Payment Operations

Prize configuration exists, but payment handling is still manual.

Next-step work:

- track paid entries explicitly
- support payment providers such as Stripe or Mercado Pago
- model payout rules and settlement status
- improve leaderboard and admin reporting for prize-bearing tournaments

### 5. Communication And Notifications

Useful follow-up capabilities:

- transactional emails for password reset in non-local environments
- tournament invite emails for private tournaments and leagues
- closing-date reminders
- result and leaderboard update notifications

## Product Improvements After Core Gaps

- richer tournament cards and sport-specific visual identity per format
- better admin bulk-edit/import tooling
- season archives and historical leaderboards
- audit trails for admin structure and result changes
- improved mobile ergonomics for large brackets

## Recommended Order

1. Add explicit tournament format families and the next tournament engine
2. Add automated tests and CI around the current engine
3. Add official import pipelines and validation tooling
4. Add payment and prize operations
5. Add notification and communication workflows
