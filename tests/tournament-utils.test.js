import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getEligibleBestThirdGroups,
  hasBestThirdPlaceSlots,
  resolveMatchParticipants,
  resolveSlot,
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
