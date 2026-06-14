import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLockState,
  isMatchPredictionLocked,
  isGroupPredictionLocked,
  buildGroupCodeIndex,
} from '../api/locking.cjs';

const REFERENCE_NOW = new Date('2026-06-15T18:00:00Z');

function buildFixture() {
  const groups = [
    {
      id: 'group-a',
      name: 'A',
      teams: [
        { id: 't-mex', code: 'MEX' },
        { id: 't-rsa', code: 'RSA' },
        { id: 't-kor', code: 'KOR' },
        { id: 't-cze', code: 'CZE' },
      ],
    },
    {
      id: 'group-b',
      name: 'B',
      teams: [
        { id: 't-can', code: 'CAN' },
        { id: 't-bih', code: 'BIH' },
        { id: 't-qat', code: 'QAT' },
        { id: 't-sui', code: 'SUI' },
      ],
    },
  ];

  const rounds = [
    {
      id: 'round-gs',
      name: 'group_stage',
      matches: [
        {
          id: 'm-gs-played',
          homeLabel: 'MEX',
          awayLabel: 'RSA',
          matchDate: '2026-06-11T20:00:00Z',
        },
        {
          id: 'm-gs-future',
          homeLabel: 'KOR',
          awayLabel: 'CZE',
          matchDate: '2026-06-20T20:00:00Z',
        },
        {
          id: 'm-gs-future-b',
          homeLabel: 'CAN',
          awayLabel: 'BIH',
          matchDate: '2026-06-21T20:00:00Z',
        },
      ],
    },
    {
      id: 'round-r32',
      name: 'round_of_32',
      matches: [
        {
          id: 'm-r32-played',
          homeLabel: '1A',
          awayLabel: '3B/E/F',
          matchDate: '2026-06-15T17:00:00Z',
        },
        {
          id: 'm-r32-future',
          homeLabel: '1B',
          awayLabel: '3A/C/D',
          matchDate: '2026-06-25T17:00:00Z',
        },
        {
          id: 'm-r32-tbd',
          homeLabel: '1C',
          awayLabel: '2D',
          matchDate: null,
        },
      ],
    },
  ];

  return { groups, rounds };
}

test('isMatchPredictionLocked uses kickoff time as the threshold', () => {
  assert.equal(
    isMatchPredictionLocked({ matchDate: '2026-06-15T17:59:59Z' }, REFERENCE_NOW),
    true,
    'a match that already kicked off is locked'
  );
  assert.equal(
    isMatchPredictionLocked({ matchDate: '2026-06-15T18:00:00Z' }, REFERENCE_NOW),
    true,
    'kickoff at "now" is locked (boundary is inclusive)'
  );
  assert.equal(
    isMatchPredictionLocked({ matchDate: '2026-06-15T18:00:01Z' }, REFERENCE_NOW),
    false,
    'a future kickoff is still open'
  );
  assert.equal(
    isMatchPredictionLocked({ matchDate: null }, REFERENCE_NOW),
    false,
    'a match without a date stays open'
  );
  assert.equal(
    isMatchPredictionLocked(null, REFERENCE_NOW),
    false,
    'a missing match record is treated as open'
  );
});

test('isGroupPredictionLocked locks a group as soon as any of its matches kicks off', () => {
  const { groups, rounds } = buildFixture();
  const groupStageMatches = rounds[0].matches;
  const codeToGroupId = buildGroupCodeIndex(groups);

  assert.equal(
    isGroupPredictionLocked({
      groupId: 'group-a',
      groupStageMatches,
      codeToGroupId,
      now: REFERENCE_NOW,
    }),
    true,
    'group A is locked because MEX vs RSA has already been played'
  );
  assert.equal(
    isGroupPredictionLocked({
      groupId: 'group-b',
      groupStageMatches,
      codeToGroupId,
      now: REFERENCE_NOW,
    }),
    false,
    'group B is still open until CAN vs BIH kicks off'
  );
});

test('isGroupPredictionLocked ignores matches whose labels are not group team codes', () => {
  const groups = [
    {
      id: 'group-a',
      teams: [{ id: 't-mex', code: 'MEX' }, { id: 't-rsa', code: 'RSA' }],
    },
  ];
  const groupStageMatches = [
    {
      id: 'placeholder',
      homeLabel: 'TBD',
      awayLabel: 'TBD',
      matchDate: '2026-06-11T20:00:00Z',
    },
  ];
  const codeToGroupId = buildGroupCodeIndex(groups);

  assert.equal(
    isGroupPredictionLocked({
      groupId: 'group-a',
      groupStageMatches,
      codeToGroupId,
      now: REFERENCE_NOW,
    }),
    false,
    'a match whose labels do not match any team code does not lock the group'
  );
});

test('buildLockState collects all locked match and group ids', () => {
  const { groups, rounds } = buildFixture();
  const state = buildLockState({ rounds, groups, now: REFERENCE_NOW });

  assert.deepEqual(
    [...state.lockedMatchIds].sort(),
    ['m-gs-played', 'm-r32-played'],
    'should lock the past kickoffs and only those'
  );
  assert.deepEqual(
    [...state.lockedGroupIds].sort(),
    ['group-a'],
    'should lock group A because MEX vs RSA has been played'
  );
});

test('buildLockState returns empty sets when nothing has kicked off yet', () => {
  const { groups, rounds } = buildFixture();
  const earlyNow = new Date('2026-06-01T00:00:00Z');
  const state = buildLockState({ rounds, groups, now: earlyNow });

  assert.equal(state.lockedMatchIds.size, 0);
  assert.equal(state.lockedGroupIds.size, 0);
});

test('buildLockState tolerates empty inputs', () => {
  const empty = buildLockState();
  assert.equal(empty.lockedMatchIds.size, 0);
  assert.equal(empty.lockedGroupIds.size, 0);
});

test('isMatchPredictionLocked treats predictionsClosed=true as locked regardless of kickoff', () => {
  assert.equal(
    isMatchPredictionLocked(
      { matchDate: '2026-12-31T23:59:59Z', predictionsClosed: true },
      REFERENCE_NOW
    ),
    true,
    'a future match flagged closed is locked even when kickoff has not happened'
  );
  assert.equal(
    isMatchPredictionLocked(
      { matchDate: null, predictionsClosed: true },
      REFERENCE_NOW
    ),
    true,
    'a match with no kickoff but flagged closed is still locked'
  );
});

test('isGroupPredictionLocked locks a group when a group-stage match is manually closed', () => {
  const groups = [
    {
      id: 'group-c',
      teams: [
        { id: 't-arg', code: 'ARG' },
        { id: 't-aus', code: 'AUS' },
      ],
    },
  ];
  const groupStageMatches = [
    {
      id: 'm-future-closed',
      homeLabel: 'ARG',
      awayLabel: 'AUS',
      matchDate: '2027-01-01T00:00:00Z',
      predictionsClosed: true,
    },
  ];
  const codeToGroupId = buildGroupCodeIndex(groups);

  assert.equal(
    isGroupPredictionLocked({
      groupId: 'group-c',
      groupStageMatches,
      codeToGroupId,
      now: REFERENCE_NOW,
    }),
    true,
    'closing a single group-stage match locks the whole group'
  );
});
