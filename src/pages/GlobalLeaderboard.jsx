import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { get } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

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

  if (authLoading) {
    return (
      <div className="sport-shell min-h-screen flex items-center justify-center">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="sport-shell min-h-screen flex items-center justify-center">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sport-shell min-h-screen flex items-center justify-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="sport-shell min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] items-start mb-10">
          <div className="sport-panel-strong rounded-[2rem] p-8">
            <div className="score-pill mb-4 text-emerald-200">
              {t('nav.globalLeaderboard')}
            </div>
            <h1 className="sport-display text-5xl md:text-6xl text-white mb-4">
              {t('leaderboard.globalLeaderboard')}
            </h1>
            <p className="text-slate-300 max-w-2xl text-lg leading-relaxed">
              {t('leaderboard.globalDescription')}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <div className="sport-panel rounded-[1.6rem] p-6">
              <p className="text-sm text-slate-400 mb-2">
                {t('leaderboard.visiblePlayers')}
              </p>
              <p className="sport-display text-4xl text-white">
                {formatNumber(summary?.visiblePlayerCount || players.length)}
              </p>
            </div>
            <div className="sport-panel rounded-[1.6rem] p-6">
              <p className="text-sm text-slate-400 mb-2">
                {t('leaderboard.yourRank')}
              </p>
              <p className="sport-display text-4xl text-white">
                {currentUser?.isVisible
                  ? (currentUser?.rank ? formatNumber(currentUser.rank) : '--')
                  : t('leaderboard.hiddenRank')}
              </p>
            </div>
          </div>
        </div>

        {!currentUser?.isVisible ? (
          <div className="sport-panel rounded-[1.6rem] p-5 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <p className="text-slate-300">
              {t('leaderboard.visibilityOff')}
            </p>
            <Link
              to="/profile"
              className="sport-button px-5 py-3 rounded-full text-slate-950 font-bold text-center"
            >
              {t('nav.profile')}
            </Link>
          </div>
        ) : null}

        {players.length === 0 ? (
          <div className="sport-panel app-empty">
            <p className="text-gray-400 text-lg">
              {t('leaderboard.noGlobalPlayers')}
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
                              <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-slate-900 font-bold">
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
          </div>
        )}
      </div>
    </div>
  );
}
