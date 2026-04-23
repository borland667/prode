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
import { Button, DisplayText, PageShell, Panel, Pill } from '../components/ui/DesignSystem';

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
      <div className="ds-shell min-h-screen flex items-center justify-center">
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
      <div className="ds-shell min-h-screen flex items-center justify-center">
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
    <div className="ds-shell min-h-screen">
      <PageShell size="narrow" className="profile-page">
        <Panel variant="strong" padding="normal" radius="2xl" className="profile-hero">
          <div className="profile-hero__layout">
            <div className="profile-hero__identity">
              {profileForm.avatarUrl ? (
                <img
                  src={profileForm.avatarUrl}
                  alt={profile?.user?.name || user.name}
                  className="profile-hero__avatar border border-white/10 object-cover shadow-ds-profile-photo"
                />
              ) : (
                <div className="profile-hero__avatar surface-accent-gradient flex items-center justify-center text-5xl font-bold shadow-ds-profile-avatar">
                  {profile?.user?.name?.[0] || user.name?.[0] || 'U'}
                </div>
              )}

              <div className="profile-hero__copy">
                <Pill compact className="mb-4 text-emerald-200">
                  {t('nav.profile')}
                </Pill>
                <h1 className="mb-2 text-4xl font-bold text-white md:text-5xl">
                  {profile?.user?.name || user.name}
                </h1>
                <p className="text-lg text-slate-300">
                  {profile?.user?.email || user.email}
                </p>
              </div>
            </div>

            <div className="profile-hero__badges">
              <Pill className="text-emerald-200">
                <Globe2 size={16} className={visibilityEnabled ? 'text-emerald-300' : 'text-slate-400'} />
                <span>
                  {visibilityEnabled ? t('auth.globalRankingsVisible') : t('leaderboard.hiddenRank')}
                </span>
              </Pill>
              <Pill className="text-cyan-200">
                <ShieldCheck size={16} className="text-cyan-300" />
                <span>{t('profile.security')}</span>
              </Pill>
            </div>
          </div>
        </Panel>

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

        <div className="profile-stat-grid">
          {statCards.map((stat) => {
            const Icon = stat.icon;

            return (
              <Panel key={stat.key} radius="sm" className="profile-stat-card">
                <div className={`mb-3 flex items-center gap-3 ${stat.tone}`}>
                  <Icon size={18} />
                  <Pill compact>{stat.label}</Pill>
                </div>
                <DisplayText as="p" className="text-4xl text-white">
                  {stat.value}
                </DisplayText>
              </Panel>
            );
          })}
        </div>

        <div className="profile-main-grid">
          <Panel variant="strong" padding="normal" radius="lg" className="profile-section">
            <DisplayText className="text-3xl text-white">
              {t('profile.profileDetails')}
            </DisplayText>

            <div className="profile-field">
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

            <div className="profile-field">
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

            <div className="account-toggle-card profile-toggle-card">
              <div className="profile-toggle-card__content">
                <div className="min-w-0">
                  <Pill className="mb-3 text-emerald-200">
                    <Globe2 size={14} />
                    {t('nav.globalLeaderboard')}
                  </Pill>
                  <h3 className="profile-toggle-card__title">
                    {t('auth.globalRankingsVisible')}
                  </h3>
                  <p className="profile-toggle-card__text">
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

            <Button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              block
              className="disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingProfile ? t('auth.updatingProfile') : t('auth.updateProfile')}
            </Button>
          </Panel>

          <div className="profile-side-stack">
            <Panel padding="normal" radius="lg" className="profile-section">
              <DisplayText className="text-3xl text-white">
                {t('profile.rankingPrivacy')}
              </DisplayText>
              <div className="account-subtle-panel profile-subtle-panel">
                <Pill compact className="mb-3 text-cyan-200">
                  <Globe2 size={14} />
                  {t('nav.globalLeaderboard')}
                </Pill>
                <p className="profile-subtle-panel__text">
                  {visibilityEnabled
                    ? t('auth.globalRankingsVisibleHelp')
                    : t('leaderboard.visibilityOff')}
                </p>
              </div>
            </Panel>

            <Panel variant="strong" padding="normal" radius="lg" className="profile-section">
              <DisplayText className="text-3xl text-white">
                {t('profile.security')}
              </DisplayText>
              <div className="profile-field">
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
              <div className="profile-field">
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
              <Button
                variant="secondary"
                onClick={handleChangePassword}
                disabled={savingPassword}
                block
                className="disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingPassword ? t('auth.changingPassword') : t('auth.changePassword')}
              </Button>
            </Panel>
          </div>
        </div>

        <div className="profile-footer-actions">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            block
          >
            <ArrowLeft size={18} />
            <span>{t('common.back')}</span>
          </Button>
          <Button
            variant="danger"
            onClick={handleLogout}
            block
          >
            <LogOut size={18} />
            <span>{t('nav.logout')}</span>
          </Button>
        </div>
      </PageShell>
    </div>
  );
}
