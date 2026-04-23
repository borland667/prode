/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import { EN, ES, PT, IT, NL } from './translations';

const LanguageContext = createContext();

const BUNDLES = {
  en: EN,
  es: ES,
  pt: PT,
  it: IT,
  nl: NL,
};

const SUPPORTED_LANGUAGES = new Set(['en', 'es', 'pt', 'it', 'nl']);

const DEFAULT_LOCALE_BY_LANGUAGE = {
  en: 'en-US',
  es: 'es-AR',
  pt: 'pt-BR',
  it: 'it-IT',
  nl: 'nl-NL',
};

function normalizeLocaleTag(raw) {
  if (!raw || typeof raw !== 'string') {
    return '';
  }

  return raw.trim().replace(/_/g, '-');
}

function getSupportedLocale(locale) {
  if (!locale || typeof locale !== 'string') {
    return null;
  }

  return Intl.DateTimeFormat.supportedLocalesOf([locale])[0] || null;
}

/**
 * Intl may resolve a bare language tag (e.g. "pt") without a region; use our
 * default region so dates and numbers stay consistent across engines.
 */
function normalizeFormattingLocale(resolvedTag, language) {
  if (!resolvedTag || typeof resolvedTag !== 'string') {
    return DEFAULT_LOCALE_BY_LANGUAGE[language] || DEFAULT_LOCALE_BY_LANGUAGE.en;
  }

  const supported = getSupportedLocale(resolvedTag.replace(/_/g, '-'));
  if (!supported) {
    return DEFAULT_LOCALE_BY_LANGUAGE[language] || DEFAULT_LOCALE_BY_LANGUAGE.en;
  }

  if (!supported.includes('-')) {
    return DEFAULT_LOCALE_BY_LANGUAGE[language] || DEFAULT_LOCALE_BY_LANGUAGE.en;
  }

  const base = supported.split('-')[0]?.toLowerCase();
  if (base !== language) {
    return DEFAULT_LOCALE_BY_LANGUAGE[language] || DEFAULT_LOCALE_BY_LANGUAGE.en;
  }

  return supported;
}

function getNavigatorLanguageCandidates() {
  if (typeof navigator === 'undefined') {
    return [];
  }

  if (Array.isArray(navigator.languages) && navigator.languages.length) {
    return navigator.languages;
  }

  return navigator.language ? [navigator.language] : [];
}

function getInitialLanguage() {
  const storedLanguage = localStorage.getItem('language');
  if (SUPPORTED_LANGUAGES.has(storedLanguage)) {
    return storedLanguage;
  }

  for (const raw of getNavigatorLanguageCandidates()) {
    const candidate = normalizeLocaleTag(raw);
    if (!candidate) {
      continue;
    }

    const base = candidate.split('-')[0]?.toLowerCase();
    if (SUPPORTED_LANGUAGES.has(base)) {
      return base;
    }
  }

  return 'en';
}

function pickLocaleForLanguage(language) {
  for (const raw of getNavigatorLanguageCandidates()) {
    const candidate = normalizeLocaleTag(raw);
    if (!candidate) {
      continue;
    }

    const base = candidate.split('-')[0]?.toLowerCase();
    if (base !== language) {
      continue;
    }

    const supported = getSupportedLocale(candidate);
    if (supported) {
      return normalizeFormattingLocale(supported, language);
    }
  }

  return DEFAULT_LOCALE_BY_LANGUAGE[language] || DEFAULT_LOCALE_BY_LANGUAGE.en;
}

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(getInitialLanguage);
  const [, setLocaleRevision] = useState(0);

  useEffect(() => {
    const onLanguageChange = () => {
      setLocaleRevision((n) => n + 1);
    };

    window.addEventListener('languagechange', onLanguageChange);
    return () => window.removeEventListener('languagechange', onLanguageChange);
  }, []);

  const locale = pickLocaleForLanguage(language);

  const setLanguage = (lang) => {
    const nextLanguage = SUPPORTED_LANGUAGES.has(lang) ? lang : 'en';
    setLanguageState(nextLanguage);
    localStorage.setItem('language', nextLanguage);
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = (key) => {
    const keys = key.split('.');
    const translations = BUNDLES[language] || EN;
    let value = translations;

    for (const k of keys) {
      value = value?.[k];
    }

    return value || key;
  };

  const formatNumber = (value, options = {}) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return String(value ?? '');
    }

    return new Intl.NumberFormat(locale, options).format(numericValue);
  };

  const formatCurrency = (value, currency = 'USD', options = {}) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return String(value ?? '');
    }

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      ...options,
    }).format(numericValue);
  };

  const formatDate = (value, options = {}) => {
    if (!value) {
      return '';
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return new Intl.DateTimeFormat(locale, options).format(date);
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        locale,
        setLanguage,
        t,
        formatDate,
        formatNumber,
        formatCurrency,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
