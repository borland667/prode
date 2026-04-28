# Prode

Prode is a multilingual sports prediction app centered on Prode-style tournament picks (English, Spanish, Portuguese, Italian, and Dutch UI). The current product is production-shaped around football tournaments that have:

- a group stage
- a knockout bracket
- optional best-third-place qualification slots
- tournament-wide public or private access
- optional prize configuration
- private leagues inside a tournament

The app currently supports one prediction engine: football group-stage plus knockout Prode. The product already uses generic tournament, mode, and sport metadata, but non-football formats such as NBA playoff series are not implemented yet.

## Current Implementation Snapshot

Implemented today:

- public and private tournaments with join codes
- tournament-scoped prediction flow for the main tournament entry
- private leagues inside a tournament, each with its own prediction scope
- copy an existing tournament or league prediction set into a private league scope
- official primary-entry selection per user per tournament
- tournament leaderboard based on the tournament scope only
- league leaderboard based on the corresponding league scope only
- shared leaderboard hub that can switch across accessible tournaments and private league boards
- authenticated global rankings based on each user’s official primary entry and opt-in visibility setting
- registration, login, logout, Google OAuth, forgot-password, reset-password, and profile management
- browser language detection with English fallback (uses `navigator.languages` order among supported UI languages)
- regional date and number formatting from the browser locale when it matches the active UI language (for example `es-MX`, `pt-PT`, `en-GB`), with regional defaults otherwise
- dark and light themes with persisted preference
- World Cup 2026 support including best-third-place Round of 32 handling
- seeded football tournament catalog beyond World Cup 2026
- admin tournament builder, safe structure editing, tournament settings, results entry, and score recalculation
- design-system-based UI is now the default across the app, while legacy alias classes remain mapped for compatibility

Important current product rules:

- the tournament page represents the tournament-wide official competition
- users can also make separate predictions inside multiple private leagues
- only one scope can count as the user’s official tournament entry at a time
- global rankings only include logged-in users who have not opted out of visibility
- the current global ranking uses official entries so multiple league entries do not inflate a user’s score

## Seeded Tournament Catalog

The local seed currently installs:

- FIFA World Cup 2026
- UEFA Euro
- Copa América
- AFC Asian Cup
- Africa Cup of Nations

Notes:

- World Cup 2026 is the most complete seed and includes explicit best-third-place bracket handling.
- The other seeded tournaments are curated, format-compatible football templates that fit the current engine. They are not live official imports.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, React Router 7, Vite 8 |
| Styling | Tailwind CSS v4 via Vite plus semantic design-system classes in `src/index.css` |
| Backend | Express 5 |
| Database | PostgreSQL |
| ORM | Prisma 7 |
| Auth | JWT + Passport Google OAuth |
| Email | Nodemailer |
| Deploy Shape | SPA + API, Netlify-compatible |

## Documentation Map

- [README.md](./README.md): local setup, current features, commands, and operational notes
- [docs/IMPLEMENTATION_STATUS.md](./docs/IMPLEMENTATION_STATUS.md): where the app stands today, what is working, and what is next
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md): routes, backend responsibilities, schema model, prediction scopes, and API surface
- [docs/QA_CHECKLIST.md](./docs/QA_CHECKLIST.md): manual QA and smoke-test checklist
- [docs/ROADMAP.md](./docs/ROADMAP.md): prioritized next steps after the current implementation snapshot
- [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md): UI primitives, styling rules, and migration guidance
- [docs/KEYCLOAK_MIGRATION.md](./docs/KEYCLOAK_MIGRATION.md): future auth portability path
- [AGENTS.md](./AGENTS.md): repository working standards and implementation expectations

## Local Development

### Prerequisites

- Node.js `24.1.0`
- `nvm` recommended
- Docker
- PostgreSQL if not using Docker

The repo includes `.nvmrc`, so the recommended setup is:

```bash
nvm install
nvm use
```

### Install Dependencies

```bash
npm install
```

### Configure Environment

```bash
cp .env.example .env
```

Recommended local values:

```env
DATABASE_URL=postgresql://prode:prode123@localhost:5432/prode
TEST_DATABASE_URL=postgresql://prode:prode123@127.0.0.1:5432/prode
JWT_SECRET=local-dev-secret-change-me

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

SITE_URL=http://localhost:5173

EMAIL_FROM_ADDRESS=noreply@example.com
EMAIL_FROM_NAME=Prode
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=

VITE_ANALYTICS_ENABLED=false
VITE_ANALYTICS_PROVIDER=none
VITE_POSTHOG_KEY=
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

Notes:

- Google OAuth is optional in local development.
- SMTP is optional in local development. Without SMTP, email/password registration falls back to the legacy immediate-login flow, and the forgot-password flow returns a local reset URL/token payload for testing.
- Frontend analytics is optional. Set `VITE_ANALYTICS_ENABLED=true`, `VITE_ANALYTICS_PROVIDER=posthog`, and `VITE_POSTHOG_KEY` to enable PostHog; otherwise the shared analytics adapter stays disabled.

### Run PostgreSQL With Docker

```bash
docker run -d \
  --name prode-postgres \
  -e POSTGRES_USER=prode \
  -e POSTGRES_PASSWORD=prode123 \
  -e POSTGRES_DB=prode \
  -p 5432:5432 \
  postgres:16-alpine
```

Useful Docker commands:

```bash
docker ps
docker stop prode-postgres
docker start prode-postgres
```

### Apply Migrations

Use checked-in migrations for schema changes:

```bash
npm run db:migrate
```

Generate the Prisma client if needed:

```bash
npm run db:generate
```

### Seed Data

```bash
npm run db:seed
npm run db:backfill:translations
```

`db:backfill:translations` is safe to run after seeding or against an existing local database. It fills missing Spanish names for tournaments, rounds, modes, and teams without requiring a full reseed.

### Start The App

```bash
npm run dev
```

Local URLs:

- frontend: `http://localhost:5173`
- API: `http://localhost:3001`
- health check: `http://localhost:3001/api/health`

`npm run dev` uses `scripts/dev.cjs` to supervise the API and Vite processes so local shutdown works cleanly with `Ctrl+C`.

## Local Database Reset

If you want a clean local database while keeping the container:

```bash
npx prisma migrate reset
```

If you want to skip the automatic seed and reseed manually:

```bash
npx prisma migrate reset --skip-seed
npm run db:seed
npm run db:backfill:translations
```

If you want to fully recreate the Docker database container:

```bash
docker rm -f prode-postgres
```

Then rerun the `docker run ... postgres:16-alpine` command above.

Important:

- prefer checked-in migrations over `db push`
- do not overwrite a shared or remote database when resetting locally
- use `TEST_DATABASE_URL` for automated tests so test setup does not target the wrong database

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start frontend and API together |
| `npm run dev:web` | Start only the Vite frontend |
| `npm run dev:api` | Start only the API server |
| `npm run build` | Production frontend build |
| `npm run lint` | ESLint |
| `npm test` | Node test suite, including API integration and utility tests |
| `npm run verify` | Lint, Prisma generate, Prisma validate, test suite, production build |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:validate` | Validate Prisma schema |
| `npm run db:migrate` | Create/apply a local development migration |
| `npm run db:migrate:deploy` | Apply checked-in migrations only |
| `npm run db:migrate:status` | Show migration status |
| `npm run db:push` | Push schema without migrations, use sparingly |
| `npm run db:seed` | Seed the football tournament catalog |
| `npm run db:backfill:translations` | Fill missing translated names in existing rows |
| `npm run db:studio` | Open Prisma Studio |

## Implemented User Flows

### Guest Flows

- browse the landing page
- inspect the featured tournament
- inspect active tournaments
- open tournament detail pages
- switch language and theme

### Authenticated User Flows

- register with email/password
- log in with email/password
- log in with Google when configured
- request a password reset
- reset password with a one-time token
- update display name
- update avatar URL
- change password
- opt in or out of global ranking visibility

### Tournament Participation

- join a private tournament with a join code
- submit tournament-scope predictions
- revisit and update tournament-scope predictions while the tournament is still open
- clear predictions through the API before closing date using `DELETE /api/predictions/:id`
- use random-fill from the prediction flow to generate a valid bracket across all steps
- view group standings and knockout progress once results exist

### League Participation

- create a private league inside a tournament
- join a league using a join code
- share league invite links
- submit league-scope predictions
- copy an existing tournament or league prediction set into a private league scope
- choose a league scope as the official primary entry if it has predictions
- leave a league
- delete a league if you are the owner

### Rankings

- tournament leaderboard for the tournament-wide official scope
- league leaderboard for league members only
- leaderboard hub that switches between tournament boards and accessible private league boards
- global rankings across official entries for visible users only

### Admin

- create tournaments from JSON group/round structures
- edit tournament structure only when the tournament is still structurally safe to change
- update tournament settings:
  - access type
  - join code
  - prize enable/disable
  - entry fee
  - currency
- enter group results
- enter knockout results
- recalculate scores manually

## Current Scoring And Prediction Model

Group-stage scoring:

- 4 points: both teams correct in correct order
- 3 points: both teams correct in inverted order
- 2 points: one team correct in correct position
- 1 point: one team correct in wrong position
- 0 points: no correct teams

Knockout scoring:

- stored on each `Round` as `pointsPerCorrect`
- seeded tournaments currently use a linear scaling pattern through the bracket
- rules display and maximum score are derived from the tournament mode plus round configuration

World Cup 2026:

- supports best-third-place slot assignment in the expanded 48-team bracket
- users explicitly place eligible third-placed teams where required by the prediction flow

## Testing And Verification

Current automated coverage includes:

- scoring logic
- tournament utility logic
- translation helper logic
- email helper logic
- end-to-end API integration coverage for core auth, tournament, league, and leaderboard flows
- production build validation

CI:

- GitHub Actions runs `npm run verify`
- CI provisions PostgreSQL for the test suite
- on pushes to `main`, GitHub Actions also runs `npm run db:migrate:deploy` for production when the `PRODUCTION_DATABASE_URL` GitHub secret is configured
- if `PRODUCTION_DATABASE_URL` is not set, the `migrate-production` job is skipped (a prior gate job reads it from `env` and exposes a boolean output) without failing CI

## Deployment And Production Migrations

Netlify remains the production host shape for the SPA and serverless API. Production database migrations are applied from GitHub Actions rather than from the Netlify build itself.

Current production deployment expectation:

- the Netlify function that wraps Express is `prode-http` (see `netlify.toml`): it cannot be named `api` because that collides with the repository `api/` directory in the serverless bundle and breaks Node ESM resolution
- pushing to `main` triggers `.github/workflows/ci.yml`
- the `verify` job must pass first
- after `verify`, on pushes to `main`, `check-production-migrate` sets `run_migrate` from whether `PRODUCTION_DATABASE_URL` is non-empty (secret injected into step `env`, never logged)
- the `migrate-production` job runs only when that output is `true`, then runs `npm run db:migrate:deploy`
- if the secret is absent, `migrate-production` is skipped and the workflow still completes successfully

Required GitHub secret:

- `PRODUCTION_DATABASE_URL`: the production PostgreSQL connection string Prisma should use for `migrate deploy`

Operational notes:

- keep production schema changes migration-first and checked into `prisma/migrations`
- do not rely on `db push` in production
- GitHub Actions and Netlify are separate systems, so application changes should stay forward-compatible with normal deploy timing

## Current Boundaries

The app is not yet:

- a generic multi-sport engine for non-football tournament formats
- integrated with official live competition feeds
- integrated with payment providers or automated payouts
- fully stripped of every legacy alias class, even though the design system is now the default UI layer
- covered by browser-level E2E tests

For the current implementation snapshot and the prioritized next steps, see:

- [docs/IMPLEMENTATION_STATUS.md](./docs/IMPLEMENTATION_STATUS.md)
- [docs/ROADMAP.md](./docs/ROADMAP.md)
