import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Globe2,
  LogOut,
  ShieldCheck,
  Target,
  Trophy,
  Users,
} from 'lucide-react';
import { get, patch, post } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export default function Profile() {
  const { user, logout, loading: authLoading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { t, formatNumber } = useLanguage();

  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    avatarUrl: '',
    showInGlobalRankings: true,
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
  });
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!user) {
      return;
    }

    const loadProfile = async () => {
      try {
        const data = await get('/account/profile');
        setProfile(data);
        setProfileForm({
          name: data?.user?.name || '',
          avatarUrl: data?.user?.avatarUrl || '',
          showInGlobalRankings: data?.user?.showInGlobalRankings !== false,
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
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

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setError('');
    setSuccess('');

    try {
      const response = await patch('/account/profile', profileForm);
      await refreshUser();
      setProfile((prev) => ({
        ...(prev || {}),
        user: response?.user || prev?.user,
      }));
      setSuccess(response?.message || t('auth.updateProfile'));
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    setSavingPassword(true);
    setError('');
    setSuccess('');

    try {
      const response = await post('/account/change-password', passwordForm);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
      });
      setSuccess(response?.message || t('auth.changePassword'));
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const stats = profile?.stats || {};

  if (loading) {
    return (
      <div className="sport-shell min-h-screen flex items-center justify-center">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  const visibilityEnabled = profileForm.showInGlobalRankings;
  const statCards = [
    {
      key: 'tournaments',
      label: t('auth.tournamentsJoined'),
      value: formatNumber(stats.tournamentCount || 0),
      icon: Trophy,
      tone: 'text-amber-300',
    },
    {
      key: 'leagues',
      label: t('auth.leaguesJoined'),
      value: formatNumber(stats.leagueCount || 0),
      icon: Users,
      tone: 'text-cyan-300',
    },
    {
      key: 'total',
      label: t('leaderboard.total'),
      value: formatNumber(stats.totalScore || 0),
      icon: Target,
      tone: 'text-emerald-300',
    },
    {
      key: 'saved',
      label: t('auth.savedPredictions'),
      value: formatNumber(stats.savedPredictionCount || 0),
      icon: ShieldCheck,
      tone: 'text-violet-300',
    },
  ];

  return (
    <div className="sport-shell min-h-screen">
      <div className="page-shell-narrow">
        <div className="sport-panel-strong mb-8 rounded-panel-2xl page-panel-pad">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              {profileForm.avatarUrl ? (
                <img
                  src={profileForm.avatarUrl}
                  alt={profile?.user?.name || user.name}
                  className="h-24 w-24 rounded-panel-lg border border-white/10 object-cover shadow-ds-profile-photo"
                />
              ) : (
                <div className="surface-accent-gradient flex h-24 w-24 items-center justify-center rounded-panel-lg text-5xl font-bold shadow-ds-profile-avatar">
                  {profile?.user?.name?.[0] || user.name?.[0] || 'U'}
                </div>
              )}

              <div>
                <div className="score-pill mb-4 text-emerald-200">
                  {t('nav.profile')}
                </div>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
                  {profile?.user?.name || user.name}
                </h1>
                <p className="text-slate-300 text-lg">
                  {profile?.user?.email || user.email}
                </p>
              </div>
            </div>

            <div className="account-pill-group">
              <div className="account-pill">
                <Globe2 size={16} className={visibilityEnabled ? 'text-emerald-300' : 'text-slate-400'} />
                <span>
                  {visibilityEnabled ? t('auth.globalRankingsVisible') : t('leaderboard.hiddenRank')}
                </span>
              </div>
              <div className="account-pill">
                <ShieldCheck size={16} className="text-cyan-300" />
                <span>{t('profile.security')}</span>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="account-feedback account-feedback-error mb-8">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="account-feedback account-feedback-success mb-8">
            {success}
          </div>
        ) : null}

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5 mb-8">
          {statCards.map((stat) => {
            const Icon = stat.icon;

            return (
              <div key={stat.key} className="sport-panel rounded-panel-sm p-5">
                <div className={`flex items-center gap-3 mb-3 ${stat.tone}`}>
                  <Icon size={18} />
                  <span className="score-pill">{stat.label}</span>
                </div>
                <p className="sport-display text-4xl text-white">
                  {stat.value}
                </p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.92fr] lg:gap-10">
          <div className="sport-panel-strong space-y-5 rounded-panel-lg page-panel-pad">
            <h2 className="sport-display text-3xl text-white">
              {t('profile.profileDetails')}
            </h2>

            <div>
              <label className="account-label">
                {t('auth.displayName')}
              </label>
              <input
                type="text"
                value={profileForm.name}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, name: event.target.value }))
                }
                className="account-input"
              />
            </div>

            <div>
              <label className="account-label">
                {t('auth.avatarUrl')}
              </label>
              <input
                type="url"
                value={profileForm.avatarUrl}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, avatarUrl: event.target.value }))
                }
                className="account-input"
                placeholder="https://"
              />
            </div>

            <div className="account-toggle-card">
              <div className="flex items-start justify-between gap-4">
                <div className="pr-2">
                  <div className="score-pill text-emerald-200 mb-3">
                    <Globe2 size={14} />
                    {t('nav.globalLeaderboard')}
                  </div>
                  <h3 className="text-xl font-semibold text-white">
                    {t('auth.globalRankingsVisible')}
                  </h3>
                  <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                    {t('auth.globalRankingsVisibleHelp')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setProfileForm((prev) => ({
                      ...prev,
                      showInGlobalRankings: !prev.showInGlobalRankings,
                    }))
                  }
                  className={`account-toggle ${profileForm.showInGlobalRankings ? 'account-toggle-on' : 'account-toggle-off'}`}
                  aria-pressed={profileForm.showInGlobalRankings}
                >
                  <span className="account-toggle-thumb" />
                </button>
              </div>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="sport-button w-full py-3.5 rounded-2xl text-slate-950 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {savingProfile ? t('auth.updatingProfile') : t('auth.updateProfile')}
            </button>
          </div>

          <div className="space-y-6">
            <div className="sport-panel space-y-5 rounded-panel-lg page-panel-pad">
              <h2 className="sport-display text-3xl text-white">
                {t('profile.rankingPrivacy')}
              </h2>
              <p className="text-slate-300 leading-relaxed">
                {t('profile.security')}
              </p>
              <div className="account-subtle-panel">
                <p className="text-sm text-slate-300">
                  {visibilityEnabled
                    ? t('auth.globalRankingsVisibleHelp')
                    : t('leaderboard.visibilityOff')}
                </p>
              </div>
            </div>

            <div className="sport-panel-strong space-y-5 rounded-panel-lg page-panel-pad">
              <h2 className="sport-display text-3xl text-white">
                {t('profile.security')}
              </h2>
              <div>
                <label className="account-label">
                  {t('auth.currentPassword')}
                </label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                  }
                  className="account-input"
                />
              </div>
              <div>
                <label className="account-label">
                  {t('auth.newPassword')}
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                  }
                  className="account-input"
                />
              </div>
              <button
                onClick={handleChangePassword}
                disabled={savingPassword}
                className="sport-button-secondary w-full py-3.5 rounded-2xl text-emerald-300 font-bold hover:text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {savingPassword ? t('auth.changingPassword') : t('auth.changePassword')}
              </button>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mt-8">
          <button
            onClick={() => navigate('/')}
            className="account-secondary-action"
          >
            <ArrowLeft size={18} />
            <span>{t('common.back')}</span>
          </button>
          <button
            onClick={handleLogout}
            className="account-danger-action"
          >
            <LogOut size={18} />
            <span>{t('nav.logout')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
