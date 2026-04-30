import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type LanguageCode = "en" | "pt" | "es" | "fr" | "de" | "it";

type Language = {
  code: LanguageCode;
  flag: string;
  nativeName: string;
  /** BCP-47 prefixes used to detect from navigator.language(s) */
  match: string[];
};

export const LANGUAGES: Language[] = [
  { code: "en", flag: "🇬🇧", nativeName: "English", match: ["en"] },
  { code: "pt", flag: "🇵🇹", nativeName: "Português", match: ["pt"] },
  { code: "es", flag: "🇪🇸", nativeName: "Español", match: ["es"] },
  { code: "fr", flag: "🇫🇷", nativeName: "Français", match: ["fr"] },
  { code: "de", flag: "🇩🇪", nativeName: "Deutsch", match: ["de"] },
  { code: "it", flag: "🇮🇹", nativeName: "Italiano", match: ["it"] },
];

const STORAGE_KEY = "forge.lang";

/**
 * Detection order:
 *   1. localStorage preference (if valid)
 *   2. navigator.languages / navigator.language (first matching prefix)
 *   3. fallback "en"
 */
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

  const candidates: string[] = [];
  if (typeof navigator !== "undefined") {
    if (Array.isArray(navigator.languages)) {
      candidates.push(...navigator.languages);
    }
    if (navigator.language) candidates.push(navigator.language);
  }

  for (const raw of candidates) {
    const tag = raw.toLowerCase();
    const found = LANGUAGES.find((l) => l.match.some((m) => tag.startsWith(m)));
    if (found) return found.code;
  }

  return "en";
}

export function useLanguage() {
  const [lang, setLang] = useState<LanguageCode>("en");

  useEffect(() => {
    const initial = detectInitialLanguage();
    setLang(initial);
    try {
      document.documentElement.lang = initial;
    } catch {
      // ignore
    }
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
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) =>
        l.nativeName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q),
    );
  }, [query]);

  // Reset + focus search when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      // wait for radix to mount the content
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  const handleSelect = (code: LanguageCode) => {
    setLang(code);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
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
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-60 border-border/60 bg-surface p-0 text-ink-primary shadow-lg"
        // Prevent radix from stealing focus from the search input on open
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b border-border/50 p-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-secondary"
              aria-hidden
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // Let user type without radix's typeahead hijacking keys
                e.stopPropagation();
                if (e.key === "Enter" && filtered[0]) {
                  e.preventDefault();
                  handleSelect(filtered[0].code);
                }
              }}
              placeholder="Search language…"
              aria-label="Search language"
              className="h-8 w-full rounded-sm bg-background/40 pl-7 pr-2 text-sm text-ink-primary placeholder:text-ink-secondary focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-ink-secondary">
              No matches
            </div>
          ) : (
            filtered.map((l) => {
              const active = l.code === lang;
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => handleSelect(l.code)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm transition",
                    "text-ink-primary hover:bg-background/50",
                    active && "bg-background/40",
                  )}
                >
                  <span className="text-base leading-none" aria-hidden>
                    {l.flag}
                  </span>
                  <span className="flex-1">{l.nativeName}</span>
                  <span className="text-[10px] uppercase tracking-wider text-ink-secondary">
                    {l.code}
                  </span>
                  {active && (
                    <Check
                      className="h-3.5 w-3.5 text-ink-primary"
                      aria-hidden
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
