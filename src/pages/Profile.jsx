import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export default function Profile() {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  if (loading) {
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-white mb-8">
          {t('nav.profile')}
        </h1>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 space-y-6">
          {/* User Avatar and Name */}
          <div className="flex items-center space-x-6">
            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center text-slate-900 text-4xl font-bold">
              {user.name?.[0] || 'U'}
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white">
                {user.name}
              </h2>
              <p className="text-gray-400">
                {user.email}
              </p>
            </div>
          </div>

          <hr className="border-slate-700" />

          {/* User Stats */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-center">
              <p className="text-gray-400 text-sm mb-2">
                {t('tournament.participants')}
              </p>
              <p className="text-white font-bold text-2xl">
                0
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-center">
              <p className="text-gray-400 text-sm mb-2">
                {t('leaderboard.total')}
              </p>
              <p className="text-emerald-400 font-bold text-2xl">
                0
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-center">
              <p className="text-gray-400 text-sm mb-2">
                {t('admin.saved')}
              </p>
              <p className="text-white font-bold text-2xl">
                0
              </p>
            </div>
          </div>

          <hr className="border-slate-700" />

          {/* Actions */}
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
