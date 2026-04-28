import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { get } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Button, DisplayText, PageShell, Panel, Pill } from '../components/ui/DesignSystem';
import { ANALYTICS_EVENTS, trackEvent } from '../utils/analytics';

export default function GlobalLeaderboard() {
  const { user, loading: authLoading } = useAuth();
  const { t, formatNumber } = useLanguage();
  const [players, setPlayers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      return;
    }

    const loadLeaderboard = async () => {
      try {
        const data = await get('/leaderboard/global');
        setPlayers(data?.players || []);
        setSummary(data?.summary || null);
        setCurrentUser(data?.currentUser || null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, [user]);

  useEffect(() => {
    if (!user || loading || error) {
      return;
    }

    trackEvent(
      ANALYTICS_EVENTS.LEADERBOARD_VIEWED,
      {
        scope: 'global',
      },
      {
        dedupeKey: 'leaderboard_viewed:global',
      }
    );
  }, [error, loading, user]);

  if (authLoading) {
    return (
      <div className="ds-shell min-h-screen flex items-center justify-center">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="ds-shell min-h-screen flex items-center justify-center">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ds-shell min-h-screen flex items-center justify-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="ds-shell min-h-screen">
      <PageShell className="global-leaderboard-page">
        <div className="global-leaderboard-hero">
          <Panel variant="strong" padding="normal" radius="2xl" className="global-leaderboard-hero__panel">
            <Pill className="mb-4 text-emerald-200">
              {t('nav.globalLeaderboard')}
            </Pill>
            <DisplayText as="h1" className="global-leaderboard-title text-white mb-4">
              {t('leaderboard.globalLeaderboard')}
            </DisplayText>
            <p className="text-slate-300 max-w-2xl text-lg leading-relaxed">
              {t('leaderboard.globalDescription')}
            </p>
          </Panel>

          <div className="global-leaderboard-summary">
            <Panel radius="md" className="global-leaderboard-stat">
              <p className="text-sm text-slate-400 mb-2">
                {t('leaderboard.visiblePlayers')}
              </p>
              <DisplayText as="p" className="text-4xl text-white">
                {formatNumber(summary?.visiblePlayerCount || players.length)}
              </DisplayText>
            </Panel>
            <Panel radius="md" className="global-leaderboard-stat">
              <p className="text-sm text-slate-400 mb-2">
                {t('leaderboard.yourRank')}
              </p>
              <DisplayText as="p" className="text-4xl text-white">
                {currentUser?.isVisible
                  ? (currentUser?.rank ? formatNumber(currentUser.rank) : '--')
                  : t('leaderboard.hiddenRank')}
              </DisplayText>
            </Panel>
          </div>
        </div>

        {!currentUser?.isVisible ? (
          <Panel radius="md" className="global-leaderboard-callout">
            <p className="text-slate-300">
              {t('leaderboard.visibilityOff')}
            </p>
            <Button
              as={Link}
              to="/profile"
              className="global-leaderboard-callout__action"
            >
              {t('nav.profile')}
            </Button>
          </Panel>
        ) : null}

        {players.length === 0 ? (
          <Panel className="app-empty">
            <p className="text-gray-400 text-lg">
              {t('leaderboard.noGlobalPlayers')}
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
                      {t('leaderboard.tournamentsPlayed')}
                    </th>
                    <th className="text-center">
                      {t('leaderboard.groupPts')}
                    </th>
                    <th className="text-center">
                      {t('leaderboard.knockoutPts')}
                    </th>
                    <th className="text-center text-emerald-400">
                      {t('leaderboard.total')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player, index) => {
                    const isCurrentUser = player.userId === user.id;

                    return (
                      <tr
                        key={player.id}
                        className={`app-table-row ${isCurrentUser ? 'app-table-row-current' : ''}`}
                      >
                        <td>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-white text-lg">
                              {formatNumber(index + 1)}
                            </span>
                            {index === 0 ? <Trophy size={16} className="text-amber-300" /> : null}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            {player.avatarUrl ? (
                              <img
                                src={player.avatarUrl}
                                alt={player.name}
                                className="w-10 h-10 rounded-full object-cover border border-white/10"
                              />
                            ) : (
                              <div className="surface-accent-gradient flex h-10 w-10 items-center justify-center rounded-full font-bold">
                                {player.name?.[0] || 'U'}
                              </div>
                            )}
                            <div>
                              <p className="text-white font-semibold">
                                {player.name}
                              </p>
                              {isCurrentUser ? (
                                <p className="text-emerald-400 text-xs">
                                  {t('leaderboard.you')}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="text-center font-semibold">
                          {formatNumber(player.tournamentCount || 0)}
                        </td>
                        <td className="text-center font-semibold">
                          {formatNumber(player.groupScore || 0)}
                        </td>
                        <td className="text-center font-semibold">
                          {formatNumber(player.knockoutScore || 0)}
                        </td>
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
