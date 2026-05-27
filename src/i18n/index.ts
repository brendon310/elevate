import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import it from './it.json';

const STORAGE_KEY = 'forge_lang';

function detectLanguage(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  const nav = navigator.language.split('-')[0];
  return ['it'].includes(nav) ? nav : 'en';
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      it: { translation: it },
    },
    lng: detectLanguage(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;
export { STORAGE_KEY };
