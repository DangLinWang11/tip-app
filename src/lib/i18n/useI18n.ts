import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import en from './en.json';
import es from './es.json';

export type Locale = 'en' | 'es';

type TranslationMap = typeof en;

type ReplaceParams = Record<string, string | number>;

const DICTIONARIES: Record<Locale, TranslationMap> = {
  en,
  es
};

interface I18nContextValue {
  language: Locale;
  setLanguage: (locale: Locale) => void;
  t: (key: string, replacements?: ReplaceParams) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const STORAGE_KEY = 'tip.language';

const resolveKey = (key: string, dictionary: TranslationMap): string | Record<string, unknown> | undefined => {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (typeof acc !== 'object' || acc === null) {
      return undefined;
    }
    if (!(part in acc)) {
      return undefined;
    }
    return (acc as Record<string, unknown>)[part];
  }, dictionary) as string | Record<string, unknown> | undefined;
};

const applyReplacements = (text: string, replacements?: ReplaceParams) => {
  if (!replacements) return text;
  return Object.keys(replacements).reduce((acc, token) => {
    const value = replacements[token];
    const pattern = new RegExp(`{{\\s*${token}\\s*}}`, 'g');
    return acc.replace(pattern, String(value));
  }, text);
};

const detectDefaultLanguage = (): Locale => {
  if (typeof window === 'undefined') return 'en';
  const fromStorage = window.localStorage.getItem(STORAGE_KEY);
  if (fromStorage === 'en' || fromStorage === 'es') {
    return fromStorage;
  }
  const browserLang = window.navigator.language?.slice(0, 2);
  return browserLang === 'es' ? 'es' : 'en';
};

export const I18nProvider: React.FC<{ children: React.ReactNode; initialLanguage?: Locale }> = ({
  children,
  initialLanguage
}) => {
  const [language, setLanguage] = useState<Locale>(() => initialLanguage || detectDefaultLanguage());

  const setLanguageSafe = useCallback((locale: Locale) => {
    setLanguage(locale);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, locale);
    }
  }, []);

  const t = useCallback(
    (key: string, replacements?: ReplaceParams) => {
      const dictionary = DICTIONARIES[language] || DICTIONARIES.en;
      const fallbackDictionary = language === 'en' ? DICTIONARIES.es : DICTIONARIES.en;
      const resolved = resolveKey(key, dictionary);
      const fallback = resolveKey(key, fallbackDictionary);
      const phrase = typeof resolved === 'string'
        ? resolved
        : typeof fallback === 'string'
          ? fallback
          : key;
      return applyReplacements(phrase, replacements);
    },
    [language]
  );

  const value = useMemo<I18nContextValue>(() => ({
    language,
    setLanguage: setLanguageSafe,
    t
  }), [language, setLanguageSafe, t]);

  return React.createElement(I18nContext.Provider, { value }, children);
};

export const useI18n = (): I18nContextValue => {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
};

export const AVAILABLE_LANGUAGES: Array<{ code: Locale; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' }
];

