/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';
import { EN, ES } from './translations';

const LanguageContext = createContext();
const SUPPORTED_LANGUAGES = new Set(['en', 'es']);

function getInitialLanguage() {
  const storedLanguage = localStorage.getItem('language');
  if (SUPPORTED_LANGUAGES.has(storedLanguage)) {
    return storedLanguage;
  }

  const browserLanguage = navigator.language?.split('-')[0]?.toLowerCase();
  if (SUPPORTED_LANGUAGES.has(browserLanguage)) {
    return browserLanguage;
  }

  return 'en';
}

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(getInitialLanguage);

  const setLanguage = (lang) => {
    const nextLanguage = SUPPORTED_LANGUAGES.has(lang) ? lang : 'en';
    setLanguageState(nextLanguage);
    localStorage.setItem('language', nextLanguage);
  };

  const t = (key) => {
    const keys = key.split('.');
    const translations = language === 'es' ? ES : EN;
    let value = translations;

    for (const k of keys) {
      value = value?.[k];
    }

    return value || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
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
