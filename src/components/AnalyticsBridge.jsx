import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import {
  identifyAnalyticsUser,
  initAnalytics,
  resetAnalytics,
  setAnalyticsContext,
  trackPageView,
} from '../utils/analytics';

export default function AnalyticsBridge() {
  const location = useLocation();
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const { language, locale } = useLanguage();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    setAnalyticsContext({
      authenticated: Boolean(user),
      language,
      locale,
      theme,
    });
  }, [language, loading, locale, theme, user]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (user?.id) {
      identifyAnalyticsUser(user, { language, locale, theme });
      return;
    }

    resetAnalytics();
  }, [language, loading, locale, theme, user]);

  useEffect(() => {
    if (loading) {
      return;
    }

    trackPageView(location, {
      authenticated: Boolean(user),
      language,
      locale,
      theme,
    });
  }, [language, loading, locale, location, theme, user]);

  return null;
}
