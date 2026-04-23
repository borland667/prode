require('dotenv').config();

const prisma = require('./db.cjs');
const {
  getModeNameEs,
  getRoundNameEs,
  getTeamNameEs,
  getTournamentNameEs,
} = require('./translations.cjs');

async function backfillTranslations() {
  const [tournaments, teams, rounds] = await Promise.all([
    prisma.tournament.findMany({
      select: {
        id: true,
        name: true,
        nameEs: true,
        modeKey: true,
        modeName: true,
        modeNameEs: true,
      },
    }),
    prisma.team.findMany({
      select: {
        id: true,
        name: true,
        nameEs: true,
        code: true,
      },
    }),
    prisma.round.findMany({
      select: {
        id: true,
        name: true,
        nameEs: true,
      },
    }),
  ]);

  const operations = [];
  let tournamentUpdates = 0;
  let teamUpdates = 0;
  let roundUpdates = 0;

  for (const tournament of tournaments) {
    const nextNameEs = getTournamentNameEs(tournament);
    const nextModeNameEs = getModeNameEs(tournament);
    const data = {};

    if (nextNameEs && nextNameEs !== tournament.nameEs) {
      data.nameEs = nextNameEs;
    }

    if (nextModeNameEs && nextModeNameEs !== tournament.modeNameEs) {
      data.modeNameEs = nextModeNameEs;
    }

    if (Object.keys(data).length) {
      tournamentUpdates += 1;
      operations.push(
        prisma.tournament.update({
          where: { id: tournament.id },
          data,
        })
      );
    }
  }

  for (const team of teams) {
    const nextNameEs = getTeamNameEs(team);
    if (nextNameEs && nextNameEs !== team.nameEs) {
      teamUpdates += 1;
      operations.push(
        prisma.team.update({
          where: { id: team.id },
          data: {
            nameEs: nextNameEs,
          },
        })
      );
    }
  }

  for (const round of rounds) {
    const nextNameEs = getRoundNameEs(round);
    if (nextNameEs && nextNameEs !== round.nameEs) {
      roundUpdates += 1;
      operations.push(
        prisma.round.update({
          where: { id: round.id },
          data: {
            nameEs: nextNameEs,
          },
        })
      );
    }
  }

  if (operations.length) {
    await prisma.$transaction(operations);
  }

  console.log(
    `Backfilled translations: ${tournamentUpdates} tournaments, ${teamUpdates} teams, ${roundUpdates} rounds.`
  );
}

backfillTranslations()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
