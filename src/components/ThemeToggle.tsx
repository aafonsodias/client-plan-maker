import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const STORAGE_KEY = "protocol_theme";
type Mode = "dark" | "slate" | "cream";
const MODES: Mode[] = ["dark", "slate", "cream"];

function applyTheme(mode: Mode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "slate");
  if (mode === "cream") root.classList.add("light");
  else if (mode === "slate") root.classList.add("slate");
  root.dataset.theme = mode;
}

function readInitial(): Mode {
  if (typeof window === "undefined") return "dark";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "dark" || v === "slate" || v === "cream") return v;
    // Migrate old binary key
    const legacy = window.localStorage.getItem("forge_theme");
    if (legacy === "light") return "cream";
  } catch {
    /* ignore */
  }
  return "dark";
}

/**
 * Tri-mode theme toggle — Dark · Slate · Cream.
 * Disc divided into 3 sectors (120° each). Active sector marked by an amber
 * tick at the top. Click rotates 120° and advances to the next mode.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation("common");
  const [mode, setMode] = useState<Mode>("dark");

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
  const rotation = MODES.indexOf(mode) * 120;
  // Conic gradient: 3 equal sectors starting at -60° so first sector is centered at top.
  const sectors = "conic-gradient(from -60deg, #0E0F13 0deg 120deg, #2A3140 120deg 240deg, #F2EEE6 240deg 360deg)";

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${label} (${mode})`}
      title={`${label} · ${mode}`}
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
          style={{ background: "rgba(232,165,71,0.95)", boxShadow: "0 0 4px rgba(232,165,71,0.7)" }}
        />
      </span>
    </button>
  );
}
