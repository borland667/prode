// Importer for football-data.org v4 free tier.
//
// The free tier covers the FIFA World Cup competition (code "WC") and is
// rate-limited to ~10 requests per minute. A single import run makes one
// /standings request plus one /matches request per knockout stage, which
// is well under the limit.
//
// The module is intentionally pure: it accepts a prisma client and a
// fetcher so the caller (the Express endpoint at runtime, the test suite
// in CI) can wire it as needed. The importer writes group standings and
// knockout-match winners directly through prisma but does not recompute
// scores; the caller invokes the existing persistTournamentScores helper
// when the importer reports new writes.

const DEFAULT_BASE_URL = 'https://api.football-data.org/v4';

// Map football-data.org stage codes to our Round.name values.
// football-data.org has historically used a couple of different spellings
// for the third-place playoff, so all of them are recognised here.
const STAGE_TO_ROUND_NAME = new Map([
  ['GROUP_STAGE', 'group_stage'],
  ['LAST_32', 'round_of_32'],
  ['ROUND_OF_32', 'round_of_32'],
  ['LAST_16', 'round_of_16'],
  ['ROUND_OF_16', 'round_of_16'],
  ['QUARTER_FINALS', 'quarter_finals'],
  ['SEMI_FINALS', 'semi_finals'],
  ['THIRD_PLACE_PLAYOFF', 'third_place_match'],
  ['THIRD_PLACE_FINAL', 'third_place_match'],
  ['THIRD_PLACE', 'third_place_match'],
  ['FINAL', 'final'],
]);

const KNOCKOUT_STAGES = [
  'round_of_32',
  'round_of_16',
  'quarter_finals',
  'semi_finals',
  'third_place_match',
  'final',
];

function normalizeStage(stage) {
  if (!stage) {
    return null;
  }
  return STAGE_TO_ROUND_NAME.get(String(stage).toUpperCase()) || null;
}

// football-data.org groups arrive as "GROUP_A"; our Group.name is "A".
function groupLetterFromExternal(externalGroup) {
  if (!externalGroup) {
    return null;
  }
  const match = String(externalGroup).toUpperCase().match(/^GROUP_([A-Z])$/);
  return match ? match[1] : null;
}

function pairKey(homeTeamId, awayTeamId) {
  return [homeTeamId, awayTeamId].filter(Boolean).sort().join('|');
}

async function fetchJson(fetcher, url, apiKey) {
  const response = await fetcher(url, {
    headers: {
      'X-Auth-Token': apiKey,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const error = new Error(
      `football-data.org ${response.status} for ${url}: ${body.slice(0, 200)}`
    );
    error.status = response.status;
    throw error;
  }

  return response.json();
}

// Resolve a football-data.org team object to one of our Team rows by TLA
// first, then by name as a fallback. Returns null if neither matches.
function resolveExternalTeam(externalTeam, teamsByCode, teamsByName) {
  if (!externalTeam) {
    return null;
  }
  const tla = externalTeam.tla ? String(externalTeam.tla).toUpperCase() : null;
  if (tla && teamsByCode.has(tla)) {
    return teamsByCode.get(tla);
  }
  const name = externalTeam.name ? String(externalTeam.name).toLowerCase() : null;
  if (name && teamsByName.has(name)) {
    return teamsByName.get(name);
  }
  return null;
}

async function importFootballDataResults({
  tournamentId,
  prisma,
  apiKey,
  competitionCode = 'WC',
  baseUrl = DEFAULT_BASE_URL,
  fetcher = globalThis.fetch,
  logger = console,
}) {
  if (!tournamentId) {
    throw new Error('tournamentId is required');
  }
  if (!apiKey) {
    throw new Error('apiKey is required (set RESULTS_IMPORT_API_KEY)');
  }
  if (typeof fetcher !== 'function') {
    throw new Error('fetcher must be a function (globalThis.fetch is unavailable)');
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      teams: true,
      groups: true,
      rounds: { include: { matches: true } },
      groupResults: true,
    },
  });

  if (!tournament) {
    throw new Error(`Tournament ${tournamentId} not found`);
  }

  const teamsByCode = new Map(
    tournament.teams.filter((team) => team.code).map((team) => [team.code.toUpperCase(), team])
  );
  const teamsByName = new Map(
    tournament.teams
      .filter((team) => team.name)
      .map((team) => [team.name.toLowerCase(), team])
  );
  const groupsByLetter = new Map(
    tournament.groups
      .filter((group) => group.name)
      .map((group) => [group.name.toUpperCase(), group])
  );
  const existingGroupResultGroupIds = new Set(
    tournament.groupResults.map((result) => result.groupId)
  );
  const roundsByName = new Map(tournament.rounds.map((round) => [round.name, round]));

  // Build an index of knockout matches whose participants are already
  // resolved so we can match them to feed entries by team pair. Matches
  // whose selected team ids are still null cannot be matched yet and are
  // reported back as "unresolved".
  const knockoutMatchIndex = new Map();
  const unresolvedKnockoutMatches = [];
  for (const round of tournament.rounds) {
    if (!KNOCKOUT_STAGES.includes(round.name)) {
      continue;
    }
    for (const match of round.matches || []) {
      if (!match.selectedHomeTeamId || !match.selectedAwayTeamId) {
        unresolvedKnockoutMatches.push({ matchId: match.id, round: round.name });
        continue;
      }
      const key = `${round.name}::${pairKey(match.selectedHomeTeamId, match.selectedAwayTeamId)}`;
      knockoutMatchIndex.set(key, { match, round });
    }
  }

  const standingsUrl = `${baseUrl}/competitions/${competitionCode}/standings`;
  const matchesUrl = `${baseUrl}/competitions/${competitionCode}/matches?status=FINISHED`;

  logger.log(`[results-importer] Fetching standings: ${standingsUrl}`);
  const standingsPayload = await fetchJson(fetcher, standingsUrl, apiKey);

  const groupWrites = [];
  const groupSkipped = [];
  const groupUnresolved = [];

  for (const standing of standingsPayload.standings || []) {
    if (String(standing.stage || '').toUpperCase() !== 'GROUP_STAGE') {
      continue;
    }
    if (standing.type && String(standing.type).toUpperCase() !== 'TOTAL') {
      continue;
    }

    const letter = groupLetterFromExternal(standing.group);
    if (!letter) {
      continue;
    }
    const group = groupsByLetter.get(letter);
    if (!group) {
      groupUnresolved.push({ externalGroup: standing.group, reason: 'no matching group in DB' });
      continue;
    }
    if (existingGroupResultGroupIds.has(group.id)) {
      groupSkipped.push({ groupId: group.id, reason: 'group result already exists' });
      continue;
    }

    const sortedTable = [...(standing.table || [])].sort(
      (a, b) => Number(a.position) - Number(b.position)
    );
    const positions = [0, 1, 2].map((index) => {
      const entry = sortedTable[index];
      return entry ? resolveExternalTeam(entry.team, teamsByCode, teamsByName) : null;
    });

    if (!positions[0] || !positions[1]) {
      groupUnresolved.push({
        externalGroup: standing.group,
        reason: 'could not resolve first or second team in group',
      });
      continue;
    }

    groupWrites.push({
      groupId: group.id,
      first: positions[0].code,
      second: positions[1].code,
      third: positions[2] ? positions[2].code : null,
    });
  }

  logger.log(`[results-importer] Fetching finished matches: ${matchesUrl}`);
  const matchesPayload = await fetchJson(fetcher, matchesUrl, apiKey);

  const matchWrites = [];
  const matchSkipped = [];
  const matchUnmatched = [];

  for (const externalMatch of matchesPayload.matches || []) {
    if (String(externalMatch.status || '').toUpperCase() !== 'FINISHED') {
      continue;
    }
    const roundName = normalizeStage(externalMatch.stage);
    if (!roundName || !KNOCKOUT_STAGES.includes(roundName)) {
      continue;
    }
    if (!roundsByName.has(roundName)) {
      matchUnmatched.push({ stage: externalMatch.stage, reason: 'round not present in tournament' });
      continue;
    }

    const homeTeam = resolveExternalTeam(externalMatch.homeTeam, teamsByCode, teamsByName);
    const awayTeam = resolveExternalTeam(externalMatch.awayTeam, teamsByCode, teamsByName);
    if (!homeTeam || !awayTeam) {
      matchUnmatched.push({
        stage: externalMatch.stage,
        reason: 'could not resolve home or away team',
      });
      continue;
    }

    const key = `${roundName}::${pairKey(homeTeam.id, awayTeam.id)}`;
    const dbEntry = knockoutMatchIndex.get(key);
    if (!dbEntry) {
      matchUnmatched.push({
        stage: externalMatch.stage,
        homeTla: homeTeam.code,
        awayTla: awayTeam.code,
        reason: 'no DB match with this team pair (participants may not be resolved yet)',
      });
      continue;
    }

    if (dbEntry.match.status === 'finished') {
      matchSkipped.push({ matchId: dbEntry.match.id, reason: 'match already marked finished' });
      continue;
    }

    const externalWinner = String(externalMatch.score?.winner || '').toUpperCase();
    let winnerCode = null;
    if (externalWinner === 'HOME_TEAM') {
      winnerCode = homeTeam.code;
    } else if (externalWinner === 'AWAY_TEAM') {
      winnerCode = awayTeam.code;
    } else {
      // DRAW after extra time + penalties is reported as winner=null with
      // a penalties block populated. football-data.org sets winner via
      // shootout outcome on most finals, but if the field really is null
      // the match cannot have a winner from this feed alone.
      matchUnmatched.push({
        stage: externalMatch.stage,
        homeTla: homeTeam.code,
        awayTla: awayTeam.code,
        reason: 'feed did not report a winner (draw or unsupported)',
      });
      continue;
    }

    matchWrites.push({
      matchId: dbEntry.match.id,
      winner: winnerCode,
    });
  }

  if (groupWrites.length > 0 || matchWrites.length > 0) {
    await prisma.$transaction([
      ...groupWrites.map((write) =>
        prisma.groupResult.create({
          data: {
            tournamentId,
            groupId: write.groupId,
            first: write.first,
            second: write.second,
            third: write.third,
          },
        })
      ),
      ...matchWrites.map((write) =>
        prisma.match.update({
          where: { id: write.matchId },
          data: {
            winner: write.winner,
            status: 'finished',
          },
        })
      ),
    ]);
  }

  const totalWrites = groupWrites.length + matchWrites.length;
  logger.log(
    `[results-importer] Done. Group writes=${groupWrites.length}, group skipped=${groupSkipped.length}, group unresolved=${groupUnresolved.length}, match writes=${matchWrites.length}, match skipped=${matchSkipped.length}, match unmatched=${matchUnmatched.length}, unresolved knockout slots=${unresolvedKnockoutMatches.length}`
  );

  return {
    totalWrites,
    groupResults: {
      written: groupWrites.length,
      skipped: groupSkipped.length,
      unresolved: groupUnresolved.length,
    },
    matches: {
      written: matchWrites.length,
      skipped: matchSkipped.length,
      unmatched: matchUnmatched.length,
      unresolvedSlots: unresolvedKnockoutMatches.length,
    },
    details: {
      groupSkipped,
      groupUnresolved,
      matchSkipped,
      matchUnmatched,
      unresolvedKnockoutMatches,
    },
  };
}

module.exports = {
  importFootballDataResults,
  STAGE_TO_ROUND_NAME,
  KNOCKOUT_STAGES,
};
