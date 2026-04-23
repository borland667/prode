import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { get, post } from '../utils/api';
import {
  buildTeamMap,
  getLocalizedName,
  getKnockoutRounds,
  getModeLabel,
  getRoundLabel,
  getSportLabel,
  resolveMatchParticipants,
  sortGroups,
} from '../utils/tournament';

export default function Tournament() {
  const { id } = useParams();
  const { language, t, formatDate, formatNumber, formatCurrency } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [hasPredictions, setHasPredictions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [creatingLeague, setCreatingLeague] = useState(false);
  const [joiningLeague, setJoiningLeague] = useState(false);
  const [leagueName, setLeagueName] = useState('');
  const [leagueDescription, setLeagueDescription] = useState('');
  const [leagueJoinCode, setLeagueJoinCode] = useState('');
  const [primaryEntry, setPrimaryEntry] = useState(null);
  const [pageError, setPageError] = useState('');
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const tournamentData = await get(`/tournaments/${id}`);
        let predictionsData = null;
        let leagueData = [];
        let primaryEntryData = null;

        if (user && tournamentData?.access?.canViewPredictions) {
          [predictionsData, leagueData, primaryEntryData] = await Promise.all([
            get(`/tournaments/${id}/my-predictions`),
            get(`/tournaments/${id}/leagues`).catch(() => []),
            get(`/tournaments/${id}/primary-entry`).catch(() => null),
          ]);
        }

        setTournament(tournamentData);
        setLeagues(leagueData || []);
        setPrimaryEntry(primaryEntryData);
        setHasPredictions(
          Boolean(
            predictionsData?.groupPredictions?.length || predictionsData?.knockoutPredictions?.length
          )
        );
      } catch (err) {
        setPageError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, user]);

  const handleJoinTournament = async () => {
    if (!joinCode.trim()) {
      setFormError(t('tournament.joinHelp'));
      return;
    }

    setJoining(true);
    setFormError('');
    setSuccess('');

    try {
      const response = await post(`/tournaments/${id}/join`, {
        joinCode,
      });
      setTournament(response?.tournament || tournament);
      if (response?.tournament?.access?.canViewPredictions) {
        await refreshLeagues();
      }
      setSuccess(t('tournament.joined'));
      setJoinCode('');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setJoining(false);
    }
  };

  const refreshLeagues = async () => {
    const [leagueData, primaryEntryData] = await Promise.all([
      get(`/tournaments/${id}/leagues`),
      get(`/tournaments/${id}/primary-entry`).catch(() => null),
    ]);
    setLeagues(leagueData || []);
    setPrimaryEntry(primaryEntryData);
  };

  const handleCreateLeague = async () => {
    if (!leagueName.trim()) {
      setFormError(t('tournament.leagueNameRequired'));
      return;
    }

    setCreatingLeague(true);
    setFormError('');
    setSuccess('');

    try {
      await post(`/tournaments/${id}/leagues`, {
        name: leagueName,
        description: leagueDescription,
      });
      await refreshLeagues();
      setLeagueName('');
      setLeagueDescription('');
      setSuccess(t('tournament.leagueCreated'));
    } catch (err) {
      setFormError(err.message);
    } finally {
      setCreatingLeague(false);
    }
  };

  const handleJoinLeague = async () => {
    if (!leagueJoinCode.trim()) {
      setFormError(t('tournament.joinLeagueHelp'));
      return;
    }

    setJoiningLeague(true);
    setFormError('');
    setSuccess('');

    try {
      await post(`/tournaments/${id}/leagues/join`, {
        joinCode: leagueJoinCode,
      });
      await refreshLeagues();
      setLeagueJoinCode('');
      setSuccess(t('tournament.joinedLeague'));
    } catch (err) {
      setFormError(err.message);
    } finally {
      setJoiningLeague(false);
    }
  };

  const handleSetPrimaryEntry = async (scopeKey, option) => {
    if (!option?.hasPredictions) {
      setFormError(t('tournament.primaryEntryNeedsPredictions'));
      return;
    }

    setFormError('');
    setSuccess('');

    try {
      const response = await post(`/tournaments/${id}/primary-entry`, { scopeKey });
      setPrimaryEntry(response?.primaryEntry || primaryEntry);
      setSuccess(t('tournament.primaryEntrySaved'));
    } catch (err) {
      setFormError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="sport-shell min-h-screen flex items-center justify-center">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="sport-shell min-h-screen flex items-center justify-center px-4">
        <div className="sport-panel app-empty max-w-2xl w-full">
          <p className="text-red-400">{pageError}</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="sport-shell min-h-screen flex items-center justify-center">
        <p className="text-gray-400">{t('common.noResults')}</p>
      </div>
    );
  }

  const closingDate = tournament.closingDate ? new Date(tournament.closingDate) : null;
  const now = new Date();
  const timeRemaining = closingDate ? closingDate - now : 0;
  const daysRemaining = Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60 * 24)));
  const hoursRemaining = Math.max(
    0,
    Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  );
  const groups = sortGroups(tournament.groups || []);
  const rounds = getKnockoutRounds(tournament.rounds || []);
  const teamMap = buildTeamMap(groups);
  const canSubmitPredictions = Boolean(user && tournament.access?.canSubmitPredictions);
  const canManageLeagues = Boolean(user && tournament.access?.canViewPredictions);
  const isPrivate = Boolean(tournament.access?.isPrivate);
  const isMember = Boolean(tournament.access?.isMember);
  const predictionsLocked = Boolean(tournament.access?.predictionsLocked);
  const canChangePrimaryEntry = Boolean(primaryEntry?.canChange);
  const showPrizeInfo = Boolean(tournament.prizesEnabled && tournament.entryFee);
  const currentPrimaryOption = primaryEntry?.options?.find((option) => option.isPrimary) || null;
  const tournamentPrimaryOption =
    primaryEntry?.options?.find((option) => option.scopeKey === 'tournament') || null;
  const actualGroupSelections = Object.fromEntries(
    groups
      .filter((group) => group.result)
      .map((group) => [
        group.id,
        {
          first: group.result.first,
          second: group.result.second,
          third: group.result.third || '',
        },
      ])
  );
  const actualKnockoutSelections = Object.fromEntries(
    rounds.flatMap((round) =>
      (round.matches || []).map((match) => [match.id, match.winner || ''])
    )
  );
  const statusLabel = t(`tournament.${tournament.status}`) !== `tournament.${tournament.status}`
    ? t(`tournament.${tournament.status}`)
    : tournament.status;

  return (
    <div className="sport-shell min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-12">
          <div className="score-pill mb-5 text-emerald-200">
            {getSportLabel(tournament.sport, language)}
          </div>
          <h1 className="sport-display text-5xl md:text-6xl text-white mb-6">
            {getLocalizedName(tournament, language, tournament.name)}
          </h1>

          <div className="grid md:grid-cols-6 gap-6 mb-8">
            <div className="sport-panel rounded-[1.6rem] p-6">
              <p className="text-gray-400 text-sm mb-2">
                {t('tournament.mode')}
              </p>
              <p className="text-white font-semibold text-lg">
                {getModeLabel(tournament.mode, language)}
              </p>
            </div>

            <div className="sport-panel rounded-[1.6rem] p-6">
              <p className="text-gray-400 text-sm mb-2">
                {t('tournament.access')}
              </p>
              <p className="text-white font-semibold text-lg">
                {isPrivate ? t('tournament.privateAccess') : t('tournament.publicAccess')}
              </p>
            </div>

            <div className="sport-panel rounded-[1.6rem] p-6">
              <p className="text-gray-400 text-sm mb-2">
                {t('tournament.status')}
              </p>
              <p className="text-white font-semibold text-lg capitalize">
                {statusLabel}
              </p>
            </div>

            <div className="sport-panel rounded-[1.6rem] p-6">
              <p className="text-gray-400 text-sm mb-2">
                {t('tournament.closingDate')}
              </p>
              <p className="text-white font-semibold text-lg">
                {closingDate ? formatDate(closingDate) : 'TBD'}
              </p>
            </div>

            <div className="sport-panel rounded-[1.6rem] p-6">
              <p className="text-gray-400 text-sm mb-2">
                {isPrivate ? t('tournament.members') : t('tournament.participants')}
              </p>
              <p className="text-white font-semibold text-lg">
                {formatNumber(isPrivate ? tournament.memberCount || 0 : tournament.participantCount || 0)}
              </p>
            </div>

            <div className="sport-panel rounded-[1.6rem] p-6">
              <p className="text-gray-400 text-sm mb-2">
                {t('tournament.prizes')}
              </p>
              <p className="text-white font-semibold text-lg">
                {tournament.prizesEnabled ? t('tournament.prizesOn') : t('tournament.prizesOff')}
              </p>
              {showPrizeInfo ? (
                <p className="text-gray-400 text-sm mt-2">
                  {formatCurrency(tournament.entryFee, tournament.currency, {
                    maximumFractionDigits: 0,
                  })}
                </p>
              ) : null}
            </div>

            <div className="sport-panel rounded-[1.6rem] p-6">
              <p className="text-gray-400 text-sm mb-2">
                {t('tournament.predictionWindow')}
              </p>
              <p className="text-white font-semibold text-lg">
                {predictionsLocked ? t('tournament.closedNow') : t('tournament.openNow')}
              </p>
            </div>

            <div className="sport-panel rounded-[1.6rem] p-6">
              <p className="text-gray-400 text-sm mb-2 flex items-center gap-2">
                <Clock size={16} />
                {t('home.tournamentEndsIn')}
              </p>
              <p className="text-white font-semibold text-lg">
                {formatNumber(daysRemaining)}d {formatNumber(hoursRemaining)}h
              </p>
            </div>
          </div>

          {success ? (
            <div className="app-alert app-alert-success mb-8">
              {success}
            </div>
          ) : null}

        {formError ? (
          <div className="app-alert app-alert-error mb-8">
            {formError}
          </div>
        ) : null}

        {user && tournament.access?.canViewPredictions ? (
          <div className="sport-panel-strong app-card-strong mb-8">
            <h2 className="app-section-title">
              {t('tournament.primaryEntry')}
            </h2>
            <p className="app-section-copy mb-5">
              {t('tournament.primaryEntryHelp')}
            </p>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-gray-500 mb-2">
                  {t('tournament.currentPrimaryEntry')}
                </p>
                <p className="text-white font-semibold text-xl">
                  {currentPrimaryOption?.type === 'league'
                    ? currentPrimaryOption.label
                    : t('tournament.primaryEntryTournament')}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleSetPrimaryEntry('tournament', tournamentPrimaryOption)}
                  disabled={
                    !tournamentPrimaryOption?.hasPredictions ||
                    !canChangePrimaryEntry ||
                    currentPrimaryOption?.scopeKey === 'tournament'
                  }
                  className="app-button-secondary sm:w-auto"
                >
                  {currentPrimaryOption?.scopeKey === 'tournament'
                    ? t('tournament.currentPrimaryEntry')
                    : t('tournament.setPrimaryEntry')}
                </button>
              </div>
            </div>
            {!canChangePrimaryEntry ? (
              <p className="text-amber-300 text-sm mt-4">
                {t('tournament.primaryEntryLocked')}
              </p>
            ) : null}
          </div>
        ) : null}

        {isPrivate && !isMember ? (
            <div className="sport-panel-strong rounded-[1.75rem] border border-amber-500/60 p-6 mb-8">
              <h2 className="text-2xl font-bold text-white mb-3">
                {t('tournament.joinTournament')}
              </h2>
              <p className="text-amber-200 mb-2">
                {t('tournament.privateNotice')}
              </p>
              <p className="text-gray-300 mb-6">
                {user ? t('tournament.joinToPredict') : t('tournament.signInToJoin')}
              </p>

              {predictionsLocked ? (
                <p className="text-white font-semibold">
                  {t('tournament.joinClosed')}
                </p>
              ) : user ? (
                <div className="flex flex-col sm:flex-row gap-4">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                    placeholder={t('tournament.joinCode')}
                    className="app-input flex-1"
                  />
                  <button
                    onClick={handleJoinTournament}
                    disabled={joining}
                    className="sport-button px-6 py-3 text-slate-950 rounded-full font-bold hover:scale-[1.02] disabled:opacity-50 transition"
                  >
                    {joining ? t('tournament.joining') : t('tournament.joinNow')}
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="sport-button inline-flex px-6 py-3 text-slate-950 rounded-full font-bold hover:scale-[1.02] transition"
                >
                  {t('auth.login')}
                </Link>
              )}

              <p className="text-gray-400 text-sm mt-4">
                {predictionsLocked ? t('tournament.predictionsClosedHelp') : t('tournament.joinHelp')}
              </p>
            </div>
          ) : null}

          {canSubmitPredictions ? (
            <div className="flex gap-4">
              <button
                onClick={() => navigate(`/tournament/${id}/predict`)}
                className="sport-button px-6 py-3 text-slate-950 rounded-full font-bold hover:scale-[1.02] transition"
              >
                {hasPredictions ? t('predict.makePredictions') : t('home.enterPredictions')}
              </button>

              {hasPredictions && (
                <Link
                  to={`/leaderboard/${id}`}
                  className="sport-button-secondary px-6 py-3 text-emerald-300 rounded-full font-bold hover:bg-white/5 transition"
                >
                  {t('home.viewLeaderboard')}
                </Link>
              )}
            </div>
          ) : user && isMember && predictionsLocked ? (
            <div className="sport-panel rounded-[1.75rem] border border-amber-500/30 p-6">
              <h2 className="text-2xl font-bold text-white mb-3">
                {t('tournament.predictionsClosed')}
              </h2>
              <p className="text-gray-300 mb-5">
                {t('tournament.predictionsClosedHelp')}
              </p>
              <div className="flex flex-wrap gap-4">
                {hasPredictions ? (
                  <Link
                    to={`/leaderboard/${id}`}
                    className="sport-button-secondary px-6 py-3 text-emerald-300 rounded-full font-bold hover:bg-white/5 transition"
                  >
                    {t('home.viewLeaderboard')}
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {canManageLeagues ? (
          <div className="mb-12">
            <h2 className="sport-display text-4xl text-white mb-8">
              {t('tournament.leagues')}
            </h2>

            <div className="grid lg:grid-cols-2 gap-8 mb-8">
              <div className="sport-panel rounded-[1.75rem] p-6">
                <h3 className="sport-display text-2xl text-white mb-3">
                  {t('tournament.createLeague')}
                </h3>
                <p className="text-gray-400 mb-6">
                  {t('tournament.createLeagueHelp')}
                </p>
                <div className="space-y-4">
                  <input
                    type="text"
                    value={leagueName}
                    onChange={(event) => setLeagueName(event.target.value)}
                    placeholder={t('tournament.leagueName')}
                    className="app-input"
                  />
                  <textarea
                    value={leagueDescription}
                    onChange={(event) => setLeagueDescription(event.target.value)}
                    placeholder={t('tournament.leagueDescription')}
                    rows={3}
                    className="app-textarea"
                  />
                  <button
                    onClick={handleCreateLeague}
                    disabled={creatingLeague}
                    className="sport-button px-6 py-3 text-slate-950 rounded-full font-bold hover:scale-[1.02] disabled:opacity-50 transition"
                  >
                    {creatingLeague ? t('tournament.creatingLeague') : t('tournament.createLeagueNow')}
                  </button>
                </div>
              </div>

              <div className="sport-panel rounded-[1.75rem] p-6">
                <h3 className="sport-display text-2xl text-white mb-3">
                  {t('tournament.joinLeague')}
                </h3>
                <p className="text-gray-400 mb-6">
                  {t('tournament.joinLeagueHelp')}
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <input
                    type="text"
                    value={leagueJoinCode}
                    onChange={(event) => setLeagueJoinCode(event.target.value.toUpperCase())}
                    placeholder={t('tournament.joinCode')}
                    className="app-input flex-1"
                  />
                  <button
                    onClick={handleJoinLeague}
                    disabled={joiningLeague}
                    className="sport-button px-6 py-3 text-slate-950 rounded-full font-bold hover:scale-[1.02] disabled:opacity-50 transition"
                  >
                    {joiningLeague ? t('tournament.joining') : t('tournament.joinLeagueNow')}
                  </button>
                </div>
              </div>
            </div>

            <div className="sport-panel rounded-[1.75rem] p-6">
              <h3 className="sport-display text-2xl text-white mb-6">
                {t('tournament.yourLeagues')}
              </h3>
              {leagues.length === 0 ? (
                <p className="text-gray-400">{t('tournament.noLeaguesYet')}</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {leagues.map((league) => (
                    <div
                      key={league.id}
                      className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-5"
                    >
                      <h4 className="sport-display text-xl text-white mb-2">{league.name}</h4>
                      {league.description ? (
                        <p className="text-gray-400 mb-4">{league.description}</p>
                      ) : null}
                      <div className="space-y-2 text-sm text-gray-300 mb-5">
                        <p>
                          {t('tournament.leagueMembers')}: {formatNumber(league.memberCount || 0)}
                        </p>
                        <p>
                          {t('tournament.joinCode')}: <span className="tracking-[0.2em]">{league.joinCode}</span>
                        </p>
                        {currentPrimaryOption?.scopeKey === `league:${league.id}` ? (
                          <p className="text-emerald-300">
                            {t('tournament.currentPrimaryEntry')}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Link
                          to={`/league/${league.id}`}
                          className="sport-button-secondary inline-flex px-4 py-2 rounded-full text-emerald-300 font-bold hover:bg-white/5 transition"
                        >
                          {t('tournament.openLeague')}
                        </Link>
                        {canSubmitPredictions ? (
                          <Link
                            to={`/league/${league.id}/predict`}
                            className="sport-button inline-flex px-4 py-2 rounded-full text-slate-950 font-bold transition"
                          >
                            {t('tournament.openLeaguePredictions')}
                          </Link>
                        ) : null}
                        {primaryEntry?.options?.find((option) => option.scopeKey === `league:${league.id}`)?.hasPredictions ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleSetPrimaryEntry(
                                `league:${league.id}`,
                                primaryEntry?.options?.find((option) => option.scopeKey === `league:${league.id}`)
                              )
                            }
                            disabled={
                              !canChangePrimaryEntry ||
                              currentPrimaryOption?.scopeKey === `league:${league.id}`
                            }
                            className="app-button-secondary sm:w-auto"
                          >
                            {currentPrimaryOption?.scopeKey === `league:${league.id}`
                              ? t('tournament.currentPrimaryEntry')
                              : t('tournament.setPrimaryEntry')}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="mb-12">
            <h2 className="sport-display text-4xl text-white mb-8">
            {t('tournament.groups')}
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <div
                key={group.id}
                className="sport-panel sport-pitch rounded-[1.75rem] p-6"
              >
                <div className="score-pill mb-4 text-emerald-200">
                  {group.name}
                </div>
                <h3 className="sport-display text-2xl text-white mb-4">
                  {group.name}
                </h3>

                <div className="space-y-2">
                  {group.teams?.length ? (
                    getGroupDisplayTeams(group, actualGroupSelections, teamMap).map((team, index) => (
                      <div
                        key={team.id}
                        className="flex items-center justify-between p-3 bg-slate-950/70 rounded-2xl border border-white/8"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 font-semibold w-6">
                            {formatNumber(index + 1)}.
                          </span>
                          <span className="text-white">{getLocalizedName(team, language, team.name)}</span>
                        </div>
                        <span className="text-gray-400 text-sm">
                          {group.result && index < 3 ? positionLabel(index) : team.code || ''}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400">{t('common.noResults')}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {rounds.length ? (
          <div className="mb-12">
            <h2 className="sport-display text-4xl text-white mb-8">
              {t('tournament.knockoutBracket')}
            </h2>

            <div className="space-y-8">
              {rounds.map((round) => (
                <div key={round.id} className="sport-panel rounded-[1.75rem] p-6">
                  <h3 className="sport-display text-2xl text-white mb-6">
                    {getRoundLabel(round, t)}
                  </h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    {(round.matches || []).map((match) => {
                      const matchup = resolveMatchParticipants({
                        match,
                        groups,
                        rounds,
                        groupSelections: actualGroupSelections,
                        knockoutSelections: actualKnockoutSelections,
                        slotSelections: {
                          [match.homeLabel]: match.selectedHomeTeamId || '',
                          [match.awayLabel]: match.selectedAwayTeamId || '',
                        },
                        teamMap,
                      });

                      return (
                        <div
                          key={match.id}
                          className="rounded-[1.5rem] border border-white/8 bg-slate-950/60 p-5"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <span className="score-pill text-emerald-200">{match.code}</span>
                            <span className="text-sm text-gray-400 capitalize">
                              {match.status}
                            </span>
                          </div>

                          <div className="space-y-3 mb-4">
                            <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${match.winner === matchup.home.teamId ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/8 bg-white/[0.02]'}`}>
                              <span className="text-white">
                                {matchup.home.teamName || matchup.home.slotLabel || match.homeLabel}
                              </span>
                              {match.winner === matchup.home.teamId ? (
                                <span className="text-emerald-300 font-semibold">
                                  {t('tournament.winner')}
                                </span>
                              ) : null}
                            </div>
                            <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${match.winner === matchup.away.teamId ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/8 bg-white/[0.02]'}`}>
                              <span className="text-white">
                                {matchup.away.teamName || matchup.away.slotLabel || match.awayLabel}
                              </span>
                              {match.winner === matchup.away.teamId ? (
                                <span className="text-emerald-300 font-semibold">
                                  {t('tournament.winner')}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {canSubmitPredictions && !hasPredictions && (
          <div className="sport-panel-strong rounded-[2rem] p-12 text-center">
            <h3 className="sport-display text-4xl text-white mb-4">
              {t('tournament.makeYourPredictions')}
            </h3>
            <p className="text-emerald-200 mb-8 text-lg">
              {t('tournament.noPredictionsYet')}
            </p>
            <button
              onClick={() => navigate(`/tournament/${id}/predict`)}
              className="sport-button px-8 py-4 text-slate-950 rounded-full font-bold hover:scale-[1.02] transition"
            >
              {t('tournament.startPredicting')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function getGroupDisplayTeams(group, groupSelections, teamMap) {
  if (!group.result) {
    return group.teams || [];
  }

  const orderedTeamIds = [
    groupSelections[group.id]?.first,
    groupSelections[group.id]?.second,
    groupSelections[group.id]?.third,
  ].filter(Boolean);
  const orderedTeams = orderedTeamIds
    .map((teamId) => teamMap[teamId])
    .filter(Boolean);
  const remainingTeams = (group.teams || []).filter(
    (team) => !orderedTeamIds.includes(team.id)
  );

  return [...orderedTeams, ...remainingTeams];
}

function positionLabel(index) {
  if (index === 0) {
    return '#1';
  }
  if (index === 1) {
    return '#2';
  }
  if (index === 2) {
    return '#3';
  }
  return '';
}
