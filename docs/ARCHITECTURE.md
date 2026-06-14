# Prode Architecture

Version: 2026-06-13  
Status: implementation-aligned snapshot

## 1. Product Scope

Prode is currently built around a single tournament engine: football-style group-stage plus knockout prediction flows.

Supported today:

- group placement predictions
- knockout winner predictions
- optional best-third-place qualifier placement
- tournament-wide public or private access
- tournament-scoped private leagues
- one official entry per user per tournament for tournament and global rankings

Not supported yet:

- playoff-only engines without groups
- best-of-series formats
- pure round-robin or league-table competitions without a knockout bracket
- official live data ingestion
- payment processing and automated prize settlement

The product stores generic `sport`, `modeKey`, and `modeName` metadata, but those currently map back to the football Prode engine.

## 2. High-Level System

```text
React SPA
  ├─ ThemeProvider
  ├─ AuthProvider
  ├─ LanguageProvider
  ├─ AnalyticsBridge
  ├─ Navbar
  └─ Route pages
         │
         ▼
Express API (/api/*)
  ├─ Auth and profile
  ├─ Tournament access and serialization
  ├─ Prediction persistence by scope
  ├─ League lifecycle
  ├─ Leaderboards and global rankings
  ├─ Admin tournament builder and results
  └─ Score calculation
         │
         ▼
Prisma ORM
         │
         ▼
PostgreSQL
```

## 3. Frontend Architecture

### 3.1 Runtime Providers

The app root is composed as:

```text
Router
└─ ThemeProvider
   └─ AuthProvider
      └─ LanguageProvider
         ├─ Navbar
         └─ Routes
```

Provider responsibilities:

- `ThemeProvider`: light/dark theme resolution and persistence
- `AuthProvider`: current user, token lifecycle, refresh, login, register, logout
- `LanguageProvider`: language selection, browser locale detection, localized dates and numbers, translations
- `AnalyticsBridge`: env-gated client analytics initialization, pageview capture, user identification, and shared context registration

### 3.2 Route Map

Current routes in `src/App.jsx`:

- `/`
- `/login`
- `/register`
- `/verify-email`
- `/forgot-password`
- `/reset-password`
- `/tournament/:id`
- `/tournament/:id/predict`
- `/leaderboard`
- `/leaderboard/:id`
- `/leaderboard/global`
- `/league/:id`
- `/league/:id/predict`
- `/league/invite/:joinCode`
- `/profile`
- `/admin`

### 3.3 Page Responsibilities

- `Home.jsx`
  - featured tournament
  - rules by tournament mode
  - active tournaments discovery
  - guest and authenticated CTA entry points
- `Tournament.jsx`
  - tournament metadata
  - tournament-wide official entry controls
  - create/join league controls
  - group and knockout spectator view
- `Predict.jsx`
  - tournament-scope or league-scope prediction wizard
  - random-fill support
  - best-third-place slot handling
- `Leaderboard.jsx`
  - shared standings hub
  - tournament-wide leaderboard
  - private league board switcher within the selected tournament
- `GlobalLeaderboard.jsx`
  - authenticated global ranking
  - visibility-aware summary
- `League.jsx`
  - league summary
  - invite link and join code
  - league settings and actions
  - league leaderboard
- `LeagueInvite.jsx`
  - direct invite link flow
- `Profile.jsx`
  - identity editing
  - password change
  - global ranking visibility preference
- `Admin.jsx`
  - tournament creation
  - safe structure editing
  - settings updates
  - result entry
  - manual score recalculation

### 3.4 Styling Model

The UI uses Tailwind CSS v4 through Vite plus semantic design-system classes in `src/index.css`.

Canonical UI primitives:

- `PageShell`
- `Panel`
- `Button`
- `Pill`
- `DisplayText`

User-facing copy should come from translations or API data, not hardcoded tournament- or route-specific strings embedded in JSX.

See `docs/DESIGN_SYSTEM.md`.

### 3.5 Analytics

Analytics is provider-abstracted through `src/utils/analytics.js`.

Current behavior:

- the app can run with analytics disabled
- PostHog is the first supported provider
- route pageviews are captured centrally instead of per-page vendor snippets
- product events are emitted from page/action success points through the shared adapter

Current env contract:

- `VITE_ANALYTICS_ENABLED=true|false`
- `VITE_ANALYTICS_PROVIDER=posthog|none`
- `VITE_POSTHOG_KEY`
- `VITE_POSTHOG_HOST` (defaults to the US PostHog host if omitted)

## 4. Backend Architecture

The backend is a single Express app in `api/app.cjs` with:

- auth and account endpoints
- tournament listing and detail serialization
- prediction load/save/delete endpoints
- primary-entry selection endpoints
- tournament join flow
- league lifecycle endpoints
- leaderboard endpoints
- admin tournament builder endpoints
- admin result and settings endpoints
- health endpoint

Runtime entry points:

- local server: `api/server.cjs`
- Netlify wrapper: `netlify/functions/prode-http.cjs` (not `api`, to avoid clashing with the `api/` app folder in the function bundle)

## 5. Authentication And Session Model

Supported auth methods:

- email/password
- Google OAuth when configured

Auth implementation:

- JWT signed with `JWT_SECRET`
- token accepted from HTTP-only cookie or `Authorization: Bearer ...`
- frontend also stores the returned token for API calls
- email/password signup requires email verification only when SMTP/email transport config is present; otherwise registration falls back to the legacy immediate-login behavior
- Google OAuth users are treated as verified automatically
- Google OAuth is enabled only when `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` are all configured
- the public callback should align with `SITE_URL`, typically `${SITE_URL}/api/auth/google/callback` on Netlify because `/api/*` is rewritten to the Express function wrapper
- OAuth failures redirect back to `${SITE_URL}/login?error=google_auth_failed` so the SPA can show a translated error state

Password reset:

- one-time hashed reset tokens stored in `PasswordResetToken`
- TTL currently one hour
- can send email through SMTP or return a local reset URL for non-production testing

Email verification:

- one-time hashed verification tokens stored in `EmailVerificationToken`
- TTL currently 24 hours
- `POST /api/auth/verify-email` consumes the token and sets `User.emailVerifiedAt`
- `POST /api/auth/resend-verification` issues a fresh token from the `/verify-email` page when delivery failed or expired

## 6. Access Control Model

### 6.1 Tournament Access

Tournament access is derived from:

- `Tournament.accessType`
- whether the viewer is a `TournamentMember`
- whether the viewer is an admin
- whether the tournament lifecycle is open or closed

Tournament access flags returned by the API include:

- `canJoin`
- `canViewLeaderboard`
- `canViewPredictions`
- `canSubmitPredictions`

There is no tournament-wide prediction lock. Predictions lock granularly
per match (once kickoff passes) and per group (once any group-stage
match has kicked off). Locking flags are exposed on serialized matches
and groups via `match.predictionLocked` and `group.predictionLocked`;
see §7.5.

### 6.2 League Access

League access is derived from:

- tournament participation access
- league membership
- ownership

League endpoints are authenticated. League leaderboards are only available to league members and authorized owners/admins.

### 6.3 Global Rankings Privacy

Global rankings require authentication and only include users with:

- `showInGlobalRankings = true`
- a valid official scope for at least one tournament

Users can opt out from the profile page.

## 7. Prediction Scope Model

This is one of the most important current architectural rules.

### 7.1 Scope Keys

Predictions, scores, and official-entry selection are scoped by `scopeKey`.

Current scope forms:

- `tournament`
- `league:<leagueId>`

This means a user can hold:

- one tournament-wide prediction set
- zero or more league-specific prediction sets

for the same tournament.

### 7.2 Stored Scoped Data

Scoped models:

- `GroupPrediction.scopeKey`
- `KnockoutPrediction.scopeKey`
- `Score.scopeKey`
- `TournamentPrimaryEntry.scopeKey`

### 7.3 Primary Entry

`TournamentPrimaryEntry` stores which scope currently counts as the user’s official tournament entry.

Implications:

- the tournament leaderboard uses the tournament-wide scope
- league leaderboards use their own league scope
- global rankings use the user’s official scope per tournament
- multiple league entries do not multiply a user’s global score

### 7.4 Prediction Deletion

Predictions can be cleared by scope before lock using:

- `DELETE /api/predictions/:id`

The backend resolves the target scope and removes:

- group predictions for that scope
- knockout predictions for that scope
- the score row for that scope

If the removed scope was the official primary entry, the backend falls back to another available scope when possible.

### 7.5 Prediction Locking

Locking is strictly per match. There is no tournament-wide hard cap:
`Tournament.status` and the lifecycle metadata describe the tournament
but do not block prediction submissions.

The rules in `api/locking.cjs`:

- a knockout match locks the moment `match.matchDate <= now`
- a match also locks if an admin has flipped `Match.predictionsClosed`
  to `true` via `PATCH /api/tournaments/:id/matches/:matchId` (admin-only)
- a group's 1°/2°/3° prediction locks as soon as any of its group-stage
  matches between two of its teams has locked — by kickoff time or by an
  admin closing one of them
- a match with `matchDate = null` and `predictionsClosed = false` stays
  open until the importer or admin acts on it

`serializeRounds` and `serializeGroups` attach `predictionLocked: boolean`
to every match and group in the API response so clients can render those
tiles read-only.

`savePredictionsForScope` recomputes the lock state on every submit and
applies these rules:

1. payload entries for locked groups or matches are dropped silently —
   stale clients can never overwrite a pick once kickoff has passed
2. existing locked rows are preserved untouched in the DB
3. only the unlocked rows are deleted and recreated from the filtered
   payload
4. progression validation runs against the merged final state (existing
   locked rows plus newly accepted unlocked picks), so locked SF winners
   continue to constrain the Final pick

This means the prediction window is genuinely per-match: a user can keep
editing later rounds after group-stage kickoff, and the importer marking
matches as finished does not affect locking — only the scheduled kickoff
time does.

## 8. Domain Model

The Prisma schema currently contains:

- `User`
- `Tournament`
- `Team`
- `Group`
- `Round`
- `Match`
- `GroupPrediction`
- `KnockoutPrediction`
- `GroupResult`
- `Score`
- `TournamentPrimaryEntry`
- `TournamentMember`
- `TournamentLeague`
- `LeagueMember`
- `PasswordResetToken`
- `EmailVerificationToken`

### 8.1 Key Model Responsibilities

`User`

- identity and auth
- role
- avatar
- global ranking visibility

`Tournament`

- base product container
- mode metadata
- sport metadata
- lifecycle and access settings
- prize settings

`Group`, `Team`, `Round`, `Match`

- tournament structure
- team catalog for a tournament
- knockout round ordering and point values
- match slot labels and winners

`GroupPrediction`, `KnockoutPrediction`

- prediction persistence by scope

`GroupResult`

- saved group outcomes

`Score`

- persisted group, knockout, and total scores by scope

`TournamentPrimaryEntry`

- current official scope per user per tournament

`TournamentMember`

- membership for private tournaments

`TournamentLeague`, `LeagueMember`

- private league definitions and membership

### 8.2 Important Schema Rules

- `User.email` is unique
- `Tournament.joinCode` is unique when present
- `TournamentLeague.joinCode` is unique
- group predictions are unique by user, tournament, group, and scope
- knockout predictions are unique by user, match, and scope
- scores are unique by user, tournament, and scope
- each user has exactly one `TournamentPrimaryEntry` row per tournament
- tournament membership is unique by user and tournament
- league membership is unique by league and user

## 9. Tournament Lifecycle And Safety Rules

### 9.1 Lifecycle

`Tournament.status` (`upcoming`, `active`, `closed`, `finished`) is purely
informational metadata for the UI. Prediction submissions are gated only
by per-match locks (see §7.5), not by the tournament-level status.

### 9.2 Safe Structure Editing

Tournament structure can only be edited when there are no:

- tournament members
- leagues
- group predictions
- knockout predictions
- saved group results
- scores

This protects bracket integrity once activity exists.

## 10. Scoring Model

### 10.1 Group Stage

Per group:

- 4 points: exact first and second
- 3 points: correct teams, inverted order
- 2 points: one team in the correct position
- 1 point: one team but in the wrong position
- 0 points: no relevant hits

When the mode uses best-third-place logic, the `third` prediction affects bracket resolution but does not change the base 4/3/2/1 score logic.

### 10.2 Knockout Rounds

Knockout scoring is persisted on each `Round` as `pointsPerCorrect`.

The current seeded tournaments use linearly increasing values through the bracket. The UI computes total maximum score by combining:

- `groupCount * 4`
- the sum of all `round.matches.length * round.pointsPerCorrect`

### 10.3 Score Calculation

Scoring lives in `api/scoring.cjs`.

Scores are recalculated:

- automatically after admin result saves
- manually through `POST /api/tournaments/:id/calculate-scores`
- automatically by the importer at `POST /api/tournaments/:id/import-results` when at least one row was written

## 11. Best-Third-Place Handling

World Cup 2026 and similar expanded modes require explicit handling for third-placed qualifiers.

Current behavior:

- the backend and frontend parse slot labels such as `3[...]`
- the prediction wizard forces a third-place pick when the bracket requires it
- downstream knockout options are sanitized when upstream picks no longer qualify
- random fill generates valid third-place assignments without duplicates

Key logic lives in:

- `src/utils/tournament.js`
- `api/app.cjs`
- `api/scoring.cjs`

## 12. API Surface

All routes are under `/api`.

### 12.1 Auth And Account

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/verify-email`
- `POST /auth/resend-verification`
- `GET /auth/google`
- `GET /auth/google/callback`
- `GET /auth/me`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/logout`
- `GET /account/profile`
- `GET /account/navigation`
- `PATCH /account/profile`
- `POST /account/change-password`

### 12.2 Tournament Discovery And Participation

- `GET /tournaments`
- `GET /tournaments/:id`
- `GET /tournaments/:id/groups`
- `GET /tournaments/:id/my-predictions`
- `GET /tournaments/:id/primary-entry`
- `POST /tournaments/:id/primary-entry`
- `POST /tournaments/:id/predictions`
- `POST /tournaments/:id/join`
- `GET /tournaments/:id/leagues`
- `POST /tournaments/:id/leagues`
- `POST /tournaments/:id/leagues/join`
- `GET /tournaments/:id/leaderboard`
- `GET /leaderboard/:tournamentId`

### 12.3 League Flows

- `GET /leagues/invite/:joinCode`
- `GET /leagues/:id`
- `GET /leagues/:id/my-predictions`
- `POST /leagues/:id/predictions`
- `POST /leagues/:id/predictions/copy`
- `PATCH /leagues/:id`
- `POST /leagues/:id/regenerate-code`
- `DELETE /leagues/:id/members/me`
- `DELETE /leagues/:id`
- `GET /leagues/:id/leaderboard`

### 12.4 Scoped Prediction Maintenance

- `DELETE /predictions/:id`

### 12.5 Global Rankings

- `GET /leaderboard/global`

### 12.6 Admin

- `POST /tournaments`
- `PUT /tournaments/:id/structure`
- `PATCH /tournaments/:id/settings`
- `POST /tournaments/:id/results/groups`
- `POST /tournaments/:id/results/knockout`
- `POST /tournaments/:id/calculate-scores`
- `POST /tournaments/:id/import-results`
- `PATCH /tournaments/:id/matches/:matchId` — toggle `predictionsClosed` for
  a single match (see §7.5)

### 12.7 Ops

- `GET /health`

## 12a. Results Importer

The admin endpoint `POST /tournaments/:id/import-results` pulls results
from football-data.org and applies them through the same data shapes as
the existing admin results endpoints. The HTTP route is the integration
point so the importer always runs through prisma + the existing
`persistTournamentScores` helper rather than touching the database from
a standalone process.

Module layout:

- `api/results-importer.cjs` — pure helper that accepts a prisma client
  and a fetcher, calls football-data.org `/competitions/<code>/standings`
  and `/competitions/<code>/matches?status=FINISHED`, and returns the
  set of writes plus a `details` field describing skipped/unresolved
  rows. Defaults to competition code `WC` (FIFA World Cup).
- `scripts/import-results.cjs` — CLI used both for local runs and the
  GitHub Actions cron. Logs in as the admin given by
  `RESULTS_IMPORT_ADMIN_EMAIL` / `RESULTS_IMPORT_ADMIN_PASSWORD` and
  POSTs the import endpoint at `RESULTS_IMPORT_API_BASE_URL`.
- `.github/workflows/import-results.yml` — schedules the CLI every six
  hours and exposes a manual `workflow_dispatch` trigger.

Safety properties:

- the football-data.org API key (`RESULTS_IMPORT_API_KEY`) only ever
  lives on the server; the CLI does not see it
- the endpoint returns 503 when the server-side key is missing, and the
  CLI logs missing client-side env vars and exits 0 instead of failing
- group standings are upserted only when no `GroupResult` exists for
  that group, so admin-entered standings are never overwritten
- group-stage match rows are matched by `homeLabel` / `awayLabel` team
  codes and store the final score plus winner (a `null` winner is kept
  for draws); knockout rows are matched by resolved team pair and must
  declare a winner (feed entries reporting a draw with no shootout are
  reported as unmatched instead of being persisted)
- match updates write `homeScore`, `awayScore`, and `status='finished'`,
  and skip any DB row already marked `finished`
- recompute via `persistTournamentScores` runs only when the importer
  reports at least one write

## 13. Seeding, Translation, And Naming

### 13.1 Seed Script

`api/seed.cjs` installs the current curated football catalog and its rounds.

Current seed responsibilities:

- create/update seeded tournaments
- generate groups and teams
- create rounds with persisted point values
- define bracket slot labels explicitly

Re-running the seed against a database that already has the tournament is
**non-destructive by default**. `api/seed-sync.cjs` performs an additive sync
that creates any rounds and matches missing from the current definition and
refreshes match dates on existing rows; it never deletes or overwrites
predictions, results, scores, leagues, or memberships. Group-stage rows are
matched by team pair (not by `matchNumber`) so labels and ordering can be
corrected without churning IDs.

`SEED_ALLOW_REBUILD=true` is an opt-in escape hatch for non-production
databases that triggers a destructive rebuild (drops groups, teams, rounds,
and matches before reseeding). The rebuild is still refused when the
tournament has user activity; in that case the seed falls back to the
additive sync.

### 13.2 Translation Backfill

`api/backfill-translations.cjs` fills missing Spanish values for:

- tournament names
- mode names
- round names
- team names

### 13.3 UI Localization

The UI localizes:

- text labels
- dates
- numbers
- tournament, mode, round, and team names when translated data exists

Terminology should stay audience-aware:

- English: “soccer”
- Spanish: “futbol”
- Portuguese: “futebol”
- Italian: “calcio”
- Dutch: “voetbal”

`LanguageProvider` picks the **UI language** from `navigator.languages` in order: the first tag whose language subtag is one of the supported UI languages (ignoring unsupported languages such as French that may appear earlier in the list). **Date and number formatting** use a BCP47 locale that matches the active UI language: the first matching entry from `navigator.languages` that includes a region (for example `pt-PT`, `es-MX`, `en-GB`) is preferred; bare tags such as `pt` are normalized to a regional default (`pt-BR`, `es-AR`, `en-US`, `it-IT`, `nl-NL`). The `languagechange` event triggers a refresh so formatting tracks updated browser preferences without a full reload.

## 14. Testing And Verification

Automated tests currently cover:

- scoring utilities
- tournament utilities
- translation helpers
- email helpers
- core API integration flows

CI:

- GitHub Actions workflow in `.github/workflows/ci.yml`
- PostgreSQL service in CI
- `npm run verify`
- production migration on pushes to `main`: a gate job derives `run_migrate` from `PRODUCTION_DATABASE_URL` via `env`, then `migrate-production` runs only when that output is true

Verification baseline:

- ESLint
- Prisma generate
- Prisma schema validation
- test suite
- production build

## 15. Deployment And Local Operations

### 15.1 Local Dev

`npm run dev` uses `scripts/dev.cjs` to supervise:

- `node --watch api/server.cjs`
- `vite`

This exists so local shutdown behaves correctly with `Ctrl+C`.

### 15.2 Database Operations

Preferred schema workflow:

1. update `prisma/schema.prisma`
2. create a checked-in migration
3. regenerate Prisma client if needed
4. run `npm run verify`

Avoid using `db push` as the normal schema workflow.

### 15.3 Production Migration Automation

Production schema changes are applied from GitHub Actions rather than from the Netlify build.

Current automation contract:

- workflow: `.github/workflows/ci.yml`
- trigger: push to `main`
- gate: `check-production-migrate` sets job output `run_migrate` from step `env` (`PRODUCTION_DATABASE_URL`); `migrate-production` uses `needs.*.outputs` in its `if` (secrets are not valid in job-level `if`)
- order: `check-production-migrate` and `migrate-production` wait for `verify`
- command: `npm run db:migrate:deploy` (migrate job only)

This keeps the migration path explicit and checked-in while allowing repositories without configured production secrets to keep using the same CI workflow safely.

### 15.4 Production Deploy Pipeline

Production code is shipped to Netlify from GitHub Actions, not via Netlify's git auto-deploy.

Why: Netlify's `noble` build image rollout (June 2026) broke our
auto-deploy for ~7 weeks. We had no logs and no signal, so the live
Lambda silently stayed on the April 28 build while migrations kept
running on `main`. Owning the deploy from GitHub Actions gives us
pinned Node, full build logs, and a smoke check.

Pipeline contract (`.github/workflows/ci.yml`):

| Job | Trigger | Purpose |
|---|---|---|
| `verify` | every push + PR | lint, validate, tests, build |
| `netlify-build-check` | every push + PR (after `verify`) | runs `netlify build --offline` to catch Netlify-Build-specific failures on the PR, not in prod |
| `check-production-migrate` | push to `main` | gates the migrate job on `PRODUCTION_DATABASE_URL` |
| `migrate-production` | push to `main` (when gated true) | `npm run db:migrate:deploy` + `npm run db:seed` |
| `check-production-deploy` | push to `main` | gates the deploy job on `NETLIFY_AUTH_TOKEN` + `NETLIFY_SITE_ID` |
| `deploy-production` | push to `main` (when gated true) | `npm ci` (postinstall regenerates Prisma client), `netlify deploy --prod --build --skip-functions-cache` (Netlify build injects `VITE_*` project env into the bundle), then smoke-checks the live API |

Required GitHub secrets:

- `PRODUCTION_DATABASE_URL` — gates the migrate path
- `NETLIFY_AUTH_TOKEN` — personal access token with deploy scope
- `NETLIFY_SITE_ID` — Netlify project id

Notes:

- `--build` is mandatory: it runs `netlify build` which loads the Netlify project env vars into the Vite build, so `VITE_*` values (PostHog key, analytics flags, Google client id, etc.) are baked into the deployed bundle. Without it we would silently ship a bundle with empty `VITE_*` values.
- `--skip-functions-cache` is mandatory: the older "Deploying functions from cache" path can publish a function bundle whose Prisma client predates the current schema.
- The deploy job runs a 5-attempt curl smoke check against `/api/tournaments?status=active,upcoming` and fails the CI run if the live API does not 200.
- Source of truth for both frontend (`VITE_*`) and backend runtime env vars is Netlify's project env, not GitHub Actions secrets. GitHub secrets only carry the values needed to authenticate the deploy itself (`NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`) plus `PRODUCTION_DATABASE_URL` for the migrate job.
- Netlify's git auto-deploy is disabled (`stop_builds: true`) so the only deploy path is GitHub Actions. `[build.environment] NODE_VERSION = "24.1.0"` is still pinned in `netlify.toml` for defence in depth if auto-deploys are ever re-enabled.

#### `VITE_*` env vars must not be marked secret

Netlify lets you mark an env var as containing secret values. Secret env vars are never exposed during a build — they only reach Functions at request time. That breaks any `VITE_*` value, because Vite *only* reads env at build time. A silent regression we hit during this work: the bundle shipped with empty `VITE_POSTHOG_KEY`, `VITE_ANALYTICS_ENABLED`, `VITE_ANALYTICS_PROVIDER`, and `VITE_POSTHOG_HOST` even though all four were set on the Netlify project, because all four had been flagged secret. PostHog analytics were effectively dead in prod with no error.

Operational rules:

- Any env var prefixed `VITE_` must be a regular (non-secret) Netlify env var. They are meant to be in the public browser bundle by design (PostHog uses a public client-side key, analytics flag is a boolean, etc.).
- Backend-only secrets (`DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_SECRET`, `RESULTS_IMPORT_API_KEY`) stay marked secret. They are read from `process.env` by the Lambda at request time and never need to appear in a build.
- Quick check during CI debugging: `netlify env:list --context production --plain | grep '^VITE_'`. If any value is masked with `****`, that variable is incorrectly flagged secret.

### Destructive Migrations And The Deploy Race

CI's `migrate-production` job and the deploy step are sequenced in the
same workflow (`deploy-production` `needs:` `migrate-production`), so
the deploy waits for the migration to finish before publishing the new
Lambda. That removes the historical race between Netlify's
out-of-band build and the migrate job.

A residual race still exists when Netlify's git auto-deploy is left
on as a fallback (it runs in parallel with our pipeline). Until we
fully disable it, keep using the two-step pattern for destructive
changes (see §3 of `AGENTS.md`):

1. ship code that no longer references the column, merge, and
   confirm the new Lambda is live
2. ship the destructive Prisma migration in a follow-up PR so CI
   only drops the column once the deployed bundle has stopped
   reading it

## 16. Current Architectural Gaps

The main outstanding architectural work is:

- explicit format-family support beyond football group-plus-knockout
- better separation between curated seed data and official data import pipelines
- browser-level E2E coverage
- prize/payment operations
- broader admin bulk tooling
