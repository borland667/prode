# Prode — Sports Prediction Game

A sports prediction app centered on Prode-style tournament picks, where users predict group stage results and knockout round winners. Built with React, Express, PostgreSQL, and deployable to Netlify.

## Features

- **Bracket Predictions** — Predict 1st/2nd in each group, then winners through the knockout rounds configured for the tournament
- **Scoring System** — Group stage stays 4/3/2/1 pts, while knockout rounds scale linearly by tournament size
- **Tournament Modes** — Rules, maximum score, and bracket behavior come from the tournament mode
- **Auth** — Email/password registration, password reset, profile editing, and Google OAuth
- **Bilingual** — English and Spanish, with browser-language detection and English fallback
- **Themes** — Sports-oriented dark and light modes with persisted preference
- **Leaderboard** — Live rankings with optional prize pool calculation (70/30 split when prizes are enabled)
- **Global Rankings** — Logged-in players can view a cross-tournament leaderboard, and each profile can opt in or out of being shown there
- **Private Groups** — Run tournaments as public competitions or closed groups with join codes
- **Private Leagues** — Create invite-only leagues inside a tournament, each with its own join code and filtered leaderboard
- **Admin Panel** — Create tournaments, edit safe structures, enter results, calculate scores, and manage tournament settings
- **Spectator Views** — Tournament pages show current standings and knockout progress once results are entered
- **Portable** — Netlify Functions now, Kubernetes later (see `docs/KEYCLOAK_MIGRATION.md`)

## Tech Stack

| Layer     | Technology                              |
|-----------|-----------------------------------------|
| Frontend  | React 19, Vite, Tailwind CSS            |
| Backend   | Express.js (Netlify Functions)          |
| Database  | PostgreSQL (Neon cloud or local Docker) |
| ORM       | Prisma 7                                |
| Auth      | JWT + Passport.js (Google OAuth)        |
| Deploy    | Netlify (frontend + serverless API)     |

---

## Local Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v24.1.0
- [nvm](https://github.com/nvm-sh/nvm) recommended
- [Docker](https://docs.docker.com/get-docker/)
- Git

### 1. Clone the repo

```bash
git clone https://github.com/borland667/prode.git
cd prode
```

### 2. Start PostgreSQL with Docker

```bash
docker run -d \
  --name prode-postgres \
  -e POSTGRES_USER=prode \
  -e POSTGRES_PASSWORD=prode123 \
  -e POSTGRES_DB=prode \
  -p 5432:5432 \
  postgres:16-alpine
```

Verify it's running:

```bash
docker ps
```

To stop/start later:

```bash
docker stop prode-postgres
docker start prode-postgres
```

To reset the database completely:

```bash
docker rm -f prode-postgres
# Then run the docker run command above again
```

### 3. Install dependencies

If you use `nvm`:

```bash
nvm install
nvm use
```

```bash
npm install
```

### 4. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your local settings:

```env
# Local Docker Postgres
DATABASE_URL=postgresql://prode:prode123@localhost:5432/prode

# Dedicated integration-test database target
# Recommended: point this at your local Docker Postgres even if DATABASE_URL uses a remote DB
TEST_DATABASE_URL=postgresql://prode:prode123@127.0.0.1:5432/prode

# JWT secret (any random string for local dev)
JWT_SECRET=local-dev-secret-change-me

# Google OAuth (optional — skip for local dev without Google login)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# Site URL
SITE_URL=http://localhost:5173

# Transactional email / password reset delivery
# In local development you can leave SMTP unset and use the returned resetUrl.
# In production, configure SMTP so forgot-password can deliver real email.
EMAIL_FROM_ADDRESS=noreply@example.com
EMAIL_FROM_NAME=Prode
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
```

### 5. Set up the database

Apply the checked-in Prisma migrations to your local Postgres:

```bash
npm run db:migrate
```

Generate the Prisma client:

```bash
npx prisma generate
```

Seed the database with the current football tournament catalog:

- FIFA World Cup 2026
- UEFA Euro
- Copa América
- AFC Asian Cup
- Africa Cup of Nations
- Current app-mode Prode knockout/scoring rules for each seeded tournament
- Prize pool enabled for the seeded World Cup, disabled for the other seeded tournaments
- Public access by default, with private-group support available from the admin panel

```bash
npm run db:seed
npm run db:backfill:translations
```

Note:
The World Cup seed uses the official April 2026 line-up, the official FIFA 2026 Round of 32 structure, and the real best-third-place slot format used by the expanded 48-team bracket. The other seeded tournaments are format-compatible football templates that fit the current group-stage plus knockout Prode engine. In the prediction UI, users explicitly place the advancing third-placed teams into the eligible knockout slots whenever a tournament mode uses best-third-place qualifiers. `npm run db:backfill:translations` safely fills in missing translated tournament, round, mode, and team names for existing local rows without reseeding.

### 6. Start the development servers

```bash
npm run dev
```

This runs both servers concurrently:
- **Frontend** → http://localhost:5173 (Vite dev server with HMR)
- **API** → http://localhost:3001 (Express, auto-restarts on file changes)

Vite automatically proxies `/api/*` requests to the Express server.

### 7. Open the app

Go to http://localhost:5173 in your browser. You should see the Prode landing page with the seeded tournament catalog, including World Cup 2026.

To test registration, create an account at http://localhost:5173/register.

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend + API together |
| `npm run dev:web` | Start only the Vite frontend |
| `npm run dev:api` | Start only the Express API |
| `npm run build` | Build for production (output in `dist/`) |
| `npm test` | Run automated unit tests for scoring and tournament utilities |
| `npm run verify` | Run lint, Prisma schema validation, tests, and production build |
| `npm run db:migrate` | Create/apply a local development migration |
| `npm run db:migrate:deploy` | Apply checked-in migrations without creating new ones |
| `npm run db:migrate:status` | Show migration status |
| `npm run db:push` | Push schema directly without a migration (use sparingly) |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:validate` | Validate the Prisma schema |
| `npm run db:seed` | Seed database with the current football tournament catalog |
| `npm run db:backfill:translations` | Fill missing translated tournament, round, mode, and team names in the existing DB |
| `npm run db:studio` | Open Prisma Studio (visual DB editor) |

### Documentation

- [README.md](README.md) — local setup, current feature summary, and operational notes
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — current architecture, data model, routes, and system boundaries
- [docs/QA_CHECKLIST.md](docs/QA_CHECKLIST.md) — manual QA and release smoke test checklist
- [docs/ROADMAP.md](docs/ROADMAP.md) — next-step roadmap and product gaps still to close
- [docs/KEYCLOAK_MIGRATION.md](docs/KEYCLOAK_MIGRATION.md) — future auth/infrastructure portability path

### Current Product Status

What is implemented today:

- Public and private tournaments with join codes
- Authenticated global rankings with per-profile visibility control
- Private leagues inside a tournament
- Tournament-mode-aware scoring and rules display
- World Cup 2026 best-third-place Round of 32 handling
- Additional seeded football tournaments that fit the current Prode engine
- Password reset and profile/account management
- Automatic score updates when admins save results
- Admin tournament builder with structure safety checks
- Guest browsing plus spectator progress views
- Browser language detection and persisted light/dark theme preference

Current boundaries and known limitations:

- The core engine still assumes football-style group stage plus knockout progression
- Non-football formats such as NBA playoffs still need a separate format engine
- Seed data outside World Cup 2026 is format-compatible template data, not a live official feed
- Prize pools are configurable, but payment collection and payout settlement are still manual
- QA still relies heavily on manual flow coverage; CI now validates lint, Prisma schema, core unit tests, and production build, but broader API/UI test coverage is still next-step work

### QA Checklist

For end-to-end manual testing, use [docs/QA_CHECKLIST.md](docs/QA_CHECKLIST.md).

It covers:

- guest and auth flows
- password recovery
- public/private tournament participation
- prediction locking
- private league lifecycle
- admin tournament creation and result entry
- spectator tournament views

### Tournament Access And Prizes

- Tournaments can now be `public` or `private`
- Private tournaments use a join code and only members can submit predictions or view the leaderboard
- Prize pools can be enabled or disabled per tournament
- The admin panel lets you change access type, entry fee, currency, prize toggle, and regenerate the private join code
- Tournament rules and scoring are mode-driven, so the UI should present the rules for the selected tournament mode
- For World Cup 2026 mode and UEFA-style 24-team formats, the app also supports third-place group picks plus the best-third-place knockout slots
- Global rankings are visible only to logged-in users and aggregate scores across tournaments without exposing private tournament details
- Each user can opt out of appearing in global rankings from their profile, and the default is opt-in

### Private Leagues Inside A Tournament

- Any logged-in participant with access to a tournament can create a private league from the tournament page
- Each league gets its own join code
- Other participants can join that league from the same tournament page using the league code
- League leaderboards are filtered to league members only, while predictions still belong to the tournament itself

### Schema Change Workflow

For any future Prisma schema change:

```bash
# 1. Edit prisma/schema.prisma
# 2. Create and apply a migration locally
npm run db:migrate -- --name your_change_name

# 3. Regenerate the Prisma client if needed
npm run db:generate
```

Use `npm run db:push` only for quick local experiments when you explicitly do not want a checked-in migration.

### Resetting Your Local Database

If you want a completely fresh local database with the current schema and seed data:

```bash
# Drop and recreate the local database schema
npx prisma migrate reset
```

That command will:

- drop all local data
- reapply the checked-in migrations
- run the Prisma seed command if prompted/available

If you prefer to do the steps manually:

```bash
npx prisma migrate reset --skip-seed
npm run db:seed
npm run db:backfill:translations
```

If you are using the Docker Postgres container from this README and want to fully wipe the database instance itself:

```bash
docker rm -f prode-postgres
docker run -d \
  --name prode-postgres \
  -e POSTGRES_USER=prode \
  -e POSTGRES_PASSWORD=prode123 \
  -e POSTGRES_DB=prode \
  -p 5432:5432 \
  postgres:16-alpine
npm run db:migrate
npm run db:seed
```

### Development Notes

- `npm run dev` uses [`scripts/dev.cjs`](scripts/dev.cjs) so the API and Vite dev server shut down cleanly with `Ctrl+C`; the script starts the local `vite` CLI from `node_modules` with the project root as cwd (same toolchain as `npm run dev:web` and `vite build`, including Tailwind)
- GitHub Actions now runs `npm run verify` on pushes to `main` and pull requests
- The current automated test layer covers scoring and tournament utility logic with Node's built-in test runner
- API integration tests use `TEST_DATABASE_URL` first and create an isolated temporary Postgres database per run
- Password reset emails use SMTP when `SMTP_HOST`, `SMTP_PORT`, and `EMAIL_FROM_ADDRESS` are configured
- Production builds use `vite build` so Tailwind v4 is compiled the same way as in dev
- UI tokens: shared radii, shadows, tracking, and kicker text sizes live in `@theme` in `src/index.css` (use `rounded-panel-*`, `shadow-ds-*`, `tracking-overline`, etc.); reusable surfaces use classes like `surface-accent-gradient` and `sport-button` / `sport-panel` instead of one-off arbitrary values where possible
- Page layout: route bodies use `page-shell` (default max width), `page-shell-narrow` (profile), or `page-shell-md` (league invite); large inner panels use `page-panel-pad` / `page-panel-pad-md` for consistent padding. Combine `page-panel-pad` with `page-panel-pad-loft-top` when headings need extra clearance from the panel top curve. Override vertical spacing with Tailwind utilities (for example `pt-0`, `md:pb-16`) when a section needs a different rhythm
- Home metrics: the hero stat row and featured sidebar stat tiles share `home-metric-tile` + `home-metric-tile__kicker` on `sport-panel` (top-weighted padding, top-aligned content, shallow horizontal tile shape)

### Next Steps

The highest-impact next steps are tracked in [docs/ROADMAP.md](docs/ROADMAP.md). The main product work still ahead is:

- add additional tournament engines beyond football-style group + knockout
- replace static seed templates with importable official tournament data pipelines
- add automated tests around auth, predictions, scoring, and admin flows on top of the new CI baseline
- add real transactional support for paid prize pools, invites, and notifications

---

## Project Structure

```
prode/
├── api/
│   ├── app.cjs          # Express API (all routes)
│   ├── db.cjs           # Prisma client singleton
│   ├── scoring.cjs      # Scoring engine
│   ├── seed.cjs         # Database seeder (football tournament catalog)
│   └── server.cjs       # Local dev server entry
├── netlify/
│   └── functions/
│       └── api.cjs      # Netlify Function wrapper
├── prisma/
│   └── schema.prisma    # Database schema
├── src/
│   ├── components/      # Navbar
│   ├── context/         # AuthContext
│   ├── i18n/            # Translations (EN/ES) + LanguageContext
│   ├── pages/           # Home, Login, Register, Tournament,
│   │                    # Predict, Leaderboard, Admin, Profile
│   └── utils/           # API client helper
├── docs/
│   └── KEYCLOAK_MIGRATION.md
├── netlify.toml         # Netlify deploy config
└── package.json
```

---

## Scoring Rules

Based on the classic Argentine prode format, with scoring shown according to the selected tournament mode:

**Group Stage** (per group):
- **4 pts** — Both teams correct, correct positions (1st and 2nd)
- **3 pts** — Both teams correct, inverted positions
- **2 pts** — One team correct, in the right position
- **1 pt** — One team correct, but wrong position
- Users also pick **3rd place** in each group when the tournament uses best-third-place knockout slots; that extra pick is used to build the bracket, but the group-stage score still comes from 1st/2nd accuracy

**Knockout Rounds** (per correct advancing team):
- Points scale linearly from the earliest knockout round to the final
- The default step is **+2 points per round**

Current World Cup 2026 seeded mode example:

| Round | Points per Correct | Max Matches | Max Points |
|-------|-------------------|-------------|------------|
| Round of 32 | 2 | 16 | 32 |
| Round of 16 | 4 | 8 | 32 |
| Quarter Finals | 6 | 4 | 24 |
| Semi Finals | 8 | 2 | 16 |
| Final (Champion) | 10 | 1 | 10 |

**Maximum possible score in the current 2026 app mode: 162 points**

---

## Deploying to Netlify

1. Push this repo to GitHub
2. Connect the repo in [Netlify](https://app.netlify.com)
3. Add environment variables in Netlify dashboard:
   - `DATABASE_URL` — your Neon (or any Postgres) connection string
   - `JWT_SECRET` — a strong random secret
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from Google Cloud Console
   - `GOOGLE_CALLBACK_URL` — `https://your-site.netlify.app/api/auth/google/callback`
   - `SITE_URL` — `https://your-site.netlify.app`
4. Deploy — Netlify auto-detects the build command from `netlify.toml`

---

## Future: Migrating to Kubernetes + Keycloak

This project is designed to be portable. See [`docs/KEYCLOAK_MIGRATION.md`](docs/KEYCLOAK_MIGRATION.md) for a step-by-step guide on:
- Deploying Keycloak as your identity provider on K8s
- Switching from JWT/Passport to Keycloak OIDC tokens
- Migrating existing users
- Running the Express API as a standalone container

The database is standard PostgreSQL with Prisma migrations — it works on Neon, RDS, CloudSQL, or self-hosted Postgres without any code changes.
