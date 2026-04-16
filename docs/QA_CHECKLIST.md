# QA Checklist

Use this document as the manual test plan for local development and release smoke testing.

## Preflight

- Run `nvm use`
- Run `npm run db:migrate`
- Run `npm run db:seed`
- Run `npm run dev`
- Open the app at `http://localhost:5173`

## Local Admin Setup

The seed does not create an admin user automatically.

1. Register a normal account from the app.
2. Open Prisma Studio with `npm run db:studio`.
3. Open the `User` table and change that account's `role` to `ADMIN`.
4. Refresh the app and confirm the `Admin` entry appears in the navbar.

## Test Accounts

- `User A`: regular participant
- `User B`: second participant for league and leaderboard checks
- `Admin`: promoted account for tournament management

## Flow 1: Guest Discovery

- Open `/`
- Confirm the home page loads without auth
- Confirm the featured tournament card renders
- Confirm the active tournaments section renders at least one tournament
- Confirm the rules panel matches the featured tournament mode
- Confirm light mode and dark mode both render correctly
- Confirm the language toggle switches visible copy

Expected:
- No authenticated controls are required to browse the landing page
- Tournament cards link to tournament detail pages

## Flow 2: Registration, Login, Logout

1. Register `User A`
2. Log out
3. Log in again with email/password
4. Log out again

Expected:
- Registration lands on the authenticated experience
- Login restores the same user
- Logout removes authenticated navigation and returns to guest behavior

## Flow 3: Forgot Password And Reset Password

1. Open `/forgot-password`
2. Submit `User A` email
3. In local non-production mode, copy the returned reset URL from the success panel
4. Open the reset URL
5. Submit a new password
6. Log in with the new password

Expected:
- The forgot-password flow succeeds without exposing whether an email exists
- Local dev shows a reset URL
- The reset token works once
- Login succeeds with the new password

## Flow 4: Profile And Account Management

1. Open `/profile`
2. Confirm account stats load
3. Update display name
4. Update avatar URL
5. Confirm the navbar/profile page reflect the new identity
6. Change password from the security section

Expected:
- Profile data comes from real API state, not placeholders
- Name/avatar updates persist immediately
- Password change succeeds and future login uses the new password

## Flow 5: Public Tournament Participation

1. As `User A`, open the seeded public tournament page
2. Confirm tournament metadata renders
3. Confirm prediction CTA is visible while the tournament is open
4. Enter predictions
5. Save predictions
6. Return to the tournament page

Expected:
- User can submit group and knockout predictions
- Returning to the tournament shows the prediction flow as already started
- Predictions persist on reload

## Flow 6: Private Tournament Join Flow

1. As `Admin`, open `/admin`
2. Switch the tournament to `private`
3. Save settings
4. Copy the join code
5. As `User B`, open the same tournament
6. Confirm the tournament requires a join code
7. Try a bad code
8. Try the correct code

Expected:
- Non-members cannot access prediction/leaderboard actions
- Invalid code is rejected
- Valid code grants membership and unlocks participation

## Flow 7: Prediction Locking

1. As `Admin`, set the tournament `closingDate` to a time in the past using the tournament builder or DB
2. Reload the tournament as `User A`
3. Attempt to open prediction entry
4. Attempt to join the private tournament as a new user if applicable
5. Attempt to save predictions directly if already inside the wizard

Expected:
- Tournament status resolves to `closed`
- Prediction CTAs disappear or switch to a locked state
- API rejects new prediction submissions
- API rejects new joins once the tournament is closed

## Flow 8: League Lifecycle

1. As `User A`, create a private league inside the tournament
2. Confirm the new league appears in `Your leagues`
3. Copy the league join code
4. As `User B`, join the league
5. Open the league page as both users
6. As `User A` (owner), rename the league
7. Regenerate the join code
8. As `User B`, leave the league
9. As `User A`, delete the league

Expected:
- League create/join works
- League leaderboard is limited to league members
- Owner can edit name/description and rotate code
- Members can leave
- Owner can delete the league

## Flow 9: Admin Tournament Builder

1. As `Admin`, open the tournament builder section
2. Create a small test tournament with custom groups and rounds
3. Confirm it appears in the tournament selector and on the homepage
4. Edit that same tournament structure before any members/predictions exist
5. After adding participation or predictions, try to edit structure again

Expected:
- New tournaments can be created without seeding
- Empty tournaments can be structurally edited
- Tournaments with real activity reject unsafe structure edits

## Flow 10: Admin Results And Automatic Score Updates

1. Ensure `User A` and `User B` both have predictions in the same tournament
2. As `Admin`, enter group results
3. Open the leaderboard in another session
4. As `Admin`, enter knockout results
5. Refresh the leaderboard again
6. Optionally press `Calculate Scores`

Expected:
- Leaderboard updates automatically after results are saved
- Manual score calculation still works as a repair/re-sync action
- Stored scores and displayed leaderboard stay aligned

## Flow 11: Leaderboards And Prizes

1. Open the tournament leaderboard
2. Confirm round columns match the tournament structure
3. Confirm total scores are populated
4. If prizes are enabled, confirm prize pool math renders
5. Disable prizes from admin and reload

Expected:
- Round scoring columns are dynamic
- Prize pool appears only when enabled
- Leaderboard remains viewable according to tournament access rules

## Flow 12: Spectator Tournament View

1. Enter some group results and knockout winners as `Admin`
2. Open the tournament page as a spectator or participant
3. Review the group cards
4. Review the knockout progress section

Expected:
- Group cards reorder to reflect saved standings
- Top positions are visually obvious
- Knockout rounds show resolved participants and marked winners

## Optional Google Auth Check

Only run this if local Google OAuth is configured.

1. Open login
2. Use Google sign-in
3. Confirm the app returns to the authenticated state
4. Confirm an existing email account links correctly instead of duplicating users

## Release Smoke Test Minimum

Before shipping, at minimum re-run:

- Flow 1
- Flow 2
- Flow 5
- Flow 7
- Flow 8
- Flow 9
- Flow 10
- Flow 12

## Notes

- In local non-production mode, forgot-password returns a `resetUrl` in the API response so the reset flow can be tested without email infrastructure.
- If you want a clean rerun, use `npx prisma migrate reset` and reseed.
