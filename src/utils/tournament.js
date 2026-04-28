const ROUND_LABEL_KEYS = {
  group_stage: 'predict.stepGroupStage',
  round_of_32: 'predict.stepRound32',
  round_of_16: 'predict.stepRound16',
  quarter_finals: 'predict.stepQuarterfinals',
  semi_finals: 'predict.stepSemifinals',
  final: 'predict.stepFinal',
};

const ROUND_CODE_MAP = {
  group_stage: 'GS',
  round_of_32: 'R32',
  round_of_16: 'R16',
  quarter_finals: 'QF',
  semi_finals: 'SF',
  final: 'FINAL',
};

const GROUP_SLOT_PATTERN = /^([123])\s*([A-Za-z0-9]+)$/;
const BEST_THIRD_SLOT_PATTERN = /^3\[(.+)\]$/i;
const WINNER_SLOT_PATTERN = /^W-([A-Za-z0-9]+)-(\d+)$/i;

function titleize(value = '') {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getRoundCode(roundName) {
  if (ROUND_CODE_MAP[roundName]) {
    return ROUND_CODE_MAP[roundName];
  }

  const roundMatch = roundName?.match(/^round_of_(\d+)$/);
  if (roundMatch) {
    return `R${roundMatch[1]}`;
  }

  return roundName
    ?.split('_')
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '';
}

export function getRoundLabel(round, t) {
  const translationKey = ROUND_LABEL_KEYS[round.name];
  if (translationKey) {
    return t(translationKey);
  }

  return round.label || round.nameEs || titleize(round.name);
}

export function getModeLabel(mode, language = 'en') {
  if (!mode) {
    return '';
  }

  if (language === 'es' && mode.nameEs) {
    return mode.nameEs;
  }

  return mode.name || mode.nameEs || '';
}

export function getLocalizedName(entity, language = 'en', fallback = '') {
  if (!entity) {
    return fallback;
  }

  if (language === 'es' && entity.nameEs) {
    return entity.nameEs;
  }

  return entity.name || entity.nameEs || fallback;
}

const FOOTBALL_AUDIENCE_LABEL = {
  en: 'soccer',
  es: 'futbol',
  pt: 'futebol',
  it: 'calcio',
  nl: 'voetbal',
};

export function getSportLabel(sport, language = 'en') {
  const normalizedSport = String(sport || '').trim().toLowerCase();

  if (!normalizedSport) {
    return FOOTBALL_AUDIENCE_LABEL[language] || FOOTBALL_AUDIENCE_LABEL.en;
  }

  if (normalizedSport === 'football') {
    return FOOTBALL_AUDIENCE_LABEL[language] || FOOTBALL_AUDIENCE_LABEL.en;
  }

  return titleize(normalizedSport);
}

export function getModeRuleSections({ mode, rules, language = 'en', t }) {
  const modeKey = mode?.key || 'classic_argentinian_prode';
  const knockoutRounds = rules?.knockout || [];

  switch (modeKey) {
    case 'classic_argentinian_prode':
    default:
      return {
        summary: {
          title: t('home.scoringMode'),
          value: getModeLabel(mode, language),
          note: rules?.totalMaximumPoints
            ? `${t('home.maximumScore')}: ${rules.totalMaximumPoints}`
            : '',
        },
        primary: {
          id: 'group-stage',
          title: t('home.groupStage'),
          lines: [
            t('home.groupStageRuleExact'),
            t('home.groupStageRuleInverted'),
            t('home.groupStageRuleOneRight'),
            t('home.groupStageRuleOneWrong'),
          ],
          footer: rules?.groupStageSummary
            ? `${t('home.maxPoints')} ${rules.groupStageSummary.maxPoints}`
            : '',
        },
        secondary: knockoutRounds.map((round) => ({
          id: round.round,
          title: getRoundLabel(round, t),
          lines: [
            `${round.pointsPerCorrect} ${t('home.pointsPerCorrect')}`,
            `${round.maxMatches} ${t('home.matchesForRound')}`,
          ],
          footer: `${t('home.maxPoints')} ${round.maxPoints}`,
        })),
      };
  }
}

export function sortGroups(groups = []) {
  return [...groups].sort((a, b) => a.name.localeCompare(b.name));
}

export function sortRounds(rounds = []) {
  return [...rounds].sort((a, b) => a.order - b.order);
}

export function getKnockoutRounds(rounds = []) {
  return sortRounds(rounds).filter((round) => round.matches?.length);
}

export function buildTeamMap(groups = []) {
  return groups.reduce((acc, group) => {
    for (const team of group.teams || []) {
      acc[team.id] = team;
    }
    return acc;
  }, {});
}

export function countGroupStageMatches(groups = []) {
  return groups.reduce((total, group) => {
    const teamCount = group?.teams?.length || 0;
    if (teamCount < 2) {
      return total;
    }

    return total + ((teamCount * (teamCount - 1)) / 2);
  }, 0);
}

export function countTournamentMatches({ groups = [], rounds = [] } = {}) {
  const groupStageMatches = countGroupStageMatches(groups);
  const knockoutMatches = rounds.reduce(
    (total, round) => total + (round?.matches?.length || 0),
    0
  );

  return groupStageMatches + knockoutMatches;
}

export function formatClosingCountdown(value, { formatNumber, t, now = new Date() } = {}) {
  if (!value || typeof formatNumber !== 'function' || typeof t !== 'function') {
    return '';
  }

  const closingDate = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(closingDate.getTime())) {
    return '';
  }

  const delta = closingDate.getTime() - now.getTime();
  if (delta <= 0) {
    return t('tournament.closedNow');
  }

  const totalMinutes = Math.max(0, Math.floor(delta / (1000 * 60)));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const formatPart = (amount, singularKey, pluralKey) => {
    const unit = amount === 1 ? t(singularKey) : t(pluralKey);
    return `${formatNumber(amount)} ${unit}`;
  };

  const parts = [];

  if (days > 0) {
    parts.push(formatPart(days, 'common.day', 'common.days'));
  }

  if (days > 0 || hours > 0) {
    parts.push(formatPart(hours, 'common.hour', 'common.hours'));
  }

  parts.push(formatPart(minutes, 'common.minute', 'common.minutes'));

  return parts.join(', ');
}

function shuffleArray(items = [], random = Math.random) {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function pickRandomItem(items = [], random = Math.random) {
  if (!items.length) {
    return null;
  }

  const index = Math.floor(random() * items.length);
  return items[index] || null;
}

export function getEligibleBestThirdGroups(label = '') {
  const match = label.trim().match(BEST_THIRD_SLOT_PATTERN);
  if (!match) {
    return [];
  }

  return match[1]
    .split('/')
    .map((groupCode) => groupCode.trim().toUpperCase())
    .filter(Boolean);
}

function getEligibleBestThirdTeamIds(label = '', groups = [], groupSelections = {}) {
  return getEligibleBestThirdGroups(label)
    .map((groupCode) => findGroupByCode(groups, groupCode))
    .map((group) => (group ? groupSelections[group.id]?.third : ''))
    .filter(Boolean);
}

export function hasBestThirdPlaceSlots(rounds = []) {
  return rounds.some((round) =>
    (round.matches || []).some((match) =>
      BEST_THIRD_SLOT_PATTERN.test(match.homeLabel || '') || BEST_THIRD_SLOT_PATTERN.test(match.awayLabel || '')
    )
  );
}

export function getGroupPlacements(groupSelections = {}, groupId) {
  return groupSelections[groupId] || {};
}

function getGroupCode(groupName = '') {
  const match = groupName.match(/([A-Za-z0-9]+)$/);
  return match ? match[1].toUpperCase() : groupName.toUpperCase();
}

function findGroupByCode(groups = [], code = '') {
  return groups.find((group) => getGroupCode(group.name) === code.toUpperCase());
}

function findMatchByRoundCode(rounds = [], roundCode, matchNumber) {
  return rounds
    .flatMap((round) =>
      (round.matches || []).map((match) => ({
        ...match,
        roundName: round.name,
        roundCode: round.code || getRoundCode(round.name),
      }))
    )
    .find(
      (match) =>
        match.roundCode.toUpperCase() === roundCode.toUpperCase() &&
        Number(match.matchNumber) === Number(matchNumber)
    );
}

export function resolveSlot({
  label,
  groups = [],
  rounds = [],
  groupSelections = {},
  knockoutSelections = {},
  slotSelections = {},
  teamMap = {},
}) {
  if (!label) {
    return { teamId: null, teamName: '', slotLabel: '' };
  }

  const trimmedLabel = label.trim();
  const groupSlot = trimmedLabel.match(GROUP_SLOT_PATTERN);
  if (groupSlot) {
    const position = groupSlot[1] === '1' ? 'first' : groupSlot[1] === '2' ? 'second' : 'third';
    const group = findGroupByCode(groups, groupSlot[2]);
    const selectedTeamId = group ? groupSelections[group.id]?.[position] : null;
    const selectedTeam = selectedTeamId ? teamMap[selectedTeamId] : null;

    return {
      teamId: selectedTeamId || null,
      teamName: selectedTeam?.name || '',
      slotLabel: `${groupSlot[1]}${groupSlot[2].toUpperCase()}`,
    };
  }

  const bestThirdSlot = trimmedLabel.match(BEST_THIRD_SLOT_PATTERN);
  if (bestThirdSlot) {
    const eligibleGroups = getEligibleBestThirdGroups(trimmedLabel);
    const selectedTeamId = slotSelections[trimmedLabel] || null;
    const selectedTeam = selectedTeamId ? teamMap[selectedTeamId] : null;

    return {
      teamId: selectedTeamId,
      teamName: selectedTeam?.name || '',
      slotLabel: `Best 3rd from ${eligibleGroups.join('/')}`,
      eligibleGroups,
      isBestThirdSlot: true,
    };
  }

  const winnerSlot = trimmedLabel.match(WINNER_SLOT_PATTERN);
  if (winnerSlot) {
    const sourceMatch = findMatchByRoundCode(rounds, winnerSlot[1], winnerSlot[2]);
    const selectedTeamId = sourceMatch ? knockoutSelections[sourceMatch.id] : null;
    const selectedTeam = selectedTeamId ? teamMap[selectedTeamId] : null;
    const sourceCode = sourceMatch?.code || `${winnerSlot[1].toUpperCase()}-${winnerSlot[2]}`;

    return {
      teamId: selectedTeamId || null,
      teamName: selectedTeam?.name || '',
      slotLabel: `Winner of ${sourceCode}`,
    };
  }

  return {
    teamId: null,
    teamName: '',
    slotLabel: trimmedLabel,
  };
}

export function resolveMatchParticipants({
  match,
  groups = [],
  rounds = [],
  groupSelections = {},
  knockoutSelections = {},
  slotSelections = {},
  teamMap = {},
}) {
  const home = resolveSlot({
    label: match.homeLabel,
    groups,
    rounds,
    groupSelections,
    knockoutSelections,
    slotSelections,
    teamMap,
  });

  const away = resolveSlot({
    label: match.awayLabel,
    groups,
    rounds,
    groupSelections,
    knockoutSelections,
    slotSelections,
    teamMap,
  });

  return {
    home,
    away,
  };
}

export function sanitizeKnockoutPredictionMap({
  groups = [],
  rounds = [],
  groupSelections = {},
  knockoutPredictions = {},
  teamMap = buildTeamMap(groups),
} = {}) {
  const sanitized = {};
  const knockoutSelections = {};
  const usedBestThirdTeams = new Set();

  for (const round of getKnockoutRounds(rounds)) {
    for (const match of round.matches || []) {
      const current = knockoutPredictions[match.id] || {};
      const nextPrediction = {};

      if (BEST_THIRD_SLOT_PATTERN.test(match.homeLabel || '')) {
        const eligibleHomeTeamIds = getEligibleBestThirdTeamIds(match.homeLabel, groups, groupSelections);
        const isValidHomeSelection =
          eligibleHomeTeamIds.includes(current.selectedHomeTeamId) &&
          !usedBestThirdTeams.has(current.selectedHomeTeamId) &&
          current.selectedHomeTeamId !== current.selectedAwayTeamId;

        nextPrediction.selectedHomeTeamId = isValidHomeSelection ? current.selectedHomeTeamId : '';

        if (nextPrediction.selectedHomeTeamId) {
          usedBestThirdTeams.add(nextPrediction.selectedHomeTeamId);
        }
      }

      if (BEST_THIRD_SLOT_PATTERN.test(match.awayLabel || '')) {
        const eligibleAwayTeamIds = getEligibleBestThirdTeamIds(match.awayLabel, groups, groupSelections);
        const isValidAwaySelection =
          eligibleAwayTeamIds.includes(current.selectedAwayTeamId) &&
          !usedBestThirdTeams.has(current.selectedAwayTeamId) &&
          current.selectedAwayTeamId !== nextPrediction.selectedHomeTeamId;

        nextPrediction.selectedAwayTeamId = isValidAwaySelection ? current.selectedAwayTeamId : '';

        if (nextPrediction.selectedAwayTeamId) {
          usedBestThirdTeams.add(nextPrediction.selectedAwayTeamId);
        }
      }

      const matchup = resolveMatchParticipants({
        match,
        groups,
        rounds,
        groupSelections,
        knockoutSelections,
        slotSelections: {
          [match.homeLabel]: nextPrediction.selectedHomeTeamId || '',
          [match.awayLabel]: nextPrediction.selectedAwayTeamId || '',
        },
        teamMap,
      });

      const isValidWinner =
        current.predictedWinner &&
        (current.predictedWinner === matchup.home.teamId || current.predictedWinner === matchup.away.teamId);

      nextPrediction.predictedWinner = isValidWinner ? current.predictedWinner : '';
      sanitized[match.id] = nextPrediction;

      if (nextPrediction.predictedWinner) {
        knockoutSelections[match.id] = nextPrediction.predictedWinner;
      }
    }
  }

  return sanitized;
}

export function buildRandomPredictionSet({
  groups = [],
  rounds = [],
  teamMap = buildTeamMap(groups),
  random = Math.random,
} = {}) {
  const groupSelections = {};
  let knockoutPredictions = {};
  const requiresThirdPlaceSelections = hasBestThirdPlaceSlots(rounds);

  for (const group of sortGroups(groups)) {
    const shuffledTeamIds = shuffleArray(
      (group.teams || []).map((team) => team.id).filter(Boolean),
      random
    );

    groupSelections[group.id] = {
      first: shuffledTeamIds[0] || '',
      second: shuffledTeamIds[1] || '',
      ...(requiresThirdPlaceSelections ? { third: shuffledTeamIds[2] || '' } : {}),
    };
  }

  for (const round of getKnockoutRounds(rounds)) {
    for (const match of round.matches || []) {
      const prediction = { ...knockoutPredictions[match.id] };

      if (BEST_THIRD_SLOT_PATTERN.test(match.homeLabel || '')) {
        const usedThirdPlaceTeams = new Set(
          Object.values(knockoutPredictions)
            .flatMap((entry) => [entry.selectedHomeTeamId, entry.selectedAwayTeamId])
            .filter(Boolean)
        );
        const options = getEligibleBestThirdTeamIds(match.homeLabel, groups, groupSelections)
          .filter((teamId) => !usedThirdPlaceTeams.has(teamId));

        prediction.selectedHomeTeamId = pickRandomItem(options, random) || '';
      }

      if (BEST_THIRD_SLOT_PATTERN.test(match.awayLabel || '')) {
        const usedThirdPlaceTeams = new Set(
          Object.values(knockoutPredictions)
            .flatMap((entry) => [entry.selectedHomeTeamId, entry.selectedAwayTeamId])
            .filter(Boolean)
        );
        if (prediction.selectedHomeTeamId) {
          usedThirdPlaceTeams.add(prediction.selectedHomeTeamId);
        }

        const options = getEligibleBestThirdTeamIds(match.awayLabel, groups, groupSelections)
          .filter((teamId) => !usedThirdPlaceTeams.has(teamId));

        prediction.selectedAwayTeamId = pickRandomItem(options, random) || '';
      }

      knockoutPredictions = sanitizeKnockoutPredictionMap({
        groups,
        rounds,
        groupSelections,
        knockoutPredictions: {
          ...knockoutPredictions,
          [match.id]: prediction,
        },
        teamMap,
      });

      const sanitizedPrediction = knockoutPredictions[match.id] || {};
      const matchup = resolveMatchParticipants({
        match,
        groups,
        rounds,
        groupSelections,
        knockoutSelections: Object.fromEntries(
          Object.entries(knockoutPredictions).map(([matchId, entry]) => [matchId, entry.predictedWinner || ''])
        ),
        slotSelections: {
          [match.homeLabel]: sanitizedPrediction.selectedHomeTeamId || '',
          [match.awayLabel]: sanitizedPrediction.selectedAwayTeamId || '',
        },
        teamMap,
      });

      const candidates = [matchup.home.teamId, matchup.away.teamId].filter(Boolean);
      knockoutPredictions = sanitizeKnockoutPredictionMap({
        groups,
        rounds,
        groupSelections,
        knockoutPredictions: {
          ...knockoutPredictions,
          [match.id]: {
            ...sanitizedPrediction,
            predictedWinner: pickRandomItem(candidates, random) || '',
          },
        },
        teamMap,
      });
    }
  }

  return {
    groupPredictions: groupSelections,
    knockoutPredictions: sanitizeKnockoutPredictionMap({
      groups,
      rounds,
      groupSelections,
      knockoutPredictions,
      teamMap,
    }),
  };
}
