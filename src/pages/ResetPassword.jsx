import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { post } from '../utils/api';
import { useLanguage } from '../i18n/LanguageContext';

export default function ResetPassword() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const token = useMemo(
    () => new URLSearchParams(location.search).get('token') || '',
    [location.search]
  );

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await post('/auth/reset-password', {
        token,
        password,
      });
      setSuccess(t('auth.resetPasswordSuccess'));
      window.setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-2">
              {t('auth.resetPassword')}
            </h1>
            <p className="text-gray-400">
              {t('auth.newPassword')}
            </p>
          </div>

          {!token ? (
            <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded">
              {t('common.error')}
            </div>
          ) : null}

          {error ? (
            <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="bg-green-900 border border-green-700 text-green-100 px-4 py-3 rounded">
              {success}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('auth.newPassword')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={!token}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none transition disabled:opacity-50"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? t('auth.changingPassword') : t('auth.resetPassword')}
            </button>
          </form>

          <div className="text-center text-sm text-gray-400">
            <Link
              to="/login"
              className="text-emerald-400 hover:text-emerald-300 transition"
            >
              {t('auth.backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
