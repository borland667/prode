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
    <div className="sport-shell app-auth-shell">
      <div className="app-auth-card space-y-6">
          <div className="text-center">
            <div className="score-pill mx-auto mb-4 text-emerald-200">
              {t('auth.resetPassword')}
            </div>
            <h1 className="sport-display text-5xl text-white mb-2">
              {t('auth.resetPassword')}
            </h1>
            <p className="text-gray-400">
              {t('auth.newPassword')}
            </p>
          </div>

          {!token ? (
            <div className="app-alert app-alert-error">
              {t('common.error')}
            </div>
          ) : null}

          {error ? (
            <div className="app-alert app-alert-error">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="app-alert app-alert-success">
              {success}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="account-label">
                {t('auth.newPassword')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={!token}
                className="app-input disabled:opacity-50"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              className="app-button-primary"
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
  );
}
