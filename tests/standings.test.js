import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeGroupStandings,
  computePredictedGroupStandings,
} from '../src/utils/standings.js';

function makeGroup() {
  return {
    id: 'group-a',
    name: 'Group A',
    teams: [
      { id: 't-mex', name: 'Mexico', code: 'MEX' },
      { id: 't-rsa', name: 'South Africa', code: 'RSA' },
      { id: 't-kor', name: 'Korea Republic', code: 'KOR' },
      { id: 't-cze', name: 'Czechia', code: 'CZE' },
    ],
  };
}

function match(home, away, homeScore, awayScore, status = 'finished') {
  return {
    id: `${home}-${away}`,
    homeLabel: home,
    awayLabel: away,
    homeScore,
    awayScore,
    status,
  };
}

test('computeGroupStandings returns all zeros when no matches are recorded', () => {
  const standings = computeGroupStandings(makeGroup(), []);

  assert.equal(standings.length, 4);
  for (const row of standings) {
    assert.equal(row.played, 0);
    assert.equal(row.won, 0);
    assert.equal(row.drawn, 0);
    assert.equal(row.lost, 0);
    assert.equal(row.goalsFor, 0);
    assert.equal(row.goalsAgainst, 0);
    assert.equal(row.goalDiff, 0);
    assert.equal(row.points, 0);
  }

  assert.deepEqual(
    standings.map((row) => row.team.code),
    ['CZE', 'KOR', 'MEX', 'RSA'],
    'rows are alphabetical by team name when stats are all zero'
  );
});

test('computeGroupStandings ignores matches with unrecorded scores', () => {
  const matches = [
    match('MEX', 'RSA', null, null, 'scheduled'),
    match('KOR', 'CZE', undefined, undefined, 'scheduled'),
  ];

  const standings = computeGroupStandings(makeGroup(), matches);
  for (const row of standings) {
    assert.equal(row.played, 0);
    assert.equal(row.points, 0);
  }
});

test('computeGroupStandings handles a win, a draw, and a loss', () => {
  const matches = [
    match('MEX', 'RSA', 2, 0),
    match('KOR', 'CZE', 1, 1),
  ];

  const standings = computeGroupStandings(makeGroup(), matches);
  const byCode = Object.fromEntries(standings.map((row) => [row.team.code, row]));

  assert.deepEqual(
    {
      played: byCode.MEX.played,
      won: byCode.MEX.won,
      drawn: byCode.MEX.drawn,
      lost: byCode.MEX.lost,
      goalsFor: byCode.MEX.goalsFor,
      goalsAgainst: byCode.MEX.goalsAgainst,
      goalDiff: byCode.MEX.goalDiff,
      points: byCode.MEX.points,
    },
    {
      played: 1, won: 1, drawn: 0, lost: 0,
      goalsFor: 2, goalsAgainst: 0, goalDiff: 2, points: 3,
    }
  );

  assert.deepEqual(
    {
      played: byCode.RSA.played,
      won: byCode.RSA.won,
      drawn: byCode.RSA.drawn,
      lost: byCode.RSA.lost,
      goalsFor: byCode.RSA.goalsFor,
      goalsAgainst: byCode.RSA.goalsAgainst,
      goalDiff: byCode.RSA.goalDiff,
      points: byCode.RSA.points,
    },
    {
      played: 1, won: 0, drawn: 0, lost: 1,
      goalsFor: 0, goalsAgainst: 2, goalDiff: -2, points: 0,
    }
  );

  assert.equal(byCode.KOR.drawn, 1);
  assert.equal(byCode.CZE.drawn, 1);
  assert.equal(byCode.KOR.points, 1);
  assert.equal(byCode.CZE.points, 1);
});

test('computeGroupStandings sorts by points, then goal diff, then goals for, then name', () => {
  // Mexico:   2W 0D 0L  GF=4 GA=1  Pts=6  GD=+3
  // Korea:    2W 0D 0L  GF=2 GA=0  Pts=6  GD=+2
  // RSA:      0W 0D 2L  GF=1 GA=3  Pts=0  GD=-2
  // Czechia:  0W 0D 2L  GF=0 GA=3  Pts=0  GD=-3
  const matches = [
    match('MEX', 'RSA', 2, 1),
    match('MEX', 'CZE', 2, 0),
    match('KOR', 'RSA', 1, 0),
    match('KOR', 'CZE', 1, 0),
  ];

  // Both MEX and KOR finish at 6 points; GD favours MEX (+3 > +2).
  // Both RSA and CZE finish at 0 points; GD favours RSA (-2 > -3).
  const standings = computeGroupStandings(makeGroup(), matches);

  assert.deepEqual(
    standings.map((row) => row.team.code),
    ['MEX', 'KOR', 'RSA', 'CZE']
  );
});

test('computeGroupStandings breaks tie on goals-for when points and goal diff match', () => {
  // Both teams 1W 0D 0L with GD = 1, but different GF.
  const matches = [
    match('MEX', 'RSA', 3, 2),
    match('KOR', 'CZE', 1, 0),
  ];

  const standings = computeGroupStandings(makeGroup(), matches);
  assert.equal(standings[0].team.code, 'MEX', 'MEX wins tiebreaker on goals-for (3 > 1)');
  assert.equal(standings[1].team.code, 'KOR');
});

test('computeGroupStandings ignores matches that belong to other groups', () => {
  const matches = [
    match('MEX', 'RSA', 1, 0),
    // Foreign codes (Group B match leaked in) — must be skipped silently.
    match('CAN', 'BIH', 4, 0),
  ];

  const standings = computeGroupStandings(makeGroup(), matches);
  const mex = standings.find((row) => row.team.code === 'MEX');
  assert.equal(mex.played, 1);
  // No row was created for CAN/BIH; group is still four teams.
  assert.equal(standings.length, 4);
});

test('computePredictedGroupStandings ranks a complete prediction first, second, third + remainder', () => {
  const prediction = { first: 't-rsa', second: 't-kor', third: 't-mex' };
  const ranked = computePredictedGroupStandings(makeGroup(), prediction);

  assert.deepEqual(
    ranked.map((row) => ({ id: row.teamId, rank: row.predictedRank })),
    [
      { id: 't-rsa', rank: 1 },
      { id: 't-kor', rank: 2 },
      { id: 't-mex', rank: 3 },
      { id: 't-cze', rank: 4 },
    ]
  );
});

test('computePredictedGroupStandings handles no prediction by returning alphabetical, no rank', () => {
  const ranked = computePredictedGroupStandings(makeGroup(), null);

  assert.equal(ranked.length, 4);
  assert.equal(ranked[0].team.code, 'CZE');
  for (const row of ranked) {
    assert.equal(row.predictedRank, null);
  }
});

test('computePredictedGroupStandings tolerates partial predictions and unknown team ids', () => {
  const prediction = { first: 't-rsa', second: 'unknown-id', third: 't-mex' };
  const ranked = computePredictedGroupStandings(makeGroup(), prediction);

  // 't-rsa' first, 't-mex' second (since 'unknown-id' is dropped),
  // then alphabetical fillers without overlap.
  assert.equal(ranked[0].teamId, 't-rsa');
  assert.equal(ranked[0].predictedRank, 1);
  assert.equal(ranked[1].teamId, 't-mex');
  assert.equal(ranked[1].predictedRank, 2);
  const remainingIds = ranked.slice(2).map((row) => row.teamId).sort();
  assert.deepEqual(remainingIds, ['t-cze', 't-kor']);
});
