import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { get } from '../utils/api';
import { getRoundLabel } from '../utils/tournament';

export default function Leaderboard() {
  const { id } = useParams();
  const { language, t } = useLanguage();
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  const entryFee = tournament?.entryFee || 0;
  const totalParticipants = tournament?.participantCount || players.length;
  const totalPrize = entryFee * totalParticipants;
  const firstPlacePrize = Math.round(totalPrize * 0.7);
  const secondPlacePrize = Math.round(totalPrize * 0.3);
  const currencyFormatter = new Intl.NumberFormat(language === 'es' ? 'es-AR' : 'en-US', {
    style: 'currency',
    currency: tournament?.currency || 'USD',
    maximumFractionDigits: 0,
  });

  return (
    <div className="sport-shell min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-12">
          <div className="score-pill mb-5 text-emerald-200">
            Standings
          </div>
          <h1 className="sport-display text-5xl md:text-6xl text-white mb-6">
            {t('leaderboard.leaderboard')}
          </h1>
          <p className="text-gray-400 text-lg">
            {tournament?.name}
          </p>
        </div>

        {tournament?.prizesEnabled && tournament?.entryFee ? (
          <div className="grid md:grid-cols-4 gap-6 mb-12">
            <div className="sport-panel rounded-[1.6rem] p-6">
              <p className="text-gray-400 text-sm mb-2">
                {t('leaderboard.prizePool')}
              </p>
              <p className="text-white font-bold text-2xl">
                {currencyFormatter.format(totalPrize)}
              </p>
            </div>

            <div className="sport-panel rounded-[1.6rem] p-6">
              <p className="text-gray-400 text-sm mb-2">
                {t('leaderboard.participants')}
              </p>
              <p className="text-white font-bold text-2xl">
                {totalParticipants}
              </p>
            </div>

            <div className="sport-panel rounded-[1.6rem] p-6">
              <p className="text-gray-400 text-sm mb-2">
                {t('leaderboard.firstPlace')}
              </p>
              <p className="text-emerald-400 font-bold text-2xl">
                {currencyFormatter.format(firstPlacePrize)}
              </p>
            </div>

            <div className="sport-panel rounded-[1.6rem] p-6">
              <p className="text-gray-400 text-sm mb-2">
                {t('leaderboard.secondPlace')}
              </p>
              <p className="text-emerald-400 font-bold text-2xl">
                {currencyFormatter.format(secondPlacePrize)}
              </p>
            </div>
          </div>
        ) : tournament ? (
          <div className="sport-panel rounded-[1.6rem] p-6 mb-12">
            <p className="text-gray-300">{t('leaderboard.prizesDisabled')}</p>
          </div>
        ) : null}

        {players.length === 0 ? (
          <div className="sport-panel rounded-[1.75rem] p-12 text-center">
            <p className="text-gray-400 text-lg">
              {t('leaderboard.noPlayers')}
            </p>
          </div>
        ) : (
          <div className="sport-panel-strong rounded-[1.9rem] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-slate-950/80">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                      {t('leaderboard.rank')}
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                      {t('leaderboard.player')}
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300">
                      {t('leaderboard.groupPts')}
                    </th>
                    {rounds.map((round) => (
                      <th
                        key={round.id}
                        className="px-6 py-4 text-center text-sm font-semibold text-gray-300"
                      >
                        {getRoundLabel(round, t)}
                      </th>
                    ))}
                    <th className="px-6 py-4 text-center text-sm font-semibold text-emerald-400">
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
                        className={`border-b border-slate-700 transition ${
                          isCurrentUser
                            ? 'bg-emerald-900 bg-opacity-20'
                            : 'hover:bg-slate-700'
                        }`}
                      >
                        <td className="px-6 py-4">
                          <span className="font-bold text-white text-lg">
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-slate-900 font-bold">
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
                        <td className="px-6 py-4 text-center text-white font-semibold">
                          {player.groupScore || 0}
                        </td>
                        {rounds.map((round) => (
                          <td
                            key={round.id}
                            className="px-6 py-4 text-center text-white font-semibold"
                          >
                            {player.roundScores?.[round.name] || 0}
                          </td>
                        ))}
                        <td className="px-6 py-4 text-center font-bold text-emerald-400 text-lg">
                          {player.totalScore || 0}
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
