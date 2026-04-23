import { useState } from 'react';
import { Link } from 'react-router-dom';
import { post } from '../utils/api';
import { useLanguage } from '../i18n/LanguageContext';

export default function ForgotPassword() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetUrl, setResetUrl] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    setResetUrl('');

    try {
      const response = await post('/auth/forgot-password', { email });
      setSuccess(response?.message || t('auth.resetPasswordHelp'));
      setResetUrl(response?.resetUrl || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ds-shell app-auth-shell">
      <div className="app-auth-card">
          <div className="text-center">
            <div className="ds-pill mx-auto mb-4 text-emerald-200">
              {t('auth.resetPassword')}
            </div>
            <h1 className="ds-display app-auth-title text-white mb-2">
              {t('auth.resetPassword')}
            </h1>
            <p className="text-gray-400">
              {t('auth.resetPasswordHelp')}
            </p>
          </div>

          {error ? (
            <div className="app-alert app-alert-error">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="app-alert app-alert-success space-y-3">
              <p>{success}</p>
              {resetUrl ? (
                <a
                  href={resetUrl}
                  className="text-emerald-200 underline break-all"
                >
                  {resetUrl}
                </a>
              ) : null}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="app-auth-form">
            <div>
              <label className="account-label">
                {t('auth.email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="app-input"
                placeholder="your@email.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="app-button-primary"
            >
              {loading ? t('auth.sendingResetLink') : t('auth.sendResetLink')}
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
