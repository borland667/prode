const prisma = require('./db.cjs');

/**
 * FIFA World Cup 2026 seed data
 *
 * Teams and groups are aligned to FIFA's official April 2026 tournament data.
 * Knockout fixtures follow FIFA's official 2026 Round of 32 bracket, including
 * the best third-placed team slots used in the expanded 48-team format.
 */
const GROUPS = {
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

const KNOCKOUT_ROUND_NAMES = [
  'round_of_32',
  'round_of_16',
  'quarter_finals',
  'semi_finals',
  'final',
];

function buildLinearKnockoutRounds(roundNames, start = 2, step = 2) {
  return roundNames.map((name, index) => ({
    name,
    order: index + 1,
    pointsPerCorrect: start + index * step,
  }));
}

const ROUNDS = [
  { name: 'group_stage', order: 0, pointsPerCorrect: 0 },
  ...buildLinearKnockoutRounds(KNOCKOUT_ROUND_NAMES),
];

const ROUND_OF_32_MATCHES = [
  ['2A', '2B'],
  ['1E', '3[A/B/C/D/F]'],
  ['1F', '2C'],
  ['1C', '2F'],
  ['1I', '3[C/D/F/G/H]'],
  ['2E', '2I'],
  ['1A', '3[C/E/F/H/I]'],
  ['1L', '3[E/H/I/J/K]'],
  ['1D', '3[B/E/F/I/J]'],
  ['1G', '3[A/E/H/I/J]'],
  ['2K', '2L'],
  ['1H', '2J'],
  ['1B', '3[E/F/G/I/J]'],
  ['1J', '2H'],
  ['1K', '3[D/E/I/J/L]'],
  ['2D', '2G'],
];

const ROUND_OF_16_MATCHES = [
  ['W-R32-2', 'W-R32-5'],
  ['W-R32-1', 'W-R32-3'],
  ['W-R32-4', 'W-R32-6'],
  ['W-R32-7', 'W-R32-8'],
  ['W-R32-11', 'W-R32-12'],
  ['W-R32-9', 'W-R32-10'],
  ['W-R32-14', 'W-R32-16'],
  ['W-R32-13', 'W-R32-15'],
];

async function seed() {
  try {
    console.log('Seeding FIFA World Cup 2026...\n');

    const tournament = await prisma.tournament.create({
      data: {
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
    });
    console.log(`Tournament: ${tournament.name} (${tournament.id})`);

    // Create groups and teams
    for (const [groupName, teams] of Object.entries(GROUPS)) {
      const group = await prisma.group.create({
        data: { name: groupName, tournamentId: tournament.id },
      });

      for (const team of teams) {
        await prisma.team.create({
          data: {
            name: team.name,
            code: team.code,
            flagUrl: `https://flagcdn.com/w40/${team.flagCode || team.code.toLowerCase().slice(0, 2)}.png`,
            groupId: group.id,
            tournamentId: tournament.id,
          },
        });
      }
      console.log(`  Group ${groupName}: ${teams.map(t => t.code).join(', ')}`);
    }

    // Create rounds with knockout matches
    const roundMap = {};
    for (const round of ROUNDS) {
      const r = await prisma.round.create({
        data: {
          name: round.name,
          nameEs: round.name.replace('group_stage', 'fase_de_grupos')
            .replace('round_of_32', 'dieciseisavos_de_final')
            .replace('round_of_16', 'octavos_de_final')
            .replace('quarter_finals', 'cuartos_de_final')
            .replace('semi_finals', 'semifinales')
            .replace('final', 'final'),
          order: round.order,
          pointsPerCorrect: round.pointsPerCorrect,
          tournamentId: tournament.id,
        },
      });
      roundMap[round.name] = r.id;
      console.log(`  Round: ${round.name} (${round.pointsPerCorrect} pts/correct)`);
    }

    // Create knockout matches
    let matchNum = 1;
    for (const [home, away] of ROUND_OF_32_MATCHES) {
      await prisma.match.create({
        data: {
          roundId: roundMap['round_of_32'],
          matchNumber: matchNum++,
          homeLabel: home,
          awayLabel: away,
        },
      });
    }
    console.log(`  Created ${matchNum - 1} R32 matches`);

    matchNum = 1;
    for (const [home, away] of ROUND_OF_16_MATCHES) {
      await prisma.match.create({
        data: {
          roundId: roundMap['round_of_16'],
          matchNumber: matchNum++,
          homeLabel: home,
          awayLabel: away,
        },
      });
    }
    console.log('  Created 8 R16 matches');

    for (let i = 1; i <= 4; i++) {
      await prisma.match.create({
        data: {
          roundId: roundMap['quarter_finals'],
          matchNumber: i,
          homeLabel: `W-R16-${i * 2 - 1}`,
          awayLabel: `W-R16-${i * 2}`,
        },
      });
    }
    console.log('  Created 4 QF matches');

    // SF matches
    for (let i = 1; i <= 2; i++) {
      await prisma.match.create({
        data: {
          roundId: roundMap['semi_finals'],
          matchNumber: i,
          homeLabel: `W-QF-${i * 2 - 1}`,
          awayLabel: `W-QF-${i * 2}`,
        },
      });
    }
    console.log('  Created 2 SF matches');

    // Final
    await prisma.match.create({
      data: {
        roundId: roundMap['final'],
        matchNumber: 1,
        homeLabel: 'W-SF-1',
        awayLabel: 'W-SF-2',
      },
    });
    console.log('  Created Final match');

    console.log('\nSeed completed! Tournament ID:', tournament.id);
  } catch (error) {
    console.error('Seed failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
