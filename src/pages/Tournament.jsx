import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { get, post } from '../utils/api';
import { getModeLabel, sortGroups } from '../utils/tournament';

export default function Tournament() {
  const { id } = useParams();
  const { language, t } = useLanguage();
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
  const [pageError, setPageError] = useState('');
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const tournamentData = await get(`/tournaments/${id}`);
        let predictionsData = null;
        let leagueData = [];

        if (user && tournamentData?.access?.canViewPredictions) {
          [predictionsData, leagueData] = await Promise.all([
            get(`/tournaments/${id}/my-predictions`),
            get(`/tournaments/${id}/leagues`).catch(() => []),
          ]);
        }

        setTournament(tournamentData);
        setLeagues(leagueData || []);
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
      setSuccess(t('tournament.joined'));
      setJoinCode('');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setJoining(false);
    }
  };

  const refreshLeagues = async () => {
    const leagueData = await get(`/tournaments/${id}/leagues`);
    setLeagues(leagueData || []);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-red-400">{pageError}</p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
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
  const canPredict = Boolean(user && tournament.access?.canSubmitPredictions);
  const isPrivate = Boolean(tournament.access?.isPrivate);
  const isMember = Boolean(tournament.access?.isMember);
  const showPrizeInfo = Boolean(tournament.prizesEnabled && tournament.entryFee);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-12">
          <h1 className="text-5xl font-bold text-white mb-6">
            {tournament.name}
          </h1>

          <div className="grid md:grid-cols-6 gap-6 mb-8">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <p className="text-gray-400 text-sm mb-2">
                {t('tournament.mode')}
              </p>
              <p className="text-white font-semibold text-lg">
                {getModeLabel(tournament.mode, language)}
              </p>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <p className="text-gray-400 text-sm mb-2">
                {t('tournament.access')}
              </p>
              <p className="text-white font-semibold text-lg">
                {isPrivate ? t('tournament.privateAccess') : t('tournament.publicAccess')}
              </p>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <p className="text-gray-400 text-sm mb-2">
                {t('tournament.status')}
              </p>
              <p className="text-white font-semibold text-lg capitalize">
                {tournament.status}
              </p>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <p className="text-gray-400 text-sm mb-2">
                {t('tournament.closingDate')}
              </p>
              <p className="text-white font-semibold text-lg">
                {closingDate ? closingDate.toLocaleDateString() : 'TBD'}
              </p>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <p className="text-gray-400 text-sm mb-2">
                {isPrivate ? t('tournament.members') : t('tournament.participants')}
              </p>
              <p className="text-white font-semibold text-lg">
                {isPrivate ? tournament.memberCount || 0 : tournament.participantCount || 0}
              </p>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <p className="text-gray-400 text-sm mb-2">
                {t('tournament.prizes')}
              </p>
              <p className="text-white font-semibold text-lg">
                {tournament.prizesEnabled ? t('tournament.prizesOn') : t('tournament.prizesOff')}
              </p>
              {showPrizeInfo ? (
                <p className="text-gray-400 text-sm mt-2">
                  {tournament.currency} {tournament.entryFee}
                </p>
              ) : null}
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <p className="text-gray-400 text-sm mb-2">
                {t('tournament.participants')}
              </p>
              <p className="text-white font-semibold text-lg">
                {tournament.participantCount || 0}
              </p>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <p className="text-gray-400 text-sm mb-2 flex items-center gap-2">
                <Clock size={16} />
                {t('home.tournamentEndsIn')}
              </p>
              <p className="text-white font-semibold text-lg">
                {daysRemaining}d {hoursRemaining}h
              </p>
            </div>
          </div>

          {success ? (
            <div className="bg-green-900 border border-green-700 text-green-100 px-4 py-3 rounded mb-8">
              {success}
            </div>
          ) : null}

          {formError ? (
            <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded mb-8">
              {formError}
            </div>
          ) : null}

          {isPrivate && !isMember ? (
            <div className="bg-slate-800 border border-amber-500 rounded-lg p-6 mb-8">
              <h2 className="text-2xl font-bold text-white mb-3">
                {t('tournament.joinTournament')}
              </h2>
              <p className="text-amber-200 mb-2">
                {t('tournament.privateNotice')}
              </p>
              <p className="text-gray-300 mb-6">
                {user ? t('tournament.joinToPredict') : t('tournament.signInToJoin')}
              </p>

              {user ? (
                <div className="flex flex-col sm:flex-row gap-4">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                    placeholder={t('tournament.joinCode')}
                    className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    onClick={handleJoinTournament}
                    disabled={joining}
                    className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 disabled:opacity-50 transition"
                  >
                    {joining ? t('tournament.joining') : t('tournament.joinNow')}
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition"
                >
                  {t('auth.login')}
                </Link>
              )}

              <p className="text-gray-400 text-sm mt-4">
                {t('tournament.joinHelp')}
              </p>
            </div>
          ) : null}

          {canPredict ? (
            <div className="flex gap-4">
              <button
                onClick={() => navigate(`/tournament/${id}/predict`)}
                className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition"
              >
                {hasPredictions ? t('predict.makePredictions') : t('home.enterPredictions')}
              </button>

              {hasPredictions && (
                <Link
                  to={`/leaderboard/${id}`}
                  className="px-6 py-3 border-2 border-emerald-500 text-emerald-400 rounded-lg font-semibold hover:bg-emerald-500 hover:text-white transition"
                >
                  {t('home.viewLeaderboard')}
                </Link>
              )}
            </div>
          ) : null}
        </div>

        {canPredict ? (
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-8">
              {t('tournament.leagues')}
            </h2>

            <div className="grid lg:grid-cols-2 gap-8 mb-8">
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h3 className="text-xl font-bold text-white mb-3">
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
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                  />
                  <textarea
                    value={leagueDescription}
                    onChange={(event) => setLeagueDescription(event.target.value)}
                    placeholder={t('tournament.leagueDescription')}
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    onClick={handleCreateLeague}
                    disabled={creatingLeague}
                    className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 disabled:opacity-50 transition"
                  >
                    {creatingLeague ? t('tournament.creatingLeague') : t('tournament.createLeagueNow')}
                  </button>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h3 className="text-xl font-bold text-white mb-3">
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
                    className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    onClick={handleJoinLeague}
                    disabled={joiningLeague}
                    className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 disabled:opacity-50 transition"
                  >
                    {joiningLeague ? t('tournament.joining') : t('tournament.joinLeagueNow')}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h3 className="text-xl font-bold text-white mb-6">
                {t('tournament.yourLeagues')}
              </h3>
              {leagues.length === 0 ? (
                <p className="text-gray-400">{t('tournament.noLeaguesYet')}</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {leagues.map((league) => (
                    <div
                      key={league.id}
                      className="bg-slate-900 border border-slate-700 rounded-lg p-5"
                    >
                      <h4 className="text-lg font-bold text-white mb-2">{league.name}</h4>
                      {league.description ? (
                        <p className="text-gray-400 mb-4">{league.description}</p>
                      ) : null}
                      <div className="space-y-2 text-sm text-gray-300 mb-5">
                        <p>
                          {t('tournament.leagueMembers')}: {league.memberCount || 0}
                        </p>
                        <p>
                          {t('tournament.joinCode')}: <span className="tracking-[0.2em]">{league.joinCode}</span>
                        </p>
                      </div>
                      <Link
                        to={`/league/${league.id}`}
                        className="inline-flex px-4 py-2 border-2 border-emerald-500 text-emerald-400 rounded-lg font-semibold hover:bg-emerald-500 hover:text-white transition"
                      >
                        {t('tournament.openLeague')}
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-8">
            {t('tournament.groups')}
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <div
                key={group.id}
                className="bg-slate-800 border border-slate-700 rounded-lg p-6"
              >
                <h3 className="text-xl font-bold text-emerald-400 mb-4">
                  {group.name}
                </h3>

                <div className="space-y-2">
                  {group.teams?.length ? (
                    group.teams.map((team, index) => (
                      <div
                        key={team.id}
                        className="flex items-center justify-between p-3 bg-slate-900 rounded border border-slate-700"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 font-semibold w-6">
                            {index + 1}.
                          </span>
                          <span className="text-white">{team.name}</span>
                        </div>
                        <span className="text-gray-400 text-sm">
                          {team.code || ''}
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

        {canPredict && !hasPredictions && (
          <div className="bg-gradient-to-r from-emerald-900 to-emerald-800 border border-emerald-700 rounded-lg p-12 text-center">
            <h3 className="text-3xl font-bold text-white mb-4">
              {t('tournament.makeYourPredictions')}
            </h3>
            <p className="text-emerald-200 mb-8 text-lg">
              {t('tournament.noPredictionsYet')}
            </p>
            <button
              onClick={() => navigate(`/tournament/${id}/predict`)}
              className="px-8 py-4 bg-white text-emerald-600 rounded-lg font-semibold hover:bg-gray-100 transition"
            >
              {t('tournament.startPredicting')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
