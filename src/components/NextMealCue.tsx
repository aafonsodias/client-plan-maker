import { useState } from "react";
import { Apple, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { nutritionWindows } from "@/lib/nutrition-suggestions";

/**
 * Compact nutrition-window cue rendered under <ThisWeekHero/>. Always-on
 * (not gated to next-session) so trainers can use it as a teaching surface.
 * Click expands the three windows with example foods + rationale.
 */
export function NextMealCue() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const lang = i18n.language?.startsWith("en") ? "en" : "pt";
  const windows = nutritionWindows(lang);

  return (
    <section
      aria-label="Janelas nutricionais"
      className="rounded-2xl border border-border bg-card/40 p-3"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Apple className="h-4 w-4 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {lang === "en" ? "Around the workout" : "À volta do treino"}
            </p>
            <p className="text-xs text-foreground/90 truncate">
              {windows.map((w) => w.title).join(" · ")}
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {windows.map((w) => (
            <div
              key={w.key}
              className="rounded-xl border border-border bg-background/40 p-2.5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/80">
                {w.whenLabel}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-foreground">
                {w.title}
              </p>
              <ul className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
                {w.examples.map((ex) => (
                  <li key={ex}>· {ex}</li>
                ))}
              </ul>
              <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground/80">
                {w.rationale}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}