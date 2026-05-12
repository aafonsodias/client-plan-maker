import { useTranslation } from "react-i18next";
import { ArrowRight, ExternalLink, Send } from "lucide-react";

/**
 * Stage-1 landing hero for the client detail page.
 * Renders when there is no plan and no approved briefing yet, so the page
 * never feels empty just because the trainer hasn't generated anything.
 * Visual language mirrors /me (BrandMark amber + soft surface).
 */
export type StageOneHeroProps = {
  clientId: string;
  intakeStatus: "not_sent" | "sent" | "opened" | "submitted" | "reviewed";
  intakeExpiresAt: string | null;
  hasDraft: boolean;
  draftDoneSections: number;
  draftTotalSections: number;
  onPrimary: () => void;
  onResend?: () => void;
};

const STEPS = ["assessment", "briefing", "blueprint", "microcycle", "progressions"] as const;

export function ClientStageOneHero({
  clientId,
  intakeStatus,
  intakeExpiresAt,
  hasDraft,
  draftDoneSections,
  draftTotalSections,
  onPrimary,
  onResend,
}: StageOneHeroProps) {
  const { t } = useTranslation("assessment");

  const expired =
    !!intakeExpiresAt && new Date(intakeExpiresAt).getTime() < Date.now();
  const daysLeft = intakeExpiresAt
    ? Math.max(
        0,
        Math.round(
          (new Date(intakeExpiresAt).getTime() - Date.now()) / 86_400_000,
        ),
      )
    : null;

  const linkLabel = expired
    ? t("stage_one_hero.link_expired")
    : intakeStatus === "reviewed"
    ? t("stage_one_hero.link_reviewed")
    : intakeStatus === "submitted"
    ? t("stage_one_hero.link_submitted")
    : intakeStatus === "opened"
    ? t("stage_one_hero.link_opened")
    : intakeStatus === "sent"
    ? t("stage_one_hero.link_sent")
    : t("stage_one_hero.link_not_sent");

  const primaryLabel = hasDraft
    ? t("stage_one_hero.cta_continue")
    : t("stage_one_hero.cta_request");

  return (
    <section
      aria-label="Stage 1"
      className="mb-3 overflow-hidden rounded-xl border border-border/60 bg-[var(--surface)] px-3 py-2.5 sm:px-4 sm:py-3"
    >
      {/* Row 1: stage chip + progress dots + current step name + primary CTA */}
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-500">
          1/5
        </span>
        <span className="flex shrink-0 items-center gap-1" aria-hidden>
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={[
                "h-1 rounded-full transition-all",
                i === 0 ? "w-4 bg-amber-400" : "w-1.5 bg-muted-foreground/25",
              ].join(" ")}
            />
          ))}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
          {t("stage_one_hero.steps_assessment")}
        </span>
        <button
          type="button"
          onClick={onPrimary}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background transition hover:opacity-90"
        >
          {primaryLabel}
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {/* Row 2: subtitle + secondary actions + status — single wrapping line */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            className={[
              "h-1.5 w-1.5 rounded-full",
              expired
                ? "bg-amber-400"
                : intakeStatus === "submitted" || intakeStatus === "reviewed"
                ? "bg-emerald-400"
                : intakeStatus === "opened"
                ? "bg-sky-400"
                : intakeStatus === "sent"
                ? "bg-amber-300"
                : "bg-muted-foreground/40",
            ].join(" ")}
          />
          {linkLabel}
          {!expired && daysLeft != null && intakeStatus !== "not_sent" && (
            <span className="opacity-70">· {daysLeft}d</span>
          )}
        </span>
        {hasDraft && (
          <span className="opacity-80">
            {t("stage_one_hero.draft_status", {
              count: draftDoneSections,
              total: draftTotalSections,
            })}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-2">
          <a
            href={`/me?as=${clientId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-foreground/70 underline-offset-2 hover:text-foreground hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {t("stage_one_hero.cta_preview")}
          </a>
          {onResend && (intakeStatus !== "not_sent" || expired) && (
            <button
              type="button"
              onClick={onResend}
              className="inline-flex items-center gap-1 text-foreground/70 hover:text-foreground"
            >
              <Send className="h-3 w-3" />
              {t("stage_one_hero.cta_resend")}
            </button>
          )}
        </span>
      </div>
    </section>
  );
}