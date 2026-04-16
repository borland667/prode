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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-2">
              {t('auth.resetPassword')}
            </h1>
            <p className="text-gray-400">
              {t('auth.resetPasswordHelp')}
            </p>
          </div>

          {error ? (
            <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="bg-green-900 border border-green-700 text-green-100 px-4 py-3 rounded space-y-3">
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('auth.email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none transition"
                placeholder="your@email.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
    </div>
  );
}
