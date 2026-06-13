import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { importFootballDataResults } = require('../api/results-importer.cjs');

// Build a tiny in-memory tournament fixture that exercises the importer's
// three interesting code paths:
//   - group A has no existing GroupResult       → should be written
//   - group B already has a GroupResult         → should be skipped
//   - a knockout match in round_of_32 has both  → can be matched against
//     selected team ids populated                 the feed
//   - a knockout match in round_of_16 has nulls → reported as unresolved
function buildTournamentFixture({ groupBHasResult = true } = {}) {
  const teams = [
    { id: 'team-mex', code: 'MEX', name: 'Mexico' },
    { id: 'team-rsa', code: 'RSA', name: 'South Africa' },
    { id: 'team-kor', code: 'KOR', name: 'Korea Republic' },
    { id: 'team-cze', code: 'CZE', name: 'Czechia' },
    { id: 'team-can', code: 'CAN', name: 'Canada' },
    { id: 'team-bih', code: 'BIH', name: 'Bosnia and Herzegovina' },
    { id: 'team-qat', code: 'QAT', name: 'Qatar' },
    { id: 'team-sui', code: 'SUI', name: 'Switzerland' },
  ];

  const groups = [
    { id: 'group-a', name: 'A' },
    { id: 'group-b', name: 'B' },
  ];

  const rounds = [
    { id: 'round-group', name: 'group_stage', matches: [] },
    {
      id: 'round-r32',
      name: 'round_of_32',
      matches: [
        {
          id: 'match-r32-1',
          status: 'scheduled',
          winner: null,
          selectedHomeTeamId: 'team-mex',
          selectedAwayTeamId: 'team-bih',
        },
        {
          id: 'match-r32-2',
          status: 'finished',
          winner: 'KOR',
          selectedHomeTeamId: 'team-kor',
          selectedAwayTeamId: 'team-qat',
        },
      ],
    },
    {
      id: 'round-r16',
      name: 'round_of_16',
      matches: [
        {
          id: 'match-r16-1',
          status: 'scheduled',
          winner: null,
          selectedHomeTeamId: null,
          selectedAwayTeamId: null,
        },
      ],
    },
  ];

  const groupResults = groupBHasResult
    ? [{ groupId: 'group-b', first: 'CAN', second: 'SUI', third: 'BIH' }]
    : [];

  return { id: 'tournament-1', teams, groups, rounds, groupResults };
}

function buildPrismaMock(fixture) {
  const created = [];
  const updated = [];

  return {
    tournament: {
      findUnique: async () => fixture,
    },
    groupResult: {
      create: async ({ data }) => {
        created.push(data);
        return { id: `gr-${created.length}`, ...data };
      },
    },
    match: {
      update: async ({ where, data }) => {
        updated.push({ where, data });
        return { id: where.id, ...data };
      },
    },
    async $transaction(operations) {
      return Promise.all(operations);
    },
    __created: created,
    __updated: updated,
  };
}

// Standings payload mirrors the football-data.org /v4 contract: the
// /standings endpoint returns an array of stage-typed standings tables.
function buildStandingsPayload() {
  return {
    standings: [
      {
        stage: 'GROUP_STAGE',
        type: 'TOTAL',
        group: 'GROUP_A',
        table: [
          { position: 1, team: { tla: 'MEX', name: 'Mexico' } },
          { position: 2, team: { tla: 'RSA', name: 'South Africa' } },
          { position: 3, team: { tla: 'KOR', name: 'Korea Republic' } },
          { position: 4, team: { tla: 'CZE', name: 'Czechia' } },
        ],
      },
      {
        stage: 'GROUP_STAGE',
        type: 'TOTAL',
        group: 'GROUP_B',
        table: [
          { position: 1, team: { tla: 'SUI', name: 'Switzerland' } },
          { position: 2, team: { tla: 'CAN', name: 'Canada' } },
          { position: 3, team: { tla: 'BIH', name: 'Bosnia and Herzegovina' } },
          { position: 4, team: { tla: 'QAT', name: 'Qatar' } },
        ],
      },
    ],
  };
}

function buildMatchesPayload() {
  return {
    matches: [
      {
        // matches the resolved DB match in round_of_32 → should write a winner
        status: 'FINISHED',
        stage: 'LAST_32',
        homeTeam: { tla: 'MEX', name: 'Mexico' },
        awayTeam: { tla: 'BIH', name: 'Bosnia and Herzegovina' },
        score: { winner: 'HOME_TEAM' },
      },
      {
        // matches the already-finished DB match → should be skipped
        status: 'FINISHED',
        stage: 'LAST_32',
        homeTeam: { tla: 'KOR', name: 'Korea Republic' },
        awayTeam: { tla: 'QAT', name: 'Qatar' },
        score: { winner: 'HOME_TEAM' },
      },
      {
        // no resolved DB participants in round_of_16 → unmatched
        status: 'FINISHED',
        stage: 'LAST_16',
        homeTeam: { tla: 'MEX', name: 'Mexico' },
        awayTeam: { tla: 'CAN', name: 'Canada' },
        score: { winner: 'AWAY_TEAM' },
      },
    ],
  };
}

function buildFetcher(standings, matches) {
  return async (url) => {
    if (url.includes('/standings')) {
      return new Response(JSON.stringify(standings), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/matches')) {
      return new Response(JSON.stringify(matches), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('not found', { status: 404 });
  };
}

test('importFootballDataResults writes new group results and skips existing ones', async () => {
  const fixture = buildTournamentFixture({ groupBHasResult: true });
  const prisma = buildPrismaMock(fixture);
  const fetcher = buildFetcher(buildStandingsPayload(), buildMatchesPayload());

  const summary = await importFootballDataResults({
    tournamentId: fixture.id,
    prisma,
    apiKey: 'test-key',
    fetcher,
    logger: { log: () => {} },
  });

  assert.equal(summary.groupResults.written, 1, 'only group A should be written');
  assert.equal(summary.groupResults.skipped, 1, 'group B should be skipped');

  assert.equal(prisma.__created.length, 1);
  assert.deepEqual(prisma.__created[0], {
    tournamentId: 'tournament-1',
    groupId: 'group-a',
    first: 'MEX',
    second: 'RSA',
    third: 'KOR',
  });
});

test('importFootballDataResults updates knockout winners only for resolved, unfinished matches', async () => {
  const fixture = buildTournamentFixture({ groupBHasResult: false });
  const prisma = buildPrismaMock(fixture);
  const fetcher = buildFetcher(buildStandingsPayload(), buildMatchesPayload());

  const summary = await importFootballDataResults({
    tournamentId: fixture.id,
    prisma,
    apiKey: 'test-key',
    fetcher,
    logger: { log: () => {} },
  });

  assert.equal(summary.matches.written, 1, 'only the unfinished R32 match should be written');
  assert.equal(summary.matches.skipped, 1, 'the already-finished R32 match should be skipped');
  assert.equal(summary.matches.unmatched, 1, 'the R16 match with unresolved slots should be unmatched');
  assert.equal(summary.matches.unresolvedSlots, 1, 'one unresolved knockout slot should be reported');

  assert.equal(prisma.__updated.length, 1);
  assert.deepEqual(prisma.__updated[0], {
    where: { id: 'match-r32-1' },
    data: { winner: 'MEX', status: 'finished' },
  });
});

test('importFootballDataResults runs no DB writes when feed returns nothing new', async () => {
  const fixture = buildTournamentFixture({ groupBHasResult: true });
  // Both groups already have a stored result and both R32 matches are
  // marked finished, so the feed has nothing new to write.
  fixture.groupResults.push({ groupId: 'group-a', first: 'MEX', second: 'RSA', third: 'KOR' });
  fixture.rounds[1].matches[0].status = 'finished';
  fixture.rounds[1].matches[0].winner = 'MEX';

  const prisma = buildPrismaMock(fixture);
  const fetcher = buildFetcher(buildStandingsPayload(), buildMatchesPayload());

  const summary = await importFootballDataResults({
    tournamentId: fixture.id,
    prisma,
    apiKey: 'test-key',
    fetcher,
    logger: { log: () => {} },
  });

  assert.equal(summary.totalWrites, 0);
  assert.equal(prisma.__created.length, 0);
  assert.equal(prisma.__updated.length, 0);
});

test('importFootballDataResults throws when the feed returns a non-2xx', async () => {
  const fixture = buildTournamentFixture();
  const prisma = buildPrismaMock(fixture);
  const fetcher = async () =>
    new Response('upstream rate-limited', { status: 429, headers: { 'content-type': 'text/plain' } });

  await assert.rejects(
    () =>
      importFootballDataResults({
        tournamentId: fixture.id,
        prisma,
        apiKey: 'test-key',
        fetcher,
        logger: { log: () => {} },
      }),
    /football-data\.org 429/
  );
});

test('importFootballDataResults rejects when apiKey is missing', async () => {
  await assert.rejects(
    () =>
      importFootballDataResults({
        tournamentId: 'tournament-1',
        prisma: buildPrismaMock(buildTournamentFixture()),
        apiKey: '',
        fetcher: async () => new Response('{}', { status: 200 }),
        logger: { log: () => {} },
      }),
    /apiKey is required/
  );
});
