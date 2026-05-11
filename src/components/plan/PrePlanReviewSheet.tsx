import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, AlertTriangle, Info, Shield, HeartPulse, Pill } from "lucide-react";
import { deriveStartingFloor } from "@/server/phased/programming-defaults";
import type { Brief } from "@/server/phased/schemas";
import { cn } from "@/lib/utils";

/**
 * Round 2 — Pre-Plan Review Sheet.
 *
 * ZERO-AI preflight. Opening this sheet must NOT trigger any server call,
 * AI synthesis, or plan-row creation. The only server call lives behind
 * the "Criar briefing inicial" primary button, which the parent wires to
 * the existing `startPhasedPlanDraft` server fn.
 *
 * `approveBrief` is NEVER called from this sheet — final brief approval
 * stays in the existing BriefEditor / protocol stages flow.
 */

const TIER_TO_BAND: Record<string, "beginner" | "intermediate" | "advanced"> = {
  beginner: "beginner",
  novice: "beginner",
  intermediate: "intermediate",
  advanced: "advanced",
  expert: "advanced",
};

function bandFromAssessment(a: any): "beginner" | "intermediate" | "advanced" {
  const lvl = String(a?.experience_level ?? "").toLowerCase();
  return TIER_TO_BAND[lvl] ?? "intermediate";
}

function redFlagsCountFromAssessment(a: any): number {
  let n = 0;
  if (a?.parq && typeof a.parq === "object") {
    n += Object.values(a.parq).filter((v) => v === true).length;
  }
  if (Array.isArray(a?.med_flags)) n += a.med_flags.length;
  if (Array.isArray(a?.injuries)) n += a.injuries.length;
  if (Array.isArray(a?.known_imbalances)) n += a.known_imbalances.length > 0 ? 1 : 0;
  return n;
}

type Tone = "neutral" | "warn" | "danger" | "success";
function toneClasses(tone: Tone): string {
  switch (tone) {
    case "danger":
      return "border-red-500/40 bg-red-500/10 text-red-200";
    case "warn":
      return "border-amber-500/40 bg-amber-500/10 text-amber-200";
    case "success":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
    default:
      return "border-border bg-muted/20 text-foreground/80";
  }
}

function tierColor(tier: "MEV" | "MAV" | "MRV"): { text: string; ring: string; label: string } {
  if (tier === "MEV") return { text: "text-blue-300", ring: "ring-blue-500/40", label: "MEV" };
  if (tier === "MRV") return { text: "text-amber-300", ring: "ring-amber-500/40", label: "MRV" };
  return { text: "text-emerald-300", ring: "ring-emerald-500/40", label: "MAV" };
}

const DURATION_OPTIONS = [3, 4, 6] as const;

export function PrePlanReviewSheet({
  open,
  onOpenChange,
  assessment,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  assessment: any;
  busy: boolean;
  /**
   * Called when the PT explicitly clicks "Criar briefing inicial".
   * The PARENT is responsible for invoking `startPhasedPlanDraft` and
   * routing the result. This component never calls a server fn.
   */
  onConfirm: (durationWeeks: number) => void;
}) {
  const { t } = useTranslation("assessment");
  const [duration, setDuration] = useState<number>(4);

  const summary = useMemo(() => {
    const a = assessment ?? {};
    return {
      goal: a.primary_goal ?? null,
      smartSpecific: a.smart_specific ?? null,
      experience: a.experience_level ?? null,
      days: a.training_days_per_week ?? null,
      sessionMin: a.session_duration_minutes ?? null,
      location: a.training_location ?? null,
      equipmentCount: Array.isArray(a.available_equipment) ? a.available_equipment.length : 0,
    };
  }, [assessment]);

  const startingFloor = useMemo(() => {
    const band = bandFromAssessment(assessment);
    const rfCount = redFlagsCountFromAssessment(assessment);
    // deriveStartingFloor only reads training_age_band + red_flags.length,
    // so a minimal Brief shim is safe and pure (no network).
    const shim = {
      training_age_band: band,
      red_flags: Array.from({ length: rfCount }, (_, i) => `flag_${i}`),
    } as unknown as Brief;
    return deriveStartingFloor(shim);
  }, [assessment]);

  const warnings = useMemo(() => {
    const a = assessment ?? {};
    const out: { tone: Tone; icon: any; text: string }[] = [];
    const parqFlags = a.parq ? Object.values(a.parq).filter((v) => v === true).length : 0;
    if (parqFlags > 0) {
      out.push({ tone: "danger", icon: Shield, text: t("pre_plan_review.warnings.parq", { count: parqFlags }) });
    }
    const meds: string[] = Array.isArray(a.med_flags) ? a.med_flags : [];
    if (meds.includes("beta_blocker")) {
      out.push({ tone: "warn", icon: HeartPulse, text: t("pre_plan_review.warnings.beta_blocker") });
    }
    if (meds.includes("anticoagulant")) {
      out.push({ tone: "warn", icon: Pill, text: t("pre_plan_review.warnings.anticoagulant") });
    }
    const sleep = String(a.sleep_quality ?? "").toLowerCase();
    const stress = String(a.stress_level ?? "").toLowerCase();
    const readiness = String(a.readiness_stage ?? "").toLowerCase();
    if (sleep === "poor" || stress === "high" || readiness === "precontemplation" || readiness === "contemplation") {
      out.push({ tone: "neutral", icon: Info, text: t("pre_plan_review.warnings.low_recovery") });
    }
    if (Array.isArray(a.injuries) && a.injuries.length > 0) {
      out.push({ tone: "warn", icon: AlertTriangle, text: t("pre_plan_review.warnings.injury", { count: a.injuries.length }) });
    }
    return out;
  }, [assessment, t]);

  const tier = tierColor(startingFloor.volume_tier);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
        aria-describedby={undefined}
      >
        {/* Sticky header */}
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold leading-tight">
                {t("pre_plan_review.title")}
              </h2>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                {t("pre_plan_review.subtitle")}
              </p>
            </div>
          </div>
        </header>

        {/* Scroll body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-5">
            {/* Safety warnings */}
            {warnings.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("pre_plan_review.section.safety")}
                </h3>
                <ul className="space-y-1.5">
                  {warnings.map((w, i) => {
                    const Icon = w.icon;
                    return (
                      <li
                        key={i}
                        className={cn(
                          "flex items-start gap-2 rounded-md border px-3 py-2 text-xs leading-snug",
                          toneClasses(w.tone),
                        )}
                      >
                        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 flex-1">{w.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* Assessment summary */}
            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("pre_plan_review.section.summary")}
              </h3>
              <dl className="grid grid-cols-2 gap-2">
                <SummaryItem label={t("pre_plan_review.fields.goal")} value={summary.goal} />
                <SummaryItem label={t("pre_plan_review.fields.experience")} value={summary.experience} />
                <SummaryItem
                  label={t("pre_plan_review.fields.frequency")}
                  value={summary.days != null ? t("pre_plan_review.fields.frequency_value", { count: Number(summary.days) }) : null}
                />
                <SummaryItem
                  label={t("pre_plan_review.fields.session_minutes")}
                  value={summary.sessionMin != null ? `${summary.sessionMin}'` : null}
                />
                <SummaryItem label={t("pre_plan_review.fields.location")} value={summary.location} />
                <SummaryItem
                  label={t("pre_plan_review.fields.equipment")}
                  value={t("pre_plan_review.fields.equipment_value", { count: summary.equipmentCount })}
                />
              </dl>
            </section>

            {/* Starting floor — estimated */}
            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("pre_plan_review.section.starting_floor")}
              </h3>
              <div className={cn("rounded-md border p-3", "border-border bg-muted/10")}>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                  {t("pre_plan_review.starting_floor_estimated")}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ring-1", tier.text, tier.ring)}>
                    {tier.label}
                  </span>
                  <span className="rounded-full border border-border/60 px-2.5 py-0.5 font-mono text-[11px] tabular-nums text-foreground/80">
                    RPE {startingFloor.rpe_floor.toFixed(1)}–{startingFloor.rpe_ceiling.toFixed(1)}
                  </span>
                  <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-[11px] text-foreground/80">
                    {t("pre_plan_review.weeks_to_progress", { count: startingFloor.weeks_to_progress })}
                  </span>
                </div>
                {startingFloor.reason.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {startingFloor.reason.map((r) => (
                      <li key={r} className="rounded border border-dashed border-border/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                  {t("pre_plan_review.starting_floor_note")}
                </p>
              </div>
            </section>

            {/* Duration weeks (the only editable knob) */}
            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("pre_plan_review.section.duration")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {DURATION_OPTIONS.map((w) => {
                  const active = duration === w;
                  return (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setDuration(w)}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-sm transition",
                        active
                          ? "border-amber-500/50 bg-amber-500/15 text-amber-100"
                          : "border-border bg-muted/20 text-foreground/80 hover:bg-muted/40",
                      )}
                    >
                      {t("pre_plan_review.duration_value", { count: w })}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("pre_plan_review.duration_hint")}
              </p>
            </section>

            {/* Em breve — future knobs */}
            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("pre_plan_review.section.advanced")}
              </h3>
              <ul className="space-y-1.5">
                {[
                  "intensity_volume_tradeoff",
                  "deload_frequency",
                  "autoreg_strictness",
                  "wave_model",
                  "exercise_bias",
                  "cardio_emphasis",
                  "mobility_emphasis",
                ].map((k) => (
                  <li key={k} className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border/60 px-3 py-1.5 text-xs text-muted-foreground/80">
                    <span>{t(`pre_plan_review.future.${k}` as const)}</span>
                    <span className="rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                      {t("pre_plan_review.coming_soon")}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground">
                {t("pre_plan_review.future_hint")}
              </p>
            </section>

            <p className="pt-2 text-[10px] leading-snug text-muted-foreground/70">
              {t("pre_plan_review.legal")}
            </p>
          </div>
        </div>

        {/* Sticky footer */}
        <footer className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-border bg-background/95 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {t("pre_plan_review.cancel")}
          </Button>
          <Button
            size="sm"
            onClick={() => onConfirm(duration)}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t("pre_plan_review.confirm")}
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  );
}

function SummaryItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-2">
      <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">{label}</dt>
      <dd className="mt-0.5 truncate text-xs text-foreground/90">{value ?? "—"}</dd>
    </div>
  );
}