import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zh from "../locales/zh/translation.json";
import en from "../locales/en/translation.json";

let initialized = false;

export function initI18n(): void {
  if (initialized) return;
  initialized = true;
  i18n.use(initReactI18next).init({
    resources: {
      zh: { translation: zh },
      en: { translation: en },
    },
    lng: "zh",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
}

export { i18n };
