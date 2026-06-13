const { getRoundNameEs } = require('./translations.cjs');

function matchPairKey(home, away) {
  return [home, away]
    .filter(Boolean)
    .sort()
    .join(':');
}

function findExistingMatch(matches, expectedMatch, roundName) {
  return (matches || []).find((match) => {
    if (roundName !== 'group_stage') {
      return Number(match.matchNumber) === Number(expectedMatch.matchNumber);
    }
    return (
      matchPairKey(match.homeLabel, match.awayLabel) ===
      matchPairKey(expectedMatch.homeLabel, expectedMatch.awayLabel)
    );
  });
}

// Non-destructive sync. Creates missing rounds and matches, updates match dates
// (and group-stage labels) on existing rows. Never deletes anything. Safe to run
// against tournaments that already have user activity.
async function syncTournamentMatchMetadata(client, tournament, definition) {
  let updatedMatches = 0;
  let createdMatches = 0;
  let createdRounds = 0;

  const existingRoundsByName = new Map(
    (tournament.rounds || []).map((round) => [round.name, round])
  );

  for (const definitionRound of definition.rounds || []) {
    let round = existingRoundsByName.get(definitionRound.name);

    if (!round) {
      round = await client.round.create({
        data: {
          name: definitionRound.name,
          nameEs: getRoundNameEs(definitionRound) || definitionRound.name,
          order: definitionRound.order,
          pointsPerCorrect: definitionRound.pointsPerCorrect,
          tournamentId: tournament.id,
        },
      });
      round.matches = [];
      createdRounds += 1;
    }

    const expectedMatches = definition.matchesByRound?.[definitionRound.name] || [];

    for (const expectedMatch of expectedMatches) {
      const existingMatch = findExistingMatch(round.matches, expectedMatch, definitionRound.name);

      if (!existingMatch) {
        await client.match.create({
          data: {
            roundId: round.id,
            matchNumber: expectedMatch.matchNumber,
            homeLabel: expectedMatch.homeLabel,
            awayLabel: expectedMatch.awayLabel,
            matchDate: expectedMatch.matchDate ? new Date(expectedMatch.matchDate) : null,
          },
        });
        createdMatches += 1;
        continue;
      }

      if (!expectedMatch.matchDate) {
        continue;
      }

      await client.match.update({
        where: { id: existingMatch.id },
        data: {
          matchDate: new Date(expectedMatch.matchDate),
          ...(definitionRound.name === 'group_stage'
            ? {
                matchNumber: expectedMatch.matchNumber,
                homeLabel: expectedMatch.homeLabel,
                awayLabel: expectedMatch.awayLabel,
              }
            : {}),
        },
      });
      updatedMatches += 1;
    }
  }

  return { updatedMatches, createdMatches, createdRounds };
}

module.exports = { syncTournamentMatchMetadata };
