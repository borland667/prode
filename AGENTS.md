# AGENTS

This file captures the repository standards and implementation approach for Prode.

## 0. Agent Tools Reference

### Built-in Tools

The following tools are available in this agent:

- **read** - Read file contents
- **bash** - Execute bash commands
- **edit** - Make precise file edits with exact text matching
- **write** - Create or overwrite files
- **grep** - Search for patterns in files
- **find** - Find files and directories
- **ls** - List directory contents

### Commands

- `pi install <source>` - Install an extension
- `pi remove <source>` - Remove an extension
- `pi update` - Update pi and installed extensions
- `pi list` - List installed extensions
- `pi config` - Open TUI to enable/disable package resources
- `pi --help` - Show help for pi

### ❌ There is NO "submit" tool

**Important:** The agent does NOT have a `submit` tool. Any attempt to use `submit` will fail with the error "Tool submit not found".

**Alternative:** Use the `write` tool to save files, or the `bash` tool to execute shell commands.

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
- never apply production migrations from a local machine; the CI job is the only supported path so that migrations and the deployed Lambda bundle stay in lockstep

### Destructive Schema Changes

`DROP COLUMN`, `DROP TABLE`, renames, and type changes that are not
backward compatible must follow a two-step pattern so the deployed
Lambda is never out of sync with the live schema:

1. **PR A — stop using the column.** Ship code that no longer reads
   or writes the affected column. Schema and migrations are
   unchanged in this PR. Merge to `main`, wait for the new Lambda
   to deploy on Netlify, and verify the live `/api/...` endpoints
   no longer reference the column.
2. **PR B — drop the column.** Add the destructive Prisma migration
   in a follow-up PR. When CI runs `db:migrate:deploy` on this PR,
   the live Lambda is already on the column-free build, so the drop
   does not break in-flight requests.

Symmetric guidance applies to adding required columns: ship the
migration first (column added as nullable or with a default), wait
for the migrate job to finish, and only then ship the code that
treats the column as required.

### Production Deploy Pipeline

Production deploys are owned by GitHub Actions (`deploy-production`
job in `.github/workflows/ci.yml`), not Netlify's git auto-deploy.

Rules:

- never deploy by pushing a release branch through Netlify's UI
- the only supported deploy path on `main` is the GitHub Actions
  workflow; if it is skipped (missing secrets, gated false), do not
  shadow it with a manual `netlify deploy` from a workstation
- the deploy step uses `--skip-functions-cache` so the bundled
  Prisma client always matches the current schema; do not remove
  that flag
- the deploy step ends with a live-API smoke check; if it fails,
  the workflow fails red — investigate before re-running
- if you need to roll back, prefer `netlify api restoreSiteDeploy`
  via the Netlify CLI against a known-good deploy id rather than
  pushing a revert commit, which would re-run the migrate job too

Required GitHub secrets:

- `PRODUCTION_DATABASE_URL` (existing, gates migrate)
- `NETLIFY_AUTH_TOKEN` (gates deploy)
- `NETLIFY_SITE_ID` (gates deploy)

These three are the *only* env values that live in GitHub repo secrets.
Everything else needed by the build or runtime — `DATABASE_URL`,
`JWT_SECRET`, `SITE_URL`, `GOOGLE_*`, `RESULTS_IMPORT_API_KEY`, and the
`VITE_*` family — lives in the Netlify project env. The deploy job
shells out to `netlify deploy --prod --build`, which loads those values
into the Vite build and into the Functions runtime.

If `NETLIFY_AUTH_TOKEN` or `NETLIFY_SITE_ID` is missing, the deploy
job is skipped cleanly; the workflow stays green. Netlify's git
auto-deploy is disabled (`stop_builds: true`), so a skipped deploy
means no production update — never let the workflow stay green and
silent in that state.

#### `VITE_*` env vars must not be marked secret in Netlify

Vite reads env vars at build time only. Netlify's "secret" flag hides
the value from the build environment (it is only injected into
Functions at request time). Marking a `VITE_*` value as secret is
therefore a foot-gun: the build silently emits an empty string and
the deployed bundle ships with that feature broken — analytics, the
PostHog client, the Google client id check, etc.

Rule: every `VITE_*` env var in Netlify must be a regular env var.
Backend-only secrets (`DATABASE_URL`, `JWT_SECRET`,
`GOOGLE_CLIENT_SECRET`, `RESULTS_IMPORT_API_KEY`) should stay marked
secret. If you ever need to audit, run
`netlify env:list --context production --plain | grep '^VITE_'` —
any masked value (`****`) is a misconfiguration.

## 4. API And Data Safety

When changing API behavior:

- preserve access control semantics
- preserve tournament vs league scope isolation
- preserve primary-entry behavior
- preserve closed-tournament prediction locking
- keep admin structure edits blocked once a tournament has meaningful activity

### Authentication Security

When adding or modifying authentication flows:

- Google OAuth is disabled by default - it requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` to be configured together
- The frontend Google login button only appears when `VITE_GOOGLE_CLIENT_ID` is set
- Never expose `GOOGLE_CLIENT_SECRET` to the frontend (it's only used in the backend)
- The backend checks for complete OAuth configuration before enabling Google Passport strategy
- Frontend environment variables must not contain secrets - use `VITE_` prefix for non-secret values
- If any Google OAuth environment variables are missing or empty, Google OAuth is automatically disabled

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
- do not hardcode user-facing copy when the text should come from translations or API data
- do not add shell-level vignette or darkening overlays unless they are an intentional design-system surface pattern

Reference:

- `docs/DESIGN_SYSTEM.md`

## 6. Localization Standards

The app is multilingual and locale-aware.

Rules:

- all user-facing copy should support English, Spanish, Portuguese, Italian, and Dutch
- browser language detection should still fall back to English
- dates and numbers should use a regional locale when the browser provides one (for example `en-GB`, `pt-PT`); otherwise use sensible defaults per UI language
- terminology should remain audience-correct:
  - English: `soccer`
  - Spanish: `futbol`
  - Portuguese: `futebol`
  - Italian: `calcio`
  - Dutch: `voetbal`
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

## 10. Analytics Standards

Analytics must go through the shared frontend adapter, not direct vendor calls in pages.

Rules:

- use `src/utils/analytics.js` as the only provider integration point
- gate analytics with env vars
- keep provider choice separate from enabled/disabled state
- prefer explicit product events over broad vendor autocapture
- do not scatter vendor-specific APIs like `posthog.capture(...)` through route components
- if event taxonomy changes, update docs and QA notes

Current frontend analytics env contract:

- `VITE_ANALYTICS_ENABLED`
- `VITE_ANALYTICS_PROVIDER`
- `VITE_POSTHOG_KEY`
- `VITE_POSTHOG_HOST`

## 11. Preferred Engineering Approach

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
