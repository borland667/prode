# QA Checklist

Use this document as the manual regression and release smoke-test plan.

## 1. Preflight

Run:

```bash
nvm use
npm install
npm run db:migrate
npm run db:seed
npm run db:backfill:translations
npm run dev
```

Open:

- app: `http://localhost:5173`
- API health: `http://localhost:3001/api/health`

## 2. Local Admin Setup

The seed does not automatically create an admin user.

1. Register a normal account.
2. Run `npm run db:studio`.
3. Open the `User` table.
4. Change the account `role` to `ADMIN`.
5. Refresh the app and confirm the admin route is available.

## 3. Suggested Test Accounts

- `Admin`
- `User A`
- `User B`

Use separate browsers or private windows when you need concurrent sessions.

## 4. Guest Experience

1. Open `/`.
2. Confirm the landing page loads without auth.
3. Confirm the featured tournament card renders.
4. Confirm active tournaments render.
5. Confirm rules are tied to the featured tournament mode.
6. Switch language.
7. Switch theme.

Expected:

- guest browsing works without login
- copy changes with language
- dates and numbers match the browser locale
- the page remains readable in both light and dark modes

## 5. Registration, Login, Logout

1. Register `User A`.
2. Log out.
3. Log in again with the same account.
4. Log out again.

Expected:

- registration authenticates the new user
- login restores the session
- logout removes authenticated navigation

## 5.1 Analytics Smoke Test

Use this only when analytics env vars are configured.

1. Open the app.
2. Visit `/`, a tournament page, `/leaderboard`, and `/leaderboard/global`.
3. Register or log in.
4. Save a prediction set.
5. Create or join a league if available.

Expected:

- pageviews are recorded without adding vendor-specific code to individual pages
- login, registration, verification, leaderboard view, tournament view, prediction save, and league events appear in the configured analytics provider

## 6. Forgot Password And Reset Password

1. Open `/forgot-password`.
2. Submit `User A` email.
3. In local development, capture the returned reset URL or token payload.
4. Open the reset link.
5. Set a new password.
6. Log in with the new password.

Expected:

- forgot-password succeeds without leaking account existence
- reset token works once
- new password replaces the old one

## 7. Profile And Global Ranking Visibility

1. Open `/profile`.
2. Confirm stats load.
3. Update display name.
4. Update avatar URL.
5. Toggle global ranking visibility off.
6. Reload the page.
7. Toggle visibility back on.
8. Change password from the profile page.

Expected:

- identity updates persist
- navbar updates with the new name/avatar
- visibility toggle persists
- password change succeeds

## 8. Public Tournament Participation

1. As `User A`, open the seeded public tournament.
2. Confirm tournament metadata renders.
3. Open the prediction wizard.
4. Fill the group stage.
5. Continue through knockout rounds.
6. Save.
7. Return to the tournament page.

Expected:

- the tournament page recognizes saved predictions
- user can return to the prediction wizard before lock
- predictions persist on reload

## 9. Random Fill

1. Open the prediction wizard for a tournament or league.
2. Use the random-fill action.
3. Confirm the flow advances to the final step.
4. Move backward through the steps.
5. Confirm all picks are populated consistently.

Expected:

- random fill populates every step
- downstream knockout picks remain valid
- best-third-place assignments are unique where required

## 10. Private Tournament Join

1. As `Admin`, set a tournament to `private`.
2. Save and copy the tournament join code.
3. As `User B`, open the tournament.
4. Confirm prediction actions are blocked.
5. Try an invalid code.
6. Try the correct code.

Expected:

- non-members cannot participate
- bad code is rejected
- valid code grants membership
- prediction actions unlock after membership

## 11. Prediction Locking

1. As `Admin`, set the tournament closing date to the past.
2. Reload as a normal user.
3. Try to enter or save predictions.
4. If the tournament is private, try to join after lock.

Expected:

- prediction window shows locked/closed state
- saves are rejected
- new joins are blocked once the tournament is closed

## 12. Scoped Predictions And Primary Entry

1. As `User A`, save tournament-wide predictions.
2. Create a league in the same tournament.
3. Save a different prediction set inside that league.
4. Open the tournament page.
5. Set the league entry as the official primary entry.
6. Switch it back to the tournament entry.

Expected:

- tournament and league predictions remain independent
- the official-entry setting updates successfully
- only scopes with predictions can be selected

## 13. League Lifecycle

1. As `User A`, create a league.
2. Confirm it appears under personal leagues.
3. Copy the join code.
4. Copy the invite link.
5. As `User B`, join by code.
6. Open the invite link directly in a new session.
7. Confirm the invite screen resolves correctly.
8. Join the league from the invite screen if not already joined.
9. As owner, rename the league and update the description.
10. Regenerate the join code.
11. As `User B`, leave the league.
12. As owner, delete the league.

Expected:

- code join works
- invite-link flow works
- owner updates persist
- join-code regeneration works
- leaving and deleting behave correctly

## 14. Tournament Leaderboard

1. Open `/leaderboard`.
2. Confirm the tournament board switcher renders when tournaments exist.
3. Select a tournament board.
4. Open the same tournament through `/leaderboard/:id`.
5. Compare the selected board with the direct route.
6. If private leagues exist inside that tournament, switch to a league board.
7. Return to the tournament board.
8. If prizes are enabled, confirm prize information renders.
9. Disable prizes from admin and reload.

Expected:

- the leaderboard hub can switch across accessible tournament boards
- direct tournament leaderboard routes still resolve correctly
- private league boards are scoped to the selected tournament
- tournament leaderboard reflects tournament-scope scores
- round columns match the structure
- prize UI only appears when enabled

## 15. League Leaderboard

1. Ensure at least two users are in the same league with predictions.
2. Open the league page.
3. Confirm only league members appear.
4. Compare with the tournament leaderboard.

Expected:

- league leaderboard is filtered to that league
- tournament leaderboard is not replaced by league-only results

## 16. League Prediction Copy Flow

1. As `User A`, save tournament-wide predictions.
2. Create or join a private league in the same tournament.
3. Open the league page.
4. Use the copy-predictions control to copy either the tournament scope or another league scope into this league.
5. Open the league prediction wizard.
6. Confirm the copied picks are present.
7. Change one copied prediction and save again.
8. Reopen the original source scope.

Expected:

- the copy flow creates a league-scoped prediction set for that league
- copied predictions are editable after the copy
- changing the copied league scope does not overwrite the original source scope

## 17. Global Rankings

1. Ensure visible users have official entries and saved scores.
2. Open `/leaderboard/global` while authenticated.
3. Confirm the current user appears if visible.
4. Turn visibility off from the profile page.
5. Reload the global rankings.

Expected:

- global rankings require login
- hidden users disappear from shared rankings
- ranking is based on official tournament entries, not every possible league scope

## 18. Spectator Tournament View

1. As `Admin`, save group results.
2. Save knockout results.
3. Open the tournament page as a spectator or participant.
4. Inspect the groups section.
5. Inspect the knockout section.

Expected:

- groups reorder to reflect results
- top placements are clear
- knockout winners and resolved participants are visible

## 19. Prediction Deletion API

This is currently an API-level maintenance check.

1. Save predictions for a tournament or league.
2. Identify one prediction record ID from the database or API response path.
3. Call `DELETE /api/predictions/:id` while the tournament is still open.
4. Reload the relevant page.

Expected:

- predictions for the target scope are removed
- associated score for that scope is removed
- if the deleted scope was the official scope, the backend falls back safely when possible

## 19. Admin Tournament Builder

1. As `Admin`, open the admin page.
2. Create a test tournament from JSON groups and rounds.
3. Confirm it appears in the selector and homepage.
4. Edit its structure before any participation exists.
5. After adding members or predictions, try to edit structure again.

Expected:

- creation succeeds
- empty tournaments are editable
- active tournaments reject unsafe structural edits

## 20. Admin Results And Score Recalculation

1. Ensure at least two users have predictions in the same tournament.
2. Save group results as `Admin`.
3. Reload leaderboard views.
4. Save knockout results.
5. Reload leaderboard views again.
6. Trigger manual `Calculate Scores`.

Expected:

- scores update after results are saved
- manual recalculation still works
- stored scores and displayed rankings stay aligned

## 21. Optional Google OAuth Check

Run only if local Google OAuth is configured.

1. Open login.
2. Use Google sign-in.
3. Confirm the app returns authenticated.
4. Confirm matching-email users are linked instead of duplicated.

## 22. Minimum Release Smoke Test

Before shipping, at minimum repeat:

- guest experience
- registration/login/logout
- forgot-password/reset-password
- public tournament predictions
- private tournament join
- scoped predictions and primary entry
- league lifecycle
- tournament leaderboard
- global rankings
- admin results and score recalculation
