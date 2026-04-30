import { useEffect, useState, useCallback } from "react";
import { ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type LanguageCode =
  | "pt"
  | "en"
  | "es"
  | "fr"
  | "de"
  | "it"
  | "nl"
  | "pl"
  | "ru"
  | "zh"
  | "ja"
  | "ko";

type Language = {
  code: LanguageCode;
  flag: string;
  nativeName: string;
  /** BCP-47 prefixes used to detect from navigator.language */
  match: string[];
};

export const LANGUAGES: Language[] = [
  { code: "pt", flag: "🇵🇹", nativeName: "Português", match: ["pt"] },
  { code: "en", flag: "🇬🇧", nativeName: "English", match: ["en"] },
  { code: "es", flag: "🇪🇸", nativeName: "Español", match: ["es"] },
  { code: "fr", flag: "🇫🇷", nativeName: "Français", match: ["fr"] },
  { code: "de", flag: "🇩🇪", nativeName: "Deutsch", match: ["de"] },
  { code: "it", flag: "🇮🇹", nativeName: "Italiano", match: ["it"] },
  { code: "nl", flag: "🇳🇱", nativeName: "Nederlands", match: ["nl"] },
  { code: "pl", flag: "🇵🇱", nativeName: "Polski", match: ["pl"] },
  { code: "ru", flag: "🇷🇺", nativeName: "Русский", match: ["ru"] },
  { code: "zh", flag: "🇨🇳", nativeName: "中文", match: ["zh"] },
  { code: "ja", flag: "🇯🇵", nativeName: "日本語", match: ["ja"] },
  { code: "ko", flag: "🇰🇷", nativeName: "한국어", match: ["ko"] },
];

const STORAGE_KEY = "forge.lang";

function detectInitialLanguage(): LanguageCode {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && LANGUAGES.some((l) => l.code === stored)) {
      return stored as LanguageCode;
    }
  } catch {
    // ignore
  }
  const nav = (navigator.language || "en").toLowerCase();
  const found = LANGUAGES.find((l) => l.match.some((m) => nav.startsWith(m)));
  return found?.code ?? "en";
}

export function useLanguage() {
  const [lang, setLang] = useState<LanguageCode>("en");

  useEffect(() => {
    setLang(detectInitialLanguage());
  }, []);

  const update = useCallback((next: LanguageCode) => {
    setLang(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.lang = next;
    } catch {
      // ignore
    }
  }, []);

  return { lang, setLang: update };
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang } = useLanguage();
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[1];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Change language. Current: ${current.nativeName}`}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-2 text-sm text-muted-foreground transition hover:bg-secondary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <span className="text-base leading-none" aria-hidden>
          {current.flag}
        </span>
        <ChevronDown className="h-3 w-3 opacity-70" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {LANGUAGES.map((l) => {
          const active = l.code === lang;
          return (
            <DropdownMenuItem
              key={l.code}
              onSelect={() => setLang(l.code)}
              className="flex items-center gap-2"
            >
              <span className="text-base leading-none" aria-hidden>
                {l.flag}
              </span>
              <span className="flex-1 text-sm">{l.nativeName}</span>
              {active && <Check className="h-3.5 w-3.5 text-foreground" aria-hidden />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}