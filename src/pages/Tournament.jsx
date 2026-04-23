import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { get, post } from '../utils/api';
import { Button, DisplayText, PageShell, Panel, Pill } from '../components/ui/DesignSystem';
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
      <div className="ds-shell min-h-screen flex items-center justify-center">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="ds-shell min-h-screen flex items-center justify-center px-4">
        <Panel className="app-empty max-w-2xl w-full">
          <p className="text-red-400">{pageError}</p>
        </Panel>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="ds-shell min-h-screen flex items-center justify-center">
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
  const tournamentCountLabel = isPrivate ? t('tournament.members') : t('tournament.participants');
  const participantTotal = formatNumber(isPrivate ? tournament.memberCount || 0 : tournament.participantCount || 0);

  return (
    <div className="ds-shell min-h-screen">
      <PageShell className="tournament-page">
        <div className="tournament-hero">
          <div className="tournament-hero__header">
            <Pill className="text-emerald-200">
            {getSportLabel(tournament.sport, language)}
            </Pill>
            <DisplayText as="h1" className="tournament-hero__title text-white">
            {getLocalizedName(tournament, language, tournament.name)}
            </DisplayText>
          </div>

          <div className="tournament-summary-grid">
            <TournamentStatCard
              label={t('tournament.mode')}
              value={getModeLabel(tournament.mode, language)}
            />
            <TournamentStatCard
              label={t('tournament.access')}
              value={isPrivate ? t('tournament.privateAccess') : t('tournament.publicAccess')}
            />
            <TournamentStatCard
              label={t('tournament.status')}
              value={statusLabel}
              valueClassName="capitalize"
            />
            <TournamentStatCard
              label={t('tournament.closingDate')}
              value={closingDate ? formatDate(closingDate) : 'TBD'}
            />
            <TournamentStatCard
              label={tournamentCountLabel}
              value={participantTotal}
            />
            <TournamentStatCard
              label={t('tournament.prizes')}
              value={tournament.prizesEnabled ? t('tournament.prizesOn') : t('tournament.prizesOff')}
              detail={
                showPrizeInfo
                  ? formatCurrency(tournament.entryFee, tournament.currency, {
                      maximumFractionDigits: 0,
                    })
                  : ''
              }
            />
            <TournamentStatCard
              label={t('tournament.predictionWindow')}
              value={predictionsLocked ? t('tournament.closedNow') : t('tournament.openNow')}
            />
            <TournamentStatCard
              label={t('home.tournamentEndsIn')}
              value={`${formatNumber(daysRemaining)}d ${formatNumber(hoursRemaining)}h`}
              icon={<Clock size={16} />}
            />
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
          <Panel variant="strong" padding="normal" radius="2xl" className="tournament-section">
            <DisplayText as="h2" className="app-section-title">
              {t('tournament.primaryEntry')}
            </DisplayText>
            <p className="app-section-copy mb-5">
              {t('tournament.primaryEntryHelp')}
            </p>
            <div className="tournament-primary-card__row">
              <div className="tournament-primary-card__content">
                <p className="mb-2 text-sm uppercase tracking-overline text-gray-500">
                  {t('tournament.currentPrimaryEntry')}
                </p>
                <p className="text-white font-semibold text-xl">
                  {currentPrimaryOption?.type === 'league'
                    ? currentPrimaryOption.label
                    : t('tournament.primaryEntryTournament')}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => handleSetPrimaryEntry('tournament', tournamentPrimaryOption)}
                  disabled={
                    !tournamentPrimaryOption?.hasPredictions ||
                    !canChangePrimaryEntry ||
                    currentPrimaryOption?.scopeKey === 'tournament'
                  }
                  variant="secondary"
                  className="tournament-cta-button"
                >
                  {currentPrimaryOption?.scopeKey === 'tournament'
                    ? t('tournament.currentPrimaryEntry')
                    : t('tournament.setPrimaryEntry')}
                </Button>
              </div>
            </div>
            {!canChangePrimaryEntry ? (
              <p className="text-amber-300 text-sm mt-4">
                {t('tournament.primaryEntryLocked')}
              </p>
            ) : null}
          </Panel>
        ) : null}

        {isPrivate && !isMember ? (
            <Panel variant="strong" padding="normal" radius="xl" className="tournament-section border border-amber-500/60">
              <DisplayText as="h2" className="text-2xl text-white">
                {t('tournament.joinTournament')}
              </DisplayText>
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
                <div className="tournament-inline-form">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                    placeholder={t('tournament.joinCode')}
                    className="app-input"
                  />
                  <Button
                    onClick={handleJoinTournament}
                    disabled={joining}
                    className="tournament-inline-submit"
                  >
                    {joining ? t('tournament.joining') : t('tournament.joinNow')}
                  </Button>
                </div>
              ) : (
                <Button
                  as={Link}
                  to="/login"
                  className="tournament-cta-button"
                >
                  {t('auth.login')}
                </Button>
              )}

              <p className="text-gray-400 text-sm mt-4">
                {predictionsLocked ? t('tournament.predictionsClosedHelp') : t('tournament.joinHelp')}
              </p>
            </Panel>
          ) : null}

          {canSubmitPredictions ? (
            <div className="tournament-action-row">
              <Button
                onClick={() => navigate(`/tournament/${id}/predict`)}
                className="tournament-cta-button"
              >
                {hasPredictions ? t('predict.makePredictions') : t('home.enterPredictions')}
              </Button>

              {hasPredictions && (
                <Button
                  as={Link}
                  to={`/leaderboard/${id}`}
                  variant="secondary"
                  className="tournament-cta-button"
                >
                  {t('home.viewLeaderboard')}
                </Button>
              )}
            </div>
          ) : user && isMember && predictionsLocked ? (
            <Panel padding="normal" radius="xl" className="tournament-section border border-amber-500/30">
              <DisplayText as="h2" className="text-2xl text-white">
                {t('tournament.predictionsClosed')}
              </DisplayText>
              <p className="text-gray-300 mb-5">
                {t('tournament.predictionsClosedHelp')}
              </p>
              <div className="flex flex-wrap gap-4">
                {hasPredictions ? (
                  <Button
                    as={Link}
                    to={`/leaderboard/${id}`}
                    variant="secondary"
                    className="tournament-cta-button"
                  >
                    {t('home.viewLeaderboard')}
                  </Button>
                ) : null}
              </div>
            </Panel>
          ) : null}
        </div>

        {canManageLeagues ? (
          <section className="tournament-section">
            <DisplayText as="h2" className="text-4xl text-white">
              {t('tournament.leagues')}
            </DisplayText>

            <div className="tournament-league-grid">
              <Panel padding="normal" radius="xl" className="tournament-section">
                <DisplayText as="h3" className="text-2xl text-white">
                  {t('tournament.createLeague')}
                </DisplayText>
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
                  <Button
                    onClick={handleCreateLeague}
                    disabled={creatingLeague}
                    className="tournament-submit-button"
                  >
                    {creatingLeague ? t('tournament.creatingLeague') : t('tournament.createLeagueNow')}
                  </Button>
                </div>
              </Panel>

              <Panel padding="normal" radius="xl" className="tournament-section">
                <DisplayText as="h3" className="text-2xl text-white">
                  {t('tournament.joinLeague')}
                </DisplayText>
                <p className="text-gray-400 mb-6">
                  {t('tournament.joinLeagueHelp')}
                </p>
                <div className="tournament-inline-form">
                  <input
                    type="text"
                    value={leagueJoinCode}
                    onChange={(event) => setLeagueJoinCode(event.target.value.toUpperCase())}
                    placeholder={t('tournament.joinCode')}
                    className="app-input"
                  />
                  <Button
                    onClick={handleJoinLeague}
                    disabled={joiningLeague}
                    className="tournament-inline-submit"
                  >
                    {joiningLeague ? t('tournament.joining') : t('tournament.joinLeagueNow')}
                  </Button>
                </div>
              </Panel>
            </div>

            <Panel padding="normal" radius="xl" className="tournament-section">
              <DisplayText as="h3" className="text-2xl text-white">
                {t('tournament.yourLeagues')}
              </DisplayText>
              {leagues.length === 0 ? (
                <p className="text-gray-400">{t('tournament.noLeaguesYet')}</p>
              ) : (
                <div className="tournament-owned-leagues">
                  {leagues.map((league) => (
                    <Panel
                      key={league.id}
                      radius="md"
                      className="tournament-league-card"
                    >
                      <DisplayText as="h4" className="text-xl text-white mb-2">{league.name}</DisplayText>
                      {league.description ? (
                        <p className="text-gray-400 mb-4">{league.description}</p>
                      ) : null}
                      <div className="space-y-2 text-sm text-gray-300 mb-5">
                        <p>
                          {t('tournament.leagueMembers')}: {formatNumber(league.memberCount || 0)}
                        </p>
                        <p>
                          {t('tournament.joinCode')}: <span className="tracking-overline-wide">{league.joinCode}</span>
                        </p>
                        {currentPrimaryOption?.scopeKey === `league:${league.id}` ? (
                          <p className="text-emerald-300">
                            {t('tournament.currentPrimaryEntry')}
                          </p>
                        ) : null}
                      </div>
                      <div className="tournament-card-actions">
                        <Button
                          as={Link}
                          to={`/league/${league.id}`}
                          variant="secondary"
                          className="tournament-cta-button"
                        >
                          {t('tournament.openLeague')}
                        </Button>
                        {canSubmitPredictions ? (
                          <Button
                            as={Link}
                            to={`/league/${league.id}/predict`}
                            className="tournament-cta-button"
                          >
                            {t('tournament.openLeaguePredictions')}
                          </Button>
                        ) : null}
                        {primaryEntry?.options?.find((option) => option.scopeKey === `league:${league.id}`)?.hasPredictions ? (
                          <Button
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
                            variant="secondary"
                            className="tournament-cta-button"
                          >
                            {currentPrimaryOption?.scopeKey === `league:${league.id}`
                              ? t('tournament.currentPrimaryEntry')
                              : t('tournament.setPrimaryEntry')}
                          </Button>
                        ) : null}
                      </div>
                    </Panel>
                  ))}
                </div>
              )}
            </Panel>
          </section>
        ) : null}

        <section className="tournament-section">
          <div className="tournament-section__header">
            <DisplayText as="h2" className="text-4xl text-white">
              {t('tournament.groups')}
            </DisplayText>
          </div>

          <div className="tournament-groups-grid">
            {groups.map((group) => (
              <Panel
                key={group.id}
                padding="normal"
                radius="xl"
                className="tournament-group-card"
              >
                <div className="tournament-group-card__header">
                  <Pill className="text-emerald-200">
                    {group.name}
                  </Pill>
                  <span className="tournament-group-card__count">
                    {formatNumber(group.teams?.length || 0)}
                  </span>
                </div>

                <div className="tournament-group-list">
                  {group.teams?.length ? (
                    getGroupDisplayTeams(group, actualGroupSelections, teamMap).map((team, index) => (
                      <div
                        key={team.id}
                        className="tournament-group-row"
                      >
                        <div className="tournament-group-row__main">
                          <span className="tournament-group-row__rank">
                            {formatNumber(index + 1)}
                          </span>
                          <span className="tournament-group-row__name">
                            {getLocalizedName(team, language, team.name)}
                          </span>
                        </div>
                        <span className="tournament-group-row__meta">
                          {group.result && index < 3 ? positionLabel(index) : team.code || ''}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400">{t('common.noResults')}</p>
                  )}
                </div>
              </Panel>
            ))}
          </div>
        </section>

        {rounds.length ? (
          <section className="tournament-section">
            <div className="tournament-section__header">
              <DisplayText as="h2" className="text-4xl text-white">
                {t('tournament.knockoutBracket')}
              </DisplayText>
            </div>

            <div className="space-y-8">
              {rounds.map((round) => (
                <Panel key={round.id} padding="normal" radius="xl" className="tournament-section">
                  <div className="tournament-round-header">
                    <DisplayText as="h3" className="text-2xl text-white">
                      {getRoundLabel(round, t)}
                    </DisplayText>
                    <Pill compact className="text-cyan-200">
                      {formatNumber(round.matches?.length || 0)}
                    </Pill>
                  </div>
                  <div className="tournament-knockout-grid">
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
                          className="tournament-match-card"
                        >
                          <div className="tournament-match-card__header">
                            <Pill compact className="text-emerald-200">{match.code}</Pill>
                            <span className="tournament-match-card__status">
                              {match.status}
                            </span>
                          </div>

                          <div className="tournament-match-card__teams">
                            <div className={`tournament-match-row ${match.winner === matchup.home.teamId ? 'is-winner' : ''}`}>
                              <span className="tournament-match-row__name">
                                {matchup.home.teamName || matchup.home.slotLabel || match.homeLabel}
                              </span>
                              {match.winner === matchup.home.teamId ? (
                                <Pill compact className="tournament-match-row__winner">
                                  {t('tournament.winner')}
                                </Pill>
                              ) : null}
                            </div>
                            <div className={`tournament-match-row ${match.winner === matchup.away.teamId ? 'is-winner' : ''}`}>
                              <span className="tournament-match-row__name">
                                {matchup.away.teamName || matchup.away.slotLabel || match.awayLabel}
                              </span>
                              {match.winner === matchup.away.teamId ? (
                                <Pill compact className="tournament-match-row__winner">
                                  {t('tournament.winner')}
                                </Pill>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
              ))}
            </div>
          </section>
        ) : null}

        {canSubmitPredictions && !hasPredictions && (
          <Panel variant="strong" padding="normal" radius="2xl" className="tournament-empty-state text-center">
            <DisplayText as="h3" className="text-4xl text-white mb-4">
              {t('tournament.makeYourPredictions')}
            </DisplayText>
            <p className="text-emerald-200 mb-8 text-lg">
              {t('tournament.noPredictionsYet')}
            </p>
            <Button
              onClick={() => navigate(`/tournament/${id}/predict`)}
              className="tournament-cta-button"
            >
              {t('tournament.startPredicting')}
            </Button>
          </Panel>
        )}
      </PageShell>
    </div>
  );
}

function TournamentStatCard({ label, value, detail, icon, valueClassName = '' }) {
  return (
    <Panel radius="md" className="tournament-stat-card">
      <p className="tournament-stat-card__label">
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <span>{label}</span>
      </p>
      <p className={`tournament-stat-card__value ${valueClassName}`.trim()}>
        {value}
      </p>
      {detail ? <p className="tournament-stat-card__detail">{detail}</p> : null}
    </Panel>
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
