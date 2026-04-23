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

async function deleteExistingTournamentByName(name) {
  const existingTournament = await prisma.tournament.findFirst({
    where: { name },
    select: { id: true },
  });

  if (!existingTournament) {
    return;
  }

  const roundIds = (
    await prisma.round.findMany({
      where: { tournamentId: existingTournament.id },
      select: { id: true },
    })
  ).map((round) => round.id);

  const leagueIds = (
    await prisma.tournamentLeague.findMany({
      where: { tournamentId: existingTournament.id },
      select: { id: true },
    })
  ).map((league) => league.id);

  if (leagueIds.length > 0) {
    await prisma.leagueMember.deleteMany({
      where: {
        leagueId: { in: leagueIds },
      },
    });
  }

  await prisma.knockoutPrediction.deleteMany({
    where: { tournamentId: existingTournament.id },
  });
  await prisma.groupPrediction.deleteMany({
    where: { tournamentId: existingTournament.id },
  });
  await prisma.groupResult.deleteMany({
    where: { tournamentId: existingTournament.id },
  });
  await prisma.score.deleteMany({
    where: { tournamentId: existingTournament.id },
  });
  await prisma.tournamentMember.deleteMany({
    where: { tournamentId: existingTournament.id },
  });
  await prisma.tournamentLeague.deleteMany({
    where: { tournamentId: existingTournament.id },
  });

  if (roundIds.length > 0) {
    await prisma.match.deleteMany({
      where: {
        roundId: { in: roundIds },
      },
    });
  }

  await prisma.round.deleteMany({
    where: { tournamentId: existingTournament.id },
  });
  await prisma.team.deleteMany({
    where: { tournamentId: existingTournament.id },
  });
  await prisma.group.deleteMany({
    where: { tournamentId: existingTournament.id },
  });
  await prisma.tournament.delete({
    where: { id: existingTournament.id },
  });
}

async function createTournamentSeed(definition) {
  console.log(`Seeding ${definition.tournament.name}...\n`);

  await deleteExistingTournamentByName(definition.tournament.name);

  const tournament = await prisma.tournament.create({
    data: definition.tournament,
  });
  console.log(`Tournament: ${tournament.name} (${tournament.id})`);

  for (const [groupName, teams] of Object.entries(definition.groups)) {
    const group = await prisma.group.create({
      data: {
        name: groupName,
        tournamentId: tournament.id,
      },
    });

    for (const team of teams) {
      await prisma.team.create({
        data: {
          name: team.name,
          nameEs: getTeamNameEs(team),
          code: team.code,
          flagUrl: getFlagUrl(team.flagCode, team.code?.slice(0, 2)),
          groupId: group.id,
          tournamentId: tournament.id,
        },
      });
    }

    console.log(`  Group ${groupName}: ${teams.map((team) => team.code).join(', ')}`);
  }

  const roundMap = {};
  for (const round of definition.rounds) {
    const createdRound = await prisma.round.create({
      data: {
        name: round.name,
        nameEs: getRoundNameEs(round) || round.name,
        order: round.order,
        pointsPerCorrect: round.pointsPerCorrect,
        tournamentId: tournament.id,
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
      await prisma.match.create({
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

  console.log(`\nSeed completed! Tournament ID: ${tournament.id}\n`);
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
    modeName: 'Classic Argentinian Prode (Scaled)',
    modeNameEs: 'Prode Argentino Clasico Escalado',
    sport: 'football',
    status: 'upcoming',
    prizesEnabled: true,
    entryFee: 20,
    currency: 'USD',
    accessType: 'public',
    startDate: new Date('2026-06-11'),
    endDate: new Date('2026-07-19'),
    closingDate: new Date('2026-06-10T19:00:00'),
  },
  groups: WORLD_CUP_2026_GROUPS,
  rounds: buildTournamentRounds(
    ['round_of_32', 'round_of_16', 'quarter_finals', 'semi_finals', 'final'],
    2,
    2
  ),
  matchesByRound: {
    round_of_32: [
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
    ],
    round_of_16: [
      { matchNumber: 1, homeLabel: 'W-R32-2', awayLabel: 'W-R32-5' },
      { matchNumber: 2, homeLabel: 'W-R32-1', awayLabel: 'W-R32-3' },
      { matchNumber: 3, homeLabel: 'W-R32-4', awayLabel: 'W-R32-6' },
      { matchNumber: 4, homeLabel: 'W-R32-7', awayLabel: 'W-R32-8' },
      { matchNumber: 5, homeLabel: 'W-R32-11', awayLabel: 'W-R32-12' },
      { matchNumber: 6, homeLabel: 'W-R32-9', awayLabel: 'W-R32-10' },
      { matchNumber: 7, homeLabel: 'W-R32-14', awayLabel: 'W-R32-16' },
      { matchNumber: 8, homeLabel: 'W-R32-13', awayLabel: 'W-R32-15' },
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

const EURO_TEMPLATE_DEF = {
  tournament: {
    name: 'UEFA Euro',
    nameEs: 'Eurocopa UEFA',
    modeKey: 'classic_argentinian_prode',
    modeName: 'Classic Argentinian Prode (Scaled)',
    modeNameEs: 'Prode Argentino Clasico Escalado',
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
    modeName: 'Classic Argentinian Prode (Scaled)',
    modeNameEs: 'Prode Argentino Clasico Escalado',
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
    modeName: 'Classic Argentinian Prode (Scaled)',
    modeNameEs: 'Prode Argentino Clasico Escalado',
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
    modeName: 'Classic Argentinian Prode (Scaled)',
    modeNameEs: 'Prode Argentino Clasico Escalado',
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
