import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sun, CloudSun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "protocol_theme";
type Mode = "light" | "medium" | "dark";
const MODES: Mode[] = ["light", "medium", "dark"];

export function applyTheme(mode: Mode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("theme-light", "theme-medium", "theme-dark", "light", "slate", "dark");
  root.classList.add(`theme-${mode}`);
  if (mode === "dark") root.classList.add("dark");
  root.dataset.theme = mode;
}

export function readPersistedTheme(): Mode {
  if (typeof window === "undefined") return "light";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    switch (v) {
      case "light":
      case "medium":
      case "dark":
        return v;
      // Legacy migrations
      case "deep":
      case "night":
        return "dark";
      case "sage":
      case "slate":
        return "medium";
      case "mist":
      case "cream":
        return "light";
    }
  } catch {
    /* ignore */
  }
  return "light";
}

const ICONS: Record<Mode, typeof Sun> = {
  light: Sun,
  medium: CloudSun,
  dark: Moon,
};

/**
 * 3-state segmented theme toggle: Light · Medium · Dark.
 * Applies `.theme-{mode}` to <html>, persists to localStorage.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation("common");
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    const initial = readPersistedTheme();
    setMode(initial);
    applyTheme(initial);
  }, []);

  const select = (next: Mode) => {
    setMode(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={t("theme.toggle_aria", "Toggle theme")}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border bg-surface-warm p-0.5",
        className,
      )}
    >
      {MODES.map((m) => {
        const Icon = ICONS[m];
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t(`theme.${m}`, m)}
            title={t(`theme.${m}`, m)}
            onClick={() => select(m)}
            className={cn(
              "inline-flex h-6 w-6 items-center justify-center rounded-full transition",
              active
                ? "bg-cta-bg text-cta-text"
                : "text-text-3 hover:text-text-1",
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );
}
