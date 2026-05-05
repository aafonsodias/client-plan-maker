import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "./locales/en/common.json";
import enPlan from "./locales/en/plan.json";
import enIntake from "./locales/en/intake.json";
import enAssessment from "./locales/en/assessment.json";
import enManual from "./locales/en/manual.json";
import enSchedule from "./locales/en/schedule.json";
import ptCommon from "./locales/pt/common.json";
import ptPlan from "./locales/pt/plan.json";
import ptIntake from "./locales/pt/intake.json";
import ptAssessment from "./locales/pt/assessment.json";
import ptManual from "./locales/pt/manual.json";
import ptSchedule from "./locales/pt/schedule.json";
import esCommon from "./locales/es/common.json";
import esPlan from "./locales/es/plan.json";
import esIntake from "./locales/es/intake.json";
import esAssessment from "./locales/es/assessment.json";
import esManual from "./locales/es/manual.json";
import esSchedule from "./locales/es/schedule.json";
import hiCommon from "./locales/hi/common.json";
import hiPlan from "./locales/hi/plan.json";
import hiIntake from "./locales/hi/intake.json";
import hiAssessment from "./locales/hi/assessment.json";
import hiManual from "./locales/hi/manual.json";
import hiSchedule from "./locales/hi/schedule.json";

export const SUPPORTED_LOCALES = ["en", "pt", "es", "hi"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const LOCALE_STORAGE_KEY = "forge.locale";

// Avoid double-init under React StrictMode / HMR.
// IMPORTANT: SSR has no localStorage/navigator, so it always renders in the
// fallback locale. To prevent React hydration mismatches, the client's FIRST
// paint must also use that same fallback. The persisted locale is only
// applied after hydration via `applyPersistedLocale()` (called from the
// root component's useEffect).
if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      // EN owns all keys — PT JSON is intentionally sparse and falls back to EN.
      fallbackLng: "en",
      lng: "en",
      supportedLngs: SUPPORTED_LOCALES as unknown as string[],
      ns: ["common", "plan", "intake", "assessment", "manual", "schedule"],
      defaultNS: "common",
      resources: {
        en: { common: enCommon, plan: enPlan, intake: enIntake, assessment: enAssessment, manual: enManual, schedule: enSchedule },
        pt: { common: ptCommon, plan: ptPlan, intake: ptIntake, assessment: ptAssessment, manual: ptManual, schedule: ptSchedule },
        es: { common: esCommon, plan: esPlan, intake: esIntake, assessment: esAssessment, manual: esManual, schedule: esSchedule },
        hi: { common: hiCommon, plan: hiPlan, intake: hiIntake, assessment: hiAssessment, manual: hiManual, schedule: hiSchedule },
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

  // Keep <html lang> in sync with the active language for a11y + SEO.
  if (typeof document !== "undefined") {
    const sync = () => {
      const lng = (i18n.resolvedLanguage ?? i18n.language ?? "en").slice(0, 2);
      document.documentElement.lang = lng;
    };
    sync();
    i18n.on("languageChanged", sync);
  }
}

/**
 * Reads the persisted locale from localStorage (or browser language) and
 * applies it. MUST only be called on the client, after hydration.
 */
export function applyPersistedLocale(): void {
  if (typeof window === "undefined") return;
  let target: string | null = null;
  try {
    target = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    target = null;
  }
  if (!target && typeof navigator !== "undefined") {
    target = (navigator.language || "en").slice(0, 2);
  }
  const normalized = (target ?? "en").slice(0, 2);
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(normalized)) return;
  if (i18n.language === normalized) return;
  void i18n.changeLanguage(normalized);
  // Persist for next visit.
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, normalized);
  } catch {}
}

export default i18n;