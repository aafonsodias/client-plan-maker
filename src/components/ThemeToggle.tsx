import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const STORAGE_KEY = "protocol_theme";
type Mode = "deep" | "sage" | "mist";
const MODES: Mode[] = ["deep", "sage", "mist"];

/* Map therapeutic modes to the existing CSS class hooks so we don't have to
 * rewrite every selector across the app:
 *   deep → :root (no class)
 *   sage → .slate
 *   mist → .light
 */

function applyTheme(mode: Mode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "slate");
  if (mode === "mist") root.classList.add("light");
  else if (mode === "sage") root.classList.add("slate");
  root.dataset.theme = mode;
}

function readInitial(): Mode {
  if (typeof window === "undefined") return "deep";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "deep" || v === "sage" || v === "mist") return v;
    // Migrate old tri-mode key (dark/slate/cream → deep/sage/mist)
    if (v === "dark") return "deep";
    if (v === "slate") return "sage";
    if (v === "cream") return "mist";
    // Migrate ancient binary key
    const legacy = window.localStorage.getItem("forge_theme");
    if (legacy === "light") return "mist";
  } catch {
    /* ignore */
  }
  return "deep";
}

/**
 * Tri-mode theme toggle — Deep · Sage · Mist (therapeutic palette).
 * Disc divided into 3 sectors (120° each). Active sector marked by an amber
 * tick at the top. Click rotates 120° and advances to the next mode.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation("common");
  const [mode, setMode] = useState<Mode>("deep");

  useEffect(() => {
    const initial = readInitial();
    setMode(initial);
    applyTheme(initial);
  }, []);

  const cycle = () => {
    const idx = MODES.indexOf(mode);
    const next = MODES[(idx + 1) % MODES.length];
    setMode(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const label = t("theme.toggle_aria", "Toggle theme");
  const modeLabel = t(`theme.${mode}`, mode);
  const rotation = MODES.indexOf(mode) * 120;
  // Conic gradient: 3 equal sectors — Deep teal-night, Sage teal-grey, Mist parchment.
  const sectors =
    "conic-gradient(from -60deg, #15252E 0deg 120deg, #4A5C5E 120deg 240deg, #E8EEEC 240deg 360deg)";

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${label} (${modeLabel})`}
      title={`${label} · ${modeLabel}`}
      className={
        "group relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full " +
        "border border-border bg-background transition hover:border-accent " +
        (className ?? "")
      }
    >
      <span className="relative block h-5 w-5">
        <span
          className="absolute inset-0 rounded-full transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ background: sectors, transform: `rotate(${rotation}deg)` }}
        />
        {/* Amber tick at the top to mark the active sector */}
        <span
          className="absolute left-1/2 top-0 h-1 w-1 -translate-x-1/2 -translate-y-[2px] rounded-full"
          style={{ background: "rgba(201,123,92,0.95)", boxShadow: "0 0 4px rgba(201,123,92,0.7)" }}
        />
      </span>
    </button>
  );
}
