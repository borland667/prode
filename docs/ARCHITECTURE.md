# Prode — Architecture

**Version:** 2026-04  
**Status:** Active implementation snapshot

## 1. Overview

Prode is a sports prediction platform centered on tournament-mode-driven Prode flows. Today, the production-ready engine supports football tournaments that follow a familiar shape:

- group-stage predictions
- knockout-bracket predictions
- optional best-third-place qualification handling
- tournament-level access control
- optional prize configuration
- tournament-scoped private leagues

The current seeded catalog includes:

- FIFA World Cup 2026
- UEFA Euro
- Copa América
- AFC Asian Cup
- Africa Cup of Nations

World Cup 2026 is seeded as the main official-style experience. The other football tournaments are format-compatible seeds that fit the current engine.

## 2. Product Capabilities

### 2.1 End-User Features

- Guest landing page with featured tournament, mode-aware rules, and active tournament discovery
- Registration, login, logout, Google OAuth, forgot-password, and reset-password flows
- Profile editing, avatar updates, account stats, and password change
- Public tournaments and private tournaments with join codes
- Group-stage and knockout predictions
- Support for best-third-place slot assignment when a mode requires it
- Tournament leaderboard with dynamic round columns and optional prize pool display
- Tournament-scoped private leagues with join codes and league-only leaderboards
- Spectator-friendly standings and knockout-progress views
- English and Spanish UI with browser-language detection and English fallback
- Light and dark themes with persisted preference

### 2.2 Admin Features

- Tournament builder for creating new tournaments without seeding
- Safe structure editing before participants, predictions, leagues, or results exist
- Tournament settings management:
  - access type
  - join code generation/regeneration
  - prize enable/disable
  - entry fee and currency
- Group result entry
- Knockout result entry
- Automatic score recalculation on result updates
- Manual score recalculation as a recovery tool

## 3. Current Scope And Boundaries

### 3.1 Supported Today

- Football tournaments with groups plus knockout rounds
- Tournament modes whose rules can be derived from:
  - group placement scoring
  - linearly scaled knockout scoring
  - optional best-third-place qualification rules

### 3.2 Not Yet Supported

- Seeded playoff formats without groups
- Best-of-series formats such as NBA or MLB playoffs
- Pure league-table competitions without knockout brackets
- Payments and payout automation
- Official external data ingestion pipelines
- Deeper automated API and UI coverage beyond the current validation and unit-test baseline

Those areas are product roadmap items rather than hidden support gaps.

## 4. High-Level Architecture

```text
React SPA (Vite)
  ├─ AuthContext
  ├─ ThemeContext
  ├─ LanguageContext
  ├─ Tournament / Prediction / League UI
  └─ Admin UI
          │
          ▼
Express API (/api/*)
  ├─ Auth + JWT
  ├─ Tournament access control
  ├─ Prediction persistence
  ├─ League management
  ├─ Admin tournament builder
  └─ Scoring orchestration
          │
          ▼
Prisma ORM
          │
          ▼
PostgreSQL
```

### 4.1 Frontend

- React 19
- React Router 7
- Vite 8 for development
- Custom `build.mjs` production build using esbuild
- Tailwind v4 plus custom CSS tokens in `src/index.css`

### 4.2 Backend

- Express 5 app in [`api/app.cjs`](../api/app.cjs)
- Local dev entrypoint in [`api/server.cjs`](../api/server.cjs)
- Netlify function wrapper in `netlify/functions/api.cjs`
- JWT-based auth with optional Google OAuth via Passport
- Prisma 7 with PostgreSQL

### 4.3 Local Development Process Model

`npm run dev` uses [`scripts/dev.cjs`](../scripts/dev.cjs) to supervise:

- `node --watch api/server.cjs`
- `vite`

That wrapper exists so local shutdown is reliable with `Ctrl+C`.

## 5. Frontend Architecture

### 5.1 Providers

The app root in [`src/App.jsx`](../src/App.jsx) is composed as:

```text
Router
└─ ThemeProvider
   └─ AuthProvider
      └─ LanguageProvider
         ├─ Navbar
         └─ Routes
```

### 5.2 Core Routes

- `/` — landing page, featured tournament, mode-aware rules, active tournaments
- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/tournament/:id`
- `/tournament/:id/predict`
- `/leaderboard/:id`
- `/league/:id`
- `/profile`
- `/admin`

### 5.3 Frontend State Strategy

- `AuthContext` manages current user and token-backed refresh/login/register/logout actions
- `ThemeContext` resolves stored preference first, then OS color scheme
- `LanguageContext` resolves stored language first, then browser locale
- Page-level data is fetched per route with React hooks and `src/utils/api.js`

### 5.4 Home Page Model

The landing page in [`src/pages/Home.jsx`](../src/pages/Home.jsx):

- loads active and upcoming tournaments
- highlights one featured tournament
- renders mode-aware scoring/rules sections
- links users into predictions or leaderboards
- exposes public tournament discovery for guests

### 5.5 Prediction Flow Model

The prediction UI assumes a tournament mode can describe:

- groups
- advancing placements
- knockout rounds
- optional best-third-place slot logic

The flow is:

1. pick group standings
2. resolve qualified teams
3. place best-third teams if the mode requires it
4. pick winners round by round
5. persist one prediction set per user per tournament

## 6. Backend Architecture

### 6.1 Main Responsibilities

[`api/app.cjs`](../api/app.cjs) currently handles:

- auth and current-user lookup
- password reset token lifecycle
- tournament listing and detail serialization
- tournament join flow for private tournaments
- prediction save/load flow
- league CRUD and league membership
- leaderboard serialization
- admin tournament creation and safe structure updates
- admin settings and result entry
- score calculation triggers

### 6.2 Authentication Model

- Email/password users store bcrypt-hashed passwords
- Google OAuth users can authenticate through Passport
- The frontend stores the returned JWT token in `localStorage`
- Protected API calls send `Authorization: Bearer <token>`
- Password reset uses one-time hashed reset tokens in the database

### 6.3 Access Control Model

Tournament access is evaluated from:

- tournament `accessType`
- tournament membership
- admin role
- tournament closing state

League access is evaluated from:

- ownership
- membership
- tournament participation access

## 7. Domain Model

The Prisma schema in [`prisma/schema.prisma`](../prisma/schema.prisma) currently models:

- `User`
- `Tournament`
- `Group`
- `Team`
- `Round`
- `Match`
- `GroupPrediction`
- `KnockoutPrediction`
- `GroupResult`
- `Score`
- `TournamentMember`
- `TournamentLeague`
- `LeagueMember`
- `PasswordResetToken`

### 7.1 Important Domain Rules

- One prediction set per user per tournament
- One score row per user per tournament
- Tournament structure is editable only before meaningful activity exists
- Private tournaments require join-code membership before participation
- League leaderboards are derived from tournament scores filtered to league members

### 7.2 Tournament Mode Metadata

`Tournament` stores:

- `modeKey`
- `modeName`
- `modeNameEs`
- `sport`

The UI and seed layer use those fields to drive:

- rule labels
- scoring summaries
- bracket behavior
- tournament presentation

The current engine still assumes those mode values map to the football-style Prode implementation in `src/utils/tournament.js` and `api/scoring.cjs`.

## 8. Scoring Model

### 8.1 Group Scoring

Per group:

- 4 points: both teams correct in correct positions
- 3 points: both teams correct in inverted positions
- 2 points: one team correct in the correct position
- 1 point: one team correct in the wrong position
- 0 points: no correct teams

When a tournament mode uses best-third-place qualification, the `third` pick is used to build the knockout bracket, but the base group score still comes from first and second.

### 8.2 Knockout Scoring

Rounds store `pointsPerCorrect` directly on the `Round` model. The current seeded tournaments use a linear scale from the earliest knockout round to the final.

Example for World Cup 2026:

- Round of 32: 2
- Round of 16: 4
- Quarter-finals: 6
- Semi-finals: 8
- Final: 10

### 8.3 Score Persistence

Scores are stored in `Score` rows:

- `groupScore`
- `knockoutScore`
- `totalScore`

Admin result entry triggers recalculation automatically, and a manual recalc endpoint exists for repair/re-sync use.

## 9. API Surface

All endpoints are prefixed with `/api`.

### 9.1 Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/google`
- `GET /auth/google/callback`
- `GET /auth/me`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

### 9.2 Tournaments

- `GET /tournaments`
- `GET /tournaments/:id`
- `GET /tournaments/:id/groups`
- `GET /tournaments/:id/my-predictions`
- `POST /tournaments/:id/predictions`
- `POST /tournaments/:id/join`
- `GET /tournaments/:id/leagues`
- `POST /tournaments/:id/leagues`
- `POST /tournaments/:id/leagues/join`
- `GET /tournaments/:id/leaderboard`

### 9.3 Leagues

- `GET /leagues/:id`
- `PATCH /leagues/:id`
- `POST /leagues/:id/regenerate-code`
- `DELETE /leagues/:id/members/me`
- `DELETE /leagues/:id`
- `GET /leagues/:id/leaderboard`

### 9.4 Admin

- `POST /tournaments`
- `PUT /tournaments/:id/structure`
- `PATCH /tournaments/:id/settings`
- `POST /tournaments/:id/results/groups`
- `POST /tournaments/:id/results/knockout`
- `POST /tournaments/:id/calculate-scores`

### 9.5 Ops

- `GET /health`

## 10. Seeding And Modes

The seed script in [`api/seed.cjs`](../api/seed.cjs):

- seeds the current football tournament catalog
- replaces matching seeded tournaments by name when rerun locally
- defines tournament rounds and knockout slots explicitly
- supports best-third-place slot labeling for World Cup and UEFA-style formats

The seed currently serves two purposes:

- local/demo data bootstrap
- reference examples for supported tournament shapes

It is not yet an official live-data ingestion pipeline.

## 11. Deployment Model

### 11.1 Current

- Frontend built to `dist/`
- Express app wrapped for Netlify Functions
- PostgreSQL hosted anywhere Prisma can reach

### 11.2 Portability Goal

The stack is intentionally portable:

- Express can run directly from `api/server.cjs`
- Postgres is provider-agnostic
- Auth can later move to Keycloak

See [`docs/KEYCLOAK_MIGRATION.md`](./KEYCLOAK_MIGRATION.md) for the future auth migration path.

## 12. Operational Notes

### 12.1 Schema Changes

For any schema change:

1. update `prisma/schema.prisma`
2. create a checked-in migration
3. regenerate Prisma client if needed
4. validate and test before committing

The preferred workflow is migration-first, not `db push`.

### 12.2 Verification Baseline

The repo now includes a lightweight operational verification path:

- `npm run verify`
- GitHub Actions workflow at `.github/workflows/ci.yml`

Current automated checks cover:

- ESLint
- Prisma schema validation
- unit tests for scoring and tournament utility logic
- production build generation

This is a deployment-safety baseline, not a replacement for broader API and UI test coverage.

### 12.3 Local Reset

For a clean local environment:

```bash
npx prisma migrate reset
```

or:

```bash
npx prisma migrate reset --skip-seed
npm run db:seed
```

## 13. Roadmap Snapshot

The main next-step work is:

- add additional tournament engines beyond football group + knockout
- support official external data imports and refresh workflows
- add broader API/UI automated test coverage on top of the existing CI and unit-test baseline
- add transactional prize and payment flows
- expand notifications and tournament operations tooling

See [`docs/ROADMAP.md`](./ROADMAP.md) for the maintained next-step list.
