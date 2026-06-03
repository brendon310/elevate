import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';

export type SupportedLanguage = 'en' | 'it' | 'es' | 'fr' | 'pt' | 'de';

const SUPPORTED: SupportedLanguage[] = ['en', 'it', 'es', 'fr', 'pt', 'de'];

// Only English is bundled eagerly (fallback + instant first paint). The other
// locales are code-split into their own chunks and fetched on demand.
const LOADERS: Record<Exclude<SupportedLanguage, 'en'>, () => Promise<{ default: Record<string, unknown> }>> = {
  it: () => import('./it.json'),
  es: () => import('./es.json'),
  fr: () => import('./fr.json'),
  pt: () => import('./pt.json'),
  de: () => import('./de.json'),
};

function detectLanguage(): SupportedLanguage {
  const saved = localStorage.getItem('forge_lang');
  if (saved && (SUPPORTED as string[]).includes(saved)) return saved as SupportedLanguage;
  const nav = navigator.language.slice(0, 2);
  return (SUPPORTED as string[]).includes(nav) ? (nav as SupportedLanguage) : 'en';
}

const initial = detectLanguage();

i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: initial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

const loaded = new Set<SupportedLanguage>(['en']);

/** Loads a locale bundle on demand (if needed) and switches to it. */
export async function loadLanguage(lang: SupportedLanguage): Promise<void> {
  if (!loaded.has(lang) && lang !== 'en') {
    const mod = await LOADERS[lang]();
    i18n.addResourceBundle(lang, 'translation', mod.default, true, true);
    loaded.add(lang);
  }
  if (i18n.language !== lang) await i18n.changeLanguage(lang);
}

// Preload the detected language before the first render (prevents a flash of
// English for non-English users). main.tsx awaits this promise before mounting.
export const i18nReady: Promise<void> =
  initial !== 'en' ? loadLanguage(initial) : Promise.resolve();

export default i18n;
