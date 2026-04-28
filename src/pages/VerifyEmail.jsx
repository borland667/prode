import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { post } from '../utils/api';
import { useLanguage } from '../i18n/LanguageContext';
import { Button } from '../components/ui/DesignSystem';

export default function VerifyEmail() {
  const { t } = useLanguage();
  const location = useLocation();
  const routeState = location.state || {};
  const token = useMemo(() => new URLSearchParams(location.search).get('token') || '', [location.search]);
  const email = useMemo(() => new URLSearchParams(location.search).get('email') || '', [location.search]);

  const [loading, setLoading] = useState(Boolean(token));
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(routeState.message || '');
  const [previewUrl, setPreviewUrl] = useState(routeState.verifyUrl || '');

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    const verify = async () => {
      setLoading(true);
      setError('');
      setSuccess('');

      try {
        const response = await post('/auth/verify-email', { token });
        if (!cancelled) {
          setSuccess(response?.message || t('auth.verificationSuccess'));
        }
      } catch (err) {
        if (!cancelled) {
          setError(t(err.message));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    verify();

    return () => {
      cancelled = true;
    };
  }, [token, t]);

  const handleResend = async () => {
    if (!email) {
      return;
    }

    setResending(true);
    setError('');
    setSuccess('');
    setPreviewUrl('');

    try {
      const response = await post('/auth/resend-verification', { email });
      setSuccess(response?.message || t('auth.verificationResendSuccess'));
      setPreviewUrl(response?.verifyUrl || '');
    } catch (err) {
      setError(t(err.message));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="ds-shell app-auth-shell">
      <div className="app-auth-card">
        <div className="text-center">
          <div className="ds-pill mx-auto mb-4 text-emerald-200">
            {t('auth.verifyEmail')}
          </div>
          <h1 className="ds-display app-auth-title text-white mb-2">
            {token ? t('auth.verifyEmail') : t('auth.verificationPendingTitle')}
          </h1>
          <p className="text-gray-400">
            {token ? t('auth.verificationHelp') : t('auth.verificationPendingHelp')}
          </p>
          {email ? (
            <p className="mt-2 text-sm text-emerald-300 break-all">{email}</p>
          ) : null}
        </div>

        {loading ? (
          <div className="app-alert app-alert-success">
            {t('common.loading')}
          </div>
        ) : null}

        {error ? (
          <div className="app-alert app-alert-error">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="app-alert app-alert-success space-y-3">
            <p>{success}</p>
            {previewUrl ? (
              <a href={previewUrl} className="text-emerald-200 underline break-all">
                {previewUrl}
              </a>
            ) : null}
          </div>
        ) : null}

        {!token ? (
          <Button
            onClick={handleResend}
            disabled={resending || !email}
            variant="primary"
            block
          >
            {resending ? t('auth.resendingVerification') : t('auth.resendVerification')}
          </Button>
        ) : null}

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
