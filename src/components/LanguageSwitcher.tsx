import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { SUPPORTED_LOCALES, LOCALE_STORAGE_KEY, type Locale } from "@/i18n";
import { Globe, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Globe-icon dropdown — matches the AppShell language menu so the icon is
 * consistent across landing and the in-app chrome (no flags / no segmented
 * control). Persists to localStorage under "protocol.locale" via
 * i18next-browser-languagedetector.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation("common");
  const activeLanguage = (i18n.language ?? i18n.resolvedLanguage ?? "en").slice(0, 2);
  const current = (
    SUPPORTED_LOCALES.includes(activeLanguage as Locale)
      ? (activeLanguage as Locale)
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("language.switch_aria")}
          title={t("language.switch_aria")}
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground transition hover:text-foreground",
            className,
          )}
        >
          <Globe className="h-4 w-4" />
          <span>{current}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LOCALES.map((code) => (
          <DropdownMenuItem key={code} onSelect={() => change(code)}>
            {current === code ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <span className="mr-2 inline-block h-4 w-4" />
            )}
            {code === "pt"
              ? t("language.portuguese", "Português")
              : code === "es"
                ? t("language.spanish", "Español")
                : code === "hi"
                  ? t("language.hindi", "हिन्दी")
                  : t("language.english", "English")}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
