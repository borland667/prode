# Prode — Architecture & Design Document

**Version:** 1.0
**Date:** April 2026
**Status:** MVP Implementation

---

## 1. Overview

Prode is a World Cup bracket prediction game inspired by the classic Argentine "prode" format. Users predict group stage outcomes and knockout round winners before the tournament begins, then earn points as real results come in. The platform supports multiple tournaments, bilingual UI (English/Spanish), and a flexible auth system designed for future migration to enterprise identity providers.

### 1.1 Goals

- Deliver a functional World Cup 2026 prediction game with real-time scoring
- Support both casual (free) and paid entry tournaments with prize pools
- Build on a portable architecture: Netlify today, Kubernetes tomorrow
- Zero vendor lock-in on database, auth, or hosting

### 1.2 Non-Goals (MVP)

- Real-time match score predictions (match-by-match)
- Mobile native apps (responsive web only)
- Payment processing integration (tracked manually for now)
- Push notifications

---

## 2. Game Rules

Based on the traditional Argentine "Pronosticos Mundial" format.

### 2.1 Prediction Flow

Players complete their predictions before the tournament closing date. The flow is sequential — each stage feeds into the next:

```
Step 1: GROUP STAGE
  → For each of the 12 groups (A–L), predict which team finishes 1st and 2nd
  → For World Cup 2026 mode, also predict 3rd place so the best-third-place Round of 32 slots can be built

Step 2: EARLIEST KNOCKOUT ROUND
  → Qualified teams auto-populate from group picks
  → When the bracket uses best-third-place slots, players assign the advancing third-placed teams into those eligible fixtures
  → Predict the winner of each knockout match for the configured bracket size

Step 3: QUARTER FINALS
  → Teams auto-populate from the previous knockout round
  → Predict 4 winners

Step 4: SEMI FINALS
  → 4 teams auto-populate from QF picks
  → Predict 2 winners

Step 5: FINAL
  → 2 teams auto-populate from SF picks
  → Pick the World Champion
```

### 2.2 Scoring System

**Group Stage** (per group, max 4 pts × 12 groups = 48 pts):

| Outcome | Points |
|---------|--------|
| Both teams correct, correct positions (1st/2nd) | 4 |
| Both teams correct, positions inverted | 3 |
| One team correct, in the right position | 2 |
| One team correct, wrong position | 1 |
| No teams correct | 0 |

**Knockout Rounds** (per correct advancing team):

- Points scale linearly from the earliest knockout round to the final
- Default scaling step: `+2` points per round

Current app-mode World Cup 2026 example:

| Round | Points per Correct | Max Matches | Max Points |
|-------|-------------------|-------------|------------|
| Round of 32 | 2 | 16 | 32 |
| Round of 16 | 4 | 8 | 32 |
| Quarter Finals | 6 | 4 | 24 |
| Semi Finals | 8 | 2 | 16 |
| Final (Champion) | 10 | 1 | 10 |

**Maximum possible score in the current 2026 app mode: 162 points**

### 2.3 Entry & Prize Pool

- Entry fee: configurable per tournament (default $20 USD)
- A participant can submit multiple predictions (each costs one entry fee)
- Prize pool = total entries × entry fee
- Distribution: 70% to highest scorer, 30% to second highest
- If tied for first: 100% split equally among tied participants

### 2.4 Closing Date

All predictions must be submitted before the tournament closing date. No modifications allowed after closing.

---

## 3. Architecture

### 3.1 High-Level Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     NETLIFY CDN                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │         React SPA (Vite + Tailwind)             │    │
│  │  • Landing page      • Prediction bracket       │    │
│  │  • Auth forms         • Leaderboard              │    │
│  │  • Tournament view    • Admin panel              │    │
│  │  • i18n (EN/ES)                                  │    │
│  └────────────────────┬────────────────────────────┘    │
│                       │ /api/*                          │
│  ┌────────────────────▼────────────────────────────┐    │
│  │         Netlify Functions (serverless)           │    │
│  │  ┌──────────────────────────────────────────┐   │    │
│  │  │        Express.js API                    │   │    │
│  │  │  • Auth (JWT + Passport.js)              │   │    │
│  │  │  • Tournament CRUD                       │   │    │
│  │  │  • Predictions (group + knockout)        │   │    │
│  │  │  • Scoring engine                        │   │    │
│  │  │  • Leaderboard                           │   │    │
│  │  │  • Admin endpoints                       │   │    │
│  │  └──────────────────────────────────────────┘   │    │
│  └────────────────────┬────────────────────────────┘    │
│                       │                                  │
└───────────────────────┼──────────────────────────────────┘
                        │ Prisma ORM
                        │
              ┌─────────▼──────────┐
              │   PostgreSQL       │
              │   (Neon Cloud)     │
              │                    │
              │  Core tables:      │
              │  User, Tournament, │
              │  Team, Group,      │
              │  Round, Match,     │
              │  *Prediction,      │
              │  *Result, Score    │
              └────────────────────┘
```

### 3.2 Portability Design

The Express API is wrapped with `serverless-http` for Netlify Functions, but it's a standard Express app. Migration to Kubernetes requires only:

1. Deploy the Express app as a Docker container (use `api/server.cjs` as entrypoint)
2. Point `DATABASE_URL` to any PostgreSQL instance
3. Swap auth from Passport.js direct providers to Keycloak OIDC (see `docs/KEYCLOAK_MIGRATION.md`)

```
Phase 1 (Current)          Phase 2 (Future)
─────────────────          ──────────────────
Netlify CDN         →      Nginx / Ingress
Netlify Functions   →      K8s Deployment (Express container)
Neon Postgres       →      RDS / CloudSQL / Self-hosted PG
Passport.js direct  →      Keycloak OIDC broker
```

---

## 4. Tech Stack

### 4.1 Frontend

| Technology | Purpose | Version |
|-----------|---------|---------|
| React | UI framework | 19.x |
| Vite | Build tool & dev server | 8.x |
| esbuild | Production bundler (replaces Rollup) | 0.28.x |
| React Router | Client-side routing | 7.x |
| Tailwind CSS | Utility-first styling (CDN) | 4.x |
| Lucide React | Icon library | 1.x |

**Build:** esbuild is used for production builds instead of Vite's default Rollup/rolldown for better compatibility across environments. The custom `build.mjs` script handles bundling, CSS extraction, and HTML injection.

### 4.2 Backend

| Technology | Purpose | Version |
|-----------|---------|---------|
| Express.js | HTTP API framework | 5.x |
| Prisma | ORM + migrations | 7.x |
| @prisma/adapter-pg | PostgreSQL driver adapter | 7.x |
| jsonwebtoken | JWT token creation/verification | 9.x |
| bcryptjs | Password hashing | 3.x |
| Passport.js | OAuth2 strategy framework | 0.7.x |
| passport-google-oauth20 | Google login | 2.x |
| serverless-http | Express → Lambda adapter | 4.x |

### 4.3 Database

| Technology | Purpose |
|-----------|---------|
| PostgreSQL 16 | Relational database |
| Neon | Serverless Postgres hosting (production) |
| Docker postgres:16-alpine | Local development |

### 4.4 Infrastructure

| Technology | Purpose |
|-----------|---------|
| Netlify | Hosting (CDN + Functions) |
| GitHub | Source control + CI trigger |
| Neon | Database hosting |

---

## 5. Database Schema

### 5.1 Entity Relationship Diagram

```
User ─────────────┬──── GroupPrediction ────── Group ──── Tournament
  │                │          │                  │            │
  │                │          └──────────────────┘            │
  │                │                                          │
  │                ├──── KnockoutPrediction ── Match ── Round─┘
  │                │                                          │
  │                └──── Score ───────────────── Tournament───┘
  │
  └── (role: USER | ADMIN)

Tournament ──┬── Group ──── Team
             ├── Round ──── Match
             ├── GroupResult
             └── Score
```

### 5.2 Models

**User** — Authenticated players and admins.
- `id`, `email` (unique), `name`, `password` (nullable for OAuth users), `googleId` (unique), `avatarUrl`, `role` (USER/ADMIN)

**Tournament** — A competition instance (e.g., "FIFA World Cup 2026").
- `id`, `name`, `nameEs`, `modeKey`, `modeName`, `modeNameEs`, `sport`, `status` (upcoming/active/finished), `prizesEnabled`, `entryFee`, `currency`, `accessType`, `joinCode`, `startDate`, `endDate`, `closingDate`

**Team** — A participating team, belonging to a group.
- `id`, `name`, `nameEs`, `code` (e.g., "ARG"), `flagUrl`, `groupId`, `tournamentId`

**Group** — Tournament group (A through L for WC2026).
- `id`, `name`, `tournamentId`
- Unique constraint: `[tournamentId, name]`

**Round** — Tournament stage with scoring rules.
- `id`, `name` (group_stage/round_of_32/round_of_16/quarter_finals/semi_finals/final), `nameEs`, `order`, `pointsPerCorrect`, `tournamentId`
- Unique constraint: `[tournamentId, name]`

**Match** — A knockout round match.
- `id`, `roundId`, `matchNumber`, `homeLabel`, `awayLabel`, `selectedHomeTeamId`, `selectedAwayTeamId`, `winner`, `status` (scheduled/live/finished), `matchDate`

**GroupPrediction** — A user's group stage prediction.
- `id`, `userId`, `tournamentId`, `groupId`, `first`, `second`, `third`
- Unique constraint: `[userId, tournamentId, groupId]`

**KnockoutPrediction** — A user's knockout match prediction.
- `id`, `userId`, `tournamentId`, `matchId`, `predictedWinner`, `selectedHomeTeamId`, `selectedAwayTeamId`
- Unique constraint: `[userId, matchId]`

**GroupResult** — Admin-entered actual group results.
- `id`, `tournamentId`, `groupId`, `first`, `second`, `third`
- Unique constraint: `[tournamentId, groupId]`

**Score** — Calculated user scores.
- `id`, `userId`, `tournamentId`, `groupScore`, `knockoutScore`, `totalScore`
- Unique constraint: `[userId, tournamentId]`

---

## 6. API Design

All endpoints are prefixed with `/api/`.

### 6.1 Authentication

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| POST | `/auth/register` | Public | Register with email + password |
| POST | `/auth/login` | Public | Login with email + password |
| GET | `/auth/google` | Public | Redirect to Google OAuth |
| GET | `/auth/google/callback` | Public | Google OAuth callback → JWT |
| GET | `/auth/me` | JWT | Get current user profile |
| POST | `/auth/logout` | Public | Clear auth cookie |

**Auth flow:** All endpoints return a JWT token (7-day expiry) set as an HTTP-only cookie and in the response body. The frontend stores the token and sends it as `Authorization: Bearer <token>` on subsequent requests.

**Google OAuth flow:**
1. Frontend redirects to `/api/auth/google`
2. Express redirects to Google consent screen
3. Google callbacks to `/api/auth/google/callback`
4. Express creates/finds user, generates JWT, redirects to frontend with token

### 6.2 Tournaments

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| GET | `/tournaments` | Public | List all tournaments with groups and rounds |
| GET | `/tournaments/:id` | Public | Tournament detail with teams, matches |

### 6.3 Predictions

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| POST | `/predictions/group` | JWT | Save/update group prediction |
| POST | `/predictions/knockout` | JWT | Save/update knockout prediction |
| GET | `/predictions/my/:tournamentId` | JWT | Get current user's predictions |
| GET | `/predictions/all/:tournamentId` | Public | All predictions (for leaderboard) |

### 6.4 Admin

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| POST | `/admin/tournaments` | Admin | Create tournament |
| POST | `/admin/tournaments/:id/groups` | Admin | Add group |
| POST | `/admin/tournaments/:id/teams` | Admin | Add team to group |
| POST | `/admin/results` | Admin | Enter group or knockout results |
| POST | `/admin/calculate-scores` | Admin | Trigger score calculation |

### 6.5 Leaderboard

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| GET | `/leaderboard/:tournamentId` | Public | Rankings sorted by total score |

### 6.6 Health

| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/health` | Returns `{ status: "ok" }` |

---

## 7. Frontend Architecture

### 7.1 Component Tree

```
App
├── LanguageProvider (i18n context)
│   └── AuthProvider (auth context)
│       ├── Navbar
│       │   ├── Logo + Nav links
│       │   ├── Language toggle (EN/ES)
│       │   └── Auth controls (login/register or avatar/logout)
│       │
│       └── Routes
│           ├── / ─────────── Home (landing, how-it-works, scoring rules)
│           ├── /login ────── Login (email/password + Google OAuth)
│           ├── /register ─── Register (name, email, password + Google)
│           ├── /tournament/:id ── Tournament (groups, teams, status)
│           ├── /tournament/:id/predict ── Predict (5-step bracket)
│           ├── /leaderboard/:id ───────── Leaderboard (rankings + prizes)
│           ├── /profile ──── Profile (user stats)
│           └── /admin ────── Admin (results entry, score calculation)
```

### 7.2 State Management

No external state library — React Context handles global state:

- **AuthContext** — User object, JWT token, login/register/logout functions. Token persisted in localStorage.
- **LanguageContext** — Current language (en/es), `t(key)` translation function. Language persisted in localStorage.

Page-level state uses React's `useState` and `useEffect` hooks for API data fetching.

### 7.3 Prediction Page (Core UI)

The prediction page is the heart of the app — a 5-step wizard with a visual bracket:

**Step 1 — Group Stage:**
- Grid of 12 group cards (A–L)
- Each card shows 4 teams with dropdowns to select 1st and 2nd place
- Teams displayed with flag icons and names

**Steps 2–5 — Knockout Bracket:**
- Visual bracket tree with connecting lines
- Matches auto-populate from previous round selections
- Click a team to select them as the winner
- Cascading updates: changing an earlier pick clears downstream selections

**State flow:**
```
groupPicks (12 groups × {first, second})
    ↓ auto-populate
r16Picks (12 matches × winner)
    ↓ auto-populate
qfPicks (4 matches × winner)
    ↓ auto-populate
sfPicks (2 matches × winner)
    ↓ auto-populate
finalPick (1 match × champion)
```

### 7.4 Internationalization (i18n)

Custom lightweight i18n — no external library:

- `translations.js` — Flat key-value objects for EN and ES
- `LanguageContext` — Provides `t(key)` function that looks up the current language's translation
- Language toggle in Navbar switches between EN/ES flag buttons
- All user-facing strings go through `t()` — no hardcoded text in components

### 7.5 Design System

- **Theme:** Dark sports aesthetic — slate-900 background, emerald-500 accents, white text
- **Typography:** System font stack (Apple, Segoe UI, Roboto)
- **Cards:** Slate-800 backgrounds with subtle borders
- **Buttons:** Emerald-600 primary, slate-700 secondary
- **Responsive:** Mobile-first, hamburger nav on small screens

---

## 8. Scoring Engine

Located in `api/scoring.cjs`. Three exported functions:

### 8.1 `scoreGroupPrediction(prediction, result)`

Compares predicted {first, second} against actual {first, second}:

```
prediction = { first: "ARG", second: "GER" }
result     = { first: "ARG", second: "GER" }
→ 4 points (both correct, correct positions)

prediction = { first: "GER", second: "ARG" }
result     = { first: "ARG", second: "GER" }
→ 3 points (both correct, inverted)

prediction = { first: "ARG", second: "BRA" }
result     = { first: "ARG", second: "GER" }
→ 2 points (one correct in right position)

prediction = { first: "BRA", second: "ARG" }
result     = { first: "ARG", second: "GER" }
→ 1 point (one correct, wrong position)

prediction = { first: "BRA", second: "FRA" }
result     = { first: "ARG", second: "GER" }
→ 0 points
```

### 8.2 `scoreKnockoutPrediction(predictedWinner, actualWinner, pointsPerCorrect)`

Binary match: correct winner = `pointsPerCorrect`, wrong = 0.

### 8.3 `calculateTotalScore(groupPredictions, groupResults, knockoutPredictions, knockoutMatches, roundPointsMap)`

Aggregates all predictions for a user across all rounds. Returns `{ groupScore, knockoutScore, totalScore }`.

---

## 9. Security

### 9.1 Authentication

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens with 7-day expiry, signed with HS256
- HTTP-only cookies for session persistence
- CORS restricted to `SITE_URL`

### 9.2 Authorization

- JWT verification middleware on protected routes
- Admin role check middleware on admin routes
- Users can only modify their own predictions

### 9.3 Data Protection

- No passwords stored in plaintext
- Google OAuth: only email, name, and profile picture accessed
- Database credentials stored in environment variables, never in code
- `.env` excluded from git

---

## 10. Deployment

### 10.1 Netlify (Current)

```
netlify.toml:
  build command: npm run build
  publish: dist/
  functions: netlify/functions/

Redirects:
  /api/* → /.netlify/functions/api/:splat (200)
  /*     → /index.html (200, SPA fallback)
```

**Environment variables required:**
- `DATABASE_URL` — Neon connection string
- `JWT_SECRET` — Random secret for token signing
- `GOOGLE_CLIENT_ID` — Google Cloud Console
- `GOOGLE_CLIENT_SECRET` — Google Cloud Console
- `GOOGLE_CALLBACK_URL` — `https://your-site.netlify.app/api/auth/google/callback`
- `SITE_URL` — `https://your-site.netlify.app`

### 10.2 Kubernetes (Future)

See `docs/KEYCLOAK_MIGRATION.md` for the full migration guide. Key changes:

- Express app deployed as a container (`api/server.cjs` entrypoint)
- Keycloak replaces Passport.js direct OAuth
- Database moves to RDS/CloudSQL/self-hosted Postgres
- Frontend served by Nginx or S3+CloudFront

---

## 11. Development Workflow

### 11.1 Local Setup

```bash
# Start Postgres
docker run -d --name prode-postgres \
  -e POSTGRES_USER=prode -e POSTGRES_PASSWORD=prode123 -e POSTGRES_DB=prode \
  -p 5432:5432 postgres:16-alpine

# Install, configure, seed
npm install
cp .env.example .env   # edit DATABASE_URL for local
npx prisma db push
npx prisma generate
npm run db:seed

# Run (frontend :5173 + API :3001)
npm run dev
```

### 11.2 Project Structure

```
prode/
├── api/                    # Backend (CommonJS)
│   ├── app.cjs             # Express routes (19 endpoints)
│   ├── db.cjs              # Prisma client with pg adapter
│   ├── scoring.cjs         # Scoring engine
│   ├── seed.cjs            # Database seeder (WC2026 data)
│   └── server.cjs          # Local dev server
├── docs/
│   ├── ARCHITECTURE.md     # This document
│   └── KEYCLOAK_MIGRATION.md
├── netlify/
│   └── functions/
│       └── api.cjs         # serverless-http wrapper
├── prisma/
│   └── schema.prisma       # 8 models
├── src/                    # Frontend (ESM/JSX)
│   ├── components/
│   │   └── Navbar.jsx
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── i18n/
│   │   ├── translations.js # EN + ES strings
│   │   └── LanguageContext.jsx
│   ├── pages/
│   │   ├── Home.jsx        # Landing page
│   │   ├── Login.jsx       # Email + Google auth
│   │   ├── Register.jsx    # Registration form
│   │   ├── Tournament.jsx  # Tournament detail
│   │   ├── Predict.jsx     # 5-step bracket wizard (core UI)
│   │   ├── Leaderboard.jsx # Rankings + prize pool
│   │   ├── Admin.jsx       # Results + score calculation
│   │   └── Profile.jsx     # User profile
│   ├── utils/
│   │   └── api.js          # Fetch wrapper with auth
│   ├── App.jsx             # Router + providers
│   ├── main.jsx            # Entry point
│   └── index.css           # Global styles
├── build.mjs               # esbuild production bundler
├── netlify.toml            # Netlify config
├── package.json
└── .env.example
```

---

## 12. Future Enhancements

### Phase 2 — Post-MVP
- Real-time score updates via WebSocket or SSE
- Push notifications (match reminders, score alerts)
- Payment integration (Stripe/MercadoPago) for entry fees
- Social features: private leagues with invite codes, group chat
- User avatars and profile customization
- Email verification and password reset

### Phase 3 — Platform
- Multi-tournament support (Copa America, Champions League, NBA Playoffs)
- Custom scoring rules per tournament
- Tournament creation by any user (not just admins)
- API for third-party integrations
- Mobile apps (React Native)

### Phase 4 — Infrastructure
- Keycloak migration (see `docs/KEYCLOAK_MIGRATION.md`)
- Kubernetes deployment
- CI/CD pipeline (GitHub Actions → Docker → K8s)
- Monitoring and observability (Prometheus, Grafana)
- Database read replicas for leaderboard queries
