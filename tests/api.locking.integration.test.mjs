import test from 'node:test';
import assert from 'node:assert/strict';

import { apiRequest, createApiTestEnvironment } from './helpers/api-test-env.mjs';

const LOCK_TEST_TOURNAMENT = {
  name: 'Lock Test Cup',
  nameEs: 'Copa Test Bloqueo',
  sport: 'football',
  modeKey: 'classic_argentinian_prode',
  modeName: 'Classic Prode',
  modeNameEs: 'Prode Clasico',
  status: 'upcoming',
  prizesEnabled: false,
  accessType: 'public',
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
  return payload;
}

test('per-match prediction locking preserves picks for matches that already kicked off', async () => {
  const env = await createApiTestEnvironment();

  try {
    const { baseUrl, prisma } = env;

    const adminReg = await registerUser(baseUrl, {
      name: 'Lock Admin',
      email: 'lock-admin@example.com',
      password: 'supersecret1',
    });
    await prisma.user.update({
      where: { email: 'lock-admin@example.com' },
      data: { role: 'ADMIN' },
    });
    const adminLogin = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: 'lock-admin@example.com', password: 'supersecret1' },
    });
    const adminToken = adminLogin.payload.token;

    const playerReg = await registerUser(baseUrl, {
      name: 'Lock Player',
      email: 'lock-player@example.com',
      password: 'supersecret1',
    });
    const playerToken = playerReg.token;

    const created = await apiRequest(baseUrl, '/api/tournaments', {
      method: 'POST',
      token: adminToken,
      body: LOCK_TEST_TOURNAMENT,
    });
    assert.equal(created.response.status, 201, created.payload.error);

    const tournament = created.payload.tournament;
    const tournamentId = tournament.id;
    const groupsByName = mapGroupsByName(tournament);
    const matchesByCode = mapMatchesByCode(tournament);

    const sf1 = matchesByCode['SF-1'];
    const sf2 = matchesByCode['SF-2'];
    const finalMatch = matchesByCode['FINAL-1'];
    const argTeam = groupsByName.A.teams.find((team) => team.name === 'Argentina');
    const ausTeam = groupsByName.A.teams.find((team) => team.name === 'Australia');
    const braTeam = groupsByName.B.teams.find((team) => team.name === 'Brazil');
    const belTeam = groupsByName.B.teams.find((team) => team.name === 'Belgium');

    const initialSubmit = await apiRequest(
      baseUrl,
      `/api/tournaments/${tournamentId}/predictions`,
      {
        method: 'POST',
        token: playerToken,
        body: {
          groupPredictions: [
            { groupId: groupsByName.A.id, first: argTeam.id, second: ausTeam.id },
            { groupId: groupsByName.B.id, first: braTeam.id, second: belTeam.id },
          ],
          knockoutPredictions: [
            // SF-1: 1A (ARG) vs 2B (BEL) -> winner ARG
            { matchId: sf1.id, predictedWinner: argTeam.id },
            // SF-2: 1B (BRA) vs 2A (AUS) -> winner BRA
            { matchId: sf2.id, predictedWinner: braTeam.id },
            // FINAL: W-SF-1 (ARG) vs W-SF-2 (BRA) -> winner ARG
            { matchId: finalMatch.id, predictedWinner: argTeam.id },
          ],
        },
      }
    );
    assert.equal(initialSubmit.response.status, 200, initialSubmit.payload.error);

    // Simulate "kickoff happened" for SF-1 by backdating its matchDate.
    await prisma.match.update({
      where: { id: sf1.id },
      data: { matchDate: new Date(Date.now() - 60 * 60 * 1000) },
    });

    const refetched = await apiRequest(baseUrl, `/api/tournaments/${tournamentId}`, {
      token: playerToken,
    });
    assert.equal(refetched.response.status, 200);
    const refetchedMatches = mapMatchesByCode(refetched.payload);
    assert.equal(
      refetchedMatches['SF-1'].predictionLocked,
      true,
      'SF-1 should be reported as locked once its matchDate is in the past'
    );
    assert.equal(refetchedMatches['SF-2'].predictionLocked, false);
    assert.equal(refetchedMatches['FINAL-1'].predictionLocked, false);

    // Stale client tries to overwrite SF-1's pick AND change SF-2 and FINAL.
    // The merged progression must remain valid: SF-1 stays ARG (locked), so
    // FINAL's home slot still resolves to ARG. Move SF-2's winner from BRA to
    // AUS and FINAL's winner accordingly.
    const restitch = await apiRequest(
      baseUrl,
      `/api/tournaments/${tournamentId}/predictions`,
      {
        method: 'POST',
        token: playerToken,
        body: {
          groupPredictions: [
            { groupId: groupsByName.A.id, first: argTeam.id, second: ausTeam.id },
            { groupId: groupsByName.B.id, first: braTeam.id, second: belTeam.id },
          ],
          knockoutPredictions: [
            // Stale client still sends a pick for SF-1, trying to flip the winner.
            { matchId: sf1.id, predictedWinner: belTeam.id },
            // SF-2: flip winner from BRA to AUS.
            { matchId: sf2.id, predictedWinner: ausTeam.id },
            // FINAL: ARG (locked SF-1 winner) vs AUS (new SF-2 winner).
            { matchId: finalMatch.id, predictedWinner: ausTeam.id },
          ],
        },
      }
    );
    assert.equal(restitch.response.status, 200, restitch.payload.error);

    const myPredictions = await apiRequest(
      baseUrl,
      `/api/tournaments/${tournamentId}/my-predictions`,
      {
        token: playerToken,
      }
    );
    assert.equal(myPredictions.response.status, 200);

    const knockoutMap = myPredictions.payload.knockoutPredictionMap || {};
    assert.equal(
      knockoutMap[sf1.id]?.predictedWinner,
      argTeam.id,
      'SF-1 must keep the original ARG winner; the locked pick is not overwritten'
    );
    assert.equal(
      knockoutMap[sf2.id]?.predictedWinner,
      ausTeam.id,
      'SF-2 must take the new AUS winner since it was still unlocked'
    );
    assert.equal(
      knockoutMap[finalMatch.id]?.predictedWinner,
      ausTeam.id,
      'FINAL must take the new winner since it was still unlocked'
    );
  } finally {
    await env.dispose();
  }
});

test('admin can manually close a single match and the lock takes effect immediately', async () => {
  const env = await createApiTestEnvironment();

  try {
    const { baseUrl, prisma } = env;

    await registerUser(baseUrl, {
      name: 'Close Admin',
      email: 'close-admin@example.com',
      password: 'supersecret1',
    });
    await prisma.user.update({
      where: { email: 'close-admin@example.com' },
      data: { role: 'ADMIN' },
    });
    const adminLogin = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: 'close-admin@example.com', password: 'supersecret1' },
    });
    const adminToken = adminLogin.payload.token;

    const playerReg = await registerUser(baseUrl, {
      name: 'Close Player',
      email: 'close-player@example.com',
      password: 'supersecret1',
    });
    const playerToken = playerReg.token;

    const created = await apiRequest(baseUrl, '/api/tournaments', {
      method: 'POST',
      token: adminToken,
      body: LOCK_TEST_TOURNAMENT,
    });
    assert.equal(created.response.status, 201, created.payload.error);

    const tournament = created.payload.tournament;
    const tournamentId = tournament.id;
    const groupsByName = mapGroupsByName(tournament);
    const matchesByCode = mapMatchesByCode(tournament);

    const sf1 = matchesByCode['SF-1'];
    const sf2 = matchesByCode['SF-2'];
    const argTeam = groupsByName.A.teams.find((team) => team.name === 'Argentina');
    const ausTeam = groupsByName.A.teams.find((team) => team.name === 'Australia');
    const braTeam = groupsByName.B.teams.find((team) => team.name === 'Brazil');
    const belTeam = groupsByName.B.teams.find((team) => team.name === 'Belgium');

    const initialSubmit = await apiRequest(
      baseUrl,
      `/api/tournaments/${tournamentId}/predictions`,
      {
        method: 'POST',
        token: playerToken,
        body: {
          groupPredictions: [
            { groupId: groupsByName.A.id, first: argTeam.id, second: ausTeam.id },
            { groupId: groupsByName.B.id, first: braTeam.id, second: belTeam.id },
          ],
          knockoutPredictions: [
            { matchId: sf1.id, predictedWinner: argTeam.id },
            { matchId: sf2.id, predictedWinner: braTeam.id },
          ],
        },
      }
    );
    assert.equal(initialSubmit.response.status, 200, initialSubmit.payload.error);

    const adminCloses = await apiRequest(
      baseUrl,
      `/api/tournaments/${tournamentId}/matches/${sf1.id}`,
      {
        method: 'PATCH',
        token: adminToken,
        body: { predictionsClosed: true },
      }
    );
    assert.equal(adminCloses.response.status, 200, adminCloses.payload.error);
    assert.equal(adminCloses.payload.match.predictionsClosed, true);

    const refetched = await apiRequest(baseUrl, `/api/tournaments/${tournamentId}`, {
      token: playerToken,
    });
    assert.equal(refetched.response.status, 200);
    const refetchedMatches = mapMatchesByCode(refetched.payload);
    assert.equal(
      refetchedMatches['SF-1'].predictionsClosed,
      true,
      'SF-1 is flagged as manually closed in the API'
    );
    assert.equal(
      refetchedMatches['SF-1'].predictionLocked,
      true,
      'SF-1 is reported as locked even though kickoff is still in the future'
    );
    assert.equal(refetchedMatches['SF-2'].predictionLocked, false);

    const retryWithStale = await apiRequest(
      baseUrl,
      `/api/tournaments/${tournamentId}/predictions`,
      {
        method: 'POST',
        token: playerToken,
        body: {
          groupPredictions: [
            { groupId: groupsByName.A.id, first: argTeam.id, second: ausTeam.id },
            { groupId: groupsByName.B.id, first: braTeam.id, second: belTeam.id },
          ],
          knockoutPredictions: [
            { matchId: sf1.id, predictedWinner: belTeam.id },
            { matchId: sf2.id, predictedWinner: ausTeam.id },
          ],
        },
      }
    );
    assert.equal(retryWithStale.response.status, 200, retryWithStale.payload.error);

    const myPredictions = await apiRequest(
      baseUrl,
      `/api/tournaments/${tournamentId}/my-predictions`,
      { token: playerToken }
    );
    assert.equal(myPredictions.response.status, 200);

    const knockoutMap = myPredictions.payload.knockoutPredictionMap || {};
    assert.equal(
      knockoutMap[sf1.id]?.predictedWinner,
      argTeam.id,
      'admin-closed match keeps its original pick'
    );
    assert.equal(
      knockoutMap[sf2.id]?.predictedWinner,
      ausTeam.id,
      'still-open match accepts the new pick'
    );

    const reopen = await apiRequest(
      baseUrl,
      `/api/tournaments/${tournamentId}/matches/${sf1.id}`,
      {
        method: 'PATCH',
        token: adminToken,
        body: { predictionsClosed: false },
      }
    );
    assert.equal(reopen.response.status, 200, reopen.payload.error);
    assert.equal(reopen.payload.match.predictionsClosed, false);
  } finally {
    await env.dispose();
  }
});

test('non-admins cannot toggle match closure', async () => {
  const env = await createApiTestEnvironment();

  try {
    const { baseUrl, prisma } = env;

    await registerUser(baseUrl, {
      name: 'Setup Admin',
      email: 'setup-admin@example.com',
      password: 'supersecret1',
    });
    await prisma.user.update({
      where: { email: 'setup-admin@example.com' },
      data: { role: 'ADMIN' },
    });
    const adminLogin = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: 'setup-admin@example.com', password: 'supersecret1' },
    });
    const adminToken = adminLogin.payload.token;

    const playerReg = await registerUser(baseUrl, {
      name: 'Regular Player',
      email: 'regular-player@example.com',
      password: 'supersecret1',
    });

    const created = await apiRequest(baseUrl, '/api/tournaments', {
      method: 'POST',
      token: adminToken,
      body: LOCK_TEST_TOURNAMENT,
    });
    const tournament = created.payload.tournament;
    const tournamentId = tournament.id;
    const sf1 = mapMatchesByCode(tournament)['SF-1'];

    const unauthorized = await apiRequest(
      baseUrl,
      `/api/tournaments/${tournamentId}/matches/${sf1.id}`,
      {
        method: 'PATCH',
        token: playerReg.token,
        body: { predictionsClosed: true },
      }
    );
    assert.equal(unauthorized.response.status, 403);
  } finally {
    await env.dispose();
  }
});
