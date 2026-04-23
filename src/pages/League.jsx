import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Copy, Link as LinkIcon } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { del, get, patch, post } from '../utils/api';
import { getLocalizedName, getRoundLabel } from '../utils/tournament';

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
      <div className="sport-shell min-h-screen flex items-center justify-center">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sport-shell min-h-screen flex items-center justify-center px-4">
        <div className="sport-panel app-empty max-w-2xl w-full">
          <p className="text-red-400">{error}</p>
        </div>
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

  const currentPrimaryScopeKey = primaryEntry?.currentScopeKey || 'tournament';
  const leaguePrimaryOption =
    primaryEntry?.options?.find((option) => option.scopeKey === `league:${id}`) || null;
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

  return (
    <div className="sport-shell min-h-screen">
      <div className="page-shell">
        <div className="app-page-header">
          <div className="app-page-kicker score-pill text-cyan-300">
            {t('nav.myLeagues')}
          </div>
          <h1 className="app-page-title sport-display">
            {league?.name || t('leaderboard.leagueLeaderboard')}
          </h1>
          {league?.description ? (
            <p className="app-page-description mb-3">
              {league.description}
            </p>
          ) : (
            <p className="app-page-description mb-3">
              {t('leaderboard.leagueDescription')}
            </p>
          )}
          {tournament ? (
            <div className="flex items-center gap-4">
              <p className="text-gray-400">{getLocalizedName(tournament, language, tournament.name)}</p>
              <Link
                to={`/tournament/${tournament.id}`}
                className="text-emerald-400 hover:text-emerald-300 transition"
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

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="sport-panel app-card">
            <p className="text-gray-400 text-sm mb-2">
              {t('tournament.leagueMembers')}
            </p>
            <p className="text-white font-bold text-2xl">
              {formatNumber(league?.memberCount || 0)}
            </p>
          </div>
          <div className="sport-panel app-card">
            <p className="text-gray-400 text-sm mb-2">
              {t('tournament.joinCode')}
            </p>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-2xl font-bold tracking-overline-wide text-white">
                  {league?.joinCode || '----'}
                </p>
                {league?.joinCode ? (
                  <button
                    type="button"
                    onClick={handleCopyInviteLink}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500 hover:text-slate-950"
                  >
                    <LinkIcon size={14} />
                    {copiedInvite ? t('common.copied') : t('tournament.copyInviteLink')}
                  </button>
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
          </div>
          <div className="sport-panel app-card">
            <p className="text-gray-400 text-sm mb-2">
              {t('predict.makePredictions')}
            </p>
            <p className="text-white font-semibold mb-4">
              {t('tournament.leaguePredictionScopeHelp')}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate(`/league/${id}/predict`)}
                disabled={!tournament?.access?.canSubmitPredictions}
                className="app-button-primary sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {tournament?.access?.canSubmitPredictions
                  ? t('tournament.openLeaguePredictions')
                  : t('tournament.predictionsClosed')}
              </button>
              <button
                type="button"
                onClick={handleSetPrimaryEntry}
                disabled={
                  saving ||
                  !primaryEntry?.canChange ||
                  !leaguePrimaryOption?.hasPredictions ||
                  currentPrimaryScopeKey === `league:${id}`
                }
                className="app-button-secondary sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {currentPrimaryScopeKey === `league:${id}`
                  ? t('tournament.currentPrimaryEntry')
                  : t('tournament.setPrimaryEntry')}
              </button>
            </div>
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
          </div>
        </div>

        <div className="sport-panel-strong app-card-strong mb-12">
          <h2 className="app-section-title">
            {t('tournament.leagueSettings')}
          </h2>
          <p className="app-section-copy mb-6">
            {isOwner ? t('tournament.ownerLeagueHelp') : t('tournament.memberLeagueHelp')}
          </p>

          {isOwner ? (
            <>
              <div className="grid md:grid-cols-2 gap-4 mb-6">
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

              <div className="flex flex-wrap gap-4">
                <button
                  onClick={handleUpdateLeague}
                  disabled={saving}
                  className="app-button-primary sm:w-auto"
                >
                  {saving ? t('admin.saving') : t('common.save')}
                </button>
                <button
                  onClick={handleRegenerateCode}
                  disabled={saving}
                  className="app-button-secondary sm:w-auto"
                >
                  {saving ? t('tournament.regeneratingCode') : t('tournament.regenerateLeagueCode')}
                </button>
                <button
                  onClick={handleDeleteLeague}
                  disabled={saving}
                  className="app-button-danger sm:w-auto"
                >
                  {saving ? t('tournament.deletingLeague') : t('tournament.deleteLeague')}
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={handleLeaveLeague}
              disabled={saving}
              className="app-button-danger sm:w-auto"
            >
              {saving ? t('tournament.leavingLeague') : t('tournament.leaveLeague')}
            </button>
          )}
        </div>

        {players.length === 0 ? (
          <div className="sport-panel app-empty">
            <p className="text-gray-400 text-lg">
              {t('leaderboard.noPlayers')}
            </p>
          </div>
        ) : (
          <div className="sport-panel-strong app-table-shell">
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
          </div>
        )}
      </div>
    </div>
  );
}
