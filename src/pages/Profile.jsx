import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { get, patch, post } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export default function Profile() {
  const { user, logout, loading: authLoading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    avatarUrl: '',
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-white mb-8">
          {t('nav.profile')}
        </h1>

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

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 space-y-8">
          <div className="flex items-center space-x-6">
            {profileForm.avatarUrl ? (
              <img
                src={profileForm.avatarUrl}
                alt={profile?.user?.name || user.name}
                className="w-20 h-20 rounded-full object-cover border border-slate-700"
              />
            ) : (
              <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center text-slate-900 text-4xl font-bold">
                {profile?.user?.name?.[0] || user.name?.[0] || 'U'}
              </div>
            )}
            <div>
              <h2 className="text-3xl font-bold text-white">
                {profile?.user?.name || user.name}
              </h2>
              <p className="text-gray-400">
                {profile?.user?.email || user.email}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-center">
              <p className="text-gray-400 text-sm mb-2">{t('auth.tournamentsJoined')}</p>
              <p className="text-white font-bold text-2xl">{stats.tournamentCount || 0}</p>
            </div>
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-center">
              <p className="text-gray-400 text-sm mb-2">{t('auth.leaguesJoined')}</p>
              <p className="text-white font-bold text-2xl">{stats.leagueCount || 0}</p>
            </div>
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-center">
              <p className="text-gray-400 text-sm mb-2">{t('leaderboard.total')}</p>
              <p className="text-emerald-400 font-bold text-2xl">{stats.totalScore || 0}</p>
            </div>
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-center">
              <p className="text-gray-400 text-sm mb-2">{t('auth.savedPredictions')}</p>
              <p className="text-white font-bold text-2xl">{stats.savedPredictionCount || 0}</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 space-y-4">
              <h3 className="text-2xl font-bold text-white">
                {t('profile.profileDetails')}
              </h3>
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {t('auth.displayName')}
                </label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(event) =>
                    setProfileForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {t('auth.avatarUrl')}
                </label>
                <input
                  type="url"
                  value={profileForm.avatarUrl}
                  onChange={(event) =>
                    setProfileForm((prev) => ({ ...prev, avatarUrl: event.target.value }))
                  }
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="w-full py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {savingProfile ? t('auth.updatingProfile') : t('auth.updateProfile')}
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 space-y-4">
              <h3 className="text-2xl font-bold text-white">
                {t('profile.security')}
              </h3>
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {t('auth.currentPassword')}
                </label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                  }
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {t('auth.newPassword')}
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                  }
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <button
                onClick={handleChangePassword}
                disabled={savingPassword}
                className="w-full py-3 border-2 border-emerald-500 text-emerald-400 rounded-lg font-semibold hover:bg-emerald-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {savingPassword ? t('auth.changingPassword') : t('auth.changePassword')}
              </button>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex-1 px-6 py-3 border-2 border-slate-700 text-white rounded-lg font-semibold hover:border-emerald-500 hover:bg-slate-700 transition"
            >
              {t('common.back')}
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition"
            >
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
