import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Copy, Link as LinkIcon } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { del, get, patch, post } from '../utils/api';
import { getLocalizedName, getRoundLabel } from '../utils/tournament';
import { Button, DisplayText, PageShell, Panel, Pill } from '../components/ui/DesignSystem';

export default function League() {
  const { id } = useParams();
  const { language, t, formatNumber } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [league, setLeague] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [players, setPlayers] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [primaryEntry, setPrimaryEntry] = useState(null);
  const [copySourceScopeKey, setCopySourceScopeKey] = useState('');
  const [leagueForm, setLeagueForm] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const leaderboardData = await get(`/leagues/${id}/leaderboard`);
        setLeague(leaderboardData?.league || null);
        setLeagueForm({
          name: leaderboardData?.league?.name || '',
          description: leaderboardData?.league?.description || '',
        });
        setPlayers(leaderboardData?.players || []);
        setRounds(leaderboardData?.rounds || []);

        if (leaderboardData?.league?.tournamentId) {
          const [tournamentData, primaryEntryData] = await Promise.all([
            get(`/tournaments/${leaderboardData.league.tournamentId}`),
            get(`/tournaments/${leaderboardData.league.tournamentId}/primary-entry`).catch(() => null),
          ]);
          setTournament(tournamentData);
          setPrimaryEntry(primaryEntryData);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const currentPrimaryScopeKey = primaryEntry?.currentScopeKey || 'tournament';
  const leaguePrimaryOption =
    primaryEntry?.options?.find((option) => option.scopeKey === `league:${id}`) || null;
  const copySourceOptions = useMemo(
    () =>
      (primaryEntry?.options || []).filter(
        (option) => option.scopeKey !== `league:${id}` && option.hasPredictions
      ),
    [primaryEntry, id]
  );

  useEffect(() => {
    if (!copySourceOptions.length) {
      setCopySourceScopeKey('');
      return;
    }

    setCopySourceScopeKey((currentValue) => {
      if (copySourceOptions.some((option) => option.scopeKey === currentValue)) {
        return currentValue;
      }

      return copySourceOptions[0].scopeKey;
    });
  }, [copySourceOptions]);

  const handleUpdateLeague = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await patch(`/leagues/${id}`, leagueForm);
      setLeague(response?.league || league);
      setSuccess(response?.message || 'League updated successfully');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateCode = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await post(`/leagues/${id}/regenerate-code`, {});
      setLeague(response?.league || league);
      setSuccess(response?.message || 'League join code regenerated successfully');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLeaveLeague = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await del(`/leagues/${id}/members/me`);
      navigate(`/tournament/${response?.tournamentId || tournament?.id || ''}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const handleDeleteLeague = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await del(`/leagues/${id}`);
      navigate(`/tournament/${response?.tournamentId || tournament?.id || ''}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="ds-shell min-h-screen flex items-center justify-center">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ds-shell min-h-screen flex items-center justify-center px-4">
        <Panel className="app-empty max-w-2xl w-full">
          <p className="text-red-400">{error}</p>
        </Panel>
      </div>
    );
  }

  const isOwner = Boolean(league?.access?.isOwner);
  const inviteUrl =
    typeof window !== 'undefined' && league?.joinCode
      ? `${window.location.origin}/league/invite/${league.joinCode}`
      : '';

  const handleCopyInviteLink = async () => {
    if (!inviteUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch (err) {
      setError(err.message || t('tournament.copyInviteFailed'));
    }
  };

  const handleSetPrimaryEntry = async () => {
    if (!leaguePrimaryOption?.hasPredictions) {
      setError(t('tournament.primaryEntryNeedsPredictions'));
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await post(`/tournaments/${league?.tournamentId}/primary-entry`, {
        scopeKey: `league:${id}`,
      });
      setPrimaryEntry(response?.primaryEntry || primaryEntry);
      setSuccess(t('tournament.primaryEntrySaved'));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPredictions = async () => {
    if (!copySourceScopeKey) {
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await post(`/leagues/${id}/predictions/copy`, {
        sourceScopeKey: copySourceScopeKey,
      });
      if (response?.primaryEntry) {
        setPrimaryEntry(response.primaryEntry);
      }
      setSuccess(t('tournament.copyPredictionsSuccess'));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ds-shell min-h-screen">
      <PageShell className="league-page">
        <div className="league-header">
          <Pill className="text-cyan-300">
            {t('nav.myLeagues')}
          </Pill>
          <DisplayText as="h1" className="text-white">
            {league?.name || t('leaderboard.leagueLeaderboard')}
          </DisplayText>
          {league?.description ? (
            <p className="ds-copy">
              {league.description}
            </p>
          ) : (
            <p className="ds-copy">
              {t('leaderboard.leagueDescription')}
            </p>
          )}
          {tournament ? (
            <div className="league-header__meta">
              <p className="text-gray-400">{getLocalizedName(tournament, language, tournament.name)}</p>
              <Link
                to={`/tournament/${tournament.id}`}
                className="league-header__back"
              >
                {t('common.back')}
              </Link>
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="app-alert app-alert-error mb-8">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="app-alert app-alert-success mb-8">
            {success}
          </div>
        ) : null}

        <div className="league-summary-grid">
          <Panel className="league-summary-card">
            <p className="text-gray-400 text-sm mb-2">
              {t('tournament.leagueMembers')}
            </p>
            <DisplayText as="p" className="text-3xl text-white">
              {formatNumber(league?.memberCount || 0)}
            </DisplayText>
          </Panel>
          <Panel className="league-summary-card league-invite-card">
            <p className="text-gray-400 text-sm mb-2">
              {t('tournament.joinCode')}
            </p>
            <div className="flex flex-col gap-4">
              <div className="league-invite-card__row">
                <DisplayText as="p" className="text-3xl tracking-overline-wide text-white">
                  {league?.joinCode || '----'}
                </DisplayText>
                {league?.joinCode ? (
                  <Button
                    type="button"
                    onClick={handleCopyInviteLink}
                    variant="secondary"
                    size="sm"
                    className="league-invite-card__button"
                  >
                    <LinkIcon size={14} />
                    {copiedInvite ? t('common.copied') : t('tournament.copyInviteLink')}
                  </Button>
                ) : null}
              </div>
              {league?.joinCode ? (
                <div className="account-subtle-panel">
                  <p className="mb-2 text-xs uppercase tracking-overline text-gray-500">
                    {t('tournament.inviteLink')}
                  </p>
                  <div className="flex items-start gap-3">
                    <Copy size={16} className="mt-1 text-emerald-400" />
                    <p className="break-all text-sm text-gray-300">
                      {inviteUrl}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </Panel>
          <Panel className="league-summary-card league-action-card">
            <p className="text-gray-400 text-sm mb-2">
              {t('predict.makePredictions')}
            </p>
            <p className="text-white font-semibold mb-4">
              {t('tournament.leaguePredictionScopeHelp')}
            </p>
            <div className="league-action-card__actions">
              <Button
                type="button"
                onClick={() => navigate(`/league/${id}/predict`)}
                disabled={!tournament?.access?.canSubmitPredictions}
                className="disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {tournament?.access?.canSubmitPredictions
                  ? t('tournament.openLeaguePredictions')
                  : t('tournament.predictionsClosed')}
              </Button>
              <Button
                type="button"
                onClick={handleSetPrimaryEntry}
                disabled={
                  saving ||
                  !primaryEntry?.canChange ||
                  !leaguePrimaryOption?.hasPredictions ||
                  currentPrimaryScopeKey === `league:${id}`
                }
                variant="secondary"
                className="disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {currentPrimaryScopeKey === `league:${id}`
                  ? t('tournament.currentPrimaryEntry')
                  : t('tournament.setPrimaryEntry')}
              </Button>
            </div>
            {copySourceOptions.length > 0 ? (
              <div className="league-copy-panel">
                <div className="league-copy-panel__header">
                  <p className="text-white font-semibold">
                    {t('tournament.copyPredictionsToLeague')}
                  </p>
                  <p className="text-sm text-gray-400">
                    {t('tournament.copyPredictionsHelp')}
                  </p>
                </div>
                <div className="league-copy-panel__controls">
                  <select
                    value={copySourceScopeKey}
                    onChange={(event) => setCopySourceScopeKey(event.target.value)}
                    className="app-select"
                    disabled={saving || !primaryEntry?.canChange}
                  >
                    {copySourceOptions.map((option) => (
                      <option key={option.scopeKey} value={option.scopeKey}>
                        {option.type === 'league'
                          ? `${option.label} (${t('tournament.primaryEntryLeague')})`
                          : `${option.label} (${t('tournament.primaryEntryTournament')})`}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    onClick={handleCopyPredictions}
                    disabled={saving || !primaryEntry?.canChange || !copySourceScopeKey}
                    variant="secondary"
                    className="disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('tournament.copyPredictionsNow')}
                  </Button>
                </div>
              </div>
            ) : null}
            {currentPrimaryScopeKey === `league:${id}` ? (
              <p className="text-emerald-300 text-sm mt-4">
                {t('tournament.primaryEntryHelp')}
              </p>
            ) : null}
            {primaryEntry && !primaryEntry.canChange ? (
              <p className="text-amber-300 text-sm mt-4">
                {t('tournament.primaryEntryLocked')}
              </p>
            ) : null}
          </Panel>
        </div>

        <Panel variant="strong" className="league-settings app-card-strong">
          <DisplayText as="h2" className="app-section-title text-white">
            {t('tournament.leagueSettings')}
          </DisplayText>
          <p className="app-section-copy mb-6">
            {isOwner ? t('tournament.ownerLeagueHelp') : t('tournament.memberLeagueHelp')}
          </p>

          {isOwner ? (
            <>
              <div className="league-settings__fields">
                <div>
                  <label className="account-label">
                    {t('tournament.leagueName')}
                  </label>
                  <input
                    type="text"
                    value={leagueForm.name}
                    onChange={(event) =>
                      setLeagueForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className="app-input"
                  />
                </div>
                <div>
                  <label className="account-label">
                    {t('tournament.leagueDescription')}
                  </label>
                  <input
                    type="text"
                    value={leagueForm.description}
                    onChange={(event) =>
                      setLeagueForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                    className="app-input"
                  />
                </div>
              </div>

              <div className="league-settings__actions">
                <Button
                  onClick={handleUpdateLeague}
                  disabled={saving}
                  className="disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? t('admin.saving') : t('common.save')}
                </Button>
                <Button
                  onClick={handleRegenerateCode}
                  disabled={saving}
                  variant="secondary"
                  className="disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? t('tournament.regeneratingCode') : t('tournament.regenerateLeagueCode')}
                </Button>
                <Button
                  onClick={handleDeleteLeague}
                  disabled={saving}
                  variant="danger"
                  className="disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? t('tournament.deletingLeague') : t('tournament.deleteLeague')}
                </Button>
              </div>
            </>
          ) : (
            <Button
              onClick={handleLeaveLeague}
              disabled={saving}
              variant="danger"
              className="disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t('tournament.leavingLeague') : t('tournament.leaveLeague')}
            </Button>
          )}
        </Panel>

        {players.length === 0 ? (
          <Panel className="app-empty">
            <p className="text-gray-400 text-lg">
              {t('leaderboard.noPlayers')}
            </p>
          </Panel>
        ) : (
          <Panel variant="strong" className="app-table-shell">
            <div className="overflow-x-auto">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>
                      {t('leaderboard.rank')}
                    </th>
                    <th>
                      {t('leaderboard.player')}
                    </th>
                    <th className="text-center">
                      {t('leaderboard.groupPts')}
                    </th>
                    {rounds.map((round) => (
                      <th
                        key={round.id}
                        className="text-center"
                      >
                        {getRoundLabel(round, t)}
                      </th>
                    ))}
                    <th className="text-center text-emerald-400">
                      {t('leaderboard.total')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player, index) => {
                    const isCurrentUser = user?.id === player.userId;

                    return (
                      <tr
                        key={player.id}
                        className={`app-table-row ${isCurrentUser ? 'app-table-row-current' : ''}`}
                      >
                        <td>
                          <span className="font-bold text-white text-lg">{formatNumber(index + 1)}</span>
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="surface-accent-gradient flex h-10 w-10 items-center justify-center rounded-full font-bold">
                              {player.name?.[0] || 'U'}
                            </div>
                            <div>
                              <p className="text-white font-semibold">{player.name}</p>
                              {isCurrentUser ? (
                                <p className="text-emerald-400 text-xs">{t('leaderboard.you')}</p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="text-center font-semibold">
                          {formatNumber(player.groupScore || 0)}
                        </td>
                        {rounds.map((round) => (
                          <td
                            key={round.id}
                            className="text-center font-semibold"
                          >
                            {formatNumber(player.roundScores?.[round.name] || 0)}
                          </td>
                        ))}
                        <td className="text-center font-bold text-emerald-400 text-lg">
                          {formatNumber(player.totalScore || 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </PageShell>
    </div>
  );
}
