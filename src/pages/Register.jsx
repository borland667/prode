import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const redirectTo = new URLSearchParams(location.search).get('redirect') || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setLoading(true);

    try {
      await register(name, email, password);
      navigate(redirectTo);
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
              {t('auth.register')}
            </div>
            <h1 className="sport-display text-5xl text-white mb-2">
              {t('auth.register')}
            </h1>
            <p className="text-gray-400">
              {t('auth.noAccount')}{' '}
              <Link
                to="/login"
                className="text-emerald-400 hover:text-emerald-300 transition"
              >
                {t('auth.loginHere')}
              </Link>
            </p>
          </div>

          {error && (
            <div className="app-alert app-alert-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="account-label">
                {t('auth.name')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="app-input"
                placeholder="Your Name"
              />
            </div>

            <div>
              <label className="account-label">
                {t('auth.email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="app-input"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="account-label">
                {t('auth.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="app-input"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="account-label">
                {t('auth.confirmPassword')}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="app-input"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="app-button-primary"
            >
              {loading ? t('common.loading') : t('auth.register')}
            </button>
          </form>

          <div className="app-divider">
            <span>O</span>
          </div>

          <button
            onClick={() => {
              sessionStorage.setItem('postAuthRedirect', redirectTo);
              loginWithGoogle();
            }}
            className="app-button-secondary"
          >
            {t('auth.signupGoogle')}
          </button>

          <div className="text-center text-sm text-gray-400">
            <Link
              to="/"
              className="text-emerald-400 hover:text-emerald-300 transition"
            >
              {t('common.back')}
            </Link>
          </div>
      </div>
    </div>
  );
}
