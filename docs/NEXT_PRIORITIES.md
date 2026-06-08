# Next Priorities for Prode

## Current State

✅ All critical bugs resolved (Google OAuth security, Round of 16 label, Third place match)
✅ All 16 tests passing
✅ Build successful
✅ Production-ready codebase

## Priority 1: Design-System Migration (High Priority)

**Goal:** Bring all user-facing pages onto the shared design-system primitives.

**Status:** 
- Partially complete (home, navbar, auth, tournament, leaderboard, league, invite, prediction, profile, admin migrated)
- Legacy aliases still exist in most pages

**Pages Still Needing Migration:**
1. `src/pages/Predict.jsx` - Prediction wizard (high priority)
2. `src/pages/Leaderboard.jsx` - Leaderboard hub (high priority)  
3. `src/pages/Admin.jsx` - Admin tools (high priority)
4. `src/pages/LeagueInvite.jsx` - League invite (high priority)
5. `src/pages/ForgotPassword.jsx` - Password reset
6. `src/pages/ResetPassword.jsx` - Password reset
7. `src/pages/VerifyEmail.jsx` - Email verification

**Migration Tasks:**
- Replace legacy `sport-*`, `app-*`, and `page-*` classes with `ds-*` classes
- Use shared React primitives: `PageShell`, `Panel`, `Button`, `Pill`, `DisplayText`
- Ensure consistent spacing and styling across all pages
- Test on mobile and desktop

**Definition of Done:**
- No new one-off button or panel styling
- Shared button, panel, page, and badge components used consistently
- Old ad-hoc layout classes reduced where practical

---

## Priority 2: Browser-Level E2E Coverage (High Priority)

**Goal:** Complement Node integration and utility tests with browser flow coverage.

**Priority Flows:**
1. Register/login/logout
2. Forgot-password/reset-password
3. Public tournament predictions
4. Private tournament join
5. League create/join/invite
6. Primary-entry selection
7. Global ranking visibility toggle

**Testing Tools:**
- Playwright or Cypress for browser automation
- GitHub Actions for CI
- Smoke tests for core user journeys

**Definition of Done:**
- Browser E2E tests covering all core user flows
- Tests run in CI pipeline
- Pass/fail indicators for UI regressions

---

## Priority 3: Tournament Format Families (Medium Priority)

**Current Limitation:**
- Generic sport/mode metadata but only one football group-plus-knockout engine

**Next Steps:**
1. Model format families explicitly
2. Stop assuming all tournaments share bracket logic
3. Add playoff-only engine
4. Add best-of-series engine
5. Add league-table competition engine
6. Add hybrid format engines

**Target Formats:**
- NBA-style playoff bracket
- NHL-style playoff bracket
- Champions League-style hybrid
- Tournament-specific engines

**Definition of Done:**
- Multiple tournament engines supported
- Format families explicitly modeled
- Easy to add new tournament types

---

## Priority 4: Official Import Pipeline (Medium Priority)

**Current State:**
- Curated seed data only
- No official live data imports

**Needed:**
- Import format definition
- Idempotent importer
- Validation of groups, rounds, slots, references
- Import-vs-seed separation

**Use Cases:**
- Import from official competition feeds
- Refresh tournament data automatically
- Validate imported data

**Definition of Done:**
- Official import pipeline operational
- Idempotent data refresh
- Validation and error handling

---

## Priority 5: Payment and Prize Operations (Medium Priority)

**Current State:**
- Prize toggles and entry-fee metadata exist
- No payment provider integration
- No payout lifecycle

**Needed:**
- Payment collection (Stripe, PayPal, etc.)
- Paid-entry state tracking
- Prize split configuration
- Settlement workflow
- Payout tracking

**Definition of Done:**
- Payment provider integration
- Transaction logging
- Settlement reporting
- Prize distribution automation

---

## Priority 6: Communication and Notifications (Medium Priority)

**Current State:**
- Password reset email support
- League sharing via link/code only

**Needed:**
- Invite emails (league creation/invites)
- Tournament close reminders
- Leaderboard update notifications
- Admin operational alerts

**Definition of Done:**
- Email notifications for all user actions
- Push notifications (optional)
- Notification preferences per user

---

## Priority 7: Admin Tooling (Low Priority)

**Current State:**
- Admin can create tournaments from JSON
- Manual JSON editing required

**Needed:**
- Schema-guided JSON validation in UI
- CSV upload for tournament structure
- JSON upload helpers
- Safer round/group editors

**Definition of Done:**
- Admin can create tournaments without JSON editing
- CSV/JSON upload supported
- Validation errors clearly displayed

---

## Recommended Order (as per ROADMAP.md)

1. ✅ **Design-system migration** (finish remaining pages)
2. ✅ **Browser E2E coverage** (smoke tests for core flows)
3. **Format families** (define explicit tournament types)
4. **Second engine** (build first non-football engine)
5. **Official import tooling** (idempotent data refresh)
6. **Admin bulk tooling** (reduce manual JSON editing)
7. **Payment and prize operations** (if prizes become real-money)
8. **Notifications and operational workflows** (broader alerts)

---

## Current Quick Wins (Easy to Implement)

### Without Major Development

1. **Add E2E tests for core flows** (2-3 days)
   - Register/login/logout
   - Public tournament prediction
   - Private league join

2. **Fix remaining design-system classes** (1-2 days)
   - Predict.jsx
   - Leaderboard.jsx
   - Admin.jsx

3. **Add CSV upload for teams** (1 day)
   - Bulk team import
   - Validation helpers

---

## Estimated Effort

| Priority | Effort | Impact |
|----------|--------|--------|
| 1. Design-system migration | 5-10 days | High |
| 2. Browser E2E tests | 3-5 days | High |
| 3. Format families | 10-15 days | Medium |
| 4. Second engine | 15-20 days | Medium |
| 5. Import pipeline | 10-15 days | Medium |
| 6. Admin tooling | 5-10 days | Low |
| 7. Payment operations | 15-20 days | Medium |
| 8. Notifications | 10-15 days | Medium |

**Total Estimated: 63-103 days (3-5 months)**

---

## Immediate Action Items

**This Week:**
- [ ] Identify which pages need design-system migration
- [ ] Set up Playwright for E2E tests
- [ ] Plan format family architecture

**Next Week:**
- [ ] Begin design-system migration on Predict.jsx
- [ ] Create E2E test framework
- [ ] Research payment providers (Stripe/PayPal)

**Next Month:**
- [ ] Complete design-system migration
- [ ] Have E2E tests for core flows
- [ ] Define format family architecture