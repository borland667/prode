import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Shield, Trophy, Users } from 'lucide-react';
import { get, post } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { getLocalizedName } from '../utils/tournament';
import { Button, DisplayText, PageShell, Panel, Pill } from '../components/ui/DesignSystem';

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
      <div className="ds-shell min-h-screen flex items-center justify-center">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="ds-shell flex min-h-screen items-center justify-center px-4">
        <Panel className="w-full max-w-2xl page-panel-pad">
          <p className="text-red-400 text-lg">{error}</p>
        </Panel>
      </div>
    );
  }

  if (!invite) {
    return <Navigate to="/" replace />;
  }

  const loginRedirect = `/login?redirect=${encodeURIComponent(`/league/invite/${joinCode}`)}`;
  const registerRedirect = `/register?redirect=${encodeURIComponent(`/league/invite/${joinCode}`)}`;

  return (
    <div className="ds-shell min-h-screen">
      <PageShell size="md">
        <Panel variant="strong" radius="2xl" className="page-panel-pad">
          <Pill className="mb-5 text-emerald-200">
            {t('tournament.leagueInviteResolved')}
          </Pill>
          <DisplayText as="h1" className="text-5xl md:text-6xl text-white mb-4">
            {invite.league?.name || t('tournament.joinLeagueInviteTitle')}
          </DisplayText>
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
            <Panel radius="sm" className="p-5">
              <div className="flex items-center gap-3 text-emerald-300 mb-3">
                <Users size={18} />
                <Pill compact>{t('tournament.leagueMembers')}</Pill>
              </div>
              <DisplayText as="p" className="text-4xl text-white">
                {formatNumber(invite.league?.memberCount || 0)}
              </DisplayText>
            </Panel>
            <Panel radius="sm" className="p-5">
              <div className="flex items-center gap-3 text-cyan-300 mb-3">
                <Shield size={18} />
                <Pill compact>{t('tournament.access')}</Pill>
              </div>
              <p className="text-white font-semibold text-lg capitalize">
                {invite.tournament?.accessType || 'public'}
              </p>
            </Panel>
            <Panel radius="sm" className="p-5">
              <div className="flex items-center gap-3 text-amber-300 mb-3">
                <Trophy size={18} />
                <Pill compact>{t('nav.tournaments')}</Pill>
              </div>
              <p className="text-white font-semibold text-lg">
                {getLocalizedName(invite.tournament, language, invite.tournament?.name || '')}
              </p>
            </Panel>
          </div>

          {!user ? (
            <Panel radius="md" className="p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p className="text-slate-300">
                {t('tournament.signInToJoinLeague')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  as={Link}
                  to={loginRedirect}
                  variant="secondary"
                >
                  {t('auth.login')}
                </Button>
                <Button
                  as={Link}
                  to={registerRedirect}
                  variant="primary"
                >
                  {t('auth.register')}
                </Button>
              </div>
            </Panel>
          ) : invite.access?.requiresTournamentJoin ? (
            <Panel radius="md" className="p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p className="text-slate-300">
                {t('tournament.needTournamentAccessFirst')}
              </p>
              <Button
                as={Link}
                to={`/tournament/${invite.tournament.id}`}
                variant="secondary"
              >
                {t('tournament.openTournament')}
              </Button>
            </Panel>
          ) : invite.access?.isLeagueMember ? (
            <Panel radius="md" className="p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p className="text-slate-300">
                {t('tournament.joinedLeague')}
              </p>
              <Button
                as={Link}
                to={`/league/${invite.league.id}`}
                variant="primary"
              >
                {t('tournament.goToLeague')}
              </Button>
            </Panel>
          ) : (
            <Panel radius="md" className="p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p className="text-slate-300">
                {t('tournament.joinLeagueInviteHelp')}
              </p>
              <Button
                onClick={handleJoinLeague}
                disabled={joining || !invite.access?.canJoinLeague}
                variant="primary"
              >
                {joining ? t('tournament.joining') : t('tournament.joinLeagueFromInvite')}
              </Button>
            </Panel>
          )}
        </Panel>
      </PageShell>
    </div>
  );
}
