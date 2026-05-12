import { useTranslation } from "react-i18next";
import { AlertCircle, ArrowRight } from "lucide-react";
import type { MissingItem } from "@/lib/assessment-completion";

/**
 * Round A — Conclude-failure panel. Replaces the bare
 * "Self intake incomplete" toast with a structured list naming each
 * missing section + a "Go to section" button. Inline (not a dialog) so
 * it stays usable on a 375px viewport.
 */
export function MissingItemsPanel({
  items,
  onGoTo,
}: {
  items: MissingItem[];
  onGoTo: (sectionId: string, anchor: string) => void;
}) {
  const { t } = useTranslation("assessment");
  if (items.length === 0) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-3 sm:p-4"
    >
      <header className="flex items-start gap-2">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
          <AlertCircle className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            {t("completion.missing_title", { count: items.length })}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-amber-900/70 dark:text-amber-100/70">
            {t("completion.missing_intro")}
          </p>
        </div>
      </header>
      <ul className="mt-3 space-y-1.5">
        {items.map((it) => (
          <li
            key={it.sectionId}
            className="flex items-start justify-between gap-3 rounded-md border border-amber-500/20 bg-background/60 px-2.5 py-2"
          >
            <div className="min-w-0">
              <div className="text-[12.5px] font-medium leading-tight">
                {t(it.sectionLabelKey as never, { defaultValue: it.sectionId })}
              </div>
              <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {t(it.reasonKey as never, { defaultValue: "" })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onGoTo(it.sectionId, it.scrollAnchor)}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-800 transition hover:bg-amber-500/20 dark:text-amber-200"
            >
              {t("completion.go_to_section")}
              <ArrowRight className="h-3 w-3" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}