require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const prisma = require('./db.cjs');
const { calculateTotalScore } = require('./scoring.cjs');
const { hasEmailTransportConfig, sendPasswordResetEmail } = require('./email.cjs');
const {
  getModeNameEs,
  getRoundNameEs,
  getTeamNameEs,
  getTournamentNameEs,
} = require('./translations.cjs');

const DEFAULT_GROUP_STAGE_RULES = {
  exactOrder: 4,
  invertedOrder: 3,
  oneCorrectRightPosition: 2,
  oneCorrectWrongPosition: 1,
};

const ROUND_LABELS = {
  group_stage: 'Group Stage',
  round_of_32: 'Round of 32',
  round_of_16: 'Round of 16',
  quarter_finals: 'Quarter Finals',
  semi_finals: 'Semi Finals',
  final: 'Final',
};

const ROUND_CODES = {
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
const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_RESET_TOKEN_TTL_MS = 1000 * 60 * 60;
const TOURNAMENT_SCOPE_KEY = 'tournament';
const GOOGLE_AUTH_CONFIGURED = Boolean(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CALLBACK_URL
);

const app = express();

app.use(
  cors({
    origin: process.env.SITE_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (GOOGLE_AUTH_CONFIGURED) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await prisma.user.findUnique({
            where: { googleId: profile.id },
          });

          if (!user) {
            const email = profile.emails?.[0]?.value;

            if (email) {
              user = await prisma.user.findUnique({ where: { email } });
            }

            if (user) {
              user = await prisma.user.update({
                where: { id: user.id },
                data: {
                  googleId: profile.id,
                  name: user.name || profile.displayName,
                },
              });
            } else {
              user = await prisma.user.create({
                data: {
                  googleId: profile.id,
                  email: email || `google_${profile.id}@prode.local`,
                  name: profile.displayName,
                  role: 'USER',
                },
              });
            }
          }

          done(null, user);
        } catch (error) {
          done(error, null);
        }
      }
    )
  );
}

app.use(passport.initialize());

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  };
}

function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function serializeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isAdmin: user.role === 'ADMIN',
    avatarUrl: user.avatarUrl || null,
    showInGlobalRankings: user.showInGlobalRankings !== false,
  };
}

async function loadAuthenticatedUser(token) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

  if (!user) {
    const error = new Error('User not found');
    error.status = 401;
    throw error;
  }

  return user;
}

async function optionalAuth(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const user = await loadAuthenticatedUser(token);
    req.user = serializeUser(user);
  } catch (error) {
    req.user = null;
  }

  next();
}

async function verifyToken(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const user = await loadAuthenticatedUser(token);
    req.user = serializeUser(user);
    next();
  } catch (error) {
    res.status(error.status || 401).json({ error: 'Invalid token' });
  }
}

function checkAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

function titleize(value) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getRoundLabel(round) {
  return ROUND_LABELS[round.name] || titleize(round.name) || round.nameEs;
}

function getRoundCode(roundName) {
  if (ROUND_CODES[roundName]) {
    return ROUND_CODES[roundName];
  }

  const roundMatch = roundName.match(/^round_of_(\d+)$/);
  if (roundMatch) {
    return `R${roundMatch[1]}`;
  }

  return roundName
    .split('_')
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function sortGroups(groups = []) {
  return [...groups].sort((a, b) => a.name.localeCompare(b.name));
}

function sortRounds(rounds = []) {
  return [...rounds].sort((a, b) => a.order - b.order);
}

function sortMatches(matches = []) {
  return [...matches].sort((a, b) => a.matchNumber - b.matchNumber);
}

function normalizeAccessType(accessType) {
  return accessType === 'private' ? 'private' : 'public';
}

function isValidAccessType(accessType) {
  return accessType === 'public' || accessType === 'private';
}

function normalizeTournamentStatus(status) {
  switch (String(status || '').trim().toLowerCase()) {
    case 'active':
    case 'closed':
    case 'finished':
    case 'upcoming':
      return String(status).trim().toLowerCase();
    default:
      return 'upcoming';
  }
}

function getTournamentLifecycle(tournament) {
  const status = normalizeTournamentStatus(tournament.status);
  const closingDate = tournament.closingDate ? new Date(tournament.closingDate) : null;
  const hasClosedByDate = Boolean(closingDate) && closingDate.getTime() <= Date.now();
  const predictionsLocked =
    status === 'closed' || status === 'finished' || hasClosedByDate;

  let lockedReason = null;
  if (status === 'finished') {
    lockedReason = 'finished';
  } else if (status === 'closed') {
    lockedReason = 'closed';
  } else if (hasClosedByDate) {
    lockedReason = 'closing_date_passed';
  }

  return {
    status: predictionsLocked && status !== 'finished' ? 'closed' : status,
    predictionsOpen: !predictionsLocked,
    predictionsLocked,
    lockedReason,
  };
}

function normalizeJoinCode(joinCode) {
  if (!joinCode) {
    return '';
  }

  return String(joinCode).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function generateUniqueJoinCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const existingTournament = await prisma.tournament.findUnique({
      where: { joinCode: code },
      select: { id: true },
    });

    if (!existingTournament) {
      return code;
    }
  }

  throw new Error('Failed to generate a unique join code');
}

async function generateUniqueLeagueJoinCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const existingLeague = await prisma.tournamentLeague.findUnique({
      where: { joinCode: code },
      select: { id: true },
    });

    if (!existingLeague) {
      return code;
    }
  }

  throw new Error('Failed to generate a unique league join code');
}

function serializeMode(tournament) {
  return {
    key: tournament.modeKey || 'classic_argentinian_prode',
    name: tournament.modeName || 'Classic Argentinian Prode (Scaled)',
    nameEs: tournament.modeNameEs || 'Prode Argentino Clasico Escalado',
  };
}

function serializeGroups(groups, groupResults = []) {
  const resultsByGroupId = new Map(groupResults.map((result) => [result.groupId, result]));

  return sortGroups(groups).map((group) => ({
    id: group.id,
    name: group.name,
    teams: [...(group.teams || [])].sort((a, b) => a.name.localeCompare(b.name)),
    result: resultsByGroupId.get(group.id) || null,
  }));
}

function serializeRounds(rounds) {
  return sortRounds(rounds).map((round) => ({
    id: round.id,
    name: round.name,
    nameEs: round.nameEs,
    label: getRoundLabel(round),
    code: getRoundCode(round.name),
    order: round.order,
    pointsPerCorrect: round.pointsPerCorrect,
    matches: sortMatches(round.matches).map((match) => ({
      id: match.id,
      matchNumber: match.matchNumber,
      code: `${getRoundCode(round.name)}-${match.matchNumber}`,
      homeLabel: match.homeLabel,
      awayLabel: match.awayLabel,
      selectedHomeTeamId: match.selectedHomeTeamId || null,
      selectedAwayTeamId: match.selectedAwayTeamId || null,
      winner: match.winner,
      status: match.status,
      matchDate: match.matchDate,
    })),
  }));
}

function buildRules(tournament, rounds) {
  const groupCount = tournament.groups?.length || 0;
  const knockoutRounds = sortRounds(rounds)
    .filter((round) => round.matches?.length)
    .map((round) => {
      const maxMatches = round.matches?.length || 0;
      const maxPoints = maxMatches * round.pointsPerCorrect;

      return {
        round: round.name,
        label: getRoundLabel(round),
        code: getRoundCode(round.name),
        pointsPerCorrect: round.pointsPerCorrect,
        maxMatches,
        maxPoints,
      };
    });

  const groupStageMaxPoints = groupCount * DEFAULT_GROUP_STAGE_RULES.exactOrder;
  const totalMaximumPoints = groupStageMaxPoints + knockoutRounds.reduce(
    (total, round) => total + round.maxPoints,
    0
  );

  return {
    type: 'prode',
    mode: serializeMode(tournament),
    groupStage: DEFAULT_GROUP_STAGE_RULES,
    scaling: {
      type: 'linear',
      step: 2,
    },
    groupStageSummary: {
      groups: groupCount,
      maxPerGroup: DEFAULT_GROUP_STAGE_RULES.exactOrder,
      maxPoints: groupStageMaxPoints,
    },
    knockout: knockoutRounds,
    totalMaximumPoints,
  };
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseOptionalDate(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createHttpError(400, `${fieldName} must be a valid date`);
  }

  return date;
}

function normalizeTournamentStructurePayload(body = {}) {
  const name = String(body.name || '').trim();
  if (!name) {
    throw createHttpError(400, 'Tournament name is required');
  }

  const entryFee = Number(body.entryFee ?? 0);
  if (Number.isNaN(entryFee) || entryFee < 0) {
    throw createHttpError(400, 'Entry fee must be a non-negative number');
  }

  const currency = String(body.currency || 'USD').trim().toUpperCase();
  if (!currency) {
    throw createHttpError(400, 'Currency is required');
  }

  const accessType = normalizeAccessType(body.accessType);
  const joinCode = normalizeJoinCode(body.joinCode);
  if (accessType === 'private' && joinCode && joinCode.length < 4) {
    throw createHttpError(400, 'Join code must be at least 4 characters');
  }

  const groups = Array.isArray(body.groups) ? body.groups : [];
  if (!groups.length) {
    throw createHttpError(400, 'At least one group is required');
  }

  const normalizedGroups = groups.map((group, index) => {
    const groupName = String(group?.name || '').trim();
    if (!groupName) {
      throw createHttpError(400, `Group ${index + 1} must have a name`);
    }

    const teams = Array.isArray(group?.teams) ? group.teams : [];
    if (!teams.length) {
      throw createHttpError(400, `Group ${groupName} must include at least one team`);
    }

    const normalizedTeams = teams.map((team, teamIndex) => {
      const teamName = String(team?.name || '').trim();
      if (!teamName) {
        throw createHttpError(400, `Team ${teamIndex + 1} in group ${groupName} must have a name`);
      }

      const teamCode = String(team?.code || '').trim().toUpperCase() || null;

      return {
        name: teamName,
        nameEs: getTeamNameEs({
          name: teamName,
          nameEs: team?.nameEs,
          code: teamCode,
        }),
        code: teamCode,
        flagUrl: String(team?.flagUrl || '').trim() || null,
      };
    });

    const teamNames = normalizedTeams.map((team) => team.name.toLowerCase());
    if (new Set(teamNames).size !== teamNames.length) {
      throw createHttpError(400, `Group ${groupName} contains duplicate team names`);
    }

    return {
      name: groupName,
      teams: normalizedTeams,
    };
  });

  const groupNames = normalizedGroups.map((group) => group.name.toLowerCase());
  if (new Set(groupNames).size !== groupNames.length) {
    throw createHttpError(400, 'Group names must be unique');
  }

  const rounds = Array.isArray(body.rounds) ? body.rounds : [];
  if (!rounds.length) {
    throw createHttpError(400, 'At least one knockout round is required');
  }

  const normalizedRounds = rounds.map((round, index) => {
    const roundName = String(round?.name || '').trim();
    if (!roundName) {
      throw createHttpError(400, `Round ${index + 1} must have a name`);
    }

    const order = Number(round?.order ?? index + 1);
    if (!Number.isInteger(order) || order < 1) {
      throw createHttpError(400, `Round ${roundName} must have a positive integer order`);
    }

    const pointsPerCorrect = Number(round?.pointsPerCorrect ?? 0);
    if (!Number.isInteger(pointsPerCorrect) || pointsPerCorrect < 0) {
      throw createHttpError(400, `Round ${roundName} must have a non-negative integer points value`);
    }

    const matches = Array.isArray(round?.matches) ? round.matches : [];
    if (!matches.length) {
      throw createHttpError(400, `Round ${roundName} must include at least one match`);
    }

    const normalizedMatches = matches.map((match, matchIndex) => {
      const matchNumber = Number(match?.matchNumber ?? matchIndex + 1);
      if (!Number.isInteger(matchNumber) || matchNumber < 1) {
        throw createHttpError(400, `Round ${roundName} has an invalid match number`);
      }

      const homeLabel = String(match?.homeLabel || '').trim();
      const awayLabel = String(match?.awayLabel || '').trim();
      if (!homeLabel || !awayLabel) {
        throw createHttpError(400, `Round ${roundName} match ${matchNumber} must include home and away labels`);
      }

      return {
        matchNumber,
        homeLabel,
        awayLabel,
        matchDate: parseOptionalDate(match?.matchDate, `Round ${roundName} match ${matchNumber} date`),
      };
    });

    const matchNumbers = normalizedMatches.map((match) => match.matchNumber);
    if (new Set(matchNumbers).size !== matchNumbers.length) {
      throw createHttpError(400, `Round ${roundName} contains duplicate match numbers`);
    }

    return {
      name: roundName,
      nameEs: getRoundNameEs({
        name: roundName,
        nameEs: round?.nameEs,
      }),
      order,
      pointsPerCorrect,
      matches: normalizedMatches,
    };
  });

  const roundNames = normalizedRounds.map((round) => round.name.toLowerCase());
  if (new Set(roundNames).size !== roundNames.length) {
    throw createHttpError(400, 'Round names must be unique');
  }

  const roundOrders = normalizedRounds.map((round) => round.order);
  if (new Set(roundOrders).size !== roundOrders.length) {
    throw createHttpError(400, 'Round order values must be unique');
  }

  const modeKey = String(body.modeKey || 'classic_argentinian_prode').trim() || 'classic_argentinian_prode';
  const modeName = String(body.modeName || 'Classic Argentinian Prode').trim() || 'Classic Argentinian Prode';

  return {
    tournament: {
      name,
      nameEs: getTournamentNameEs({
        name,
        nameEs: body.nameEs,
      }),
      modeKey,
      modeName,
      modeNameEs: getModeNameEs({
        modeKey,
        modeName,
        modeNameEs: body.modeNameEs,
      }),
      sport: String(body.sport || 'football').trim() || 'football',
      status: normalizeTournamentStatus(body.status),
      prizesEnabled: Boolean(body.prizesEnabled),
      entryFee,
      currency,
      accessType,
      joinCode,
      startDate: parseOptionalDate(body.startDate, 'Start date'),
      endDate: parseOptionalDate(body.endDate, 'End date'),
      closingDate: parseOptionalDate(body.closingDate, 'Closing date'),
    },
    groups: normalizedGroups,
    rounds: normalizedRounds,
  };
}

async function resolveTournamentJoinCode(tournamentData, existingTournament = null) {
  if (tournamentData.accessType !== 'private') {
    return null;
  }

  if (tournamentData.joinCode) {
    return tournamentData.joinCode;
  }

  if (existingTournament?.joinCode) {
    return existingTournament.joinCode;
  }

  return generateUniqueJoinCode();
}

async function createTournamentGroupsAndTeams(tx, tournamentId, groups) {
  for (const group of groups) {
    const createdGroup = await tx.group.create({
      data: {
        tournamentId,
        name: group.name,
      },
    });

    await tx.team.createMany({
      data: group.teams.map((team) => ({
        tournamentId,
        groupId: createdGroup.id,
        name: team.name,
        nameEs: team.nameEs,
        code: team.code,
        flagUrl: team.flagUrl,
      })),
    });
  }
}

async function ensureTournamentStructureEditable(tournamentId) {
  const [
    memberCount,
    leagueCount,
    groupPredictionCount,
    knockoutPredictionCount,
    groupResultCount,
    scoreCount,
  ] = await Promise.all([
    prisma.tournamentMember.count({ where: { tournamentId } }),
    prisma.tournamentLeague.count({ where: { tournamentId } }),
    prisma.groupPrediction.count({ where: { tournamentId } }),
    prisma.knockoutPrediction.count({ where: { tournamentId } }),
    prisma.groupResult.count({ where: { tournamentId } }),
    prisma.score.count({ where: { tournamentId } }),
  ]);

  if (
    memberCount ||
    leagueCount ||
    groupPredictionCount ||
    knockoutPredictionCount ||
    groupResultCount ||
    scoreCount
  ) {
    throw createHttpError(
      400,
      'Tournament structure can only be edited before participants, leagues, predictions, or results exist'
    );
  }
}

async function getParticipantCount(tournamentId) {
  const [members, groupParticipants, knockoutParticipants] = await Promise.all([
    prisma.tournamentMember.findMany({
      where: { tournamentId },
      select: { userId: true },
    }),
    prisma.groupPrediction.findMany({
      where: { tournamentId },
      select: { userId: true },
      distinct: ['userId'],
    }),
    prisma.knockoutPrediction.findMany({
      where: { tournamentId },
      select: { userId: true },
      distinct: ['userId'],
    }),
  ]);

  const participantIds = new Set([
    ...members.map((entry) => entry.userId),
    ...groupParticipants.map((entry) => entry.userId),
    ...knockoutParticipants.map((entry) => entry.userId),
  ]);

  return {
    participantCount: participantIds.size,
    memberCount: members.length,
  };
}

function buildTournamentAccess(tournament, viewer) {
  const accessType = normalizeAccessType(tournament.accessType);
  const lifecycle = getTournamentLifecycle(tournament);
  const isPrivate = accessType === 'private';
  const isAdmin = viewer?.role === 'ADMIN';
  const isMember = isAdmin || Boolean((tournament.members || []).length);
  const canParticipate = !isPrivate || isMember || isAdmin;

  return {
    type: accessType,
    isPrivate,
    isMember,
    isAdmin,
    canJoin: Boolean(viewer?.id) && isPrivate && !isMember && lifecycle.predictionsOpen,
    requiresJoinCode: isPrivate,
    canViewLeaderboard: canParticipate,
    canViewPredictions: canParticipate,
    canSubmitPredictions: canParticipate && Boolean(viewer?.id) && lifecycle.predictionsOpen,
    predictionWindowOpen: lifecycle.predictionsOpen,
    predictionsLocked: lifecycle.predictionsLocked,
    lockedReason: lifecycle.lockedReason,
  };
}

function serializeTournament(tournament, counts, viewer) {
  const groups = serializeGroups(tournament.groups, tournament.groupResults);
  const rounds = serializeRounds(tournament.rounds);
  const mode = serializeMode(tournament);
  const access = buildTournamentAccess(tournament, viewer);
  const lifecycle = getTournamentLifecycle(tournament);

  return {
    id: tournament.id,
    name: tournament.name,
    nameEs: tournament.nameEs,
    mode,
    sport: tournament.sport,
    status: lifecycle.status,
    prizesEnabled: tournament.prizesEnabled,
    entryFee: tournament.entryFee,
    currency: tournament.currency,
    accessType: normalizeAccessType(tournament.accessType),
    joinCode: access.isMember || access.isAdmin ? tournament.joinCode : null,
    startDate: tournament.startDate,
    endDate: tournament.endDate,
    closingDate: tournament.closingDate,
    participantCount: counts.participantCount,
    memberCount: counts.memberCount,
    access,
    groups,
    rounds,
    rules: buildRules(tournament, tournament.rounds),
  };
}

function buildLeagueAccess(league, viewer) {
  const isOwner = league.createdByUserId === viewer?.id;
  const isMember = isOwner || Boolean((league.members || []).length);

  return {
    isOwner,
    isMember,
    canJoin: Boolean(viewer?.id) && !isMember,
    canViewLeaderboard: isMember,
  };
}

function serializeLeague(league, viewer) {
  const access = buildLeagueAccess(league, viewer);

  return {
    id: league.id,
    tournamentId: league.tournamentId,
    name: league.name,
    description: league.description || '',
    joinCode: access.isMember ? league.joinCode : null,
    memberCount: league._count?.members ?? league.members?.length ?? 0,
    createdAt: league.createdAt,
    createdByUserId: league.createdByUserId,
    createdBy: league.createdBy
      ? {
          id: league.createdBy.id,
          name: league.createdBy.name || league.createdBy.email,
        }
      : null,
    access,
  };
}

function serializeLeagueInvite(league, tournament, viewer) {
  const leagueAccess = buildLeagueAccess(league, viewer);
  const tournamentAccess = buildTournamentAccess(tournament, viewer);
  const requiresTournamentJoin = !tournamentAccess.canViewPredictions;

  return {
    league: {
      id: league.id,
      name: league.name,
      description: league.description || '',
      joinCode: league.joinCode,
      memberCount: league._count?.members ?? league.members?.length ?? 0,
    },
    tournament: {
      id: tournament.id,
      name: tournament.name,
      nameEs: tournament.nameEs || null,
      accessType: normalizeAccessType(tournament.accessType),
      status: getTournamentLifecycle(tournament).status,
    },
    access: {
      isLeagueMember: leagueAccess.isMember,
      isTournamentMember: tournamentAccess.isMember,
      requiresTournamentJoin,
      canJoinLeague: Boolean(viewer?.id) && !requiresTournamentJoin && leagueAccess.canJoin,
      canViewLeague: leagueAccess.canViewLeaderboard,
      canJoinTournament: tournamentAccess.canJoin,
    },
  };
}

async function getTournamentDetails(tournamentId, viewer) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      groups: {
        include: {
          teams: true,
        },
      },
      rounds: {
        include: {
          matches: true,
        },
      },
      groupResults: true,
      ...(viewer?.id
        ? {
            members: {
              where: { userId: viewer.id },
              select: { userId: true },
            },
          }
        : {}),
    },
  });

  if (!tournament) {
    return null;
  }

  const counts = await getParticipantCount(tournamentId);
  return serializeTournament(tournament, counts, viewer);
}

async function getTournamentAccessState(tournamentId, viewer) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      status: true,
      closingDate: true,
      accessType: true,
      joinCode: true,
      ...(viewer?.id
        ? {
            members: {
              where: { userId: viewer.id },
              select: { userId: true },
            },
          }
        : {}),
    },
  });

  if (!tournament) {
    return null;
  }

  return {
    tournament,
    access: buildTournamentAccess(tournament, viewer),
  };
}

async function ensureTournamentParticipationAccess(tournamentId, viewer) {
  const accessState = await getTournamentAccessState(tournamentId, viewer);

  if (!accessState) {
    const error = new Error('Tournament not found');
    error.status = 404;
    throw error;
  }

  if (!accessState.access.canViewPredictions) {
    const error = new Error('This private tournament is only available to members');
    error.status = 403;
    throw error;
  }

  return accessState;
}

async function ensureTournamentPredictionSubmissionAccess(tournamentId, viewer) {
  const accessState = await ensureTournamentParticipationAccess(tournamentId, viewer);

  if (!accessState.access.canSubmitPredictions) {
    const error = new Error(
      accessState.access.predictionsLocked
        ? 'Predictions are closed for this tournament'
        : 'You cannot submit predictions for this tournament'
    );
    error.status = 403;
    throw error;
  }

  return accessState;
}

async function getLeagueDetails(leagueId, viewer) {
  const league = await prisma.tournamentLeague.findUnique({
    where: { id: leagueId },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      ...(viewer?.id
        ? {
            members: {
              where: { userId: viewer.id },
              select: { userId: true },
            },
          }
        : {}),
      _count: {
        select: { members: true },
      },
    },
  });

  if (!league) {
    return null;
  }

  return serializeLeague(league, viewer);
}

async function ensureLeagueMembership(leagueId, viewer) {
  const league = await prisma.tournamentLeague.findUnique({
    where: { id: leagueId },
    select: {
      id: true,
      tournamentId: true,
      joinCode: true,
      createdByUserId: true,
      ...(viewer?.id
        ? {
            members: {
              where: { userId: viewer.id },
              select: { userId: true },
            },
          }
        : {}),
    },
  });

  if (!league) {
    const error = new Error('League not found');
    error.status = 404;
    throw error;
  }

  const access = buildLeagueAccess(league, viewer);
  if (!access.isMember) {
    const error = new Error('This league is only available to members');
    error.status = 403;
    throw error;
  }

  return { league, access };
}

async function ensureLeagueOwner(leagueId, viewer) {
  const membershipState = await ensureLeagueMembership(leagueId, viewer);

  if (!membershipState.access.isOwner) {
    throw createHttpError(403, 'Only the league owner can manage this league');
  }

  return membershipState;
}

function normalizeGroupPredictionMap(groupPredictions = []) {
  return groupPredictions.reduce((acc, prediction) => {
    acc[prediction.groupId] = {
      first: prediction.first,
      second: prediction.second,
      third: prediction.third || '',
    };
    return acc;
  }, {});
}

function normalizeKnockoutPredictionMap(knockoutPredictions = []) {
  return knockoutPredictions.reduce((acc, prediction) => {
    acc[prediction.matchId] = {
      predictedWinner: prediction.predictedWinner,
      selectedHomeTeamId: prediction.selectedHomeTeamId || '',
      selectedAwayTeamId: prediction.selectedAwayTeamId || '',
    };
    return acc;
  }, {});
}

function getEligibleBestThirdGroups(label = '') {
  const match = String(label || '').trim().match(BEST_THIRD_SLOT_PATTERN);
  if (!match) {
    return [];
  }

  return match[1]
    .split('/')
    .map((groupCode) => groupCode.trim().toUpperCase())
    .filter(Boolean);
}

function hasBestThirdPlaceSlots(rounds = []) {
  return rounds.some((round) =>
    (round.matches || []).some((match) =>
      BEST_THIRD_SLOT_PATTERN.test(match.homeLabel || '') || BEST_THIRD_SLOT_PATTERN.test(match.awayLabel || '')
    )
  );
}

function parseGroupPredictionEntries(input) {
  if (Array.isArray(input)) {
    return input;
  }

  if (!input || typeof input !== 'object') {
    return [];
  }

  return Object.entries(input).map(([groupId, prediction]) => ({
    groupId,
    first: prediction?.first || '',
    second: prediction?.second || '',
    third: prediction?.third || '',
  }));
}

function parseKnockoutPredictionEntries(input) {
  if (Array.isArray(input)) {
    return input;
  }

  if (!input || typeof input !== 'object') {
    return [];
  }

  return Object.entries(input).map(([matchId, prediction]) => ({
    matchId,
    predictedWinner:
      typeof prediction === 'string' ? prediction : prediction?.predictedWinner || '',
    selectedHomeTeamId:
      typeof prediction === 'string' ? '' : prediction?.selectedHomeTeamId || '',
    selectedAwayTeamId:
      typeof prediction === 'string' ? '' : prediction?.selectedAwayTeamId || '',
  }));
}

function validateUniqueBestThirdSelections(knockoutPredictions = []) {
  const selectedTeamIds = knockoutPredictions
    .flatMap((prediction) => [prediction.selectedHomeTeamId, prediction.selectedAwayTeamId])
    .filter(Boolean);

  return new Set(selectedTeamIds).size === selectedTeamIds.length;
}

function getGroupCode(groupName = '') {
  const match = String(groupName || '').match(/([A-Za-z0-9]+)$/);
  return match ? match[1].toUpperCase() : String(groupName || '').toUpperCase();
}

function findGroupByCode(groups = [], code = '') {
  return groups.find((group) => getGroupCode(group.name) === String(code || '').toUpperCase());
}

function findMatchByRoundCode(rounds = [], roundCode, matchNumber) {
  return rounds
    .flatMap((round) =>
      sortMatches(round.matches || []).map((match) => ({
        ...match,
        roundCode: getRoundCode(round.name),
      }))
    )
    .find(
      (match) =>
        String(match.roundCode).toUpperCase() === String(roundCode || '').toUpperCase() &&
        Number(match.matchNumber) === Number(matchNumber)
    );
}

function resolvePredictedSlotTeamId({
  label,
  groups = [],
  rounds = [],
  groupSelections = {},
  knockoutSelections = {},
  slotSelections = {},
}) {
  if (!label) {
    return null;
  }

  const trimmedLabel = String(label).trim();
  const groupSlot = trimmedLabel.match(GROUP_SLOT_PATTERN);
  if (groupSlot) {
    const position = groupSlot[1] === '1' ? 'first' : groupSlot[1] === '2' ? 'second' : 'third';
    const group = findGroupByCode(groups, groupSlot[2]);
    return group ? groupSelections[group.id]?.[position] || null : null;
  }

  const bestThirdSlot = trimmedLabel.match(BEST_THIRD_SLOT_PATTERN);
  if (bestThirdSlot) {
    const selectedTeamId = slotSelections[trimmedLabel] || null;
    const eligibleTeamIds = getEligibleBestThirdGroups(trimmedLabel)
      .map((groupCode) => findGroupByCode(groups, groupCode))
      .map((group) => (group ? groupSelections[group.id]?.third : ''))
      .filter(Boolean);

    return eligibleTeamIds.includes(selectedTeamId) ? selectedTeamId : null;
  }

  const winnerSlot = trimmedLabel.match(WINNER_SLOT_PATTERN);
  if (winnerSlot) {
    const sourceMatch = findMatchByRoundCode(rounds, winnerSlot[1], winnerSlot[2]);
    return sourceMatch ? knockoutSelections[sourceMatch.id] || null : null;
  }

  return null;
}

function validateKnockoutPredictionProgression({
  groups = [],
  rounds = [],
  groupPredictions = [],
  knockoutPredictions = [],
}) {
  const groupSelections = normalizeGroupPredictionMap(groupPredictions);
  const knockoutPredictionMap = normalizeKnockoutPredictionMap(knockoutPredictions);
  const knockoutSelections = {};

  for (const round of sortRounds(rounds)) {
    for (const match of sortMatches(round.matches || [])) {
      const prediction = knockoutPredictionMap[match.id] || {};
      const slotSelections = {
        [match.homeLabel]: prediction.selectedHomeTeamId || '',
        [match.awayLabel]: prediction.selectedAwayTeamId || '',
      };
      const homeTeamId = resolvePredictedSlotTeamId({
        label: match.homeLabel,
        groups,
        rounds,
        groupSelections,
        knockoutSelections,
        slotSelections,
      });
      const awayTeamId = resolvePredictedSlotTeamId({
        label: match.awayLabel,
        groups,
        rounds,
        groupSelections,
        knockoutSelections,
        slotSelections,
      });

      if (
        prediction.predictedWinner &&
        prediction.predictedWinner !== homeTeamId &&
        prediction.predictedWinner !== awayTeamId
      ) {
        throw createHttpError(
          400,
          `Invalid knockout progression for ${match.code || `${getRoundCode(round.name)}-${match.matchNumber}`}`
        );
      }

      if (prediction.predictedWinner) {
        knockoutSelections[match.id] = prediction.predictedWinner;
      }
    }
  }
}

function buildLeagueScopeKey(leagueId) {
  return `league:${leagueId}`;
}

function isLeagueScopeKey(scopeKey) {
  return String(scopeKey || '').startsWith('league:');
}

function getLeagueIdFromScopeKey(scopeKey) {
  return isLeagueScopeKey(scopeKey) ? String(scopeKey).slice('league:'.length) : null;
}

async function getPrimaryEntrySelection(userId, tournamentId) {
  return prisma.tournamentPrimaryEntry.findUnique({
    where: {
      userId_tournamentId: {
        userId,
        tournamentId,
      },
    },
  });
}

async function validatePrimaryEntryScopeSelection({ userId, tournamentId, scopeKey }) {
  if (scopeKey !== TOURNAMENT_SCOPE_KEY && !isLeagueScopeKey(scopeKey)) {
    throw createHttpError(400, 'Invalid primary entry scope');
  }

  if (isLeagueScopeKey(scopeKey)) {
    const leagueId = getLeagueIdFromScopeKey(scopeKey);
    await ensureLeagueMembership(leagueId, { id: userId });

    const league = await prisma.tournamentLeague.findUnique({
      where: { id: leagueId },
      select: { tournamentId: true },
    });

    if (!league || league.tournamentId !== tournamentId) {
      throw createHttpError(400, 'That league does not belong to this tournament');
    }
  }

  const [groupPredictionCount, knockoutPredictionCount] = await Promise.all([
    prisma.groupPrediction.count({
      where: {
        userId,
        tournamentId,
        scopeKey,
      },
    }),
    prisma.knockoutPrediction.count({
      where: {
        userId,
        tournamentId,
        scopeKey,
      },
    }),
  ]);

  if (!groupPredictionCount && !knockoutPredictionCount) {
    throw createHttpError(400, 'You need saved predictions in that entry before making it official');
  }
}

async function listPrimaryEntryOptions(userId, tournamentId) {
  const [selection, leagues, groupScopes, knockoutScopes, tournament] = await Promise.all([
    getPrimaryEntrySelection(userId, tournamentId),
    prisma.tournamentLeague.findMany({
      where: {
        tournamentId,
        OR: [
          { createdByUserId: userId },
          { members: { some: { userId } } },
        ],
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
    }),
    prisma.groupPrediction.findMany({
      where: {
        userId,
        tournamentId,
      },
      select: {
        scopeKey: true,
      },
      distinct: ['scopeKey'],
    }),
    prisma.knockoutPrediction.findMany({
      where: {
        userId,
        tournamentId,
      },
      select: {
        scopeKey: true,
      },
      distinct: ['scopeKey'],
    }),
    prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        name: true,
        closingDate: true,
        status: true,
        accessType: true,
      },
    }),
  ]);

  const predictionScopes = new Set([
    ...groupScopes.map((entry) => entry.scopeKey),
    ...knockoutScopes.map((entry) => entry.scopeKey),
  ]);
  const currentScopeKey = selection?.scopeKey || TOURNAMENT_SCOPE_KEY;
  const lifecycle = tournament ? getTournamentLifecycle(tournament) : { predictionsLocked: false };

  const options = [
    {
      scopeKey: TOURNAMENT_SCOPE_KEY,
      type: 'tournament',
      label: tournament?.name || 'Tournament',
      hasPredictions: predictionScopes.has(TOURNAMENT_SCOPE_KEY),
      isPrimary: currentScopeKey === TOURNAMENT_SCOPE_KEY,
    },
    ...leagues.map((league) => {
      const scopeKey = buildLeagueScopeKey(league.id);

      return {
        scopeKey,
        type: 'league',
        leagueId: league.id,
        label: league.name,
        hasPredictions: predictionScopes.has(scopeKey),
        isPrimary: currentScopeKey === scopeKey,
      };
    }),
  ];

  return {
    currentScopeKey,
    canChange: !lifecycle.predictionsLocked,
    options,
  };
}

function getOfficialScopeKeyForUser(user) {
  return user.tournamentPrimaryEntries?.[0]?.scopeKey || TOURNAMENT_SCOPE_KEY;
}

function mapPredictionsByScope(predictions = []) {
  return predictions.reduce((acc, prediction) => {
    if (!acc[prediction.scopeKey]) {
      acc[prediction.scopeKey] = [];
    }
    acc[prediction.scopeKey].push(prediction);
    return acc;
  }, {});
}

function selectOfficialScoresForUser(user) {
  const primarySelections = new Map(
    (user.tournamentPrimaryEntries || []).map((entry) => [entry.tournamentId, entry.scopeKey])
  );
  const officialScores = new Map();

  for (const score of user.scores || []) {
    const officialScopeKey = primarySelections.get(score.tournamentId) || TOURNAMENT_SCOPE_KEY;
    if (score.scopeKey === officialScopeKey) {
      officialScores.set(score.tournamentId, score);
    }
  }

  return Array.from(officialScores.values());
}

async function listPredictionScopeKeys(userId, tournamentId) {
  const [groupScopes, knockoutScopes] = await Promise.all([
    prisma.groupPrediction.findMany({
      where: {
        userId,
        tournamentId,
      },
      select: {
        scopeKey: true,
      },
      distinct: ['scopeKey'],
    }),
    prisma.knockoutPrediction.findMany({
      where: {
        userId,
        tournamentId,
      },
      select: {
        scopeKey: true,
      },
      distinct: ['scopeKey'],
    }),
  ]);

  return [...new Set([...groupScopes, ...knockoutScopes].map((entry) => entry.scopeKey).filter(Boolean))];
}

function getFallbackPrimaryScopeKey(scopeKeys = []) {
  if (scopeKeys.includes(TOURNAMENT_SCOPE_KEY)) {
    return TOURNAMENT_SCOPE_KEY;
  }

  return [...scopeKeys].sort()[0] || null;
}

async function syncPrimaryEntryAfterScopeRemoval({ userId, tournamentId, removedScopeKey }) {
  const selection = await getPrimaryEntrySelection(userId, tournamentId);
  const currentScopeKey = selection?.scopeKey || TOURNAMENT_SCOPE_KEY;

  if (currentScopeKey !== removedScopeKey) {
    return;
  }

  const remainingScopeKeys = await listPredictionScopeKeys(userId, tournamentId);
  const fallbackScopeKey = getFallbackPrimaryScopeKey(remainingScopeKeys);

  if (!fallbackScopeKey) {
    if (selection) {
      await prisma.tournamentPrimaryEntry.delete({
        where: {
          userId_tournamentId: {
            userId,
            tournamentId,
          },
        },
      });
    }
    return;
  }

  if (selection) {
    await prisma.tournamentPrimaryEntry.update({
      where: {
        userId_tournamentId: {
          userId,
          tournamentId,
        },
      },
      data: {
        scopeKey: fallbackScopeKey,
      },
    });
    return;
  }

  if (fallbackScopeKey !== TOURNAMENT_SCOPE_KEY) {
    await prisma.tournamentPrimaryEntry.create({
      data: {
        userId,
        tournamentId,
        scopeKey: fallbackScopeKey,
      },
    });
  }
}

async function getPredictionsForScope({ userId, tournamentId, scopeKey = TOURNAMENT_SCOPE_KEY }) {
  const where = {
    userId,
    tournamentId,
    scopeKey,
  };

  const [groupPredictions, knockoutPredictions] = await Promise.all([
    prisma.groupPrediction.findMany({ where }),
    prisma.knockoutPrediction.findMany({ where }),
  ]);

  return {
    groupPredictions,
    knockoutPredictions,
    groupPredictionMap: normalizeGroupPredictionMap(groupPredictions),
    knockoutPredictionMap: normalizeKnockoutPredictionMap(knockoutPredictions),
  };
}

async function savePredictionsForScope({
  userId,
  tournamentId,
  scopeKey = TOURNAMENT_SCOPE_KEY,
  groupPredictions: rawGroupPredictions,
  knockoutPredictions: rawKnockoutPredictions,
}) {
  const [groups, rounds] = await Promise.all([
    prisma.group.findMany({
      where: { tournamentId },
      include: { teams: true },
    }),
    prisma.round.findMany({
      where: { tournamentId },
      include: { matches: true },
    }),
  ]);
  const requiresThirdPlaceSelections = hasBestThirdPlaceSlots(rounds);
  const groupPredictions = parseGroupPredictionEntries(rawGroupPredictions);
  const knockoutPredictions = parseKnockoutPredictionEntries(rawKnockoutPredictions);

  if (!validateUniqueBestThirdSelections(knockoutPredictions)) {
    throw createHttpError(400, 'Each third-place team can only be used once in the Round of 32');
  }

  for (const prediction of groupPredictions) {
    if (!prediction.groupId || !prediction.first || !prediction.second) {
      throw createHttpError(400, 'Incomplete group prediction payload');
    }

    if (requiresThirdPlaceSelections && !prediction.third) {
      throw createHttpError(400, 'Third-place picks are required for this tournament');
    }

    const selectedTeams = [prediction.first, prediction.second, prediction.third].filter(Boolean);
    if (new Set(selectedTeams).size !== selectedTeams.length) {
      throw createHttpError(400, 'Group placements must use different teams');
    }
  }

  for (const prediction of knockoutPredictions) {
    if (!prediction.matchId || !prediction.predictedWinner) {
      throw createHttpError(400, 'Incomplete knockout prediction payload');
    }
  }

  validateKnockoutPredictionProgression({
    groups,
    rounds,
    groupPredictions,
    knockoutPredictions,
  });

  const operations = [
    prisma.groupPrediction.deleteMany({
      where: {
        userId,
        tournamentId,
        scopeKey,
      },
    }),
    prisma.knockoutPrediction.deleteMany({
      where: {
        userId,
        tournamentId,
        scopeKey,
      },
    }),
  ];

  if (groupPredictions.length) {
    operations.push(
      prisma.groupPrediction.createMany({
        data: groupPredictions.map((prediction) => ({
          userId,
          tournamentId,
          groupId: prediction.groupId,
          scopeKey,
          first: prediction.first,
          second: prediction.second,
          third: prediction.third || null,
        })),
      })
    );
  }

  if (knockoutPredictions.length) {
    operations.push(
      prisma.knockoutPrediction.createMany({
        data: knockoutPredictions.map((prediction) => ({
          userId,
          tournamentId,
          matchId: prediction.matchId,
          scopeKey,
          predictedWinner: prediction.predictedWinner,
          selectedHomeTeamId: prediction.selectedHomeTeamId || null,
          selectedAwayTeamId: prediction.selectedAwayTeamId || null,
        })),
      })
    );
  }

  await prisma.$transaction(operations);
}

async function clearPredictionsForScope({ userId, tournamentId, scopeKey = TOURNAMENT_SCOPE_KEY }) {
  await prisma.$transaction([
    prisma.groupPrediction.deleteMany({
      where: {
        userId,
        tournamentId,
        scopeKey,
      },
    }),
    prisma.knockoutPrediction.deleteMany({
      where: {
        userId,
        tournamentId,
        scopeKey,
      },
    }),
    prisma.score.deleteMany({
      where: {
        userId,
        tournamentId,
        scopeKey,
      },
    }),
  ]);

  await syncPrimaryEntryAfterScopeRemoval({
    userId,
    tournamentId,
    removedScopeKey: scopeKey,
  });
}

async function ensureAccessibleScopeKey({ userId, tournamentId, scopeKey }) {
  if (scopeKey === TOURNAMENT_SCOPE_KEY) {
    return;
  }

  if (!isLeagueScopeKey(scopeKey)) {
    throw createHttpError(400, 'Invalid prediction scope');
  }

  const leagueId = getLeagueIdFromScopeKey(scopeKey);
  const { league } = await ensureLeagueMembership(leagueId, { id: userId });

  if (league.tournamentId !== tournamentId) {
    throw createHttpError(400, 'That prediction scope does not belong to this tournament');
  }
}

async function copyPredictionsBetweenScopes({
  userId,
  tournamentId,
  sourceScopeKey,
  targetScopeKey,
}) {
  if (!sourceScopeKey || !targetScopeKey || sourceScopeKey === targetScopeKey) {
    throw createHttpError(400, 'Source and target prediction scopes must be different');
  }

  await Promise.all([
    ensureAccessibleScopeKey({ userId, tournamentId, scopeKey: sourceScopeKey }),
    ensureAccessibleScopeKey({ userId, tournamentId, scopeKey: targetScopeKey }),
  ]);

  const sourcePredictions = await getPredictionsForScope({
    userId,
    tournamentId,
    scopeKey: sourceScopeKey,
  });

  if (!sourcePredictions.groupPredictions.length && !sourcePredictions.knockoutPredictions.length) {
    throw createHttpError(400, 'You need saved predictions in the source entry before copying them');
  }

  await savePredictionsForScope({
    userId,
    tournamentId,
    scopeKey: targetScopeKey,
    groupPredictions: sourcePredictions.groupPredictions.map((prediction) => ({
      groupId: prediction.groupId,
      first: prediction.first,
      second: prediction.second,
      third: prediction.third || '',
    })),
    knockoutPredictions: sourcePredictions.knockoutPredictions.map((prediction) => ({
      matchId: prediction.matchId,
      predictedWinner: prediction.predictedWinner,
      selectedHomeTeamId: prediction.selectedHomeTeamId || '',
      selectedAwayTeamId: prediction.selectedAwayTeamId || '',
    })),
  });
}

async function getScoringContext(tournamentId) {
  const [rounds, groupResults, knockoutMatches] = await Promise.all([
    prisma.round.findMany({
      where: { tournamentId },
      include: { matches: true },
    }),
    prisma.groupResult.findMany({
      where: { tournamentId },
    }),
    prisma.match.findMany({
      where: {
        round: {
          tournamentId,
        },
      },
      include: {
        round: true,
      },
    }),
  ]);

  const roundPointsMap = new Map(rounds.map((round) => [round.name, round.pointsPerCorrect]));
  const knockoutMatchesForScoring = knockoutMatches.map((match) => ({
    id: match.id,
    winner: match.winner,
    round: match.round.name,
  }));

  return {
    rounds: serializeRounds(rounds),
    roundPointsMap,
    groupResults: groupResults.map((result) => ({
      groupId: result.groupId,
      first: result.first,
      second: result.second,
    })),
    knockoutMatches: knockoutMatchesForScoring,
  };
}

function serializeLeaderboardPlayer(user, score) {
  return {
    id: `${user.id}:${score.totalScore}`,
    userId: user.id,
    name: user.name || user.email,
    email: user.email,
    groupScore: score.groupScore,
    knockoutScore: score.knockoutScore,
    totalScore: score.totalScore,
    roundScores: score.roundBreakdown,
  };
}

function serializeGlobalLeaderboardPlayer(user, scores = []) {
  const totals = scores.reduce(
    (acc, score) => {
      acc.groupScore += score.groupScore || 0;
      acc.knockoutScore += score.knockoutScore || 0;
      acc.totalScore += score.totalScore || 0;
      return acc;
    },
    {
      groupScore: 0,
      knockoutScore: 0,
      totalScore: 0,
    }
  );

  return {
    id: `${user.id}:${totals.totalScore}`,
    userId: user.id,
    name: user.name || String(user.email || '').split('@')[0] || 'Player',
    avatarUrl: user.avatarUrl || null,
    tournamentCount: scores.length,
    groupScore: totals.groupScore,
    knockoutScore: totals.knockoutScore,
    totalScore: totals.totalScore,
  };
}

async function calculateLeaderboard(tournamentId, options = {}) {
  const scopeKey = options.scopeKey || null;
  const allowedUserIds = options.userIds || null;
  const useAllowedUserIds = Array.isArray(allowedUserIds);
  const scoringContext = await getScoringContext(tournamentId);
  const users = await prisma.user.findMany({
    where: useAllowedUserIds
      ? {
          id: { in: allowedUserIds },
        }
      : {
          OR: [
            { groupPredictions: { some: { tournamentId, ...(scopeKey ? { scopeKey } : {}) } } },
            { knockoutPredictions: { some: { tournamentId, ...(scopeKey ? { scopeKey } : {}) } } },
            ...(scopeKey ? [] : [{ tournamentPrimaryEntries: { some: { tournamentId } } }]),
          ],
        },
    include: {
      groupPredictions: {
        where: { tournamentId, ...(scopeKey ? { scopeKey } : {}) },
      },
      knockoutPredictions: {
        where: { tournamentId, ...(scopeKey ? { scopeKey } : {}) },
      },
      ...(scopeKey
        ? {}
        : {
            tournamentPrimaryEntries: {
              where: { tournamentId },
            },
          }),
    },
  });

  const players = users
    .map((user) => {
      const activeScopeKey = scopeKey || getOfficialScopeKeyForUser(user);
      const groupPredictionsByScope = mapPredictionsByScope(user.groupPredictions);
      const knockoutPredictionsByScope = mapPredictionsByScope(user.knockoutPredictions);
      const score = calculateScopedScore(
        groupPredictionsByScope[activeScopeKey] || [],
        knockoutPredictionsByScope[activeScopeKey] || [],
        scoringContext
      );

      return serializeLeaderboardPlayer(user, score);
    })
    .sort((a, b) => b.totalScore - a.totalScore || a.name.localeCompare(b.name));

  return {
    rounds: scoringContext.rounds.filter((round) => round.matches.length > 0),
    players,
  };
}

async function calculateGlobalLeaderboard() {
  const users = await prisma.user.findMany({
    where: {
      showInGlobalRankings: true,
      scores: {
        some: {},
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      tournamentPrimaryEntries: {
        select: {
          tournamentId: true,
          scopeKey: true,
        },
      },
      scores: {
        select: {
          tournamentId: true,
          scopeKey: true,
          groupScore: true,
          knockoutScore: true,
          totalScore: true,
        },
      },
    },
  });

  const players = users
    .map((user) => serializeGlobalLeaderboardPlayer(user, selectOfficialScoresForUser(user)))
    .filter((user) => user.tournamentCount > 0)
    .sort((a, b) => b.totalScore - a.totalScore || b.tournamentCount - a.tournamentCount || a.name.localeCompare(b.name));

  return {
    players,
    summary: {
      visiblePlayerCount: players.length,
    },
  };
}

function calculateScopedScore(groupPredictions, knockoutPredictions, scoringContext) {
  return calculateTotalScore(
    groupPredictions.map((prediction) => ({
      groupId: prediction.groupId,
      predictions: {
        first: prediction.first,
        second: prediction.second,
      },
    })),
    scoringContext.groupResults,
    knockoutPredictions.map((prediction) => ({
      matchId: prediction.matchId,
      predictedWinner: prediction.predictedWinner,
    })),
    scoringContext.knockoutMatches,
    scoringContext.roundPointsMap
  );
}

async function persistScopeScores(tournamentId, scoringContext, options = {}) {
  const scopeKey = options.scopeKey || TOURNAMENT_SCOPE_KEY;
  const allowedUserIds = options.userIds || null;
  const useAllowedUserIds = Array.isArray(allowedUserIds);
  const users = await prisma.user.findMany({
    where: useAllowedUserIds
      ? {
          id: {
            in: allowedUserIds,
          },
        }
      : {
          OR: [
            { groupPredictions: { some: { tournamentId, scopeKey } } },
            { knockoutPredictions: { some: { tournamentId, scopeKey } } },
            { scores: { some: { tournamentId, scopeKey } } },
          ],
        },
    include: {
      groupPredictions: {
        where: { tournamentId, scopeKey },
      },
      knockoutPredictions: {
        where: { tournamentId, scopeKey },
      },
    },
  });

  const scoreUpdates = users.map((user) => {
    const score = calculateScopedScore(
      user.groupPredictions,
      user.knockoutPredictions,
      scoringContext
    );

    return prisma.score.upsert({
      where: {
        userId_tournamentId_scopeKey: {
          userId: user.id,
          tournamentId,
          scopeKey,
        },
      },
      update: {
        groupScore: score.groupScore,
        knockoutScore: score.knockoutScore,
        totalScore: score.totalScore,
      },
      create: {
        userId: user.id,
        tournamentId,
        scopeKey,
        groupScore: score.groupScore,
        knockoutScore: score.knockoutScore,
        totalScore: score.totalScore,
      },
    });
  });

  if (scoreUpdates.length) {
    await prisma.$transaction(scoreUpdates);
  }

  if (useAllowedUserIds) {
    await prisma.score.deleteMany({
      where: {
        tournamentId,
        scopeKey,
        userId: {
          notIn: allowedUserIds,
        },
      },
    });
  }

  return { updatedUsers: scoreUpdates.length };
}

async function persistTournamentScores(tournamentId) {
  const scoringContext = await getScoringContext(tournamentId);
  const leagues = await prisma.tournamentLeague.findMany({
    where: {
      tournamentId,
    },
    select: {
      id: true,
      members: {
        select: {
          userId: true,
        },
      },
    },
  });

  const tournamentScopeResult = await persistScopeScores(tournamentId, scoringContext, {
    scopeKey: TOURNAMENT_SCOPE_KEY,
  });

  const leagueScopeResults = [];
  for (const league of leagues) {
    const memberIds = league.members.map((member) => member.userId);
    const leagueScopeKey = buildLeagueScopeKey(league.id);
    const leagueResult = await persistScopeScores(tournamentId, scoringContext, {
      scopeKey: leagueScopeKey,
      userIds: memberIds,
    });

    leagueScopeResults.push({
      leagueId: league.id,
      updatedUsers: leagueResult.updatedUsers,
    });
  }

  return {
    updatedUsers: tournamentScopeResult.updatedUsers,
    scopedUpdates: {
      tournament: tournamentScopeResult.updatedUsers,
      leagues: leagueScopeResults,
    },
  };
}

async function buildAccountProfile(userId) {
  const [
    user,
    tournamentMemberships,
    createdLeagues,
    leagueMemberships,
    scoreProfile,
    groupPredictionCount,
    knockoutPredictionCount,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
    }),
    prisma.tournamentMember.findMany({
      where: { userId },
      select: { tournamentId: true },
      distinct: ['tournamentId'],
    }),
    prisma.tournamentLeague.findMany({
      where: { createdByUserId: userId },
      select: { id: true },
    }),
    prisma.leagueMember.findMany({
      where: { userId },
      select: { leagueId: true },
      distinct: ['leagueId'],
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        scores: {
          select: {
            tournamentId: true,
            scopeKey: true,
            groupScore: true,
            knockoutScore: true,
            totalScore: true,
          },
        },
        tournamentPrimaryEntries: {
          select: {
            tournamentId: true,
            scopeKey: true,
          },
        },
      },
    }),
    prisma.groupPrediction.count({
      where: { userId },
    }),
    prisma.knockoutPrediction.count({
      where: { userId },
    }),
  ]);

  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  return {
    user: serializeUser(user),
    stats: {
      tournamentCount: tournamentMemberships.length,
      leagueCount: Math.max(leagueMemberships.length, createdLeagues.length),
      totalScore: selectOfficialScoresForUser(scoreProfile).reduce(
        (sum, score) => sum + (score.totalScore || 0),
        0
      ),
      savedPredictionCount: groupPredictionCount + knockoutPredictionCount,
    },
  };
}

async function buildAccountNavigation(userId) {
  const [tournaments, leagues] = await Promise.all([
    prisma.tournament.findMany({
      where: {
        OR: [
          { members: { some: { userId } } },
          { groupPredictions: { some: { userId } } },
          { knockoutPredictions: { some: { userId } } },
          { scores: { some: { userId } } },
        ],
      },
      select: {
        id: true,
        name: true,
        nameEs: true,
        accessType: true,
        status: true,
        closingDate: true,
      },
      orderBy: [
        { closingDate: 'asc' },
        { startDate: 'asc' },
        { name: 'asc' },
      ],
      take: 8,
    }),
    prisma.tournamentLeague.findMany({
      where: {
        OR: [
          { createdByUserId: userId },
          { members: { some: { userId } } },
        ],
      },
      select: {
        id: true,
        name: true,
        tournamentId: true,
        createdByUserId: true,
        tournament: {
          select: {
            name: true,
            nameEs: true,
          },
        },
        _count: {
          select: { members: true },
        },
      },
      orderBy: [
        { updatedAt: 'desc' },
        { name: 'asc' },
      ],
      take: 8,
    }),
  ]);

  return {
    tournaments: tournaments.map((tournament) => ({
      id: tournament.id,
      name: tournament.name,
      nameEs: tournament.nameEs || null,
      accessType: normalizeAccessType(tournament.accessType),
      status: tournament.status,
      closingDate: tournament.closingDate,
    })),
    leagues: leagues.map((league) => ({
      id: league.id,
      name: league.name,
      tournamentId: league.tournamentId,
      tournamentName: league.tournament?.name || '',
      tournamentNameEs: league.tournament?.nameEs || null,
      memberCount: league._count?.members || 0,
      isOwner: league.createdByUserId === userId,
    })),
  };
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (String(password).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email.split('@')[0],
        role: 'USER',
      },
    });

    const token = generateToken(user.id);
    res.cookie('token', token, getCookieOptions());
    res.json({ user: serializeUser(user), token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id);
    res.cookie('token', token, getCookieOptions());
    res.json({ user: serializeUser(user), token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/google', (req, res, next) => {
  if (!GOOGLE_AUTH_CONFIGURED) {
    return res.status(503).json({ error: 'Google OAuth is not configured' });
  }

  return passport.authenticate('google', { session: false, scope: ['profile', 'email'] })(
    req,
    res,
    next
  );
});

app.get('/api/auth/google/callback', (req, res, next) => {
  if (!GOOGLE_AUTH_CONFIGURED) {
    return res.status(503).json({ error: 'Google OAuth is not configured' });
  }

  return passport.authenticate('google', { session: false, failureRedirect: '/login' })(
    req,
    res,
    () => {
      try {
        const token = generateToken(req.user.id);
        res.cookie('token', token, getCookieOptions());
        res.redirect(`${process.env.SITE_URL || 'http://localhost:5173'}/?token=${token}`);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    }
  );
});

app.get('/api/auth/me', verifyToken, async (req, res) => {
  try {
    res.json(await buildAccountProfile(req.user.id));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const genericResponse = {
      message: 'If an account exists for that email, a password reset link has been generated',
    };

    if (!email) {
      return res.json(genericResponse);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json(genericResponse);
    }

    const resetToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = hashToken(resetToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const resetUrl = `${process.env.SITE_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    const shouldAttemptEmailDelivery =
      process.env.NODE_ENV === 'production' || hasEmailTransportConfig(process.env);

    if (shouldAttemptEmailDelivery) {
      try {
        await sendPasswordResetEmail({
          toEmail: user.email,
          toName: user.name,
          resetUrl,
          expiresInMinutes: Math.round(PASSWORD_RESET_TOKEN_TTL_MS / 60000),
        });
      } catch (error) {
        console.error('Failed to send password reset email:', error);
        await prisma.passwordResetToken.deleteMany({
          where: { userId: user.id },
        });
      }
    }

    res.json({
      ...genericResponse,
      ...(process.env.NODE_ENV === 'production'
        ? {}
        : {
            resetToken,
            resetUrl,
          }),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    const password = String(req.body.password || '');

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (
      !resetToken ||
      resetToken.usedAt ||
      new Date(resetToken.expiresAt).getTime() <= Date.now()
    ) {
      return res.status(400).json({ error: 'Reset token is invalid or expired' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.deleteMany({
        where: {
          userId: resetToken.userId,
          id: { not: resetToken.id },
        },
      }),
    ]);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/account/profile', verifyToken, async (req, res) => {
  try {
    res.json(await buildAccountProfile(req.user.id));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.get('/api/account/navigation', verifyToken, async (req, res) => {
  try {
    res.json(await buildAccountNavigation(req.user.id));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.patch('/api/account/profile', verifyToken, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const avatarUrl = String(req.body.avatarUrl || '').trim();
    const hasShowInGlobalRankings = Object.prototype.hasOwnProperty.call(
      req.body || {},
      'showInGlobalRankings'
    );

    if (!name) {
      return res.status(400).json({ error: 'Display name is required' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name,
        avatarUrl: avatarUrl || null,
        ...(hasShowInGlobalRankings
          ? {
              showInGlobalRankings: Boolean(req.body.showInGlobalRankings),
            }
          : {}),
      },
    });

    res.json({ message: 'Profile updated successfully', user: serializeUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/account/change-password', verifyToken, async (req, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');

    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required' });
      }

      const passwordMatch = await bcrypt.compare(currentPassword, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token', getCookieOptions());
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/tournaments', optionalAuth, async (req, res) => {
  try {
    const requestedStatuses = (req.query.status || '')
      .split(',')
      .map((status) => status.trim())
      .filter(Boolean);

    const tournaments = await prisma.tournament.findMany({
      where: {
        ...(requestedStatuses.length
          ? {
              status: {
                in: requestedStatuses,
              },
            }
          : {}),
        ...(req.user?.role === 'ADMIN'
          ? {}
          : req.user?.id
            ? {
                OR: [
                  { accessType: 'public' },
                  { members: { some: { userId: req.user.id } } },
                ],
              }
            : {
                accessType: 'public',
              }),
      },
      include: {
        groups: {
          include: {
            teams: true,
          },
        },
        rounds: {
          include: {
            matches: true,
          },
        },
        groupResults: true,
        ...(req.user?.id
          ? {
              members: {
                where: { userId: req.user.id },
                select: { userId: true },
              },
            }
          : {}),
      },
      orderBy: [
        { startDate: 'asc' },
        { name: 'asc' },
      ],
    });

    const tournamentPayload = await Promise.all(
      tournaments.map(async (tournament) =>
        serializeTournament(tournament, await getParticipantCount(tournament.id), req.user)
      )
    );

    res.json(tournamentPayload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tournaments/:id', optionalAuth, async (req, res) => {
  try {
    const tournament = await getTournamentDetails(req.params.id, req.user);

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    res.json(tournament);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tournaments/:id/groups', optionalAuth, async (req, res) => {
  try {
    const tournament = await getTournamentDetails(req.params.id, req.user);

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    res.json(tournament.groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tournaments/:id/my-predictions', verifyToken, async (req, res) => {
  try {
    await ensureTournamentParticipationAccess(req.params.id, req.user);

    const predictions = await getPredictionsForScope({
      userId: req.user.id,
      tournamentId: req.params.id,
      scopeKey: TOURNAMENT_SCOPE_KEY,
    });

    res.json({
      tournamentId: req.params.id,
      scopeKey: TOURNAMENT_SCOPE_KEY,
      ...predictions,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tournaments/:id/primary-entry', verifyToken, async (req, res) => {
  try {
    await ensureTournamentParticipationAccess(req.params.id, req.user);
    const primaryEntry = await listPrimaryEntryOptions(req.user.id, req.params.id);
    res.json(primaryEntry);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post('/api/tournaments/:id/primary-entry', verifyToken, async (req, res) => {
  try {
    const accessState = await ensureTournamentParticipationAccess(req.params.id, req.user);

    if (accessState.access.predictionsLocked) {
      throw createHttpError(403, 'Primary entry selection is locked for this tournament');
    }

    const scopeKey = String(req.body.scopeKey || '').trim() || TOURNAMENT_SCOPE_KEY;
    await validatePrimaryEntryScopeSelection({
      userId: req.user.id,
      tournamentId: req.params.id,
      scopeKey,
    });

    await prisma.tournamentPrimaryEntry.upsert({
      where: {
        userId_tournamentId: {
          userId: req.user.id,
          tournamentId: req.params.id,
        },
      },
      update: {
        scopeKey,
      },
      create: {
        userId: req.user.id,
        tournamentId: req.params.id,
        scopeKey,
      },
    });

    res.json({
      message: 'Primary entry updated successfully',
      primaryEntry: await listPrimaryEntryOptions(req.user.id, req.params.id),
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post('/api/tournaments/:id/predictions', verifyToken, async (req, res) => {
  try {
    await ensureTournamentPredictionSubmissionAccess(req.params.id, req.user);

    await savePredictionsForScope({
      userId: req.user.id,
      tournamentId: req.params.id,
      scopeKey: TOURNAMENT_SCOPE_KEY,
      groupPredictions: req.body.groupPredictions,
      knockoutPredictions: req.body.knockoutPredictions,
    });

    await persistTournamentScores(req.params.id);

    res.json({ message: 'Predictions saved successfully' });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.get('/api/leagues/:id/my-predictions', verifyToken, async (req, res) => {
  try {
    const { league } = await ensureLeagueMembership(req.params.id, req.user);
    await ensureTournamentParticipationAccess(league.tournamentId, req.user);

    const scopeKey = buildLeagueScopeKey(league.id);
    const predictions = await getPredictionsForScope({
      userId: req.user.id,
      tournamentId: league.tournamentId,
      scopeKey,
    });

    res.json({
      leagueId: league.id,
      tournamentId: league.tournamentId,
      scopeKey,
      ...predictions,
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post('/api/leagues/:id/predictions', verifyToken, async (req, res) => {
  try {
    const { league } = await ensureLeagueMembership(req.params.id, req.user);
    await ensureTournamentPredictionSubmissionAccess(league.tournamentId, req.user);

    await savePredictionsForScope({
      userId: req.user.id,
      tournamentId: league.tournamentId,
      scopeKey: buildLeagueScopeKey(league.id),
      groupPredictions: req.body.groupPredictions,
      knockoutPredictions: req.body.knockoutPredictions,
    });

    await persistTournamentScores(league.tournamentId);

    res.json({ message: 'Predictions saved successfully' });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post('/api/leagues/:id/predictions/copy', verifyToken, async (req, res) => {
  try {
    const { league } = await ensureLeagueMembership(req.params.id, req.user);
    await ensureTournamentPredictionSubmissionAccess(league.tournamentId, req.user);

    const sourceScopeKey = String(req.body.sourceScopeKey || '').trim();
    await copyPredictionsBetweenScopes({
      userId: req.user.id,
      tournamentId: league.tournamentId,
      sourceScopeKey,
      targetScopeKey: buildLeagueScopeKey(league.id),
    });

    await persistTournamentScores(league.tournamentId);

    res.json({
      message: 'Predictions copied successfully',
      primaryEntry: await listPrimaryEntryOptions(req.user.id, league.tournamentId),
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.delete('/api/predictions/:id', verifyToken, async (req, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });

    let tournamentId = null;
    let scopeKey = TOURNAMENT_SCOPE_KEY;
    let scopeType = 'tournament';

    if (tournament) {
      await ensureTournamentPredictionSubmissionAccess(req.params.id, req.user);
      tournamentId = req.params.id;
    } else {
      const { league } = await ensureLeagueMembership(req.params.id, req.user);
      await ensureTournamentPredictionSubmissionAccess(league.tournamentId, req.user);
      tournamentId = league.tournamentId;
      scopeKey = buildLeagueScopeKey(league.id);
      scopeType = 'league';
    }

    await clearPredictionsForScope({
      userId: req.user.id,
      tournamentId,
      scopeKey,
    });

    await persistTournamentScores(tournamentId);

    res.json({
      message: 'Predictions deleted successfully',
      tournamentId,
      scopeKey,
      scopeType,
      primaryEntry: await listPrimaryEntryOptions(req.user.id, tournamentId),
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post('/api/tournaments/:id/join', verifyToken, async (req, res) => {
  try {
    const accessState = await getTournamentAccessState(req.params.id, req.user);

    if (!accessState) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (accessState.access.type !== 'private') {
      return res.status(400).json({ error: 'Only private tournaments require joining' });
    }

    if (accessState.access.isMember) {
      const tournament = await getTournamentDetails(req.params.id, req.user);
      return res.json({ message: 'Already a member', tournament });
    }

    if (!accessState.access.canJoin) {
      return res.status(403).json({ error: 'This tournament is no longer accepting new participants' });
    }

    const providedJoinCode = normalizeJoinCode(req.body.joinCode);
    const expectedJoinCode = normalizeJoinCode(accessState.tournament.joinCode);

    if (!providedJoinCode || providedJoinCode !== expectedJoinCode) {
      return res.status(403).json({ error: 'Invalid join code' });
    }

    await prisma.tournamentMember.upsert({
      where: {
        userId_tournamentId: {
          userId: req.user.id,
          tournamentId: req.params.id,
        },
      },
      update: {},
      create: {
        userId: req.user.id,
        tournamentId: req.params.id,
      },
    });

    const tournament = await getTournamentDetails(req.params.id, req.user);
    res.json({ message: 'Joined tournament successfully', tournament });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.get('/api/tournaments/:id/leagues', verifyToken, async (req, res) => {
  try {
    await ensureTournamentParticipationAccess(req.params.id, req.user);

    const leagues = await prisma.tournamentLeague.findMany({
      where: {
        tournamentId: req.params.id,
        OR: [
          { createdByUserId: req.user.id },
          { members: { some: { userId: req.user.id } } },
        ],
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        members: {
          where: { userId: req.user.id },
          select: { userId: true },
        },
        _count: {
          select: { members: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
    });

    res.json(leagues.map((league) => serializeLeague(league, req.user)));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post('/api/tournaments/:id/leagues', verifyToken, async (req, res) => {
  try {
    await ensureTournamentParticipationAccess(req.params.id, req.user);

    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();

    if (!name) {
      return res.status(400).json({ error: 'League name is required' });
    }

    const joinCode = await generateUniqueLeagueJoinCode();
    const league = await prisma.tournamentLeague.create({
      data: {
        tournamentId: req.params.id,
        createdByUserId: req.user.id,
        name,
        description: description || null,
        joinCode,
        members: {
          create: {
            userId: req.user.id,
            role: 'owner',
          },
        },
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        members: {
          where: { userId: req.user.id },
          select: { userId: true },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    res.json({ message: 'League created successfully', league: serializeLeague(league, req.user) });
  } catch (error) {
    res.status(error.code === 'P2002' ? 400 : 500).json({
      error: error.code === 'P2002' ? 'A league with that name already exists in this tournament' : error.message,
    });
  }
});

app.post('/api/tournaments/:id/leagues/join', verifyToken, async (req, res) => {
  try {
    await ensureTournamentParticipationAccess(req.params.id, req.user);

    const joinCode = normalizeJoinCode(req.body.joinCode);
    if (!joinCode) {
      return res.status(400).json({ error: 'Join code is required' });
    }

    const league = await prisma.tournamentLeague.findFirst({
      where: {
        tournamentId: req.params.id,
        joinCode,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        members: {
          where: { userId: req.user.id },
          select: { userId: true },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    if (!league) {
      return res.status(404).json({ error: 'League not found for that join code' });
    }

    if (!buildLeagueAccess(league, req.user).isMember) {
      await prisma.leagueMember.create({
        data: {
          leagueId: league.id,
          userId: req.user.id,
        },
      });
    }

    const updatedLeague = await getLeagueDetails(league.id, req.user);
    res.json({ message: 'Joined league successfully', league: updatedLeague });
  } catch (error) {
    res.status(error.code === 'P2002' ? 400 : error.status || 500).json({
      error: error.code === 'P2002' ? 'You are already a member of that league' : error.message,
    });
  }
});

app.get('/api/leagues/invite/:joinCode', optionalAuth, async (req, res) => {
  try {
    const joinCode = normalizeJoinCode(req.params.joinCode);
    if (!joinCode) {
      return res.status(400).json({ error: 'Join code is required' });
    }

    const league = await prisma.tournamentLeague.findFirst({
      where: { joinCode },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            nameEs: true,
            accessType: true,
            status: true,
            closingDate: true,
            ...(req.user?.id
              ? {
                  members: {
                    where: { userId: req.user.id },
                    select: { userId: true },
                  },
                }
              : {}),
          },
        },
        ...(req.user?.id
          ? {
              members: {
                where: { userId: req.user.id },
                select: { userId: true },
              },
            }
          : {}),
        _count: {
          select: { members: true },
        },
      },
    });

    if (!league) {
      return res.status(404).json({ error: 'League not found for that join code' });
    }

    res.json(serializeLeagueInvite(league, league.tournament, req.user));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.get('/api/leagues/:id', verifyToken, async (req, res) => {
  try {
    await ensureLeagueMembership(req.params.id, req.user);
    const league = await getLeagueDetails(req.params.id, req.user);
    res.json(league);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.patch('/api/leagues/:id', verifyToken, async (req, res) => {
  try {
    await ensureLeagueOwner(req.params.id, req.user);

    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();

    if (!name) {
      return res.status(400).json({ error: 'League name is required' });
    }

    await prisma.tournamentLeague.update({
      where: { id: req.params.id },
      data: {
        name,
        description: description || null,
      },
    });

    const league = await getLeagueDetails(req.params.id, req.user);
    res.json({ message: 'League updated successfully', league });
  } catch (error) {
    res.status(error.code === 'P2002' ? 400 : error.status || 500).json({
      error:
        error.code === 'P2002'
          ? 'A league with that name already exists in this tournament'
          : error.message,
    });
  }
});

app.post('/api/leagues/:id/regenerate-code', verifyToken, async (req, res) => {
  try {
    await ensureLeagueOwner(req.params.id, req.user);

    const joinCode = await generateUniqueLeagueJoinCode();
    await prisma.tournamentLeague.update({
      where: { id: req.params.id },
      data: { joinCode },
    });

    const league = await getLeagueDetails(req.params.id, req.user);
    res.json({ message: 'League join code regenerated successfully', league });
  } catch (error) {
    res.status(error.code === 'P2002' ? 400 : error.status || 500).json({
      error: error.code === 'P2002' ? 'That join code is already in use' : error.message,
    });
  }
});

app.delete('/api/leagues/:id/members/me', verifyToken, async (req, res) => {
  try {
    const { league, access } = await ensureLeagueMembership(req.params.id, req.user);

    if (access.isOwner) {
      return res.status(400).json({ error: 'League owners must delete the league instead of leaving it' });
    }

    const scopeKey = buildLeagueScopeKey(req.params.id);
    await prisma.$transaction([
      prisma.groupPrediction.deleteMany({
        where: {
          userId: req.user.id,
          tournamentId: league.tournamentId,
          scopeKey,
        },
      }),
      prisma.knockoutPrediction.deleteMany({
        where: {
          userId: req.user.id,
          tournamentId: league.tournamentId,
          scopeKey,
        },
      }),
      prisma.score.deleteMany({
        where: {
          userId: req.user.id,
          tournamentId: league.tournamentId,
          scopeKey,
        },
      }),
      prisma.leagueMember.delete({
        where: {
          leagueId_userId: {
            leagueId: req.params.id,
            userId: req.user.id,
          },
        },
      }),
    ]);

    await syncPrimaryEntryAfterScopeRemoval({
      userId: req.user.id,
      tournamentId: league.tournamentId,
      removedScopeKey: scopeKey,
    });

    res.json({ message: 'Left league successfully', tournamentId: league.tournamentId });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.delete('/api/leagues/:id', verifyToken, async (req, res) => {
  try {
    const { league } = await ensureLeagueOwner(req.params.id, req.user);
    const scopeKey = buildLeagueScopeKey(req.params.id);
    const leagueMembers = await prisma.leagueMember.findMany({
      where: { leagueId: req.params.id },
      select: { userId: true },
    });
    const affectedUserIds = [...new Set([league.createdByUserId, ...leagueMembers.map((member) => member.userId)])];

    await prisma.$transaction([
      prisma.groupPrediction.deleteMany({
        where: {
          tournamentId: league.tournamentId,
          scopeKey,
        },
      }),
      prisma.knockoutPrediction.deleteMany({
        where: {
          tournamentId: league.tournamentId,
          scopeKey,
        },
      }),
      prisma.score.deleteMany({
        where: {
          tournamentId: league.tournamentId,
          scopeKey,
        },
      }),
      prisma.leagueMember.deleteMany({
        where: { leagueId: req.params.id },
      }),
      prisma.tournamentLeague.delete({
        where: { id: req.params.id },
      }),
    ]);

    await Promise.all(
      affectedUserIds.map((userId) =>
        syncPrimaryEntryAfterScopeRemoval({
          userId,
          tournamentId: league.tournamentId,
          removedScopeKey: scopeKey,
        })
      )
    );

    res.json({ message: 'League deleted successfully', tournamentId: league.tournamentId });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.get('/api/leagues/:id/leaderboard', verifyToken, async (req, res) => {
  try {
    const { league } = await ensureLeagueMembership(req.params.id, req.user);
    await ensureTournamentParticipationAccess(league.tournamentId, req.user);

    const members = await prisma.leagueMember.findMany({
      where: { leagueId: req.params.id },
      select: { userId: true },
    });

    const leaderboard = await calculateLeaderboard(league.tournamentId, {
      userIds: members.map((member) => member.userId),
      scopeKey: buildLeagueScopeKey(league.id),
    });

    res.json({
      league: await getLeagueDetails(req.params.id, req.user),
      ...leaderboard,
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post('/api/tournaments', verifyToken, checkAdmin, async (req, res) => {
  try {
    const payload = normalizeTournamentStructurePayload(req.body);
    const joinCode = await resolveTournamentJoinCode(payload.tournament);

    const createdTournament = await prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.create({
        data: {
          ...payload.tournament,
          joinCode,
          rounds: {
            create: payload.rounds.map((round) => ({
              name: round.name,
              nameEs: round.nameEs,
              order: round.order,
              pointsPerCorrect: round.pointsPerCorrect,
              matches: {
                create: round.matches,
              },
            })),
          },
        },
        select: { id: true },
      });

      await createTournamentGroupsAndTeams(tx, tournament.id, payload.groups);

      return tournament;
    });

    const tournament = await getTournamentDetails(createdTournament.id, req.user);
    res.status(201).json({ message: 'Tournament created successfully', tournament });
  } catch (error) {
    res.status(error.code === 'P2002' ? 400 : error.status || 500).json({
      error:
        error.code === 'P2002'
          ? 'That join code or tournament identifier is already in use'
          : error.message,
    });
  }
});

app.put('/api/tournaments/:id/structure', verifyToken, checkAdmin, async (req, res) => {
  try {
    const existingTournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      select: { id: true, joinCode: true },
    });

    if (!existingTournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    await ensureTournamentStructureEditable(req.params.id);

    const payload = normalizeTournamentStructurePayload(req.body);
    const joinCode = await resolveTournamentJoinCode(payload.tournament, existingTournament);

    await prisma.$transaction(async (tx) => {
      await tx.match.deleteMany({
        where: {
          round: {
            tournamentId: req.params.id,
          },
        },
      });
      await tx.round.deleteMany({
        where: { tournamentId: req.params.id },
      });
      await tx.team.deleteMany({
        where: { tournamentId: req.params.id },
      });
      await tx.group.deleteMany({
        where: { tournamentId: req.params.id },
      });

      await tx.tournament.update({
        where: { id: req.params.id },
        data: {
          ...payload.tournament,
          joinCode,
          rounds: {
            create: payload.rounds.map((round) => ({
              name: round.name,
              nameEs: round.nameEs,
              order: round.order,
              pointsPerCorrect: round.pointsPerCorrect,
              matches: {
                create: round.matches,
              },
            })),
          },
        },
      });

      await createTournamentGroupsAndTeams(tx, req.params.id, payload.groups);
    });

    const tournament = await getTournamentDetails(req.params.id, req.user);
    res.json({ message: 'Tournament structure updated successfully', tournament });
  } catch (error) {
    res.status(error.code === 'P2002' ? 400 : error.status || 500).json({
      error:
        error.code === 'P2002'
          ? 'That join code or tournament identifier is already in use'
          : error.message,
    });
  }
});

app.patch('/api/tournaments/:id/settings', verifyToken, checkAdmin, async (req, res) => {
  try {
    const existingTournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      select: { id: true, accessType: true, joinCode: true },
    });

    if (!existingTournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const updates = {};

    if (typeof req.body.prizesEnabled === 'boolean') {
      updates.prizesEnabled = req.body.prizesEnabled;
    }

    if (req.body.entryFee !== undefined) {
      const entryFee = Number(req.body.entryFee);
      if (Number.isNaN(entryFee) || entryFee < 0) {
        return res.status(400).json({ error: 'Entry fee must be a non-negative number' });
      }
      updates.entryFee = entryFee;
    }

    if (req.body.currency !== undefined) {
      const currency = String(req.body.currency || '').trim().toUpperCase();
      if (!currency) {
        return res.status(400).json({ error: 'Currency is required' });
      }
      updates.currency = currency;
    }

    const requestedAccessType =
      req.body.accessType !== undefined
        ? String(req.body.accessType).trim().toLowerCase()
        : normalizeAccessType(existingTournament.accessType);

    if (!isValidAccessType(requestedAccessType)) {
      return res.status(400).json({ error: 'Access type must be public or private' });
    }

    if (req.body.accessType !== undefined) {
      updates.accessType = requestedAccessType;
    }

    if (requestedAccessType === 'private') {
      const requestedJoinCode =
        req.body.joinCode !== undefined ? normalizeJoinCode(req.body.joinCode) : '';

      if (requestedJoinCode) {
        if (requestedJoinCode.length < 4) {
          return res.status(400).json({ error: 'Join code must be at least 4 characters' });
        }
        updates.joinCode = requestedJoinCode;
      } else if (req.body.regenerateJoinCode || !existingTournament.joinCode) {
        updates.joinCode = await generateUniqueJoinCode();
      }
    } else if (requestedAccessType === 'public') {
      updates.joinCode = null;
    }

    await prisma.tournament.update({
      where: { id: req.params.id },
      data: updates,
    });

    const tournament = await getTournamentDetails(req.params.id, req.user);
    res.json({ message: 'Tournament settings updated', tournament });
  } catch (error) {
    res.status(error.code === 'P2002' ? 400 : 500).json({
      error: error.code === 'P2002' ? 'That join code is already in use' : error.message,
    });
  }
});

app.post('/api/tournaments/:id/results/groups', verifyToken, checkAdmin, async (req, res) => {
  try {
    const rounds = await prisma.round.findMany({
      where: { tournamentId: req.params.id },
      include: { matches: true },
    });
    const requiresThirdPlaceSelections = hasBestThirdPlaceSlots(rounds);
    const results = parseGroupPredictionEntries(req.body.results);

    for (const result of results) {
      if (!result.groupId || !result.first || !result.second) {
        return res.status(400).json({ error: 'Incomplete group result payload' });
      }

      if (requiresThirdPlaceSelections && !result.third) {
        return res.status(400).json({ error: 'Third-place results are required for this tournament' });
      }

      const selectedTeams = [result.first, result.second, result.third].filter(Boolean);
      if (new Set(selectedTeams).size !== selectedTeams.length) {
        return res.status(400).json({ error: 'Group results must contain different teams' });
      }
    }

    await prisma.$transaction(
      results.map((result) =>
        prisma.groupResult.upsert({
          where: {
            tournamentId_groupId: {
              tournamentId: req.params.id,
              groupId: result.groupId,
            },
          },
          update: {
            first: result.first,
            second: result.second,
            third: result.third || null,
          },
          create: {
            tournamentId: req.params.id,
            groupId: result.groupId,
            first: result.first,
            second: result.second,
            third: result.third || null,
          },
        })
      )
    );

    await persistTournamentScores(req.params.id);

    res.json({ message: 'Group results saved successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tournaments/:id/results/knockout', verifyToken, checkAdmin, async (req, res) => {
  try {
    const results = parseKnockoutPredictionEntries(req.body.results);

    if (!validateUniqueBestThirdSelections(results)) {
      return res.status(400).json({ error: 'Each third-place team can only be used once in the Round of 32' });
    }

    for (const result of results) {
      if (!result.matchId || !result.predictedWinner) {
        return res.status(400).json({ error: 'Incomplete knockout result payload' });
      }
    }

    await prisma.$transaction(
      results.map((result) =>
        prisma.match.update({
          where: { id: result.matchId },
          data: {
            selectedHomeTeamId: result.selectedHomeTeamId || null,
            selectedAwayTeamId: result.selectedAwayTeamId || null,
            winner: result.predictedWinner,
            status: 'finished',
          },
        })
      )
    );

    await persistTournamentScores(req.params.id);

    res.json({ message: 'Knockout results saved successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tournaments/:id/calculate-scores', verifyToken, checkAdmin, async (req, res) => {
  try {
    const result = await persistTournamentScores(req.params.id);
    res.json({ message: 'Scores calculated and stored', ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tournaments/:id/leaderboard', optionalAuth, async (req, res) => {
  try {
    await ensureTournamentParticipationAccess(req.params.id, req.user);
    const leaderboard = await calculateLeaderboard(req.params.id);
    res.json(leaderboard);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.get('/api/leaderboard/global', verifyToken, async (req, res) => {
  try {
    const leaderboard = await calculateGlobalLeaderboard();
    const currentUserIndex = leaderboard.players.findIndex((player) => player.userId === req.user.id);

    res.json({
      ...leaderboard,
      currentUser: {
        isVisible: req.user.showInGlobalRankings !== false,
        rank: currentUserIndex >= 0 ? currentUserIndex + 1 : null,
      },
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.get('/api/leaderboard/:tournamentId', optionalAuth, async (req, res) => {
  try {
    await ensureTournamentParticipationAccess(req.params.tournamentId, req.user);
    const leaderboard = await calculateLeaderboard(req.params.tournamentId);
    res.json(leaderboard.players);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = app;
