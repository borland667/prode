# Roadmap

This roadmap starts from the current implemented product, not from a blank slate.

For the precise implementation snapshot, see `docs/IMPLEMENTATION_STATUS.md`.

## 1. Highest Priority

### 1.1 Finish Design-System Migration

Goal:

- bring all user-facing pages onto the shared design-system primitives and spacing rules

Priority targets:

- `src/pages/Predict.jsx`
- `src/pages/Leaderboard.jsx`
- `src/pages/Admin.jsx`
- `src/pages/LeagueInvite.jsx`
- remaining mobile navigation controls

Definition of done:

- no new one-off button or panel styling on those screens
- shared button, panel, page, and badge components used consistently
- old ad-hoc layout classes reduced where practical

### 1.2 Add Browser-Level E2E Coverage

Goal:

- complement the current Node integration and utility tests with true browser flow coverage

Priority flows:

- register/login/logout
- forgot-password/reset-password
- public tournament predictions
- private tournament join
- league create/join/invite
- primary-entry selection
- global ranking visibility toggle

## 2. Core Product Expansion

### 2.1 Introduce Explicit Tournament Format Families

Current limitation:

- the app stores generic sport and mode metadata, but only one football group-plus-knockout engine exists

Next step:

- model format families explicitly
- stop assuming all tournaments share the current bracket logic

Target formats after that:

- playoff-only brackets
- best-of-series brackets
- league-table competitions
- hybrid formats

### 2.2 Add A Second Engine

The first engine after football should be chosen intentionally.

Strong candidates:

- NBA-style playoff bracket
- NHL-style playoff bracket
- Champions League-style hybrid competition

## 3. Tournament Data Operations

### 3.1 Official Import Pipeline

Goal:

- move from curated seed data to repeatable imports

Needed:

- import format definition
- idempotent importer
- validation of groups, rounds, slots, and references
- import-vs-seed separation

### 3.2 Admin Bulk Tooling

Goal:

- reduce fragile manual JSON editing for tournament structure

Potential improvements:

- schema-guided JSON validation in the UI
- CSV or JSON upload helpers
- safer round/group editors

## 4. Prize And Payment Operations

Current state:

- prize toggles and entry-fee metadata exist
- no payment provider integration
- no payout lifecycle

Needed:

- payment capture
- paid-entry state
- prize split configuration if rules evolve
- settlement reporting

## 5. Communication And Notifications

Current state:

- password reset email support exists
- league sharing is currently link/code based

Needed:

- invite emails
- tournament close reminders
- leaderboard update notifications
- admin operational alerts

## 6. Operational Hardening

Needed:

- stronger audit trails for admin changes
- better observability around score recalculation and access errors
- migration and seed safety notes for more environments
- deployment playbooks beyond the local/dev path

## 7. Recommended Order

Recommended next sequence:

1. finish design-system migration
2. add browser E2E smoke tests
3. define format families
4. build the next tournament engine
5. introduce official import tooling
6. improve admin bulk tooling
7. add payment and prize operations
8. add broader notifications and operational workflows
