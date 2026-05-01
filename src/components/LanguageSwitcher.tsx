import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { SUPPORTED_LOCALES, LOCALE_STORAGE_KEY, type Locale } from "@/i18n";

/**
 * Segmented control: PT | EN (uppercase per founder preference).
 * Persists to localStorage under "forge.locale" via i18next-browser-languagedetector.
 * No page reload — react-i18next re-renders subscribed components.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation("common");
  const current = (
    SUPPORTED_LOCALES.includes(i18n.resolvedLanguage as Locale)
      ? (i18n.resolvedLanguage as Locale)
      : "en"
  );

  const change = (next: Locale) => {
    if (next === current) return;
    // i18next-browser-languagedetector persists to localStorage under
    // LOCALE_STORAGE_KEY automatically (caches: ["localStorage"]).
    // We also write defensively in case detector caching is disabled.
    void i18n.changeLanguage(next).then(() => {
      try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
        document.documentElement.lang = next;
      } catch {
        // ignore
      }
    });
  };

  return (
    <div
      role="group"
      aria-label={t("language.switch_aria")}
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-secondary/40 p-0.5 text-xs font-medium",
        className,
      )}
    >
      {SUPPORTED_LOCALES.map((code) => {
        const active = code === current;
        return (
          <button
            key={code}
            type="button"
            onClick={() => change(code)}
            aria-pressed={active}
            className={cn(
              "rounded-sm px-2 py-1 uppercase tracking-wider transition",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
