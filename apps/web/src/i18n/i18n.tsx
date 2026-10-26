import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { uiStrings, type Lang } from './ui-strings';

export type { Lang } from './ui-strings';

export type MessageDict = Record<string, Record<Lang, string>>;
export type TranslateParams = Record<string, string | number>;

const registeredMessages: MessageDict = {};
const warnedKeys = new Set<string>();

/** Registers message keys (for example from the knowledge package) for all languages. */
export function registerMessages(dict: MessageDict): void {
  Object.assign(registeredMessages, dict);
}

function translate(lang: Lang, key: string, params?: TranslateParams): string {
  const template = uiStrings[lang][key] ?? registeredMessages[key]?.[lang];
  if (template === undefined) {
    if (!warnedKeys.has(key)) {
      warnedKeys.add(key);
      console.warn(`[i18n] Missing message key: ${key}`);
    }
    return key;
  }
  if (params === undefined) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, params?: TranslateParams) => string;
}

const defaultI18n: I18nValue = {
  lang: 'en',
  setLang: () => {},
  t: (key, params) => translate('en', key, params),
};

const I18nContext = createContext<I18nValue>(defaultI18n);

/** Provides the current language and translation function to the tree. */
export function I18nProvider({ lang: initialLang, children }: { lang: Lang; children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang);

  useEffect(() => {
    setLang(initialLang);
  }, [initialLang]);

  const t = useCallback(
    (key: string, params?: TranslateParams) => translate(lang, key, params),
    [lang],
  );

  const value = useMemo<I18nValue>(() => ({ lang, setLang, t }), [lang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Returns the current language, setter and translation function. */
export function useT(): I18nValue {
  return useContext(I18nContext);
}
