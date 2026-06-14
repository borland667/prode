// Pure, side-effect-free helpers that decide which predictions are still
// editable at a given moment in time. Used both server-side (to filter the
// payload of a prediction save) and in serializers (so the API can tell the
// frontend which matches and groups should render as read-only).
//
// Locking is strictly per-match. A match locks once its kickoff has passed;
// a group locks once any of its group-stage matches has locked.

function toDate(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isMatchPredictionLocked(match, now) {
  const kickoff = toDate(match?.matchDate);
  if (!kickoff) {
    return false;
  }
  const moment = toDate(now) || new Date();
  return kickoff.getTime() <= moment.getTime();
}

function getGroupStageMatches(rounds) {
  for (const round of rounds || []) {
    if (round?.name === 'group_stage') {
      return round.matches || [];
    }
  }
  return [];
}

function buildGroupCodeIndex(groups) {
  const codeToGroupId = new Map();
  for (const group of groups || []) {
    for (const team of group?.teams || []) {
      if (team?.code) {
        codeToGroupId.set(team.code, group.id);
      }
    }
  }
  return codeToGroupId;
}

// A group's prediction (1st/2nd/3rd) is locked as soon as any group-stage
// match between two of its teams has kicked off. Once any match has been
// played you have new information, so re-ranking would let you cheat.
function isGroupPredictionLocked({ groupId, groupStageMatches, codeToGroupId, now }) {
  const moment = toDate(now) || new Date();
  for (const match of groupStageMatches || []) {
    const homeGroupId = match?.homeLabel ? codeToGroupId.get(match.homeLabel) : null;
    const awayGroupId = match?.awayLabel ? codeToGroupId.get(match.awayLabel) : null;
    if (homeGroupId !== groupId && awayGroupId !== groupId) {
      continue;
    }
    const kickoff = toDate(match?.matchDate);
    if (kickoff && kickoff.getTime() <= moment.getTime()) {
      return true;
    }
  }
  return false;
}

function buildLockState({ rounds, groups, now } = {}) {
  const moment = toDate(now) || new Date();
  const groupStageMatches = getGroupStageMatches(rounds);
  const codeToGroupId = buildGroupCodeIndex(groups);

  const lockedMatchIds = new Set();
  for (const round of rounds || []) {
    for (const match of round?.matches || []) {
      if (isMatchPredictionLocked(match, moment)) {
        lockedMatchIds.add(match.id);
      }
    }
  }

  const lockedGroupIds = new Set();
  for (const group of groups || []) {
    if (
      isGroupPredictionLocked({
        groupId: group.id,
        groupStageMatches,
        codeToGroupId,
        now: moment,
      })
    ) {
      lockedGroupIds.add(group.id);
    }
  }

  return { lockedMatchIds, lockedGroupIds, now: moment };
}

module.exports = {
  buildLockState,
  isMatchPredictionLocked,
  isGroupPredictionLocked,
  getGroupStageMatches,
  buildGroupCodeIndex,
};
