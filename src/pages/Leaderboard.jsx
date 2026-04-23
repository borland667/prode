import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { get } from '../utils/api';
import { getLocalizedName, getRoundLabel } from '../utils/tournament';

export default function Leaderboard() {
  const { id } = useParams();
  const { language, t, formatNumber, formatCurrency } = useLanguage();
  const { user } = useAuth();

  const [players, setPlayers] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const tournamentData = await get(`/tournaments/${id}`);
        setTournament(tournamentData);

        if (!tournamentData?.access?.canViewLeaderboard) {
          setError(t('tournament.membersOnlyLeaderboard'));
          return;
        }

        const leaderboardData = await get(`/tournaments/${id}/leaderboard`);

        setPlayers(leaderboardData?.players || []);
        setRounds(leaderboardData?.rounds || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, t]);

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

  const entryFee = tournament?.entryFee || 0;
  const totalParticipants = tournament?.participantCount || players.length;
  const totalPrize = entryFee * totalParticipants;
  const firstPlacePrize = Math.round(totalPrize * 0.7);
  const secondPlacePrize = Math.round(totalPrize * 0.3);

  return (
    <div className="sport-shell min-h-screen">
      <div className="page-shell">
        <div className="app-page-header">
          <div className="app-page-kicker score-pill text-emerald-200">
            Standings
          </div>
          <h1 className="app-page-title sport-display">
            {t('leaderboard.leaderboard')}
          </h1>
          <p className="app-page-description">
            {getLocalizedName(tournament, language, tournament?.name || '')}
          </p>
        </div>

        {tournament?.prizesEnabled && tournament?.entryFee ? (
          <div className="grid md:grid-cols-4 gap-6 mb-12">
            <div className="sport-panel app-card">
              <p className="text-gray-400 text-sm mb-2">
                {t('leaderboard.prizePool')}
              </p>
              <p className="text-white font-bold text-2xl">
                {formatCurrency(totalPrize, tournament?.currency || 'USD', {
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>

            <div className="sport-panel app-card">
              <p className="text-gray-400 text-sm mb-2">
                {t('leaderboard.participants')}
              </p>
              <p className="text-white font-bold text-2xl">
                {formatNumber(totalParticipants)}
              </p>
            </div>

            <div className="sport-panel app-card">
              <p className="text-gray-400 text-sm mb-2">
                {t('leaderboard.firstPlace')}
              </p>
              <p className="text-emerald-400 font-bold text-2xl">
                {formatCurrency(firstPlacePrize, tournament?.currency || 'USD', {
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>

            <div className="sport-panel app-card">
              <p className="text-gray-400 text-sm mb-2">
                {t('leaderboard.secondPlace')}
              </p>
              <p className="text-emerald-400 font-bold text-2xl">
                {formatCurrency(secondPlacePrize, tournament?.currency || 'USD', {
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
          </div>
        ) : tournament ? (
          <div className="sport-panel app-card mb-12">
            <p className="text-gray-300">{t('leaderboard.prizesDisabled')}</p>
          </div>
        ) : null}

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
                          <span className="font-bold text-white text-lg">
                            {formatNumber(index + 1)}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="surface-accent-gradient flex h-10 w-10 items-center justify-center rounded-full font-bold">
                              {player.name?.[0] || 'U'}
                            </div>
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
