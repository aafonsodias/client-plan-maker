import { useTranslation } from "react-i18next";
import { MoreVertical } from "lucide-react";

/**
 * Mobile-only sticky step header for the assessment screen. Shows
 * "Passo X de N · Título" plus a kebab that opens the existing step Sheet.
 * Pure presentational — the parent owns sheet state.
 */
export function MobileStepHeader({
  current,
  total,
  title,
  progressPct,
  onOpenSheet,
}: {
  current: number;
  total: number;
  title: string;
  progressPct?: number;
  onOpenSheet?: () => void;
}) {
  const { t } = useTranslation("assessment");
  return (
    <div className="sticky top-0 z-30 -mx-px border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      {typeof progressPct === "number" && (
        <div className="h-0.5 w-full bg-muted/30">
          <div
            className="h-full bg-gradient-to-r from-amber-500/70 via-primary to-primary transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
      <div className="flex h-11 items-center gap-2 px-3">
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium leading-tight">
          {t("mobile_step_header.prefix", {
            current,
            total,
            title,
            defaultValue: `Passo ${current} de ${total} · ${title}`,
          })}
        </h2>
        {onOpenSheet && (
          <button
            type="button"
            aria-label={t("jump_to", { defaultValue: "Saltar" })}
            onClick={onOpenSheet}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/40 text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
