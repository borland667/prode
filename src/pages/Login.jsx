import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Button } from '../components/ui/DesignSystem';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const redirectTo = new URLSearchParams(location.search).get('redirect') || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate(redirectTo);
    } catch (err) {
      setError(t(err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ds-shell app-auth-shell">
      <div className="app-auth-card">
          <div className="text-center">
            <div className="ds-pill mx-auto mb-4 text-emerald-200">
              {t('nav.profile')}
            </div>
            <h1 className="ds-display app-auth-title text-white mb-2">
              {t('auth.login')}
            </h1>
            <p className="text-gray-400">
              {t('auth.haveAccount')}{' '}
              <Link
                to="/register"
                className="text-emerald-400 hover:text-emerald-300 transition"
              >
                {t('auth.signupHere')}
              </Link>
            </p>
          </div>

          {error && (
            <div className="app-alert app-alert-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="app-auth-form">
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
                placeholder={t('auth.emailPlaceholder')}
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
                placeholder={t('auth.passwordPlaceholder')}
              />
              <div className="app-auth-link-row">
                <Link
                  to="/forgot-password"
                  className="text-sm text-emerald-400 hover:text-emerald-300 transition"
                >
                  {t('auth.forgotPassword')}
                </Link>
              </div>
            </div>

            <Button type="submit" disabled={loading} variant="primary" block>
              {loading ? t('common.loading') : t('auth.login')}
            </Button>
          </form>

          <div className="app-divider">
            <span>{t('common.or')}</span>
          </div>

          <Button
            onClick={() => {
              sessionStorage.setItem('postAuthRedirect', redirectTo);
              loginWithGoogle();
            }}
            variant="secondary"
            block
          >
            {t('auth.loginGoogle')}
          </Button>

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
