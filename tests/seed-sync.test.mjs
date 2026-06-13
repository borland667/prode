import test from 'node:test';
import assert from 'node:assert/strict';

import { syncTournamentMatchMetadata } from '../api/seed-sync.cjs';

function buildPrismaMock() {
  const created = { rounds: [], matches: [] };
  const updated = { matches: [] };
  let roundSeq = 1000;
  let matchSeq = 5000;

  const client = {
    round: {
      async create({ data }) {
        const id = `round-${roundSeq++}`;
        const record = { id, ...data };
        created.rounds.push(record);
        return record;
      },
    },
    match: {
      async create({ data }) {
        const id = `match-${matchSeq++}`;
        const record = { id, ...data };
        created.matches.push(record);
        return record;
      },
      async update({ where, data }) {
        updated.matches.push({ where, data });
        return { id: where.id, ...data };
      },
    },
  };

  return { client, created, updated };
}

function buildDefinition() {
  return {
    rounds: [
      { name: 'group_stage', order: 0, pointsPerCorrect: 0 },
      { name: 'round_of_32', order: 1, pointsPerCorrect: 2 },
      { name: 'round_of_16', order: 2, pointsPerCorrect: 4 },
    ],
    matchesByRound: {
      group_stage: [
        {
          matchNumber: 1,
          homeLabel: 'MEX',
          awayLabel: 'RSA',
          matchDate: '2026-06-11T20:00:00Z',
        },
        {
          matchNumber: 2,
          homeLabel: 'KOR',
          awayLabel: 'CZE',
          matchDate: '2026-06-12T18:00:00Z',
        },
      ],
      round_of_32: [
        {
          matchNumber: 1,
          homeLabel: '1A',
          awayLabel: '3B/E/F',
          matchDate: '2026-07-01T20:00:00Z',
        },
      ],
      round_of_16: [
        { matchNumber: 1, homeLabel: 'W-R32-1', awayLabel: 'W-R32-2' },
      ],
    },
  };
}

test('syncTournamentMatchMetadata creates missing group_stage matches without touching existing rows', async () => {
  const { client, created, updated } = buildPrismaMock();
  const definition = buildDefinition();

  const tournament = {
    id: 'tournament-1',
    rounds: [
      {
        id: 'round-existing-group',
        name: 'group_stage',
        matches: [
          {
            id: 'match-existing-1',
            matchNumber: 1,
            homeLabel: 'MEX',
            awayLabel: 'RSA',
            matchDate: null,
          },
        ],
      },
      {
        id: 'round-existing-r32',
        name: 'round_of_32',
        matches: [
          {
            id: 'match-existing-r32-1',
            matchNumber: 1,
            homeLabel: '1A',
            awayLabel: '3B/E/F',
            matchDate: null,
          },
        ],
      },
      {
        id: 'round-existing-r16',
        name: 'round_of_16',
        matches: [
          {
            id: 'match-existing-r16-1',
            matchNumber: 1,
            homeLabel: 'W-R32-1',
            awayLabel: 'W-R32-2',
            matchDate: null,
          },
        ],
      },
    ],
  };

  const result = await syncTournamentMatchMetadata(client, tournament, definition);

  assert.equal(result.createdRounds, 0);
  assert.equal(result.createdMatches, 1, 'should create the missing KOR vs CZE match');
  assert.equal(result.updatedMatches, 2, 'should refresh dates on existing matches with a date in the seed');

  assert.equal(created.matches.length, 1);
  assert.equal(created.matches[0].homeLabel, 'KOR');
  assert.equal(created.matches[0].awayLabel, 'CZE');
  assert.equal(created.matches[0].roundId, 'round-existing-group');
  assert.ok(created.matches[0].matchDate instanceof Date);

  const updatedIds = updated.matches.map((entry) => entry.where.id).sort();
  assert.deepEqual(updatedIds, ['match-existing-1', 'match-existing-r32-1']);
});

test('syncTournamentMatchMetadata creates missing rounds and their matches', async () => {
  const { client, created, updated } = buildPrismaMock();
  const definition = buildDefinition();

  const tournament = {
    id: 'tournament-2',
    rounds: [
      {
        id: 'round-existing-r32',
        name: 'round_of_32',
        matches: [
          {
            id: 'match-existing-r32-1',
            matchNumber: 1,
            homeLabel: '1A',
            awayLabel: '3B/E/F',
            matchDate: null,
          },
        ],
      },
    ],
  };

  const result = await syncTournamentMatchMetadata(client, tournament, definition);

  assert.equal(result.createdRounds, 2, 'should create group_stage and round_of_16 rounds');
  assert.equal(result.createdMatches, 3, 'should create both group matches plus the round_of_16 match');
  assert.equal(result.updatedMatches, 1, 'should refresh the existing round_of_32 match date');

  const createdRoundNames = created.rounds.map((round) => round.name).sort();
  assert.deepEqual(createdRoundNames, ['group_stage', 'round_of_16']);

  const groupRound = created.rounds.find((round) => round.name === 'group_stage');
  const newGroupMatches = created.matches.filter((match) => match.roundId === groupRound.id);
  assert.equal(newGroupMatches.length, 2);

  const r16Round = created.rounds.find((round) => round.name === 'round_of_16');
  const r16Matches = created.matches.filter((match) => match.roundId === r16Round.id);
  assert.equal(r16Matches.length, 1);
  assert.equal(r16Matches[0].matchDate, null, 'should preserve null matchDate when the definition has no date');

  assert.equal(updated.matches.length, 1);
});

test('syncTournamentMatchMetadata is a no-op when everything is already in sync', async () => {
  const { client, created, updated } = buildPrismaMock();
  const definition = buildDefinition();

  const tournament = {
    id: 'tournament-3',
    rounds: [
      {
        id: 'round-group',
        name: 'group_stage',
        matches: [
          {
            id: 'match-g-1',
            matchNumber: 1,
            homeLabel: 'MEX',
            awayLabel: 'RSA',
            matchDate: new Date('2026-06-11T20:00:00Z'),
          },
          {
            id: 'match-g-2',
            matchNumber: 2,
            homeLabel: 'KOR',
            awayLabel: 'CZE',
            matchDate: new Date('2026-06-12T18:00:00Z'),
          },
        ],
      },
      {
        id: 'round-r32',
        name: 'round_of_32',
        matches: [
          {
            id: 'match-r32-1',
            matchNumber: 1,
            homeLabel: '1A',
            awayLabel: '3B/E/F',
            matchDate: new Date('2026-07-01T20:00:00Z'),
          },
        ],
      },
      {
        id: 'round-r16',
        name: 'round_of_16',
        matches: [
          {
            id: 'match-r16-1',
            matchNumber: 1,
            homeLabel: 'W-R32-1',
            awayLabel: 'W-R32-2',
            matchDate: null,
          },
        ],
      },
    ],
  };

  const result = await syncTournamentMatchMetadata(client, tournament, definition);

  assert.equal(result.createdRounds, 0);
  assert.equal(result.createdMatches, 0);
  // Existing rows with a date are still rewritten when the definition has a date.
  // The round_of_16 match has no expected date in the fixture, so it stays put.
  assert.equal(result.updatedMatches, 3);
  assert.equal(created.rounds.length, 0);
  assert.equal(created.matches.length, 0);
  assert.equal(updated.matches.length, 3);
});

test('syncTournamentMatchMetadata matches group_stage entries by team pair, not match number', async () => {
  const { client, created, updated } = buildPrismaMock();
  const definition = {
    rounds: [{ name: 'group_stage', order: 0, pointsPerCorrect: 0 }],
    matchesByRound: {
      group_stage: [
        {
          matchNumber: 7,
          homeLabel: 'MEX',
          awayLabel: 'RSA',
          matchDate: '2026-06-11T20:00:00Z',
        },
      ],
    },
  };
  const tournament = {
    id: 'tournament-4',
    rounds: [
      {
        id: 'round-group',
        name: 'group_stage',
        matches: [
          {
            id: 'match-mismatched-number',
            matchNumber: 99,
            homeLabel: 'RSA',
            awayLabel: 'MEX',
            matchDate: null,
          },
        ],
      },
    ],
  };

  const result = await syncTournamentMatchMetadata(client, tournament, definition);

  assert.equal(result.createdMatches, 0);
  assert.equal(result.updatedMatches, 1);
  assert.equal(created.matches.length, 0);
  assert.equal(updated.matches.length, 1);
  assert.equal(updated.matches[0].where.id, 'match-mismatched-number');
  assert.equal(updated.matches[0].data.matchNumber, 7);
  assert.equal(updated.matches[0].data.homeLabel, 'MEX');
  assert.equal(updated.matches[0].data.awayLabel, 'RSA');
});
