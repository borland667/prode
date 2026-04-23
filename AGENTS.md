# AGENTS

This file captures the repository standards and implementation approach for Prode.

## 1. Product Orientation

Prode currently supports one prediction engine:

- football group stage plus knockout bracket

Do not assume that generic `sport`, `modeKey`, or tournament metadata means every sport format is implemented. The system is intentionally moving toward more generic tournament support, but the current runtime engine is still football-first.

## 2. Core Domain Rules

These rules must be preserved when changing product behavior:

- tournament predictions and league predictions are separate scopes
- `scopeKey = "tournament"` is the tournament-wide scope
- `scopeKey = "league:<leagueId>"` is a league-specific scope
- league scopes may copy an existing saved prediction set, but still persist their own rows after the copy
- each user has one official primary entry per tournament
- global rankings use the official primary entry only
- opting into global rankings is controlled by `showInGlobalRankings`
- private tournaments require membership before participation
- tournament structure becomes immutable once participation, predictions, scores, leagues, or results exist

## 3. Database And Migrations

Use a migration-first workflow.

Required approach for schema changes:

1. update `prisma/schema.prisma`
2. create a checked-in Prisma migration
3. regenerate the Prisma client if needed
4. run verification
5. update docs if behavior changed

Rules:

- prefer `npm run db:migrate`
- prefer `npm run db:migrate:deploy` for applying checked-in migrations
- avoid `db push` as the normal workflow
- never make undocumented schema changes
- production migrations should run from GitHub Actions on `main` using the `PRODUCTION_DATABASE_URL` GitHub secret
- production migration automation must be secret-gated and skip cleanly when the required secret is not configured

## 4. API And Data Safety

When changing API behavior:

- preserve access control semantics
- preserve tournament vs league scope isolation
- preserve primary-entry behavior
- preserve closed-tournament prediction locking
- keep admin structure edits blocked once a tournament has meaningful activity

If an API change affects frontend flows or operational behavior, update:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/QA_CHECKLIST.md`
- `docs/IMPLEMENTATION_STATUS.md` or `docs/ROADMAP.md` as appropriate

## 5. UI And Design System

UI changes must go through the design system first.

Preferred primitives:

- `PageShell`
- `Panel`
- `Button`
- `Pill`
- `DisplayText`

Canonical styling rules:

- use `ds-*` classes and semantic tokens from `src/index.css`
- prefer extending shared styles before adding page-specific one-offs
- do not introduce new hardcoded colors or bespoke button styles when a shared variant should exist
- when a new visual pattern appears more than once, promote it into the design system

Reference:

- `docs/DESIGN_SYSTEM.md`

## 6. Localization Standards

The app is bilingual and locale-aware.

Rules:

- all user-facing copy should support English and Spanish
- browser language detection should still fall back to English
- dates and numbers should be locale-aware
- terminology should remain audience-correct:
  - English: `soccer`
  - Spanish: `futbol`
- translated tournament, round, mode, and team names should be respected when available

If new product copy is added, update translations.

## 7. Seed Data Standards

Current seed behavior:

- World Cup 2026 is the strongest seeded experience
- additional tournaments are curated, format-compatible football seeds
- not all seeded data is a live official import

When changing seeds:

- be explicit about whether data is official, curated, or template-only
- keep seed runs idempotent enough for local development
- update docs if the seeded catalog or assumptions change

## 8. Testing Expectations

Before considering work complete, prefer running:

```bash
npm run verify
```

At minimum for focused UI work:

- `npm run lint`
- `npm run build`

If behavior changes in API flows, predictions, access control, or scoring, also consider:

- `npm test`

## 9. Documentation Standards

Documentation must track the implemented system, not an outdated plan.

Whenever behavior changes:

- update setup docs if env, commands, seed, or DB behavior changed
- update architecture docs if routes, schema, scopes, or API behavior changed
- update QA docs if test flows changed
- update roadmap/status docs if project state or priorities changed

Current documentation map:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/QA_CHECKLIST.md`
- `docs/ROADMAP.md`
- `docs/DESIGN_SYSTEM.md`

## 10. Preferred Engineering Approach

Prefer:

- small, safe iterations
- shared abstractions over duplicated fixes
- migration-first schema work
- documentation parity with implementation
- honest status reporting about what is and is not implemented

Avoid:

- pretending generic multi-sport support exists when it does not
- bypassing the design system for expedient UI tweaks
- schema drift without migrations
- undocumented API or product-rule changes
