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
      className="mb-4 overflow-hidden rounded-2xl border border-border/60 bg-[var(--surface)] p-5 sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-500/90">
          {t("stage_one_hero.eyebrow")}
        </span>
        <p className="max-w-xl text-sm text-muted-foreground">
          {t("stage_one_hero.subtitle")}
        </p>
      </div>

      {/* Step rail */}
      <ol className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
        {STEPS.map((s, i) => {
          const active = i === 0;
          return (
            <li
              key={s}
              className="flex min-w-0 items-center gap-2 text-[11px] uppercase tracking-wider"
            >
              <span
                className={[
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  active
                    ? "bg-amber-400 shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_25%,transparent)]"
                    : "bg-muted-foreground/30",
                ].join(" ")}
              />
              <span
                className={
                  active
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground/70"
                }
              >
                {t(`stage_one_hero.steps_${s}` as const)}
              </span>
              {i < STEPS.length - 1 && (
                <span className="mx-1 h-px w-6 bg-border" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>

      {/* CTAs */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onPrimary}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90"
        >
          {primaryLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        <a
          href={`/me?as=${clientId}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground/80 transition hover:bg-secondary hover:text-foreground"
        >
          {t("stage_one_hero.cta_preview")}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        {onResend && (intakeStatus !== "not_sent" || expired) && (
          <button
            type="button"
            onClick={onResend}
            className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-2 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
          >
            <Send className="h-3 w-3" />
            {t("stage_one_hero.cta_resend")}
          </button>
        )}
      </div>

      {/* Status strip */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
        <span className="font-medium uppercase tracking-wider text-muted-foreground/70">
          {t("stage_one_hero.link_status_label")}
        </span>
        <span
          className={[
            "inline-flex items-center gap-1.5",
            expired ? "text-amber-500" : "",
          ].join(" ")}
        >
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
        </span>
        {!expired && daysLeft != null && intakeStatus !== "not_sent" && (
          <span>
            · {t("stage_one_hero.link_expires_in", { days: daysLeft })}
          </span>
        )}
        {hasDraft && (
          <span>
            ·{" "}
            {t("stage_one_hero.draft_status", {
              count: draftDoneSections,
              total: draftTotalSections,
            })}
          </span>
        )}
      </div>
    </section>
  );
}