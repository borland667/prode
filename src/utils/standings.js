// Group-stage standings derivation.
//
// `computeGroupStandings` walks the recorded group_stage matches and produces a
// FIFA-style table: played / won / drawn / lost / goalsFor / goalsAgainst /
// goalDiff / points, sorted by points desc, then goal diff desc, then goals
// for desc, then team name asc. It treats matches as "played" only when both
// homeScore and awayScore have been recorded (or status === 'finished'), so a
// freshly seeded tournament with no results yields all zeros.
//
// `computePredictedGroupStandings` projects a user's group prediction
// (first / second / third placement) onto the same team list. Predictions
// don't carry scores, so it only returns the ordered ranking; the stats
// columns are left for the UI to dash out.

const NUMERIC_ZERO = 0;

function emptyRow(team) {
  return {
    teamId: team.id,
    team,
    played: NUMERIC_ZERO,
    won: NUMERIC_ZERO,
    drawn: NUMERIC_ZERO,
    lost: NUMERIC_ZERO,
    goalsFor: NUMERIC_ZERO,
    goalsAgainst: NUMERIC_ZERO,
    goalDiff: NUMERIC_ZERO,
    points: NUMERIC_ZERO,
  };
}

function hasRecordedScore(match) {
  if (!match) {
    return false;
  }

  if (match.status === 'finished') {
    return Number.isFinite(Number(match.homeScore)) && Number.isFinite(Number(match.awayScore));
  }

  return (
    match.homeScore !== null &&
    match.homeScore !== undefined &&
    match.awayScore !== null &&
    match.awayScore !== undefined &&
    Number.isFinite(Number(match.homeScore)) &&
    Number.isFinite(Number(match.awayScore))
  );
}

function compareRows(left, right) {
  if (right.points !== left.points) {
    return right.points - left.points;
  }

  if (right.goalDiff !== left.goalDiff) {
    return right.goalDiff - left.goalDiff;
  }

  if (right.goalsFor !== left.goalsFor) {
    return right.goalsFor - left.goalsFor;
  }

  return String(left.team?.name || '').localeCompare(String(right.team?.name || ''));
}

export function computeGroupStandings(group, matches = []) {
  const teams = group?.teams || [];
  if (teams.length === 0) {
    return [];
  }

  const codes = new Set(teams.map((team) => team.code).filter(Boolean));
  const byCode = new Map(teams.filter((team) => team.code).map((team) => [team.code, team]));
  const rowsById = new Map(teams.map((team) => [team.id, emptyRow(team)]));

  for (const match of matches) {
    const homeCode = match?.homeLabel;
    const awayCode = match?.awayLabel;
    if (!homeCode || !awayCode) {
      continue;
    }
    if (!codes.has(homeCode) || !codes.has(awayCode)) {
      continue;
    }
    if (!hasRecordedScore(match)) {
      continue;
    }

    const home = byCode.get(homeCode);
    const away = byCode.get(awayCode);
    if (!home || !away) {
      continue;
    }

    const homeRow = rowsById.get(home.id);
    const awayRow = rowsById.get(away.id);
    if (!homeRow || !awayRow) {
      continue;
    }

    const homeScore = Number(match.homeScore);
    const awayScore = Number(match.awayScore);

    homeRow.played += 1;
    awayRow.played += 1;
    homeRow.goalsFor += homeScore;
    homeRow.goalsAgainst += awayScore;
    awayRow.goalsFor += awayScore;
    awayRow.goalsAgainst += homeScore;

    if (homeScore > awayScore) {
      homeRow.won += 1;
      awayRow.lost += 1;
      homeRow.points += 3;
    } else if (homeScore < awayScore) {
      awayRow.won += 1;
      homeRow.lost += 1;
      awayRow.points += 3;
    } else {
      homeRow.drawn += 1;
      awayRow.drawn += 1;
      homeRow.points += 1;
      awayRow.points += 1;
    }
  }

  for (const row of rowsById.values()) {
    row.goalDiff = row.goalsFor - row.goalsAgainst;
  }

  return Array.from(rowsById.values()).sort(compareRows);
}

export function computePredictedGroupStandings(group, prediction) {
  const teams = group?.teams || [];
  if (teams.length === 0) {
    return [];
  }

  const byId = new Map(teams.map((team) => [team.id, team]));
  const alphabetical = teams
    .slice()
    .sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')));

  if (!prediction) {
    return alphabetical.map((team) => ({ teamId: team.id, team, predictedRank: null }));
  }

  const ranked = [];
  const seen = new Set();
  for (const key of ['first', 'second', 'third']) {
    const candidateId = prediction[key];
    if (!candidateId || seen.has(candidateId)) {
      continue;
    }
    const team = byId.get(candidateId);
    if (!team) {
      continue;
    }
    ranked.push({ teamId: team.id, team, predictedRank: ranked.length + 1 });
    seen.add(candidateId);
  }

  const remaining = alphabetical
    .filter((team) => !seen.has(team.id))
    .map((team, index) => ({
      teamId: team.id,
      team,
      predictedRank: ranked.length + index + 1,
    }));

  return [...ranked, ...remaining];
}
