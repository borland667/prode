import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  scoreGroupPrediction,
  scoreKnockoutPrediction,
  calculateTotalScore,
} = require('../api/scoring.cjs');

test('scoreGroupPrediction returns expected scores for classic prode outcomes', () => {
  assert.equal(
    scoreGroupPrediction({ first: 'ARG', second: 'GER' }, { first: 'ARG', second: 'GER' }),
    4
  );
  assert.equal(
    scoreGroupPrediction({ first: 'GER', second: 'ARG' }, { first: 'ARG', second: 'GER' }),
    3
  );
  assert.equal(
    scoreGroupPrediction({ first: 'ARG', second: 'BRA' }, { first: 'ARG', second: 'GER' }),
    2
  );
  assert.equal(
    scoreGroupPrediction({ first: 'BRA', second: 'ARG' }, { first: 'ARG', second: 'GER' }),
    1
  );
  assert.equal(
    scoreGroupPrediction({ first: 'BRA', second: 'FRA' }, { first: 'ARG', second: 'GER' }),
    0
  );
});

test('scoreKnockoutPrediction awards round points only for correct winners', () => {
  assert.equal(scoreKnockoutPrediction('ARG', 'ARG', 6), 6);
  assert.equal(scoreKnockoutPrediction('BRA', 'ARG', 6), 0);
  assert.equal(scoreKnockoutPrediction('', 'ARG', 6), 0);
});

test('calculateTotalScore aggregates group and knockout scores with a round breakdown', () => {
  const score = calculateTotalScore(
    [
      { groupId: 'A', predictions: { first: 'ARG', second: 'GER' } },
      { groupId: 'B', predictions: { first: 'BRA', second: 'ESP' } },
    ],
    [
      { groupId: 'A', first: 'ARG', second: 'GER' },
      { groupId: 'B', first: 'ESP', second: 'BRA' },
    ],
    [
      { matchId: 'm1', predictedWinner: 'ARG' },
      { matchId: 'm2', predictedWinner: 'ESP' },
    ],
    [
      { id: 'm1', winner: 'ARG', round: 'quarter_finals' },
      { id: 'm2', winner: 'FRA', round: 'semi_finals' },
    ],
    new Map([
      ['quarter_finals', 6],
      ['semi_finals', 8],
    ])
  );

  assert.deepEqual(score, {
    groupScore: 7,
    knockoutScore: 6,
    totalScore: 13,
    roundBreakdown: {
      group_stage: 7,
      quarter_finals: 6,
      semi_finals: 0,
    },
  });
});
