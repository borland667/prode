/**
 * Scoring engine for the Prode World Cup prediction game
 *
 * Scoring rules:
 * Group Stage:
 *   - 4pts: both teams in correct positions (1st and 2nd)
 *   - 3pts: both teams correct but inverted positions
 *   - 2pts: one team correct position
 *   - 1pt: one team correct but wrong position
 *
 * Knockout Rounds:
 *   - Points are driven by the tournament's round configuration
 *   - For the current scaled Prode mode, rounds increase linearly by +2
 */

/**
 * Calculate score for a group stage prediction
 * @param {Object} prediction - Predicted {first, second} team IDs
 * @param {Object} result - Actual {first, second} team IDs from results
 * @returns {number} Points earned (0-4)
 */
function scoreGroupPrediction(prediction, result) {
  if (!prediction || !result) {
    return 0;
  }

  const { first: predFirst, second: predSecond } = prediction;
  const { first: resultFirst, second: resultSecond } = result;

  // Both teams in correct positions
  if (predFirst === resultFirst && predSecond === resultSecond) {
    return 4;
  }

  // Both teams correct but inverted
  if (predFirst === resultSecond && predSecond === resultFirst) {
    return 3;
  }

  // One team in correct position
  if (predFirst === resultFirst || predSecond === resultSecond) {
    return 2;
  }

  // One team correct but wrong position
  if (predFirst === resultSecond || predSecond === resultFirst) {
    return 1;
  }

  // No points
  return 0;
}

/**
 * Calculate score for a knockout match prediction
 * @param {string} predictedWinner - Predicted winner team ID
 * @param {string} actualWinner - Actual winner team ID
 * @param {number} pointsPerCorrect - Points for correct prediction in this round
 * @returns {number} Points earned (0 or pointsPerCorrect)
 */
function scoreKnockoutPrediction(predictedWinner, actualWinner, pointsPerCorrect) {
  if (!predictedWinner || !actualWinner) {
    return 0;
  }

  return predictedWinner === actualWinner ? pointsPerCorrect : 0;
}

/**
 * Calculate total score for a user in a tournament
 * @param {Array} groupPredictions - Array of group predictions {groupId, predictions}
 * @param {Array} groupResults - Array of group results {groupId, first, second}
 * @param {Array} knockoutPredictions - Array of knockout predictions {matchId, predictedWinner}
 * @param {Array} knockoutMatches - Array of knockout matches with results {id, winner, round}
 * @param {Map} roundPointsMap - Map of round names to points per correct for the tournament
 * @returns {Object} {groupScore, knockoutScore, totalScore}
 */
function calculateTotalScore(
  groupPredictions,
  groupResults,
  knockoutPredictions,
  knockoutMatches,
  roundPointsMap
) {
  let groupScore = 0;
  let knockoutScore = 0;
  const roundBreakdown = {};

  // Score group predictions
  if (groupPredictions && groupResults) {
    groupPredictions.forEach((pred) => {
      const result = groupResults.find((r) => r.groupId === pred.groupId);
      if (result && pred.predictions) {
        groupScore += scoreGroupPrediction(pred.predictions, {
          first: result.first,
          second: result.second,
        });
      }
    });
  }

  roundBreakdown.group_stage = groupScore;

  // Score knockout predictions
  if (knockoutPredictions && knockoutMatches) {
    knockoutPredictions.forEach((pred) => {
      const match = knockoutMatches.find((m) => m.id === pred.matchId);
      if (match && match.winner) {
        const pointsPerCorrect = roundPointsMap.get(match.round) || 0;
        const score = scoreKnockoutPrediction(
          pred.predictedWinner,
          match.winner,
          pointsPerCorrect
        );
        knockoutScore += score;
        roundBreakdown[match.round] = (roundBreakdown[match.round] || 0) + score;
      }
    });
  }

  return {
    groupScore,
    knockoutScore,
    totalScore: groupScore + knockoutScore,
    roundBreakdown,
  };
}

module.exports = {
  scoreGroupPrediction,
  scoreKnockoutPrediction,
  calculateTotalScore,
};
