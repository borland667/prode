import test from 'node:test';
import assert from 'node:assert/strict';

import { apiRequest, createApiTestEnvironment } from './helpers/api-test-env.mjs';

const TEST_TOURNAMENT = {
  name: 'Private Test Cup',
  nameEs: 'Copa Privada Test',
  sport: 'football',
  modeKey: 'classic_argentinian_prode',
  modeName: 'Classic Argentinian Prode',
  modeNameEs: 'Prode Argentino Clasico',
  status: 'upcoming',
  prizesEnabled: true,
  entryFee: 10,
  currency: 'USD',
  accessType: 'private',
  joinCode: 'TEST42',
  startDate: '2026-07-01T12:00:00.000Z',
  endDate: '2026-07-20T12:00:00.000Z',
  closingDate: '2099-07-01T12:00:00.000Z',
  groups: [
    {
      name: 'A',
      teams: [
        { name: 'Argentina', code: 'ARG' },
        { name: 'Australia', code: 'AUS' },
      ],
    },
    {
      name: 'B',
      teams: [
        { name: 'Brazil', code: 'BRA' },
        { name: 'Belgium', code: 'BEL' },
      ],
    },
  ],
  rounds: [
    {
      name: 'semi_finals',
      nameEs: 'Semifinales',
      order: 1,
      pointsPerCorrect: 2,
      matches: [
        { matchNumber: 1, homeLabel: '1A', awayLabel: '2B' },
        { matchNumber: 2, homeLabel: '1B', awayLabel: '2A' },
      ],
    },
    {
      name: 'final',
      nameEs: 'Final',
      order: 2,
      pointsPerCorrect: 4,
      matches: [{ matchNumber: 1, homeLabel: 'W-SF-1', awayLabel: 'W-SF-2' }],
    },
  ],
};

function mapGroupsByName(tournament) {
  return Object.fromEntries((tournament.groups || []).map((group) => [group.name, group]));
}

function mapMatchesByCode(tournament) {
  return Object.fromEntries(
    (tournament.rounds || [])
      .flatMap((round) => round.matches || [])
      .map((match) => [match.code, match])
  );
}

async function registerUser(baseUrl, { name, email, password }) {
  const { response, payload } = await apiRequest(baseUrl, '/api/auth/register', {
    method: 'POST',
    body: { name, email, password },
  });

  assert.equal(response.status, 200, payload.error || 'Registration failed');
  assert.ok(payload.token, 'Expected auth token from registration');
  return payload;
}

test('core API flows work end to end', async () => {
  const env = await createApiTestEnvironment();

  try {
    const { baseUrl, prisma } = env;

    const health = await apiRequest(baseUrl, '/api/health');
    assert.equal(health.response.status, 200);
    assert.deepEqual(health.payload, { status: 'ok' });

    const adminRegistration = await registerUser(baseUrl, {
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'supersecret1',
    });
    await prisma.user.update({
      where: { email: 'admin@example.com' },
      data: { role: 'ADMIN' },
    });

    const adminLogin = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@example.com', password: 'supersecret1' },
    });
    assert.equal(adminLogin.response.status, 200);
    const adminToken = adminLogin.payload.token;

    const userA = await registerUser(baseUrl, {
      name: 'User A',
      email: 'usera@example.com',
      password: 'supersecret1',
    });
    const userAToken = userA.token;

    const userB = await registerUser(baseUrl, {
      name: 'User B',
      email: 'userb@example.com',
      password: 'supersecret1',
    });
    const userBToken = userB.token;

    const forgotPassword = await apiRequest(baseUrl, '/api/auth/forgot-password', {
      method: 'POST',
      body: { email: 'userb@example.com' },
    });
    assert.equal(
      forgotPassword.response.status,
      200,
      forgotPassword.payload.error || JSON.stringify(forgotPassword.payload)
    );
    assert.ok(forgotPassword.payload.resetToken);

    const resetPassword = await apiRequest(baseUrl, '/api/auth/reset-password', {
      method: 'POST',
      body: {
        token: forgotPassword.payload.resetToken,
        password: 'supersecret2',
      },
    });
    assert.equal(resetPassword.response.status, 200);

    const userBRelogin = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: 'userb@example.com', password: 'supersecret2' },
    });
    assert.equal(userBRelogin.response.status, 200);
    const userBUpdatedToken = userBRelogin.payload.token;

    const userAProfileUpdate = await apiRequest(baseUrl, '/api/account/profile', {
      method: 'PATCH',
      token: userAToken,
      body: {
        name: 'User A Updated',
        avatarUrl: 'https://example.com/avatar.png',
      },
    });
    assert.equal(userAProfileUpdate.response.status, 200);

    const userAChangePassword = await apiRequest(baseUrl, '/api/account/change-password', {
      method: 'POST',
      token: userAToken,
      body: {
        currentPassword: 'supersecret1',
        newPassword: 'supersecret3',
      },
    });
    assert.equal(userAChangePassword.response.status, 200);

    const userARelogin = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: 'usera@example.com', password: 'supersecret3' },
    });
    assert.equal(userARelogin.response.status, 200);
    const userAUpdatedToken = userARelogin.payload.token;

    const createTournament = await apiRequest(baseUrl, '/api/tournaments', {
      method: 'POST',
      token: adminToken,
      body: TEST_TOURNAMENT,
    });
    assert.equal(createTournament.response.status, 201, createTournament.payload.error);

    const tournament = createTournament.payload.tournament;
    const tournamentId = tournament.id;
    const groupsByName = mapGroupsByName(tournament);
    const matchesByCode = mapMatchesByCode(tournament);

    const userATournamentListBeforeJoin = await apiRequest(baseUrl, '/api/tournaments', {
      token: userAUpdatedToken,
    });
    assert.equal(userATournamentListBeforeJoin.response.status, 200);
    assert.equal(
      userATournamentListBeforeJoin.payload.some((entry) => entry.id === tournamentId),
      false
    );

    const userAMyPredictionsBeforeJoin = await apiRequest(
      baseUrl,
      `/api/tournaments/${tournamentId}/my-predictions`,
      {
        token: userAUpdatedToken,
      }
    );
    assert.equal(userAMyPredictionsBeforeJoin.response.status, 500);
    assert.match(
      userAMyPredictionsBeforeJoin.payload.error,
      /only available to members/i
    );

    const userALeaderboardBeforeJoin = await apiRequest(
      baseUrl,
      `/api/tournaments/${tournamentId}/leaderboard`,
      {
        token: userAUpdatedToken,
      }
    );
    assert.equal(userALeaderboardBeforeJoin.response.status, 403);

    const badJoin = await apiRequest(baseUrl, `/api/tournaments/${tournamentId}/join`, {
      method: 'POST',
      token: userAUpdatedToken,
      body: { joinCode: 'NOPE' },
    });
    assert.equal(badJoin.response.status, 403);

    const userAJoin = await apiRequest(baseUrl, `/api/tournaments/${tournamentId}/join`, {
      method: 'POST',
      token: userAUpdatedToken,
      body: { joinCode: 'TEST42' },
    });
    assert.equal(userAJoin.response.status, 200);
    assert.equal(userAJoin.payload.tournament.access.isMember, true);

    const userBJoin = await apiRequest(baseUrl, `/api/tournaments/${tournamentId}/join`, {
      method: 'POST',
      token: userBUpdatedToken,
      body: { joinCode: 'TEST42' },
    });
    assert.equal(userBJoin.response.status, 200);

    const userANavigation = await apiRequest(baseUrl, '/api/account/navigation', {
      token: userAUpdatedToken,
    });
    assert.equal(userANavigation.response.status, 200);
    assert.equal(userANavigation.payload.tournaments.some((entry) => entry.id === tournamentId), true);

    const userAPredictions = await apiRequest(baseUrl, `/api/tournaments/${tournamentId}/predictions`, {
      method: 'POST',
      token: userAUpdatedToken,
      body: {
        groupPredictions: [
          {
            groupId: groupsByName.A.id,
            first: groupsByName.A.teams[0].id,
            second: groupsByName.A.teams[1].id,
          },
          {
            groupId: groupsByName.B.id,
            first: groupsByName.B.teams[0].id,
            second: groupsByName.B.teams[1].id,
          },
        ],
        knockoutPredictions: [
          { matchId: matchesByCode['SF-1'].id, predictedWinner: groupsByName.A.teams[0].id },
          { matchId: matchesByCode['SF-2'].id, predictedWinner: groupsByName.B.teams[0].id },
          { matchId: matchesByCode['FINAL-1'].id, predictedWinner: groupsByName.A.teams[0].id },
        ],
      },
    });
    assert.equal(userAPredictions.response.status, 200, userAPredictions.payload.error);

    const userBPredictions = await apiRequest(baseUrl, `/api/tournaments/${tournamentId}/predictions`, {
      method: 'POST',
      token: userBUpdatedToken,
      body: {
        groupPredictions: [
          {
            groupId: groupsByName.A.id,
            first: groupsByName.A.teams[1].id,
            second: groupsByName.A.teams[0].id,
          },
          {
            groupId: groupsByName.B.id,
            first: groupsByName.B.teams[1].id,
            second: groupsByName.B.teams[0].id,
          },
        ],
        knockoutPredictions: [
          { matchId: matchesByCode['SF-1'].id, predictedWinner: groupsByName.A.teams[1].id },
          { matchId: matchesByCode['SF-2'].id, predictedWinner: groupsByName.B.teams[1].id },
          { matchId: matchesByCode['FINAL-1'].id, predictedWinner: groupsByName.A.teams[1].id },
        ],
      },
    });
    assert.equal(userBPredictions.response.status, 200);

    const storedPredictions = await apiRequest(
      baseUrl,
      `/api/tournaments/${tournamentId}/my-predictions`,
      {
        token: userAUpdatedToken,
      }
    );
    assert.equal(storedPredictions.response.status, 200);
    assert.equal(storedPredictions.payload.groupPredictions.length, 2);
    assert.equal(storedPredictions.payload.knockoutPredictions.length, 3);

    const createLeague = await apiRequest(baseUrl, `/api/tournaments/${tournamentId}/leagues`, {
      method: 'POST',
      token: userAUpdatedToken,
      body: {
        name: 'Friends League',
        description: 'Private test league',
      },
    });
    assert.equal(createLeague.response.status, 200, createLeague.payload.error);

    const leagueId = createLeague.payload.league.id;
    const firstLeagueCode = createLeague.payload.league.joinCode;
    assert.ok(firstLeagueCode);

    const publicLeagueInvite = await apiRequest(baseUrl, `/api/leagues/invite/${firstLeagueCode}`);
    assert.equal(publicLeagueInvite.response.status, 200);
    assert.equal(publicLeagueInvite.payload.league.name, 'Friends League');
    assert.equal(publicLeagueInvite.payload.tournament.id, tournamentId);
    assert.equal(publicLeagueInvite.payload.access.requiresTournamentJoin, true);

    const userBJoinLeague = await apiRequest(baseUrl, `/api/tournaments/${tournamentId}/leagues/join`, {
      method: 'POST',
      token: userBUpdatedToken,
      body: { joinCode: firstLeagueCode },
    });
    assert.equal(userBJoinLeague.response.status, 200);

    const createSecondLeague = await apiRequest(baseUrl, `/api/tournaments/${tournamentId}/leagues`, {
      method: 'POST',
      token: userAUpdatedToken,
      body: {
        name: 'Office League',
        description: 'Separate scoped predictions',
      },
    });
    assert.equal(createSecondLeague.response.status, 200, createSecondLeague.payload.error);

    const secondLeagueId = createSecondLeague.payload.league.id;
    const secondLeagueCode = createSecondLeague.payload.league.joinCode;
    assert.ok(secondLeagueCode);

    const userBJoinSecondLeague = await apiRequest(baseUrl, `/api/tournaments/${tournamentId}/leagues/join`, {
      method: 'POST',
      token: userBUpdatedToken,
      body: { joinCode: secondLeagueCode },
    });
    assert.equal(userBJoinSecondLeague.response.status, 200);

    const joinedLeagueInvite = await apiRequest(baseUrl, `/api/leagues/invite/${firstLeagueCode}`, {
      token: userBUpdatedToken,
    });
    assert.equal(joinedLeagueInvite.response.status, 200);
    assert.equal(joinedLeagueInvite.payload.access.isLeagueMember, true);
    assert.equal(joinedLeagueInvite.payload.access.canViewLeague, true);

    const userBNavigation = await apiRequest(baseUrl, '/api/account/navigation', {
      token: userBUpdatedToken,
    });
    assert.equal(userBNavigation.response.status, 200);
    assert.equal(userBNavigation.payload.tournaments.some((entry) => entry.id === tournamentId), true);
    assert.equal(userBNavigation.payload.leagues.some((entry) => entry.id === leagueId), true);
    assert.equal(userBNavigation.payload.leagues.some((entry) => entry.id === secondLeagueId), true);

    const userALeagueOnePredictions = await apiRequest(baseUrl, `/api/leagues/${leagueId}/predictions`, {
      method: 'POST',
      token: userAUpdatedToken,
      body: {
        groupPredictions: [
          {
            groupId: groupsByName.A.id,
            first: groupsByName.A.teams[0].id,
            second: groupsByName.A.teams[1].id,
          },
          {
            groupId: groupsByName.B.id,
            first: groupsByName.B.teams[0].id,
            second: groupsByName.B.teams[1].id,
          },
        ],
        knockoutPredictions: [
          { matchId: matchesByCode['SF-1'].id, predictedWinner: groupsByName.A.teams[0].id },
          { matchId: matchesByCode['SF-2'].id, predictedWinner: groupsByName.B.teams[0].id },
          { matchId: matchesByCode['FINAL-1'].id, predictedWinner: groupsByName.A.teams[0].id },
        ],
      },
    });
    assert.equal(userALeagueOnePredictions.response.status, 200, userALeagueOnePredictions.payload.error);

    const userBLeagueOnePredictions = await apiRequest(baseUrl, `/api/leagues/${leagueId}/predictions`, {
      method: 'POST',
      token: userBUpdatedToken,
      body: {
        groupPredictions: [
          {
            groupId: groupsByName.A.id,
            first: groupsByName.A.teams[1].id,
            second: groupsByName.A.teams[0].id,
          },
          {
            groupId: groupsByName.B.id,
            first: groupsByName.B.teams[1].id,
            second: groupsByName.B.teams[0].id,
          },
        ],
        knockoutPredictions: [
          { matchId: matchesByCode['SF-1'].id, predictedWinner: groupsByName.A.teams[1].id },
          { matchId: matchesByCode['SF-2'].id, predictedWinner: groupsByName.B.teams[1].id },
          { matchId: matchesByCode['FINAL-1'].id, predictedWinner: groupsByName.A.teams[1].id },
        ],
      },
    });
    assert.equal(userBLeagueOnePredictions.response.status, 200, userBLeagueOnePredictions.payload.error);

    const userALeagueTwoPredictions = await apiRequest(baseUrl, `/api/leagues/${secondLeagueId}/predictions`, {
      method: 'POST',
      token: userAUpdatedToken,
      body: {
        groupPredictions: [
          {
            groupId: groupsByName.A.id,
            first: groupsByName.A.teams[1].id,
            second: groupsByName.A.teams[0].id,
          },
          {
            groupId: groupsByName.B.id,
            first: groupsByName.B.teams[1].id,
            second: groupsByName.B.teams[0].id,
          },
        ],
        knockoutPredictions: [
          { matchId: matchesByCode['SF-1'].id, predictedWinner: groupsByName.A.teams[1].id },
          { matchId: matchesByCode['SF-2'].id, predictedWinner: groupsByName.B.teams[1].id },
          { matchId: matchesByCode['FINAL-1'].id, predictedWinner: groupsByName.A.teams[1].id },
        ],
      },
    });
    assert.equal(userALeagueTwoPredictions.response.status, 200, userALeagueTwoPredictions.payload.error);

    const userBLeagueTwoPredictions = await apiRequest(baseUrl, `/api/leagues/${secondLeagueId}/predictions`, {
      method: 'POST',
      token: userBUpdatedToken,
      body: {
        groupPredictions: [
          {
            groupId: groupsByName.A.id,
            first: groupsByName.A.teams[0].id,
            second: groupsByName.A.teams[1].id,
          },
          {
            groupId: groupsByName.B.id,
            first: groupsByName.B.teams[0].id,
            second: groupsByName.B.teams[1].id,
          },
        ],
        knockoutPredictions: [
          { matchId: matchesByCode['SF-1'].id, predictedWinner: groupsByName.A.teams[0].id },
          { matchId: matchesByCode['SF-2'].id, predictedWinner: groupsByName.B.teams[0].id },
          { matchId: matchesByCode['FINAL-1'].id, predictedWinner: groupsByName.A.teams[0].id },
        ],
      },
    });
    assert.equal(userBLeagueTwoPredictions.response.status, 200, userBLeagueTwoPredictions.payload.error);

    const storedLeagueOnePredictions = await apiRequest(baseUrl, `/api/leagues/${leagueId}/my-predictions`, {
      token: userAUpdatedToken,
    });
    assert.equal(storedLeagueOnePredictions.response.status, 200);
    assert.equal(storedLeagueOnePredictions.payload.groupPredictionMap[groupsByName.A.id].first, groupsByName.A.teams[0].id);

    const storedLeagueTwoPredictions = await apiRequest(baseUrl, `/api/leagues/${secondLeagueId}/my-predictions`, {
      token: userAUpdatedToken,
    });
    assert.equal(storedLeagueTwoPredictions.response.status, 200);
    assert.equal(storedLeagueTwoPredictions.payload.groupPredictionMap[groupsByName.A.id].first, groupsByName.A.teams[1].id);

    const storedTournamentPredictionsAgain = await apiRequest(
      baseUrl,
      `/api/tournaments/${tournamentId}/my-predictions`,
      {
        token: userAUpdatedToken,
      }
    );
    assert.equal(storedTournamentPredictionsAgain.response.status, 200);
    assert.equal(
      storedTournamentPredictionsAgain.payload.groupPredictionMap[groupsByName.A.id].first,
      groupsByName.A.teams[0].id
    );

    const updateLeague = await apiRequest(baseUrl, `/api/leagues/${leagueId}`, {
      method: 'PATCH',
      token: userAUpdatedToken,
      body: {
        name: 'Renamed League',
        description: 'Updated description',
      },
    });
    assert.equal(updateLeague.response.status, 200);
    assert.equal(updateLeague.payload.league.name, 'Renamed League');

    const regenerateLeagueCode = await apiRequest(baseUrl, `/api/leagues/${leagueId}/regenerate-code`, {
      method: 'POST',
      token: userAUpdatedToken,
    });
    assert.equal(regenerateLeagueCode.response.status, 200);
    assert.notEqual(regenerateLeagueCode.payload.league.joinCode, firstLeagueCode);

    const leagueLeaderboardBeforeResults = await apiRequest(baseUrl, `/api/leagues/${leagueId}/leaderboard`, {
      token: userAUpdatedToken,
    });
    assert.equal(leagueLeaderboardBeforeResults.response.status, 200);
    assert.equal(leagueLeaderboardBeforeResults.payload.players.length, 2);

    const secondLeagueLeaderboardBeforeResults = await apiRequest(baseUrl, `/api/leagues/${secondLeagueId}/leaderboard`, {
      token: userAUpdatedToken,
    });
    assert.equal(secondLeagueLeaderboardBeforeResults.response.status, 200);
    assert.equal(secondLeagueLeaderboardBeforeResults.payload.players.length, 2);

    const groupResults = await apiRequest(baseUrl, `/api/tournaments/${tournamentId}/results/groups`, {
      method: 'POST',
      token: adminToken,
      body: {
        results: [
          {
            groupId: groupsByName.A.id,
            first: groupsByName.A.teams[0].id,
            second: groupsByName.A.teams[1].id,
          },
          {
            groupId: groupsByName.B.id,
            first: groupsByName.B.teams[0].id,
            second: groupsByName.B.teams[1].id,
          },
        ],
      },
    });
    assert.equal(groupResults.response.status, 200);

    const knockoutResults = await apiRequest(baseUrl, `/api/tournaments/${tournamentId}/results/knockout`, {
      method: 'POST',
      token: adminToken,
      body: {
        results: [
          {
            matchId: matchesByCode['SF-1'].id,
            predictedWinner: groupsByName.A.teams[0].id,
          },
          {
            matchId: matchesByCode['SF-2'].id,
            predictedWinner: groupsByName.B.teams[0].id,
          },
          {
            matchId: matchesByCode['FINAL-1'].id,
            predictedWinner: groupsByName.A.teams[0].id,
          },
        ],
      },
    });
    assert.equal(knockoutResults.response.status, 200);

    const leaderboard = await apiRequest(baseUrl, `/api/tournaments/${tournamentId}/leaderboard`, {
      token: userAUpdatedToken,
    });
    assert.equal(leaderboard.response.status, 200);
    assert.equal(leaderboard.payload.players.length, 2);
    assert.equal(leaderboard.payload.players[0].email, 'usera@example.com');
    assert.equal(leaderboard.payload.players[0].totalScore, 16);
    assert.equal(leaderboard.payload.players[1].email, 'userb@example.com');
    assert.equal(leaderboard.payload.players[1].totalScore, 6);

    const firstLeagueLeaderboard = await apiRequest(baseUrl, `/api/leagues/${leagueId}/leaderboard`, {
      token: userAUpdatedToken,
    });
    assert.equal(firstLeagueLeaderboard.response.status, 200);
    assert.equal(firstLeagueLeaderboard.payload.players[0].email, 'usera@example.com');
    assert.equal(firstLeagueLeaderboard.payload.players[0].totalScore, 16);
    assert.equal(firstLeagueLeaderboard.payload.players[1].email, 'userb@example.com');
    assert.equal(firstLeagueLeaderboard.payload.players[1].totalScore, 6);

    const secondLeagueLeaderboard = await apiRequest(baseUrl, `/api/leagues/${secondLeagueId}/leaderboard`, {
      token: userAUpdatedToken,
    });
    assert.equal(secondLeagueLeaderboard.response.status, 200);
    assert.equal(secondLeagueLeaderboard.payload.players[0].email, 'userb@example.com');
    assert.equal(secondLeagueLeaderboard.payload.players[0].totalScore, 16);
    assert.equal(secondLeagueLeaderboard.payload.players[1].email, 'usera@example.com');
    assert.equal(secondLeagueLeaderboard.payload.players[1].totalScore, 6);

    const defaultPrimaryEntry = await apiRequest(baseUrl, `/api/tournaments/${tournamentId}/primary-entry`, {
      token: userAUpdatedToken,
    });
    assert.equal(defaultPrimaryEntry.response.status, 200);
    assert.equal(defaultPrimaryEntry.payload.currentScopeKey, 'tournament');
    assert.equal(defaultPrimaryEntry.payload.canChange, true);
    assert.equal(defaultPrimaryEntry.payload.options.length, 3);
    assert.equal(
      defaultPrimaryEntry.payload.options.some(
        (option) => option.scopeKey === `league:${secondLeagueId}` && option.hasPredictions === true
      ),
      true
    );

    const userASetPrimaryEntry = await apiRequest(baseUrl, `/api/tournaments/${tournamentId}/primary-entry`, {
      method: 'POST',
      token: userAUpdatedToken,
      body: {
        scopeKey: `league:${secondLeagueId}`,
      },
    });
    assert.equal(userASetPrimaryEntry.response.status, 200, userASetPrimaryEntry.payload.error);
    assert.equal(userASetPrimaryEntry.payload.primaryEntry.currentScopeKey, `league:${secondLeagueId}`);

    const userBSetPrimaryEntry = await apiRequest(baseUrl, `/api/tournaments/${tournamentId}/primary-entry`, {
      method: 'POST',
      token: userBUpdatedToken,
      body: {
        scopeKey: `league:${secondLeagueId}`,
      },
    });
    assert.equal(userBSetPrimaryEntry.response.status, 200, userBSetPrimaryEntry.payload.error);
    assert.equal(userBSetPrimaryEntry.payload.primaryEntry.currentScopeKey, `league:${secondLeagueId}`);

    const officialLeaderboard = await apiRequest(baseUrl, `/api/tournaments/${tournamentId}/leaderboard`, {
      token: userAUpdatedToken,
    });
    assert.equal(officialLeaderboard.response.status, 200);
    assert.equal(officialLeaderboard.payload.players[0].email, 'userb@example.com');
    assert.equal(officialLeaderboard.payload.players[0].totalScore, 16);
    assert.equal(officialLeaderboard.payload.players[1].email, 'usera@example.com');
    assert.equal(officialLeaderboard.payload.players[1].totalScore, 6);

    const userAClearFirstLeaguePredictions = await apiRequest(baseUrl, `/api/predictions/${leagueId}`, {
      method: 'DELETE',
      token: userAUpdatedToken,
    });
    assert.equal(
      userAClearFirstLeaguePredictions.response.status,
      200,
      userAClearFirstLeaguePredictions.payload.error
    );
    assert.equal(userAClearFirstLeaguePredictions.payload.scopeType, 'league');
    assert.equal(userAClearFirstLeaguePredictions.payload.scopeKey, `league:${leagueId}`);
    assert.equal(
      userAClearFirstLeaguePredictions.payload.primaryEntry.currentScopeKey,
      `league:${secondLeagueId}`
    );

    const userALeaguePredictionsAfterClear = await apiRequest(baseUrl, `/api/leagues/${leagueId}/my-predictions`, {
      token: userAUpdatedToken,
    });
    assert.equal(userALeaguePredictionsAfterClear.response.status, 200);
    assert.equal(userALeaguePredictionsAfterClear.payload.groupPredictions.length, 0);
    assert.equal(userALeaguePredictionsAfterClear.payload.knockoutPredictions.length, 0);

    const globalLeaderboardUnauthenticated = await apiRequest(baseUrl, '/api/leaderboard/global');
    assert.equal(globalLeaderboardUnauthenticated.response.status, 401);

    const globalLeaderboardBeforeOptOut = await apiRequest(baseUrl, '/api/leaderboard/global', {
      token: userAUpdatedToken,
    });
    assert.equal(globalLeaderboardBeforeOptOut.response.status, 200);
    assert.equal(globalLeaderboardBeforeOptOut.payload.players.length, 2);
    assert.equal(globalLeaderboardBeforeOptOut.payload.players[0].name, 'User B');
    assert.equal(globalLeaderboardBeforeOptOut.payload.players[0].totalScore, 16);
    assert.equal(globalLeaderboardBeforeOptOut.payload.players[1].name, 'User A Updated');
    assert.equal(globalLeaderboardBeforeOptOut.payload.players[1].totalScore, 6);
    assert.equal(globalLeaderboardBeforeOptOut.payload.currentUser.rank, 2);
    assert.equal(globalLeaderboardBeforeOptOut.payload.currentUser.isVisible, true);

    const userBHideFromGlobalRankings = await apiRequest(baseUrl, '/api/account/profile', {
      method: 'PATCH',
      token: userBUpdatedToken,
      body: {
        name: 'User B',
        avatarUrl: '',
        showInGlobalRankings: false,
      },
    });
    assert.equal(userBHideFromGlobalRankings.response.status, 200);
    assert.equal(userBHideFromGlobalRankings.payload.user.showInGlobalRankings, false);

    const globalLeaderboardAfterOptOut = await apiRequest(baseUrl, '/api/leaderboard/global', {
      token: userAUpdatedToken,
    });
    assert.equal(globalLeaderboardAfterOptOut.response.status, 200);
    assert.equal(globalLeaderboardAfterOptOut.payload.players.length, 1);
    assert.equal(globalLeaderboardAfterOptOut.payload.players[0].name, 'User A Updated');
    assert.equal(globalLeaderboardAfterOptOut.payload.summary.visiblePlayerCount, 1);

    const hiddenUserGlobalLeaderboardView = await apiRequest(baseUrl, '/api/leaderboard/global', {
      token: userBUpdatedToken,
    });
    assert.equal(hiddenUserGlobalLeaderboardView.response.status, 200);
    assert.equal(hiddenUserGlobalLeaderboardView.payload.currentUser.isVisible, false);
    assert.equal(hiddenUserGlobalLeaderboardView.payload.currentUser.rank, null);

    const manualRecalc = await apiRequest(baseUrl, `/api/tournaments/${tournamentId}/calculate-scores`, {
      method: 'POST',
      token: adminToken,
    });
    assert.equal(manualRecalc.response.status, 200);
    assert.equal(manualRecalc.payload.updatedUsers, 2);

    const unsafeStructureEdit = await apiRequest(baseUrl, `/api/tournaments/${tournamentId}/structure`, {
      method: 'PUT',
      token: adminToken,
      body: {
        ...TEST_TOURNAMENT,
        name: 'Edited Test Cup',
      },
    });
    assert.equal(unsafeStructureEdit.response.status, 400);

    const userBLeaveLeague = await apiRequest(baseUrl, `/api/leagues/${leagueId}/members/me`, {
      method: 'DELETE',
      token: userBUpdatedToken,
    });
    assert.equal(userBLeaveLeague.response.status, 200);

    const userADeleteLeague = await apiRequest(baseUrl, `/api/leagues/${leagueId}`, {
      method: 'DELETE',
      token: userAUpdatedToken,
    });
    assert.equal(userADeleteLeague.response.status, 200);

    const userBLeaveSecondLeague = await apiRequest(baseUrl, `/api/leagues/${secondLeagueId}/members/me`, {
      method: 'DELETE',
      token: userBUpdatedToken,
    });
    assert.equal(userBLeaveSecondLeague.response.status, 200);

    const userBPrimaryEntryAfterLeave = await apiRequest(baseUrl, `/api/tournaments/${tournamentId}/primary-entry`, {
      token: userBUpdatedToken,
    });
    assert.equal(userBPrimaryEntryAfterLeave.response.status, 200);
    assert.equal(userBPrimaryEntryAfterLeave.payload.currentScopeKey, 'tournament');

    const userADeleteSecondLeague = await apiRequest(baseUrl, `/api/leagues/${secondLeagueId}`, {
      method: 'DELETE',
      token: userAUpdatedToken,
    });
    assert.equal(userADeleteSecondLeague.response.status, 200);

    const userAPrimaryEntryAfterDelete = await apiRequest(baseUrl, `/api/tournaments/${tournamentId}/primary-entry`, {
      token: userAUpdatedToken,
    });
    assert.equal(userAPrimaryEntryAfterDelete.response.status, 200);
    assert.equal(userAPrimaryEntryAfterDelete.payload.currentScopeKey, 'tournament');

    const userAClearTournamentPredictions = await apiRequest(baseUrl, `/api/predictions/${tournamentId}`, {
      method: 'DELETE',
      token: userAUpdatedToken,
    });
    assert.equal(
      userAClearTournamentPredictions.response.status,
      200,
      userAClearTournamentPredictions.payload.error
    );
    assert.equal(userAClearTournamentPredictions.payload.scopeType, 'tournament');
    assert.equal(userAClearTournamentPredictions.payload.scopeKey, 'tournament');
    assert.equal(userAClearTournamentPredictions.payload.primaryEntry.currentScopeKey, 'tournament');

    const userATournamentPredictionsAfterClear = await apiRequest(
      baseUrl,
      `/api/tournaments/${tournamentId}/my-predictions`,
      {
        token: userAUpdatedToken,
      }
    );
    assert.equal(userATournamentPredictionsAfterClear.response.status, 200);
    assert.equal(userATournamentPredictionsAfterClear.payload.groupPredictions.length, 0);
    assert.equal(userATournamentPredictionsAfterClear.payload.knockoutPredictions.length, 0);

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        closingDate: new Date(Date.now() - 60_000),
      },
    });

    const closedPredictionAttempt = await apiRequest(
      baseUrl,
      `/api/tournaments/${tournamentId}/predictions`,
      {
        method: 'POST',
        token: userAUpdatedToken,
        body: {
          groupPredictions: [],
          knockoutPredictions: [],
        },
      }
    );
    assert.equal(closedPredictionAttempt.response.status, 403);

    const userC = await registerUser(baseUrl, {
      name: 'User C',
      email: 'userc@example.com',
      password: 'supersecret1',
    });

    const closedJoinAttempt = await apiRequest(baseUrl, `/api/tournaments/${tournamentId}/join`, {
      method: 'POST',
      token: userC.token,
      body: { joinCode: 'TEST42' },
    });
    assert.equal(closedJoinAttempt.response.status, 403);
  } finally {
    await env.dispose();
  }
});
