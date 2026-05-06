import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Inference } from "@/lib/auto-infer";

/**
 * R73 Step 4A — RationaleChip.
 * Compact "Why this?" affordance. Renders a small dot + Info icon. Click opens
 * a Popover (not a Dialog) with: source · confidence · human reason.
 * Mobile-safe: PopoverContent uses `align="start"` and `collisionPadding`.
 */
export default function RationaleChip<T>({
  inference,
  label,
}: {
  inference: Inference<T> | null | undefined;
  /** Optional short label rendered before the icon (e.g. "Auto"). */
  label?: string;
}) {
  const { t } = useTranslation("common");
  if (!inference) return null;

  const toneClass =
    inference.confidence === "confident"
      ? "bg-emerald-500"
      : inference.confidence === "assumed"
        ? "bg-amber-500"
        : "bg-foreground/60";

  let reason: string;
  try {
    reason = t(`ux.rationale.reasons.${inference.reason_key}`, {
      ...(inference.reason_params ?? {}),
      defaultValue: t("ux.rationale.fallback"),
    });
  } catch {
    reason = t("ux.rationale.fallback");
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("ux.rationale.aria")}
          className="inline-flex min-h-[24px] items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2 py-1 text-[10px] font-medium text-muted-foreground transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${toneClass}`} aria-hidden />
          {label ? <span>{label}</span> : null}
          <Info className="h-3 w-3" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        collisionPadding={12}
        className="w-64 max-w-[calc(100vw-2rem)] space-y-1.5 text-xs"
      >
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>{t("ux.rationale.title")}</span>
          <span>{t(`ux.rationale.confidence.${inference.confidence}`)}</span>
        </div>
        <p className="text-foreground">{reason}</p>
        <p className="text-[10px] text-muted-foreground">
          {t("ux.rationale.source_label")}: {t(`ux.rationale.sources.${inference.source}`)}
        </p>
      </PopoverContent>
    </Popover>
  );
}
