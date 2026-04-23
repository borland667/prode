import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Shield, Trophy, Users } from 'lucide-react';
import { get, post } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { getLocalizedName } from '../utils/tournament';

export default function LeagueInvite() {
  const { joinCode } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { language, t, formatNumber } = useLanguage();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadInvite = async () => {
      try {
        const data = await get(`/leagues/invite/${joinCode}`);
        setInvite(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadInvite();
  }, [joinCode]);

  const handleJoinLeague = async () => {
    if (!invite?.tournament?.id || !invite?.league?.joinCode) {
      return;
    }

    setJoining(true);
    setError('');
    setSuccess('');

    try {
      const response = await post(`/tournaments/${invite.tournament.id}/leagues/join`, {
        joinCode: invite.league.joinCode,
      });
      setInvite((prev) => ({
        ...prev,
        access: {
          ...(prev?.access || {}),
          isLeagueMember: true,
          canJoinLeague: false,
          canViewLeague: true,
        },
        league: response?.league || prev?.league,
      }));
      setSuccess(t('tournament.joinedLeague'));
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="sport-shell min-h-screen flex items-center justify-center">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="sport-shell flex min-h-screen items-center justify-center px-4">
        <div className="sport-panel w-full max-w-2xl rounded-panel-lg page-panel-pad">
          <p className="text-red-400 text-lg">{error}</p>
        </div>
      </div>
    );
  }

  if (!invite) {
    return <Navigate to="/" replace />;
  }

  const loginRedirect = `/login?redirect=${encodeURIComponent(`/league/invite/${joinCode}`)}`;
  const registerRedirect = `/register?redirect=${encodeURIComponent(`/league/invite/${joinCode}`)}`;

  return (
    <div className="sport-shell min-h-screen">
      <div className="page-shell-md">
        <div className="sport-panel-strong rounded-panel-2xl page-panel-pad">
          <div className="score-pill mb-5 text-emerald-200">
            {t('tournament.leagueInviteResolved')}
          </div>
          <h1 className="sport-display text-5xl md:text-6xl text-white mb-4">
            {invite.league?.name || t('tournament.joinLeagueInviteTitle')}
          </h1>
          <p className="text-lg text-slate-300 mb-8 max-w-3xl">
            {invite.league?.description || t('tournament.joinLeagueInviteHelp')}
          </p>

          {success ? (
            <div className="app-alert app-alert-success mb-6">
              {success}
            </div>
          ) : null}

          {error ? (
            <div className="app-alert app-alert-error mb-6">
              {error}
            </div>
          ) : null}

          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="sport-panel rounded-panel-xs p-5">
              <div className="flex items-center gap-3 text-emerald-300 mb-3">
                <Users size={18} />
                <span className="score-pill">{t('tournament.leagueMembers')}</span>
              </div>
              <p className="sport-display text-4xl text-white">
                {formatNumber(invite.league?.memberCount || 0)}
              </p>
            </div>
            <div className="sport-panel rounded-panel-xs p-5">
              <div className="flex items-center gap-3 text-cyan-300 mb-3">
                <Shield size={18} />
                <span className="score-pill">{t('tournament.access')}</span>
              </div>
              <p className="text-white font-semibold text-lg capitalize">
                {invite.tournament?.accessType || 'public'}
              </p>
            </div>
            <div className="sport-panel rounded-panel-xs p-5">
              <div className="flex items-center gap-3 text-amber-300 mb-3">
                <Trophy size={18} />
                <span className="score-pill">{t('nav.tournaments')}</span>
              </div>
              <p className="text-white font-semibold text-lg">
                {getLocalizedName(invite.tournament, language, invite.tournament?.name || '')}
              </p>
            </div>
          </div>

          {!user ? (
            <div className="sport-panel rounded-panel-md p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p className="text-slate-300">
                {t('tournament.signInToJoinLeague')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to={loginRedirect}
                  className="sport-button-secondary px-5 py-3 rounded-full text-emerald-300 font-bold text-center"
                >
                  {t('auth.login')}
                </Link>
                <Link
                  to={registerRedirect}
                  className="sport-button px-5 py-3 rounded-full text-slate-950 font-bold text-center"
                >
                  {t('auth.register')}
                </Link>
              </div>
            </div>
          ) : invite.access?.requiresTournamentJoin ? (
            <div className="sport-panel rounded-panel-md p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p className="text-slate-300">
                {t('tournament.needTournamentAccessFirst')}
              </p>
              <Link
                to={`/tournament/${invite.tournament.id}`}
                className="sport-button-secondary px-5 py-3 rounded-full text-emerald-300 font-bold text-center"
              >
                {t('tournament.openTournament')}
              </Link>
            </div>
          ) : invite.access?.isLeagueMember ? (
            <div className="sport-panel rounded-panel-md p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p className="text-slate-300">
                {t('tournament.joinedLeague')}
              </p>
              <Link
                to={`/league/${invite.league.id}`}
                className="sport-button px-5 py-3 rounded-full text-slate-950 font-bold text-center"
              >
                {t('tournament.goToLeague')}
              </Link>
            </div>
          ) : (
            <div className="sport-panel rounded-panel-md p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p className="text-slate-300">
                {t('tournament.joinLeagueInviteHelp')}
              </p>
              <button
                type="button"
                onClick={handleJoinLeague}
                disabled={joining || !invite.access?.canJoinLeague}
                className="sport-button px-5 py-3 rounded-full text-slate-950 font-bold disabled:opacity-50"
              >
                {joining ? t('tournament.joining') : t('tournament.joinLeagueFromInvite')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
