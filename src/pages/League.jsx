import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { del, get, patch, post } from '../utils/api';
import { getRoundLabel } from '../utils/tournament';

export default function League() {
  const { id } = useParams();
  const { t } = useLanguage();
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
          const tournamentData = await get(`/tournaments/${leaderboardData.league.tournamentId}`);
          setTournament(tournamentData);
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

  const isOwner = Boolean(league?.access?.isOwner);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            {league?.name || t('leaderboard.leagueLeaderboard')}
          </h1>
          {league?.description ? (
            <p className="text-gray-300 text-lg mb-3">
              {league.description}
            </p>
          ) : (
            <p className="text-gray-300 text-lg mb-3">
              {t('leaderboard.leagueDescription')}
            </p>
          )}
          {tournament ? (
            <div className="flex items-center gap-4">
              <p className="text-gray-400">{tournament.name}</p>
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
          <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded mb-8">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="bg-green-900 border border-green-700 text-green-100 px-4 py-3 rounded mb-8">
            {success}
          </div>
        ) : null}

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <p className="text-gray-400 text-sm mb-2">
              {t('tournament.leagueMembers')}
            </p>
            <p className="text-white font-bold text-2xl">
              {league?.memberCount || 0}
            </p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <p className="text-gray-400 text-sm mb-2">
              {t('tournament.joinCode')}
            </p>
            <p className="text-white font-bold text-2xl tracking-[0.2em]">
              {league?.joinCode || '----'}
            </p>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-12">
          <h2 className="text-2xl font-bold text-white mb-3">
            {t('tournament.leagueSettings')}
          </h2>
          <p className="text-gray-400 mb-6">
            {isOwner ? t('tournament.ownerLeagueHelp') : t('tournament.memberLeagueHelp')}
          </p>

          {isOwner ? (
            <>
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    {t('tournament.leagueName')}
                  </label>
                  <input
                    type="text"
                    value={leagueForm.name}
                    onChange={(event) =>
                      setLeagueForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    {t('tournament.leagueDescription')}
                  </label>
                  <input
                    type="text"
                    value={leagueForm.description}
                    onChange={(event) =>
                      setLeagueForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <button
                  onClick={handleUpdateLeague}
                  disabled={saving}
                  className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 disabled:opacity-50 transition"
                >
                  {saving ? t('admin.saving') : t('common.save')}
                </button>
                <button
                  onClick={handleRegenerateCode}
                  disabled={saving}
                  className="px-6 py-3 border-2 border-emerald-500 text-emerald-400 rounded-lg font-semibold hover:bg-emerald-500 hover:text-white disabled:opacity-50 transition"
                >
                  {saving ? t('tournament.regeneratingCode') : t('tournament.regenerateLeagueCode')}
                </button>
                <button
                  onClick={handleDeleteLeague}
                  disabled={saving}
                  className="px-6 py-3 border-2 border-red-500 text-red-300 rounded-lg font-semibold hover:bg-red-500 hover:text-white disabled:opacity-50 transition"
                >
                  {saving ? t('tournament.deletingLeague') : t('tournament.deleteLeague')}
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={handleLeaveLeague}
              disabled={saving}
              className="px-6 py-3 border-2 border-red-500 text-red-300 rounded-lg font-semibold hover:bg-red-500 hover:text-white disabled:opacity-50 transition"
            >
              {saving ? t('tournament.leavingLeague') : t('tournament.leaveLeague')}
            </button>
          )}
        </div>

        {players.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
            <p className="text-gray-400 text-lg">
              {t('leaderboard.noPlayers')}
            </p>
          </div>
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900">
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
                          isCurrentUser ? 'bg-emerald-900 bg-opacity-20' : 'hover:bg-slate-700'
                        }`}
                      >
                        <td className="px-6 py-4">
                          <span className="font-bold text-white text-lg">{index + 1}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-slate-900 font-bold">
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
