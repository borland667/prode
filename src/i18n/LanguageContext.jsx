/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import { EN, ES } from './translations';

const LanguageContext = createContext();
const SUPPORTED_LANGUAGES = new Set(['en', 'es']);
const DEFAULT_LOCALE_BY_LANGUAGE = {
  en: 'en-US',
  es: 'es-AR',
};

function getSupportedLocale(locale) {
  if (!locale || typeof locale !== 'string') {
    return null;
  }

  return Intl.DateTimeFormat.supportedLocalesOf([locale])[0] || null;
}

function getBrowserLocale() {
  if (typeof navigator === 'undefined') {
    return null;
  }

  const candidates = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language];

  for (const candidate of candidates) {
    const supported = getSupportedLocale(candidate);
    if (supported) {
      return supported;
    }
  }

  return null;
}

function getInitialLanguage() {
  const storedLanguage = localStorage.getItem('language');
  if (SUPPORTED_LANGUAGES.has(storedLanguage)) {
    return storedLanguage;
  }

  const browserLanguage = getBrowserLocale()?.split('-')[0]?.toLowerCase();
  if (SUPPORTED_LANGUAGES.has(browserLanguage)) {
    return browserLanguage;
  }

  return 'en';
}

function getInitialLocale(language) {
  return getBrowserLocale() || DEFAULT_LOCALE_BY_LANGUAGE[language] || DEFAULT_LOCALE_BY_LANGUAGE.en;
}

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(getInitialLanguage);
  const [locale] = useState(() => getInitialLocale(getInitialLanguage()));

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
    const translations = language === 'es' ? ES : EN;
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
