import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "./locales/en/common.json";
import enPlan from "./locales/en/plan.json";
import ptCommon from "./locales/pt/common.json";
import ptPlan from "./locales/pt/plan.json";

export const SUPPORTED_LOCALES = ["en", "pt"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const LOCALE_STORAGE_KEY = "forge.locale";

// Avoid double-init under React StrictMode / HMR.
if (!i18n.isInitialized) {
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      // EN owns all keys — PT JSON is intentionally sparse and falls back to EN.
      fallbackLng: "en",
      supportedLngs: SUPPORTED_LOCALES as unknown as string[],
      ns: ["common", "plan"],
      defaultNS: "common",
      resources: {
        en: { common: enCommon, plan: enPlan },
        pt: { common: ptCommon, plan: ptPlan },
      },
      detection: {
        order: ["localStorage", "navigator"],
        lookupLocalStorage: LOCALE_STORAGE_KEY,
        caches: ["localStorage"],
      },
      interpolation: { escapeValue: false }, // React already escapes
      returnNull: false,
      // Dev-only logging for missing keys; silent in prod.
      saveMissing: import.meta.env.DEV,
      missingKeyHandler: (lngs, ns, key) => {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn(`[i18n] missing key: ${ns}:${key} (${lngs.join(",")})`);
        }
      },
      react: { useSuspense: false },
    });
}

export default i18n;