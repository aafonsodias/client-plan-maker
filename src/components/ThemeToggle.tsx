import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const STORAGE_KEY = "forge_theme";
type Mode = "dark" | "light";

function applyTheme(mode: Mode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.dataset.theme = mode;
}

function readInitial(): Mode {
  if (typeof window === "undefined") return "dark";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  // Default to dark — Forge is a dark-first product.
  return "dark";
}

/**
 * Yin/Yang style binary theme toggle. Half cream / half deep navy, hairline
 * rule down the middle, rotates on click. No religious symbolism.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation("common");
  const [mode, setMode] = useState<Mode>("dark");

  useEffect(() => {
    const initial = readInitial();
    setMode(initial);
    applyTheme(initial);
  }, []);

  const toggle = () => {
    const next: Mode = mode === "dark" ? "light" : "dark";
    setMode(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const label = t("theme.toggle_aria", "Toggle theme");

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={
        "group relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full " +
        "border border-border bg-background transition hover:border-accent " +
        (className ?? "")
      }
    >
      <span
        className="relative block h-5 w-5 overflow-hidden rounded-full transition-transform duration-500 ease-out"
        style={{ transform: mode === "dark" ? "rotate(0deg)" : "rotate(180deg)" }}
      >
        {/* Left half — cream */}
        <span
          className="absolute inset-y-0 left-0 w-1/2"
          style={{ background: "#F2EEE6" }}
        />
        {/* Right half — deep navy */}
        <span
          className="absolute inset-y-0 right-0 w-1/2"
          style={{ background: "#0E0F13" }}
        />
        {/* Hairline divider */}
        <span
          className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2"
          style={{ background: "rgba(232,165,71,0.45)" }}
        />
      </span>
    </button>
  );
}