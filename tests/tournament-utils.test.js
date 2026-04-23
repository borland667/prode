import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRandomPredictionSet,
  getEligibleBestThirdGroups,
  hasBestThirdPlaceSlots,
  resolveMatchParticipants,
  resolveSlot,
  sanitizeKnockoutPredictionMap,
} from '../src/utils/tournament.js';

test('getEligibleBestThirdGroups parses knockout labels correctly', () => {
  assert.deepEqual(getEligibleBestThirdGroups('3[A/B/C/D]'), ['A', 'B', 'C', 'D']);
  assert.deepEqual(getEligibleBestThirdGroups('3[c/e/f]'), ['C', 'E', 'F']);
  assert.deepEqual(getEligibleBestThirdGroups('1A'), []);
});

test('hasBestThirdPlaceSlots detects tournament modes that use third-place slots', () => {
  assert.equal(
    hasBestThirdPlaceSlots([
      {
        matches: [{ homeLabel: '1A', awayLabel: '3[A/B/C/D]' }],
      },
    ]),
    true
  );

  assert.equal(
    hasBestThirdPlaceSlots([
      {
        matches: [{ homeLabel: '1A', awayLabel: '2B' }],
      },
    ]),
    false
  );
});

test('resolveSlot resolves group, best-third, and winner-derived slots', () => {
  const groups = [
    {
      id: 'group-a',
      name: 'A',
      teams: [{ id: 'arg', name: 'Argentina' }],
    },
    {
      id: 'group-b',
      name: 'B',
      teams: [{ id: 'bra', name: 'Brazil' }],
    },
  ];

  const rounds = [
    {
      name: 'round_of_16',
      matches: [
        {
          id: 'r16-1',
          matchNumber: 1,
          code: 'R16-1',
        },
      ],
    },
  ];

  const teamMap = {
    arg: { id: 'arg', name: 'Argentina' },
    bra: { id: 'bra', name: 'Brazil' },
  };

  assert.deepEqual(
    resolveSlot({
      label: '1A',
      groups,
      rounds,
      groupSelections: { 'group-a': { first: 'arg' } },
      knockoutSelections: {},
      slotSelections: {},
      teamMap,
    }),
    {
      teamId: 'arg',
      teamName: 'Argentina',
      slotLabel: '1A',
    }
  );

  assert.deepEqual(
    resolveSlot({
      label: '3[A/B]',
      groups,
      rounds,
      groupSelections: {},
      knockoutSelections: {},
      slotSelections: { '3[A/B]': 'bra' },
      teamMap,
    }),
    {
      teamId: 'bra',
      teamName: 'Brazil',
      slotLabel: 'Best 3rd from A/B',
      eligibleGroups: ['A', 'B'],
      isBestThirdSlot: true,
    }
  );

  assert.deepEqual(
    resolveSlot({
      label: 'W-R16-1',
      groups,
      rounds,
      groupSelections: {},
      knockoutSelections: { 'r16-1': 'arg' },
      slotSelections: {},
      teamMap,
    }),
    {
      teamId: 'arg',
      teamName: 'Argentina',
      slotLabel: 'Winner of R16-1',
    }
  );
});

test('resolveMatchParticipants resolves both sides of a match', () => {
  const groups = [
    {
      id: 'group-a',
      name: 'A',
      teams: [{ id: 'arg', name: 'Argentina' }],
    },
    {
      id: 'group-b',
      name: 'B',
      teams: [{ id: 'bra', name: 'Brazil' }],
    },
  ];

  const teamMap = {
    arg: { id: 'arg', name: 'Argentina' },
    bra: { id: 'bra', name: 'Brazil' },
  };

  const participants = resolveMatchParticipants({
    match: { homeLabel: '1A', awayLabel: '2B' },
    groups,
    rounds: [],
    groupSelections: {
      'group-a': { first: 'arg' },
      'group-b': { second: 'bra' },
    },
    knockoutSelections: {},
    slotSelections: {},
    teamMap,
  });

  assert.equal(participants.home.teamName, 'Argentina');
  assert.equal(participants.away.teamName, 'Brazil');
});

test('buildRandomPredictionSet creates valid random picks for a basic knockout bracket', () => {
  const groups = [
    {
      id: 'group-a',
      name: 'A',
      teams: [
        { id: 'arg', name: 'Argentina' },
        { id: 'aus', name: 'Australia' },
      ],
    },
    {
      id: 'group-b',
      name: 'B',
      teams: [
        { id: 'bra', name: 'Brazil' },
        { id: 'bel', name: 'Belgium' },
      ],
    },
  ];

  const rounds = [
    {
      id: 'semi',
      name: 'semi_finals',
      order: 1,
      matches: [
        { id: 'sf-1', matchNumber: 1, code: 'SF-1', homeLabel: '1A', awayLabel: '2B' },
        { id: 'sf-2', matchNumber: 2, code: 'SF-2', homeLabel: '1B', awayLabel: '2A' },
      ],
    },
    {
      id: 'final',
      name: 'final',
      order: 2,
      matches: [
        { id: 'final-1', matchNumber: 1, code: 'FINAL-1', homeLabel: 'W-SF-1', awayLabel: 'W-SF-2' },
      ],
    },
  ];

  const { groupPredictions, knockoutPredictions } = buildRandomPredictionSet({
    groups,
    rounds,
    random: () => 0,
  });

  assert.deepEqual(groupPredictions['group-a'], {
    first: 'aus',
    second: 'arg',
  });
  assert.deepEqual(groupPredictions['group-b'], {
    first: 'bel',
    second: 'bra',
  });

  assert.equal(knockoutPredictions['sf-1'].predictedWinner, 'aus');
  assert.equal(knockoutPredictions['sf-2'].predictedWinner, 'bel');
  assert.equal(knockoutPredictions['final-1'].predictedWinner, 'aus');

  const knockoutSelections = {};
  for (const round of rounds) {
    for (const match of round.matches) {
      const prediction = knockoutPredictions[match.id] || {};
      const participants = resolveMatchParticipants({
        match,
        groups,
        rounds,
        groupSelections: groupPredictions,
        knockoutSelections,
        slotSelections: {
          [match.homeLabel]: prediction.selectedHomeTeamId || '',
          [match.awayLabel]: prediction.selectedAwayTeamId || '',
        },
        teamMap: {
          arg: { id: 'arg', name: 'Argentina' },
          aus: { id: 'aus', name: 'Australia' },
          bra: { id: 'bra', name: 'Brazil' },
          bel: { id: 'bel', name: 'Belgium' },
        },
      });

      assert.equal(
        [participants.home.teamId, participants.away.teamId].includes(prediction.predictedWinner),
        true
      );
      knockoutSelections[match.id] = prediction.predictedWinner;
    }
  }
});

test('buildRandomPredictionSet assigns unique best-third teams when needed', () => {
  const groups = [
    {
      id: 'group-a',
      name: 'A',
      teams: [
        { id: 'a1', name: 'A1' },
        { id: 'a2', name: 'A2' },
        { id: 'a3', name: 'A3' },
        { id: 'a4', name: 'A4' },
      ],
    },
    {
      id: 'group-b',
      name: 'B',
      teams: [
        { id: 'b1', name: 'B1' },
        { id: 'b2', name: 'B2' },
        { id: 'b3', name: 'B3' },
        { id: 'b4', name: 'B4' },
      ],
    },
    {
      id: 'group-c',
      name: 'C',
      teams: [
        { id: 'c1', name: 'C1' },
        { id: 'c2', name: 'C2' },
        { id: 'c3', name: 'C3' },
        { id: 'c4', name: 'C4' },
      ],
    },
    {
      id: 'group-d',
      name: 'D',
      teams: [
        { id: 'd1', name: 'D1' },
        { id: 'd2', name: 'D2' },
        { id: 'd3', name: 'D3' },
        { id: 'd4', name: 'D4' },
      ],
    },
  ];

  const rounds = [
    {
      id: 'round-32',
      name: 'round_of_32',
      order: 1,
      matches: [
        { id: 'r32-1', matchNumber: 1, code: 'R32-1', homeLabel: '3[A/B/C/D]', awayLabel: '1A' },
        { id: 'r32-2', matchNumber: 2, code: 'R32-2', homeLabel: '1B', awayLabel: '3[A/B/C/D]' },
      ],
    },
  ];

  const { groupPredictions, knockoutPredictions } = buildRandomPredictionSet({
    groups,
    rounds,
    random: () => 0,
  });

  const selectedTeams = [
    knockoutPredictions['r32-1'].selectedHomeTeamId,
    knockoutPredictions['r32-2'].selectedAwayTeamId,
  ];

  assert.equal(new Set(selectedTeams).size, 2);
  assert.equal(selectedTeams.includes(groupPredictions['group-a'].third), true);
  assert.equal(selectedTeams.includes(groupPredictions['group-b'].third), true);

  const knockoutSelections = {};
  for (const round of rounds) {
    for (const match of round.matches) {
      const prediction = knockoutPredictions[match.id] || {};
      const participants = resolveMatchParticipants({
        match,
        groups,
        rounds,
        groupSelections: groupPredictions,
        knockoutSelections,
        slotSelections: {
          [match.homeLabel]: prediction.selectedHomeTeamId || '',
          [match.awayLabel]: prediction.selectedAwayTeamId || '',
        },
        teamMap: Object.fromEntries(
          groups.flatMap((group) => group.teams.map((team) => [team.id, team]))
        ),
      });

      assert.equal(
        [participants.home.teamId, participants.away.teamId].includes(prediction.predictedWinner),
        true
      );
      knockoutSelections[match.id] = prediction.predictedWinner;
    }
  }
});

test('sanitizeKnockoutPredictionMap clears downstream winners that no longer qualify', () => {
  const groups = [
    {
      id: 'group-a',
      name: 'A',
      teams: [
        { id: 'arg', name: 'Argentina' },
        { id: 'aus', name: 'Australia' },
      ],
    },
    {
      id: 'group-b',
      name: 'B',
      teams: [
        { id: 'bra', name: 'Brazil' },
        { id: 'bel', name: 'Belgium' },
      ],
    },
  ];

  const rounds = [
    {
      id: 'semi',
      name: 'semi_finals',
      order: 1,
      matches: [
        { id: 'sf-1', matchNumber: 1, code: 'SF-1', homeLabel: '1A', awayLabel: '2B' },
        { id: 'sf-2', matchNumber: 2, code: 'SF-2', homeLabel: '1B', awayLabel: '2A' },
      ],
    },
    {
      id: 'final',
      name: 'final',
      order: 2,
      matches: [
        { id: 'final-1', matchNumber: 1, code: 'FINAL-1', homeLabel: 'W-SF-1', awayLabel: 'W-SF-2' },
      ],
    },
  ];

  const sanitized = sanitizeKnockoutPredictionMap({
    groups,
    rounds,
    groupSelections: {
      'group-a': { first: 'arg', second: 'aus' },
      'group-b': { first: 'bra', second: 'bel' },
    },
    knockoutPredictions: {
      'sf-1': { predictedWinner: 'arg' },
      'sf-2': { predictedWinner: 'bra' },
      'final-1': { predictedWinner: 'arg' },
    },
  });

  assert.equal(sanitized['final-1'].predictedWinner, 'arg');

  const resanitized = sanitizeKnockoutPredictionMap({
    groups,
    rounds,
    groupSelections: {
      'group-a': { first: 'arg', second: 'aus' },
      'group-b': { first: 'bra', second: 'bel' },
    },
    knockoutPredictions: {
      ...sanitized,
      'sf-1': { predictedWinner: 'bel' },
    },
  });

  assert.equal(resanitized['sf-1'].predictedWinner, 'bel');
  assert.equal(resanitized['final-1'].predictedWinner, '');
});
