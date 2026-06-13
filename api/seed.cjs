const prisma = require('./db.cjs');
const { getRoundNameEs, getTeamNameEs } = require('./translations.cjs');

function buildLinearKnockoutRounds(roundNames, start = 2, step = 2) {
  return roundNames.map((name, index) => ({
    name,
    order: index + 1,
    pointsPerCorrect: start + index * step,
  }));
}

function buildTournamentRounds(knockoutRoundNames, start = 2, step = 2) {
  return [
    { name: 'group_stage', order: 0, pointsPerCorrect: 0 },
    ...buildLinearKnockoutRounds(knockoutRoundNames, start, step),
  ];
}

function getFlagUrl(flagCode, fallbackCode) {
  return `https://flagcdn.com/w40/${(flagCode || fallbackCode || '').toLowerCase()}.png`;
}

function buildGroupStageMatches(groups, matchesByRound = {}) {
  // Generate all group stage matches for 4-team groups
  const groupMatches = [];
  let matchNumber = 1;
  
  for (const groupName of Object.keys(groups).sort()) {
    const teams = groups[groupName];
    if (teams.length < 2) {
      continue;
    }
    
    // Generate all pairs of teams in the group
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        groupMatches.push({
          matchNumber,
          homeLabel: teams[i].code || teams[i].code?.toUpperCase(),
          awayLabel: teams[j].code || teams[j].code?.toUpperCase(),
        });
        matchNumber++;
      }
    }
  }
  
  return groupMatches;
}

async function syncTournamentMatchMetadata(client, tournament, definition) {
  let updatedMatches = 0;

  for (const round of tournament.rounds || []) {
    const expectedMatches = definition.matchesByRound?.[round.name] || [];

    for (const expectedMatch of expectedMatches) {
      const existingMatch = (round.matches || []).find((match) => {
        if (round.name !== 'group_stage') {
          return Number(match.matchNumber) === Number(expectedMatch.matchNumber);
        }

        const existingPair = [match.homeLabel, match.awayLabel]
          .filter(Boolean)
          .sort()
          .join(':');
        const expectedPair = [expectedMatch.homeLabel, expectedMatch.awayLabel]
          .filter(Boolean)
          .sort()
          .join(':');
        return existingPair === expectedPair;
      });

      if (!existingMatch || !expectedMatch.matchDate) {
        continue;
      }

      await client.match.update({
        where: { id: existingMatch.id },
        data: {
          matchDate: new Date(expectedMatch.matchDate),
          ...(round.name === 'group_stage'
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

  return updatedMatches;
}

async function createTournamentSeed(definition) {
  const tournamentName = definition.tournament.name;
  console.log(`Seeding ${tournamentName}...`);

  let tournament = await prisma.tournament.findFirst({
    where: { name: tournamentName },
    include: {
      rounds: {
        include: {
          matches: true,
        },
      },
      _count: {
        select: {
          teams: true,
          groups: true,
          groupResults: true,
          groupPredictions: true,
          knockoutPredictions: true,
          scores: true,
          members: true,
          leagues: true,
        },
      },
    },
  });

  if (tournament) {
    const actualMatchCount = (tournament.rounds || []).reduce(
      (total, round) => total + (round.matches?.length || 0),
      0
    );
    const expectedMatchCount = Object.values(definition.matchesByRound || {}).reduce(
      (total, matches) => total + (matches?.length || 0),
      0
    );
    const expectedGroupCount = Object.keys(definition.groups || {}).length;
    const expectedTeamCount = Object.values(definition.groups || {}).reduce(
      (total, teams) => total + (teams?.length || 0),
      0
    );
    const expectedRoundCount = definition.rounds?.length || 0;
    const structureIsComplete =
      tournament._count.groups === expectedGroupCount &&
      tournament._count.teams === expectedTeamCount &&
      tournament.rounds.length === expectedRoundCount &&
      actualMatchCount === expectedMatchCount;
    const hasActivity =
      tournament._count.groupResults > 0 ||
      tournament._count.groupPredictions > 0 ||
      tournament._count.knockoutPredictions > 0 ||
      tournament._count.scores > 0 ||
      tournament._count.members > 0 ||
      tournament._count.leagues > 0;

    console.log(`  Tournament already exists: ${tournament.id}`);

    if (structureIsComplete) {
      const updatedMatches = await syncTournamentMatchMetadata(prisma, tournament, definition);
      if (updatedMatches > 0) {
        console.log(`  Updated schedule metadata for ${updatedMatches} matches.`);
      }
      console.log(`  Skipping seed to preserve user data.`);
      return;
    }

    if (hasActivity) {
      const updatedMatches = await syncTournamentMatchMetadata(prisma, tournament, definition);
      if (updatedMatches > 0) {
        console.log(`  Updated schedule metadata for ${updatedMatches} existing matches.`);
      }
      console.log(
        `  Tournament structure is incomplete, but it already has activity. Skipping automatic repair to avoid data loss.`
      );
      console.log(
        `  Current structure counts -> groups: ${tournament._count.groups}/${expectedGroupCount}, teams: ${tournament._count.teams}/${expectedTeamCount}, rounds: ${tournament.rounds.length}/${expectedRoundCount}, matches: ${actualMatchCount}/${expectedMatchCount}`
      );
      return;
    }

    // The rebuild path drops Team, Group, Match, and Round rows for the
    // existing tournament so the new structure can be reseeded with the
    // current definition. That is fine for fresh local databases but is
    // never desired against production data: even with no user activity,
    // the deletion changes record IDs that other systems may have cached
    // and surfaces as schema drift. Require an explicit opt-in env var so
    // the production seed step skips this branch by default.
    if (process.env.SEED_ALLOW_REBUILD !== 'true') {
      console.log(
        `  Tournament structure is incomplete and has no activity, but SEED_ALLOW_REBUILD is not set. Skipping destructive rebuild.`
      );
      console.log(
        `  Current structure counts -> groups: ${tournament._count.groups}/${expectedGroupCount}, teams: ${tournament._count.teams}/${expectedTeamCount}, rounds: ${tournament.rounds.length}/${expectedRoundCount}, matches: ${actualMatchCount}/${expectedMatchCount}`
      );
      console.log(
        `  Re-run with SEED_ALLOW_REBUILD=true on a non-production database if you want to drop and recreate the structure.`
      );
      return;
    }

    console.log(`  Tournament structure is incomplete and has no activity. Rebuilding seed structure.`);
    await prisma.$transaction(
      async (tx) => {
        await tx.team.deleteMany({ where: { tournamentId: tournament.id } });
        await tx.group.deleteMany({ where: { tournamentId: tournament.id } });
        const roundIds = (tournament.rounds || []).map((round) => round.id);
        if (roundIds.length) {
          await tx.match.deleteMany({
            where: {
              roundId: { in: roundIds },
            },
          });
        }
        await tx.round.deleteMany({ where: { tournamentId: tournament.id } });
        await tx.tournamentPrimaryEntry.updateMany({
          where: { tournamentId: tournament.id },
          data: { scopeKey: 'tournament' },
        });
        await tx.tournament.update({
          where: { id: tournament.id },
          data: definition.tournament,
        });
        await populateTournamentStructure(tx, tournament.id, definition);
      },
      { timeout: 60_000 }
    );
    console.log(`  Rebuilt ${tournamentName}.`);
    return;
  }

  tournament = await prisma.$transaction(
    async (tx) => {
      const createdTournament = await tx.tournament.create({
        data: definition.tournament,
      });
      await populateTournamentStructure(tx, createdTournament.id, definition);
      return createdTournament;
    },
    { timeout: 60_000 }
  );
  console.log(`Tournament: ${tournament.name} (${tournament.id})`);
  console.log(`\nSeed completed! Tournament ID: ${tournament.id}\n`);
}

async function populateTournamentStructure(tx, tournamentId, definition) {
  for (const [groupName, teams] of Object.entries(definition.groups)) {
    const group = await tx.group.create({
      data: {
        name: groupName,
        tournamentId,
      },
    });

    for (const team of teams) {
      await tx.team.create({
        data: {
          name: team.name,
          nameEs: getTeamNameEs(team),
          code: team.code,
          flagUrl: getFlagUrl(team.flagCode, team.code?.slice(0, 2)),
          groupId: group.id,
          tournamentId,
        },
      });
    }

    console.log(`  Group ${groupName}: ${teams.map((team) => team.code).join(', ')}`);
  }

  const roundMap = {};
  for (const round of definition.rounds) {
    const createdRound = await tx.round.create({
      data: {
        name: round.name,
        nameEs: getRoundNameEs(round) || round.name,
        order: round.order,
        pointsPerCorrect: round.pointsPerCorrect,
        tournamentId,
      },
    });

    roundMap[round.name] = createdRound.id;
    console.log(`  Round: ${round.name} (${round.pointsPerCorrect} pts/correct)`);
  }

  for (const round of definition.rounds) {
    const matches = definition.matchesByRound[round.name] || [];
    let createdMatches = 0;

    for (const match of matches) {
      createdMatches += 1;
      await tx.match.create({
        data: {
          roundId: roundMap[round.name],
          matchNumber: match.matchNumber,
          homeLabel: match.homeLabel,
          awayLabel: match.awayLabel,
          matchDate: match.matchDate ? new Date(match.matchDate) : null,
        },
      });
    }

    if (createdMatches > 0) {
      console.log(`  Created ${createdMatches} ${round.name} matches`);
    }
  }
}

const WORLD_CUP_2026_GROUPS = {
  A: [
    { name: 'Mexico', code: 'MEX', flagCode: 'mx' },
    { name: 'South Africa', code: 'RSA', flagCode: 'za' },
    { name: 'Korea Republic', code: 'KOR', flagCode: 'kr' },
    { name: 'Czechia', code: 'CZE', flagCode: 'cz' },
  ],
  B: [
    { name: 'Canada', code: 'CAN', flagCode: 'ca' },
    { name: 'Bosnia and Herzegovina', code: 'BIH', flagCode: 'ba' },
    { name: 'Qatar', code: 'QAT', flagCode: 'qa' },
    { name: 'Switzerland', code: 'SUI', flagCode: 'ch' },
  ],
  C: [
    { name: 'Brazil', code: 'BRA', flagCode: 'br' },
    { name: 'Morocco', code: 'MAR', flagCode: 'ma' },
    { name: 'Haiti', code: 'HAI', flagCode: 'ht' },
    { name: 'Scotland', code: 'SCO', flagCode: 'gb-sct' },
  ],
  D: [
    { name: 'USA', code: 'USA', flagCode: 'us' },
    { name: 'Paraguay', code: 'PAR', flagCode: 'py' },
    { name: 'Australia', code: 'AUS', flagCode: 'au' },
    { name: 'Türkiye', code: 'TUR', flagCode: 'tr' },
  ],
  E: [
    { name: 'Germany', code: 'GER', flagCode: 'de' },
    { name: 'Curaçao', code: 'CUW', flagCode: 'cw' },
    { name: "Côte d'Ivoire", code: 'CIV', flagCode: 'ci' },
    { name: 'Ecuador', code: 'ECU', flagCode: 'ec' },
  ],
  F: [
    { name: 'Netherlands', code: 'NED', flagCode: 'nl' },
    { name: 'Japan', code: 'JPN', flagCode: 'jp' },
    { name: 'Sweden', code: 'SWE', flagCode: 'se' },
    { name: 'Tunisia', code: 'TUN', flagCode: 'tn' },
  ],
  G: [
    { name: 'Belgium', code: 'BEL', flagCode: 'be' },
    { name: 'Egypt', code: 'EGY', flagCode: 'eg' },
    { name: 'IR Iran', code: 'IRN', flagCode: 'ir' },
    { name: 'New Zealand', code: 'NZL', flagCode: 'nz' },
  ],
  H: [
    { name: 'Spain', code: 'ESP', flagCode: 'es' },
    { name: 'Cabo Verde', code: 'CPV', flagCode: 'cv' },
    { name: 'Saudi Arabia', code: 'KSA', flagCode: 'sa' },
    { name: 'Uruguay', code: 'URU', flagCode: 'uy' },
  ],
  I: [
    { name: 'France', code: 'FRA', flagCode: 'fr' },
    { name: 'Senegal', code: 'SEN', flagCode: 'sn' },
    { name: 'Iraq', code: 'IRQ', flagCode: 'iq' },
    { name: 'Norway', code: 'NOR', flagCode: 'no' },
  ],
  J: [
    { name: 'Argentina', code: 'ARG', flagCode: 'ar' },
    { name: 'Algeria', code: 'ALG', flagCode: 'dz' },
    { name: 'Austria', code: 'AUT', flagCode: 'at' },
    { name: 'Jordan', code: 'JOR', flagCode: 'jo' },
  ],
  K: [
    { name: 'Portugal', code: 'POR', flagCode: 'pt' },
    { name: 'Congo DR', code: 'COD', flagCode: 'cd' },
    { name: 'Uzbekistan', code: 'UZB', flagCode: 'uz' },
    { name: 'Colombia', code: 'COL', flagCode: 'co' },
  ],
  L: [
    { name: 'England', code: 'ENG', flagCode: 'gb-eng' },
    { name: 'Croatia', code: 'CRO', flagCode: 'hr' },
    { name: 'Ghana', code: 'GHA', flagCode: 'gh' },
    { name: 'Panama', code: 'PAN', flagCode: 'pa' },
  ],
};

// Official FIFA schedule published April 10, 2026. Kickoff times use Eastern
// Daylight Time so Date parsing preserves the instant for locale-aware display.
const WORLD_CUP_2026_GROUP_MATCHES = [
  { matchNumber: 1, homeLabel: 'MEX', awayLabel: 'RSA', matchDate: '2026-06-11T15:00:00-04:00' },
  { matchNumber: 2, homeLabel: 'KOR', awayLabel: 'CZE', matchDate: '2026-06-11T22:00:00-04:00' },
  { matchNumber: 3, homeLabel: 'CAN', awayLabel: 'BIH', matchDate: '2026-06-12T15:00:00-04:00' },
  { matchNumber: 4, homeLabel: 'USA', awayLabel: 'PAR', matchDate: '2026-06-12T21:00:00-04:00' },
  { matchNumber: 5, homeLabel: 'HAI', awayLabel: 'SCO', matchDate: '2026-06-13T21:00:00-04:00' },
  { matchNumber: 6, homeLabel: 'AUS', awayLabel: 'TUR', matchDate: '2026-06-13T00:00:00-04:00' },
  { matchNumber: 7, homeLabel: 'BRA', awayLabel: 'MAR', matchDate: '2026-06-13T18:00:00-04:00' },
  { matchNumber: 8, homeLabel: 'QAT', awayLabel: 'SUI', matchDate: '2026-06-13T15:00:00-04:00' },
  { matchNumber: 9, homeLabel: 'CIV', awayLabel: 'ECU', matchDate: '2026-06-14T19:00:00-04:00' },
  { matchNumber: 10, homeLabel: 'GER', awayLabel: 'CUW', matchDate: '2026-06-14T13:00:00-04:00' },
  { matchNumber: 11, homeLabel: 'NED', awayLabel: 'JPN', matchDate: '2026-06-14T16:00:00-04:00' },
  { matchNumber: 12, homeLabel: 'SWE', awayLabel: 'TUN', matchDate: '2026-06-14T22:00:00-04:00' },
  { matchNumber: 13, homeLabel: 'KSA', awayLabel: 'URU', matchDate: '2026-06-15T18:00:00-04:00' },
  { matchNumber: 14, homeLabel: 'ESP', awayLabel: 'CPV', matchDate: '2026-06-15T12:00:00-04:00' },
  { matchNumber: 15, homeLabel: 'IRN', awayLabel: 'NZL', matchDate: '2026-06-15T21:00:00-04:00' },
  { matchNumber: 16, homeLabel: 'BEL', awayLabel: 'EGY', matchDate: '2026-06-15T15:00:00-04:00' },
  { matchNumber: 17, homeLabel: 'FRA', awayLabel: 'SEN', matchDate: '2026-06-16T15:00:00-04:00' },
  { matchNumber: 18, homeLabel: 'IRQ', awayLabel: 'NOR', matchDate: '2026-06-16T18:00:00-04:00' },
  { matchNumber: 19, homeLabel: 'ARG', awayLabel: 'ALG', matchDate: '2026-06-16T21:00:00-04:00' },
  { matchNumber: 20, homeLabel: 'AUT', awayLabel: 'JOR', matchDate: '2026-06-16T00:00:00-04:00' },
  { matchNumber: 21, homeLabel: 'GHA', awayLabel: 'PAN', matchDate: '2026-06-17T19:00:00-04:00' },
  { matchNumber: 22, homeLabel: 'ENG', awayLabel: 'CRO', matchDate: '2026-06-17T16:00:00-04:00' },
  { matchNumber: 23, homeLabel: 'POR', awayLabel: 'COD', matchDate: '2026-06-17T13:00:00-04:00' },
  { matchNumber: 24, homeLabel: 'UZB', awayLabel: 'COL', matchDate: '2026-06-17T22:00:00-04:00' },
  { matchNumber: 25, homeLabel: 'CZE', awayLabel: 'RSA', matchDate: '2026-06-18T12:00:00-04:00' },
  { matchNumber: 26, homeLabel: 'SUI', awayLabel: 'BIH', matchDate: '2026-06-18T15:00:00-04:00' },
  { matchNumber: 27, homeLabel: 'CAN', awayLabel: 'QAT', matchDate: '2026-06-18T18:00:00-04:00' },
  { matchNumber: 28, homeLabel: 'MEX', awayLabel: 'KOR', matchDate: '2026-06-18T21:00:00-04:00' },
  { matchNumber: 29, homeLabel: 'BRA', awayLabel: 'HAI', matchDate: '2026-06-19T20:30:00-04:00' },
  { matchNumber: 30, homeLabel: 'SCO', awayLabel: 'MAR', matchDate: '2026-06-19T18:00:00-04:00' },
  { matchNumber: 31, homeLabel: 'TUR', awayLabel: 'PAR', matchDate: '2026-06-19T23:00:00-04:00' },
  { matchNumber: 32, homeLabel: 'USA', awayLabel: 'AUS', matchDate: '2026-06-19T15:00:00-04:00' },
  { matchNumber: 33, homeLabel: 'GER', awayLabel: 'CIV', matchDate: '2026-06-20T16:00:00-04:00' },
  { matchNumber: 34, homeLabel: 'ECU', awayLabel: 'CUW', matchDate: '2026-06-20T20:00:00-04:00' },
  { matchNumber: 35, homeLabel: 'NED', awayLabel: 'SWE', matchDate: '2026-06-20T13:00:00-04:00' },
  { matchNumber: 36, homeLabel: 'TUN', awayLabel: 'JPN', matchDate: '2026-06-20T00:00:00-04:00' },
  { matchNumber: 37, homeLabel: 'URU', awayLabel: 'CPV', matchDate: '2026-06-21T18:00:00-04:00' },
  { matchNumber: 38, homeLabel: 'ESP', awayLabel: 'KSA', matchDate: '2026-06-21T12:00:00-04:00' },
  { matchNumber: 39, homeLabel: 'BEL', awayLabel: 'IRN', matchDate: '2026-06-21T15:00:00-04:00' },
  { matchNumber: 40, homeLabel: 'NZL', awayLabel: 'EGY', matchDate: '2026-06-21T21:00:00-04:00' },
  { matchNumber: 41, homeLabel: 'NOR', awayLabel: 'SEN', matchDate: '2026-06-22T20:00:00-04:00' },
  { matchNumber: 42, homeLabel: 'FRA', awayLabel: 'IRQ', matchDate: '2026-06-22T17:00:00-04:00' },
  { matchNumber: 43, homeLabel: 'ARG', awayLabel: 'AUT', matchDate: '2026-06-22T13:00:00-04:00' },
  { matchNumber: 44, homeLabel: 'JOR', awayLabel: 'ALG', matchDate: '2026-06-22T23:00:00-04:00' },
  { matchNumber: 45, homeLabel: 'ENG', awayLabel: 'GHA', matchDate: '2026-06-23T16:00:00-04:00' },
  { matchNumber: 46, homeLabel: 'PAN', awayLabel: 'CRO', matchDate: '2026-06-23T19:00:00-04:00' },
  { matchNumber: 47, homeLabel: 'POR', awayLabel: 'UZB', matchDate: '2026-06-23T13:00:00-04:00' },
  { matchNumber: 48, homeLabel: 'COL', awayLabel: 'COD', matchDate: '2026-06-23T22:00:00-04:00' },
  { matchNumber: 49, homeLabel: 'SCO', awayLabel: 'BRA', matchDate: '2026-06-24T18:00:00-04:00' },
  { matchNumber: 50, homeLabel: 'MAR', awayLabel: 'HAI', matchDate: '2026-06-24T18:00:00-04:00' },
  { matchNumber: 51, homeLabel: 'SUI', awayLabel: 'CAN', matchDate: '2026-06-24T15:00:00-04:00' },
  { matchNumber: 52, homeLabel: 'BIH', awayLabel: 'QAT', matchDate: '2026-06-24T15:00:00-04:00' },
  { matchNumber: 53, homeLabel: 'CZE', awayLabel: 'MEX', matchDate: '2026-06-24T21:00:00-04:00' },
  { matchNumber: 54, homeLabel: 'RSA', awayLabel: 'KOR', matchDate: '2026-06-24T21:00:00-04:00' },
  { matchNumber: 55, homeLabel: 'CUW', awayLabel: 'CIV', matchDate: '2026-06-25T16:00:00-04:00' },
  { matchNumber: 56, homeLabel: 'ECU', awayLabel: 'GER', matchDate: '2026-06-25T16:00:00-04:00' },
  { matchNumber: 57, homeLabel: 'JPN', awayLabel: 'SWE', matchDate: '2026-06-25T19:00:00-04:00' },
  { matchNumber: 58, homeLabel: 'TUN', awayLabel: 'NED', matchDate: '2026-06-25T19:00:00-04:00' },
  { matchNumber: 59, homeLabel: 'TUR', awayLabel: 'USA', matchDate: '2026-06-25T22:00:00-04:00' },
  { matchNumber: 60, homeLabel: 'PAR', awayLabel: 'AUS', matchDate: '2026-06-25T22:00:00-04:00' },
  { matchNumber: 61, homeLabel: 'NOR', awayLabel: 'FRA', matchDate: '2026-06-26T15:00:00-04:00' },
  { matchNumber: 62, homeLabel: 'SEN', awayLabel: 'IRQ', matchDate: '2026-06-26T15:00:00-04:00' },
  { matchNumber: 63, homeLabel: 'EGY', awayLabel: 'IRN', matchDate: '2026-06-26T23:00:00-04:00' },
  { matchNumber: 64, homeLabel: 'NZL', awayLabel: 'BEL', matchDate: '2026-06-26T23:00:00-04:00' },
  { matchNumber: 65, homeLabel: 'CPV', awayLabel: 'KSA', matchDate: '2026-06-26T20:00:00-04:00' },
  { matchNumber: 66, homeLabel: 'URU', awayLabel: 'ESP', matchDate: '2026-06-26T20:00:00-04:00' },
  { matchNumber: 67, homeLabel: 'PAN', awayLabel: 'ENG', matchDate: '2026-06-27T17:00:00-04:00' },
  { matchNumber: 68, homeLabel: 'CRO', awayLabel: 'GHA', matchDate: '2026-06-27T17:00:00-04:00' },
  { matchNumber: 69, homeLabel: 'ALG', awayLabel: 'AUT', matchDate: '2026-06-27T22:00:00-04:00' },
  { matchNumber: 70, homeLabel: 'JOR', awayLabel: 'ARG', matchDate: '2026-06-27T22:00:00-04:00' },
  { matchNumber: 71, homeLabel: 'COL', awayLabel: 'POR', matchDate: '2026-06-27T19:30:00-04:00' },
  { matchNumber: 72, homeLabel: 'COD', awayLabel: 'UZB', matchDate: '2026-06-27T19:30:00-04:00' },
];

const WORLD_CUP_2026_KNOCKOUT_MATCH_DATES = {
  73: '2026-06-28T15:00:00-04:00',
  74: '2026-06-29T16:30:00-04:00',
  75: '2026-06-29T21:00:00-04:00',
  76: '2026-06-29T13:00:00-04:00',
  77: '2026-06-30T17:00:00-04:00',
  78: '2026-06-30T13:00:00-04:00',
  79: '2026-06-30T21:00:00-04:00',
  80: '2026-07-01T12:00:00-04:00',
  81: '2026-07-01T20:00:00-04:00',
  82: '2026-07-01T16:00:00-04:00',
  83: '2026-07-02T19:00:00-04:00',
  84: '2026-07-02T15:00:00-04:00',
  85: '2026-07-02T23:00:00-04:00',
  86: '2026-07-03T18:00:00-04:00',
  87: '2026-07-03T21:30:00-04:00',
  88: '2026-07-03T14:00:00-04:00',
  89: '2026-07-04T17:00:00-04:00',
  90: '2026-07-04T13:00:00-04:00',
  91: '2026-07-05T16:00:00-04:00',
  92: '2026-07-05T20:00:00-04:00',
  93: '2026-07-06T15:00:00-04:00',
  94: '2026-07-06T20:00:00-04:00',
  95: '2026-07-07T12:00:00-04:00',
  96: '2026-07-07T16:00:00-04:00',
  97: '2026-07-09T16:00:00-04:00',
  98: '2026-07-10T15:00:00-04:00',
  99: '2026-07-11T17:00:00-04:00',
  100: '2026-07-11T21:00:00-04:00',
  101: '2026-07-14T15:00:00-04:00',
  102: '2026-07-15T15:00:00-04:00',
  103: '2026-07-18T17:00:00-04:00',
  104: '2026-07-19T15:00:00-04:00',
};

function getWorldCupKnockoutMatchDate(officialMatchNumber) {
  return WORLD_CUP_2026_KNOCKOUT_MATCH_DATES[officialMatchNumber];
}

function withWorldCupMatchDates(firstOfficialMatchNumber, matches) {
  return matches.map((match, index) => ({
    ...match,
    matchDate: getWorldCupKnockoutMatchDate(firstOfficialMatchNumber + index),
  }));
}

const EURO_GROUPS = {
  A: [
    { name: 'Germany', code: 'GER', flagCode: 'de' },
    { name: 'Scotland', code: 'SCO', flagCode: 'gb-sct' },
    { name: 'Hungary', code: 'HUN', flagCode: 'hu' },
    { name: 'Switzerland', code: 'SUI', flagCode: 'ch' },
  ],
  B: [
    { name: 'Spain', code: 'ESP', flagCode: 'es' },
    { name: 'Italy', code: 'ITA', flagCode: 'it' },
    { name: 'Croatia', code: 'CRO', flagCode: 'hr' },
    { name: 'Albania', code: 'ALB', flagCode: 'al' },
  ],
  C: [
    { name: 'England', code: 'ENG', flagCode: 'gb-eng' },
    { name: 'Denmark', code: 'DEN', flagCode: 'dk' },
    { name: 'Serbia', code: 'SRB', flagCode: 'rs' },
    { name: 'Slovenia', code: 'SVN', flagCode: 'si' },
  ],
  D: [
    { name: 'France', code: 'FRA', flagCode: 'fr' },
    { name: 'Netherlands', code: 'NED', flagCode: 'nl' },
    { name: 'Austria', code: 'AUT', flagCode: 'at' },
    { name: 'Poland', code: 'POL', flagCode: 'pl' },
  ],
  E: [
    { name: 'Belgium', code: 'BEL', flagCode: 'be' },
    { name: 'Ukraine', code: 'UKR', flagCode: 'ua' },
    { name: 'Romania', code: 'ROU', flagCode: 'ro' },
    { name: 'Slovakia', code: 'SVK', flagCode: 'sk' },
  ],
  F: [
    { name: 'Portugal', code: 'POR', flagCode: 'pt' },
    { name: 'Türkiye', code: 'TUR', flagCode: 'tr' },
    { name: 'Czechia', code: 'CZE', flagCode: 'cz' },
    { name: 'Georgia', code: 'GEO', flagCode: 'ge' },
  ],
};

const ASIAN_CUP_GROUPS = {
  A: [
    { name: 'Qatar', code: 'QAT', flagCode: 'qa' },
    { name: 'China PR', code: 'CHN', flagCode: 'cn' },
    { name: 'Tajikistan', code: 'TJK', flagCode: 'tj' },
    { name: 'Lebanon', code: 'LBN', flagCode: 'lb' },
  ],
  B: [
    { name: 'Australia', code: 'AUS', flagCode: 'au' },
    { name: 'Uzbekistan', code: 'UZB', flagCode: 'uz' },
    { name: 'Syria', code: 'SYR', flagCode: 'sy' },
    { name: 'India', code: 'IND', flagCode: 'in' },
  ],
  C: [
    { name: 'IR Iran', code: 'IRN', flagCode: 'ir' },
    { name: 'United Arab Emirates', code: 'UAE', flagCode: 'ae' },
    { name: 'Hong Kong', code: 'HKG', flagCode: 'hk' },
    { name: 'Palestine', code: 'PLE', flagCode: 'ps' },
  ],
  D: [
    { name: 'Japan', code: 'JPN', flagCode: 'jp' },
    { name: 'Indonesia', code: 'IDN', flagCode: 'id' },
    { name: 'Iraq', code: 'IRQ', flagCode: 'iq' },
    { name: 'Vietnam', code: 'VIE', flagCode: 'vn' },
  ],
  E: [
    { name: 'Korea Republic', code: 'KOR', flagCode: 'kr' },
    { name: 'Jordan', code: 'JOR', flagCode: 'jo' },
    { name: 'Bahrain', code: 'BHR', flagCode: 'bh' },
    { name: 'Malaysia', code: 'MAS', flagCode: 'my' },
  ],
  F: [
    { name: 'Saudi Arabia', code: 'KSA', flagCode: 'sa' },
    { name: 'Thailand', code: 'THA', flagCode: 'th' },
    { name: 'Kyrgyz Republic', code: 'KGZ', flagCode: 'kg' },
    { name: 'Oman', code: 'OMA', flagCode: 'om' },
  ],
};

const AFCON_GROUPS = {
  A: [
    { name: 'Morocco', code: 'MAR', flagCode: 'ma' },
    { name: 'DR Congo', code: 'COD', flagCode: 'cd' },
    { name: 'Zambia', code: 'ZAM', flagCode: 'zm' },
    { name: 'Tanzania', code: 'TAN', flagCode: 'tz' },
  ],
  B: [
    { name: 'Senegal', code: 'SEN', flagCode: 'sn' },
    { name: 'Cameroon', code: 'CMR', flagCode: 'cm' },
    { name: 'Guinea', code: 'GUI', flagCode: 'gn' },
    { name: 'Gambia', code: 'GAM', flagCode: 'gm' },
  ],
  C: [
    { name: 'Egypt', code: 'EGY', flagCode: 'eg' },
    { name: 'Nigeria', code: 'NGA', flagCode: 'ng' },
    { name: 'South Africa', code: 'RSA', flagCode: 'za' },
    { name: 'Angola', code: 'ANG', flagCode: 'ao' },
  ],
  D: [
    { name: 'Algeria', code: 'ALG', flagCode: 'dz' },
    { name: 'Burkina Faso', code: 'BFA', flagCode: 'bf' },
    { name: 'Mali', code: 'MLI', flagCode: 'ml' },
    { name: 'Mauritania', code: 'MTN', flagCode: 'mr' },
  ],
  E: [
    { name: "Côte d'Ivoire", code: 'CIV', flagCode: 'ci' },
    { name: 'Tunisia', code: 'TUN', flagCode: 'tn' },
    { name: 'Cabo Verde', code: 'CPV', flagCode: 'cv' },
    { name: 'Equatorial Guinea', code: 'EQG', flagCode: 'gq' },
  ],
  F: [
    { name: 'Ghana', code: 'GHA', flagCode: 'gh' },
    { name: 'Benin', code: 'BEN', flagCode: 'bj' },
    { name: 'Gabon', code: 'GAB', flagCode: 'ga' },
    { name: 'Uganda', code: 'UGA', flagCode: 'ug' },
  ],
};

const COPA_AMERICA_GROUPS = {
  A: [
    { name: 'Argentina', code: 'ARG', flagCode: 'ar' },
    { name: 'Peru', code: 'PER', flagCode: 'pe' },
    { name: 'Chile', code: 'CHI', flagCode: 'cl' },
    { name: 'Canada', code: 'CAN', flagCode: 'ca' },
  ],
  B: [
    { name: 'Mexico', code: 'MEX', flagCode: 'mx' },
    { name: 'Ecuador', code: 'ECU', flagCode: 'ec' },
    { name: 'Venezuela', code: 'VEN', flagCode: 've' },
    { name: 'Jamaica', code: 'JAM', flagCode: 'jm' },
  ],
  C: [
    { name: 'USA', code: 'USA', flagCode: 'us' },
    { name: 'Uruguay', code: 'URU', flagCode: 'uy' },
    { name: 'Panama', code: 'PAN', flagCode: 'pa' },
    { name: 'Bolivia', code: 'BOL', flagCode: 'bo' },
  ],
  D: [
    { name: 'Brazil', code: 'BRA', flagCode: 'br' },
    { name: 'Colombia', code: 'COL', flagCode: 'co' },
    { name: 'Paraguay', code: 'PAR', flagCode: 'py' },
    { name: 'Costa Rica', code: 'CRC', flagCode: 'cr' },
  ],
};

const WORLD_CUP_2026_DEF = {
  tournament: {
    name: 'FIFA World Cup 2026',
    nameEs: 'Copa Mundial FIFA 2026',
    modeKey: 'classic_argentinian_prode',
    modeName: 'Classic Prode',
    modeNameEs: 'Prode Clasico',
    sport: 'football',
    status: 'upcoming',
    prizesEnabled: false,
    entryFee: 20,
    currency: 'USD',
    accessType: 'public',
    startDate: new Date('2026-06-11'),
    endDate: new Date('2026-07-19'),
    closingDate: new Date('2026-06-10T19:00:00'),
  },
  groups: WORLD_CUP_2026_GROUPS,
  rounds: buildTournamentRounds(
    [
      'round_of_32',
      'round_of_16',
      'quarter_finals',
      'semi_finals',
      'third_place_match',
      'final',
    ],
    2,
    2
  ),
  matchesByRound: {
    group_stage: WORLD_CUP_2026_GROUP_MATCHES,
    round_of_32: withWorldCupMatchDates(73, [
      { matchNumber: 1, homeLabel: '2A', awayLabel: '2B' },
      { matchNumber: 2, homeLabel: '1E', awayLabel: '3[A/B/C/D/F]' },
      { matchNumber: 3, homeLabel: '1F', awayLabel: '2C' },
      { matchNumber: 4, homeLabel: '1C', awayLabel: '2F' },
      { matchNumber: 5, homeLabel: '1I', awayLabel: '3[C/D/F/G/H]' },
      { matchNumber: 6, homeLabel: '2E', awayLabel: '2I' },
      { matchNumber: 7, homeLabel: '1A', awayLabel: '3[C/E/F/H/I]' },
      { matchNumber: 8, homeLabel: '1L', awayLabel: '3[E/H/I/J/K]' },
      { matchNumber: 9, homeLabel: '1D', awayLabel: '3[B/E/F/I/J]' },
      { matchNumber: 10, homeLabel: '1G', awayLabel: '3[A/E/H/I/J]' },
      { matchNumber: 11, homeLabel: '2K', awayLabel: '2L' },
      { matchNumber: 12, homeLabel: '1H', awayLabel: '2J' },
      { matchNumber: 13, homeLabel: '1B', awayLabel: '3[E/F/G/I/J]' },
      { matchNumber: 14, homeLabel: '1J', awayLabel: '2H' },
      { matchNumber: 15, homeLabel: '1K', awayLabel: '3[D/E/I/J/L]' },
      { matchNumber: 16, homeLabel: '2D', awayLabel: '2G' },
    ]),
    round_of_16: withWorldCupMatchDates(89, [
      { matchNumber: 1, homeLabel: 'W-R32-2', awayLabel: 'W-R32-5' },
      { matchNumber: 2, homeLabel: 'W-R32-1', awayLabel: 'W-R32-3' },
      { matchNumber: 3, homeLabel: 'W-R32-4', awayLabel: 'W-R32-6' },
      { matchNumber: 4, homeLabel: 'W-R32-7', awayLabel: 'W-R32-8' },
      { matchNumber: 5, homeLabel: 'W-R32-11', awayLabel: 'W-R32-12' },
      { matchNumber: 6, homeLabel: 'W-R32-9', awayLabel: 'W-R32-10' },
      { matchNumber: 7, homeLabel: 'W-R32-14', awayLabel: 'W-R32-16' },
      { matchNumber: 8, homeLabel: 'W-R32-13', awayLabel: 'W-R32-15' },
    ]),
    quarter_finals: withWorldCupMatchDates(97, [
      { matchNumber: 1, homeLabel: 'W-R16-1', awayLabel: 'W-R16-2' },
      { matchNumber: 2, homeLabel: 'W-R16-3', awayLabel: 'W-R16-4' },
      { matchNumber: 3, homeLabel: 'W-R16-5', awayLabel: 'W-R16-6' },
      { matchNumber: 4, homeLabel: 'W-R16-7', awayLabel: 'W-R16-8' },
    ]),
    semi_finals: withWorldCupMatchDates(101, [
      { matchNumber: 1, homeLabel: 'W-QF-1', awayLabel: 'W-QF-2' },
      { matchNumber: 2, homeLabel: 'W-QF-3', awayLabel: 'W-QF-4' },
    ]),
    third_place_match: withWorldCupMatchDates(103, [
      { matchNumber: 1, homeLabel: 'L-SF-1', awayLabel: 'L-SF-2' },
    ]),
    final: withWorldCupMatchDates(104, [
      { matchNumber: 1, homeLabel: 'W-SF-1', awayLabel: 'W-SF-2' },
    ]),
  },
};

const EURO_TEMPLATE_DEF = {
  tournament: {
    name: 'UEFA Euro',
    nameEs: 'Eurocopa UEFA',
    modeKey: 'classic_argentinian_prode',
    modeName: 'Classic Prode',
    modeNameEs: 'Prode Clasico',
    sport: 'football',
    status: 'upcoming',
    prizesEnabled: false,
    entryFee: 0,
    currency: 'EUR',
    accessType: 'public',
    startDate: new Date('2028-06-08'),
    endDate: new Date('2028-07-08'),
    closingDate: new Date('2028-06-07T19:00:00'),
  },
  groups: EURO_GROUPS,
  rounds: buildTournamentRounds(
    ['round_of_16', 'quarter_finals', 'semi_finals', 'final'],
    2,
    2
  ),
  matchesByRound: {
    round_of_16: [
      { matchNumber: 1, homeLabel: '1B', awayLabel: '3[A/D/E/F]' },
      { matchNumber: 2, homeLabel: '1A', awayLabel: '2C' },
      { matchNumber: 3, homeLabel: '1F', awayLabel: '3[A/B/C]' },
      { matchNumber: 4, homeLabel: '2D', awayLabel: '2E' },
      { matchNumber: 5, homeLabel: '1E', awayLabel: '3[A/B/C/D]' },
      { matchNumber: 6, homeLabel: '1D', awayLabel: '2F' },
      { matchNumber: 7, homeLabel: '1C', awayLabel: '3[D/E/F]' },
      { matchNumber: 8, homeLabel: '2A', awayLabel: '2B' },
    ],
    quarter_finals: [
      { matchNumber: 1, homeLabel: 'W-R16-1', awayLabel: 'W-R16-2' },
      { matchNumber: 2, homeLabel: 'W-R16-3', awayLabel: 'W-R16-4' },
      { matchNumber: 3, homeLabel: 'W-R16-5', awayLabel: 'W-R16-6' },
      { matchNumber: 4, homeLabel: 'W-R16-7', awayLabel: 'W-R16-8' },
    ],
    semi_finals: [
      { matchNumber: 1, homeLabel: 'W-QF-1', awayLabel: 'W-QF-2' },
      { matchNumber: 2, homeLabel: 'W-QF-3', awayLabel: 'W-QF-4' },
    ],
    final: [
      { matchNumber: 1, homeLabel: 'W-SF-1', awayLabel: 'W-SF-2' },
    ],
  },
};

const ASIAN_CUP_TEMPLATE_DEF = {
  tournament: {
    name: 'AFC Asian Cup',
    nameEs: 'Copa Asiática AFC',
    modeKey: 'classic_argentinian_prode',
    modeName: 'Classic Prode',
    modeNameEs: 'Prode Clasico',
    sport: 'football',
    status: 'upcoming',
    prizesEnabled: false,
    entryFee: 0,
    currency: 'USD',
    accessType: 'public',
    startDate: new Date('2027-01-07'),
    endDate: new Date('2027-02-05'),
    closingDate: new Date('2027-01-06T19:00:00'),
  },
  groups: ASIAN_CUP_GROUPS,
  rounds: buildTournamentRounds(
    ['round_of_16', 'quarter_finals', 'semi_finals', 'final'],
    2,
    2
  ),
  matchesByRound: EURO_TEMPLATE_DEF.matchesByRound,
};

const AFCON_TEMPLATE_DEF = {
  tournament: {
    name: 'Africa Cup of Nations',
    nameEs: 'Copa Africana de Naciones',
    modeKey: 'classic_argentinian_prode',
    modeName: 'Classic Prode',
    modeNameEs: 'Prode Clasico',
    sport: 'football',
    status: 'upcoming',
    prizesEnabled: false,
    entryFee: 0,
    currency: 'USD',
    accessType: 'public',
    startDate: new Date('2027-01-15'),
    endDate: new Date('2027-02-13'),
    closingDate: new Date('2027-01-14T19:00:00'),
  },
  groups: AFCON_GROUPS,
  rounds: buildTournamentRounds(
    ['round_of_16', 'quarter_finals', 'semi_finals', 'final'],
    2,
    2
  ),
  matchesByRound: EURO_TEMPLATE_DEF.matchesByRound,
};

const COPA_AMERICA_TEMPLATE_DEF = {
  tournament: {
    name: 'Copa América',
    nameEs: 'Copa América',
    modeKey: 'classic_argentinian_prode',
    modeName: 'Classic Prode',
    modeNameEs: 'Prode Clasico',
    sport: 'football',
    status: 'upcoming',
    prizesEnabled: false,
    entryFee: 0,
    currency: 'USD',
    accessType: 'public',
    startDate: new Date('2028-06-20'),
    endDate: new Date('2028-07-14'),
    closingDate: new Date('2028-06-19T19:00:00'),
  },
  groups: COPA_AMERICA_GROUPS,
  rounds: buildTournamentRounds(
    ['quarter_finals', 'semi_finals', 'final'],
    2,
    2
  ),
  matchesByRound: {
    quarter_finals: [
      { matchNumber: 1, homeLabel: '1A', awayLabel: '2B' },
      { matchNumber: 2, homeLabel: '1B', awayLabel: '2A' },
      { matchNumber: 3, homeLabel: '1C', awayLabel: '2D' },
      { matchNumber: 4, homeLabel: '1D', awayLabel: '2C' },
    ],
    semi_finals: [
      { matchNumber: 1, homeLabel: 'W-QF-1', awayLabel: 'W-QF-2' },
      { matchNumber: 2, homeLabel: 'W-QF-3', awayLabel: 'W-QF-4' },
    ],
    final: [
      { matchNumber: 1, homeLabel: 'W-SF-1', awayLabel: 'W-SF-2' },
    ],
  },
};

const TOURNAMENT_DEFINITIONS = [
  WORLD_CUP_2026_DEF,
  ASIAN_CUP_TEMPLATE_DEF,
  AFCON_TEMPLATE_DEF,
  EURO_TEMPLATE_DEF,
  COPA_AMERICA_TEMPLATE_DEF,
];

async function seed() {
  try {
    for (const definition of TOURNAMENT_DEFINITIONS) {
      await createTournamentSeed(definition);
    }
  } catch (error) {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

seed();
