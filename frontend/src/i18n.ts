import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enJson from './locales/en.json';
import ruJson from './locales/ru.json';
import uzJson from './locales/uz.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    debug: false,
    fallbackLng: 'ru',
    interpolation: {
      escapeValue: false,
    },
    resources: {
      en: {
        translation: enJson,
      },
      ru: {
        translation: ruJson,
      },
      uz: {
        translation: uzJson,
      },
    },
  });

export default i18n;
