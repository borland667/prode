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
