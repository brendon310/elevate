import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import it from './it.json';
import es from './es.json';
import fr from './fr.json';
import pt from './pt.json';
import de from './de.json';

const savedLang = localStorage.getItem('forge_lang') ||
  (navigator.language.startsWith('it') ? 'it' :
   navigator.language.startsWith('es') ? 'es' :
   navigator.language.startsWith('fr') ? 'fr' :
   navigator.language.startsWith('pt') ? 'pt' :
   navigator.language.startsWith('de') ? 'de' : 'en');

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    it: { translation: it },
    es: { translation: es },
    fr: { translation: fr },
    pt: { translation: pt },
    de: { translation: de },
  },
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
export type SupportedLanguage = 'en' | 'it' | 'es' | 'fr' | 'pt' | 'de';
