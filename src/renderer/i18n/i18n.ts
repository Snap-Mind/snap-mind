import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslations from './locales/en.json';
import zhHansTranslations from './locales/zh-Hans.json';
import zhHantTranslations from './locales/zh-Hant.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslations,
      },
      'zh-Hans': {
        translation: zhHansTranslations,
      },
      'zh-Hant': {
        translation: zhHantTranslations,
      },
    },
    fallbackLng: {
      'zh-HK': ['zh-Hant', 'en'],
      'zh-TW': ['zh-Hant', 'en'],
      'zh-CN': ['zh-Hans', 'en'],
      default: ['en'],
    },
    load: 'currentOnly',
    interpolation: {
      escapeValue: true,
    },
  });

export default i18n;
