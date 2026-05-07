import { useEffect, useState } from "react";
import { Loader2, CalendarPlus, AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { programNextWeek } from "@/server/phased/program-next-week.functions";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

type LatestMeta = {
  week: number;
  source?: string | null;
  from_week?: number | null;
  autoreg_strictness?: "strict" | "suggested" | "off" | null;
  adherence?: number | null;
  flagged_count?: number | null;
} | null;

/**
 * R66 — Surface the deterministic "program next week" path on the plan page.
 * Shows when the plan has at least one prescribed week. Adherence-gated
 * server-side; we render the friendly error inline.
 *
 * MVP lock-in: when the latest week was produced by `programNextWeek`, surface
 * the deterministic rationale (adherence, autoreg mode, flagged count) so the
 * coach sees *why* week N+1 is different. Closes the loop visibly without any
 * new schema or engine changes — reads existing `validation_meta`.
 */
export function NextWeekCard({
  planId,
  onCreated,
}: {
  planId: string;
  onCreated?: () => void | Promise<void>;
}) {
  const { t } = useTranslation("common");
  const fn = useServerFn(programNextWeek);
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);
  const [latest, setLatest] = useState<LatestMeta>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("workout_plan_days")
        .select("week_number, validation_meta")
        .eq("plan_id", planId)
        .order("week_number", { ascending: false })
        .order("day_number", { ascending: true })
        .limit(1);
      if (cancelled) return;
      const row = (data ?? [])[0] as any;
      if (!row) { setLatest(null); return; }
      const meta = row.validation_meta ?? {};
      if (meta?.source !== "program_next_week") { setLatest(null); return; }
      setLatest({
        week: row.week_number,
        source: meta.source,
        from_week: meta.from_week ?? null,
        autoreg_strictness: meta.autoreg_strictness ?? null,
        adherence: typeof meta.adherence === "number" ? meta.adherence : null,
        flagged_count: typeof meta.flagged_count === "number" ? meta.flagged_count : null,
      });
    })();
    return () => { cancelled = true; };
  }, [planId, reloadKey]);

  async function run() {
    setBusy(true);
    setWarn(null);
    try {
      const r: any = await fn({ data: { planId } });
      if (r?.ok) {
        toast.success(
          t("plan.next_week.created", {
            week: r.nextWeek,
            flagged: r.flaggedCount ?? 0,
          }),
        );
        await onCreated?.();
        setReloadKey((k) => k + 1);
      } else if (r?.error === "low_adherence") {
        const pct = Math.round((r.adherence ?? 0) * 100);
        setWarn(
          t("plan.next_week.low_adherence", {
            pct,
            logged: r.sessionsLogged,
            expected: r.sessionsExpected,
          }),
        );
      } else {
        toast.error(r?.error ?? t("plan.next_week.failed"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {latest && (
        <NextWeekRationale meta={latest} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/40 p-3 text-xs">
        <div className="flex-1 min-w-[220px]">
          <p className="font-semibold text-foreground inline-flex items-center gap-1.5">
            <CalendarPlus className="h-3.5 w-3.5 text-accent" />
            {t("plan.next_week.title")}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            {t("plan.next_week.subtitle")}
          </p>
          {warn && (
            <p className="mt-2 inline-flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{warn}</span>
            </p>
          )}
        </div>
        <Button size="sm" variant="outline" disabled={busy} onClick={run}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarPlus className="mr-2 h-4 w-4" />}
          {t("plan.next_week.cta")}
        </Button>
      </div>
    </div>
  );
}

function NextWeekRationale({ meta }: { meta: NonNullable<LatestMeta> }) {
  const { t } = useTranslation("common");
  const pct = meta.adherence != null ? Math.round(meta.adherence * 100) : null;
  const flagged = meta.flagged_count ?? 0;
  const strictness = meta.autoreg_strictness ?? "off";

  // Pick the most informative single-sentence headline based on the actual
  // adjustment that ran. Hedged, professional, no AI bragging.
  let headline: string;
  if (flagged > 0 && strictness === "strict") {
    headline = t("plan.next_week.rationale.strict_adjusted", { count: flagged });
  } else if (flagged > 0 && strictness === "suggested") {
    headline = t("plan.next_week.rationale.suggested_flag", { count: flagged });
  } else if (flagged === 0) {
    headline = t("plan.next_week.rationale.no_flags");
  } else {
    headline = t("plan.next_week.rationale.copied");
  }

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
      <p className="font-semibold text-foreground inline-flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
        {t("plan.next_week.rationale.title", { week: meta.week, from: meta.from_week ?? meta.week - 1 })}
      </p>
      <p className="mt-1 text-foreground/90">{headline}</p>
      <p className="mt-1 text-muted-foreground">
        {pct != null && (
          <span>{t("plan.next_week.rationale.adherence", { pct })}</span>
        )}
        {pct != null && <span> · </span>}
        <span>{t(`plan.next_week.rationale.mode_${strictness}`)}</span>
      </p>
    </div>
  );
}

export default NextWeekCard;