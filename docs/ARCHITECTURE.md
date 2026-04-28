# Prode Architecture

Version: 2026-04-24  
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

### 3.2 Route Map

Current routes in `src/App.jsx`:

- `/`
- `/login`
- `/register`
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

Password reset:

- one-time hashed reset tokens stored in `PasswordResetToken`
- TTL currently one hour
- can send email through SMTP or return a local reset URL for non-production testing

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
- `predictionWindowOpen`
- `predictionsLocked`
- `lockedReason`

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

Tournament lifecycle combines:

- stored status
- closing date

When closing date has passed, predictions lock even if stored status still says `upcoming` or `active`.

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

### 12.7 Ops

- `GET /health`

## 13. Seeding, Translation, And Naming

### 13.1 Seed Script

`api/seed.cjs` installs the current curated football catalog and its rounds.

Current seed responsibilities:

- create/update seeded tournaments
- generate groups and teams
- create rounds with persisted point values
- define bracket slot labels explicitly

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

## 16. Current Architectural Gaps

The main outstanding architectural work is:

- explicit format-family support beyond football group-plus-knockout
- better separation between curated seed data and official data import pipelines
- browser-level E2E coverage
- prize/payment operations
- broader admin bulk tooling
