# Prode — Sports Prediction Game

A World Cup bracket prediction game where users predict group stage results and knockout round winners. Built with React, Express, PostgreSQL, and deployable to Netlify.

## Features

- **Bracket Predictions** — Predict 1st/2nd in each group, then winners through the knockout rounds configured for the tournament
- **Scoring System** — Group stage stays 4/3/2/1 pts, while knockout rounds scale linearly by tournament size
- **Auth** — Email/password registration + Google OAuth (Auth.js, migrateable to Keycloak)
- **Bilingual** — English and Spanish (i18n)
- **Leaderboard** — Live rankings with optional prize pool calculation (70/30 split when prizes are enabled)
- **Private Groups** — Run tournaments as public competitions or closed groups with join codes
- **Private Leagues** — Create invite-only leagues inside a tournament, each with its own join code and filtered leaderboard
- **Admin Panel** — Enter results, calculate scores, and manage tournament settings
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

# JWT secret (any random string for local dev)
JWT_SECRET=local-dev-secret-change-me

# Google OAuth (optional — skip for local dev without Google login)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# Site URL
SITE_URL=http://localhost:5173
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

Seed the database with World Cup 2026 data:

- Official FIFA-qualified teams and groups
- Current app-mode Prode knockout bracket/scoring rules
- Prize pool enabled for the seeded tournament
- Public access by default, with private-group support available from the admin panel

```bash
npm run db:seed
```

Note:
The seed uses the official April 2026 tournament line-up, the official FIFA 2026 Round of 32 structure, and the real best-third-place slot format used by the expanded 48-team bracket. In the prediction UI, users explicitly place the advancing third-placed teams into the eligible Round of 32 slots before picking winners.

### 6. Start the development servers

```bash
npm run dev
```

This runs both servers concurrently:
- **Frontend** → http://localhost:5173 (Vite dev server with HMR)
- **API** → http://localhost:3001 (Express, auto-restarts on file changes)

Vite automatically proxies `/api/*` requests to the Express server.

### 7. Open the app

Go to http://localhost:5173 in your browser. You should see the Prode landing page with the World Cup 2026 tournament.

To test registration, create an account at http://localhost:5173/register.

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend + API together |
| `npm run dev:web` | Start only the Vite frontend |
| `npm run dev:api` | Start only the Express API |
| `npm run build` | Build for production (output in `dist/`) |
| `npm run db:migrate` | Create/apply a local development migration |
| `npm run db:migrate:deploy` | Apply checked-in migrations without creating new ones |
| `npm run db:migrate:status` | Show migration status |
| `npm run db:push` | Push schema directly without a migration (use sparingly) |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:seed` | Seed database with WC2026 data |
| `npm run db:studio` | Open Prisma Studio (visual DB editor) |

### Tournament Access And Prizes

- Tournaments can now be `public` or `private`
- Private tournaments use a join code and only members can submit predictions or view the leaderboard
- Prize pools can be enabled or disabled per tournament
- The admin panel lets you change access type, entry fee, currency, prize toggle, and regenerate the private join code
- For World Cup 2026 mode, the app also supports third-place group picks plus the best-third-place Round of 32 slots

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

---

## Project Structure

```
prode/
├── api/
│   ├── app.cjs          # Express API (all routes)
│   ├── db.cjs           # Prisma client singleton
│   ├── scoring.cjs      # Scoring engine
│   ├── seed.cjs         # Database seeder (WC2026)
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
├── build.mjs            # Production build script (esbuild)
└── package.json
```

---

## Scoring Rules

Based on the classic Argentine prode format, adapted to the official FIFA 2026 bracket:

**Group Stage** (per group):
- **4 pts** — Both teams correct, correct positions (1st and 2nd)
- **3 pts** — Both teams correct, inverted positions
- **2 pts** — One team correct, in the right position
- **1 pt** — One team correct, but wrong position
- Users also pick **3rd place** in each group when the tournament uses best-third-place knockout slots; that extra pick is used to build the bracket, but the group-stage score still comes from 1st/2nd accuracy

**Knockout Rounds** (per correct advancing team):
- Points scale linearly from the earliest knockout round to the final
- The default step is **+2 points per round**

Current app-mode World Cup 2026 example:

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
