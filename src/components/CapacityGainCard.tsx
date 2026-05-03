import { TrendingUp, TrendingDown, Minus, Sparkles, Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CapacitySummary, CapacityRow } from "@/lib/capacity-gain";

type Props = {
  summary: CapacitySummary;
  blockNumber: number;
  adherencePct?: number | null;
  rpeDrift?: number | null;
  transitionNote?: string | null;
};

/**
 * CapacityGainCard — the headline "what got better" card on the plan page.
 * Reads what changed between Bloco N-1 and Bloco N at a glance:
 *  - overall load delta (big number, gradient bg)
 *  - per-pattern delta chips (squat / hinge / push / pull / carry)
 *  - top 3 lifts with e1RM delta sparkline-style
 *  - context strip: adesão & RPE drift
 */
export function CapacityGainCard({
  summary, blockNumber, adherencePct, rpeDrift, transitionNote,
}: Props) {
  const { t } = useTranslation("common");
  const { rows, topLifts, overall } = summary;
  const tone = verdictBg(overall.verdict);
  const showRows = rows.filter((r) => r.deltaPct != null).slice(0, 5);

  return (
    <section data-tour="capacity-gain" className={`relative overflow-hidden rounded-2xl border border-border ${tone.bg} p-4 md:p-5`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("capacity.eyebrow", { cur: blockNumber, prev: blockNumber - 1 })}
          </p>
          <h3 className="mt-0.5 text-base font-semibold tracking-tight">
            {overall.verdict === "gain" ? t("capacity.headline_gain") :
             overall.verdict === "regression" ? t("capacity.headline_regression") :
             overall.verdict === "flat" ? t("capacity.headline_flat") :
             t("capacity.headline_unknown")}
          </h3>
        </div>
        <BigDelta value={overall.deltaPct} verdict={overall.verdict} />
      </header>

      {/* Per-pattern strip */}
      {showRows.length > 0 && (
        <div className="mt-4 grid gap-1.5 sm:grid-cols-2 md:grid-cols-3">
          {showRows.map((r) => (
            <PatternChip key={r.pattern} row={r} />
          ))}
        </div>
      )}

      {/* Top lifts */}
      {topLifts.length > 0 && (
        <div className="mt-4 rounded-xl border border-border/60 bg-card/40 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <Sparkles className="h-3 w-3" /> {t("capacity.top_lifts")}
          </p>
          <div className="space-y-1.5">
            {topLifts.map((l) => (
              <div key={l.name} className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 flex-1 truncate font-medium">{l.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {l.priorE1rm ?? "—"} → <span className="text-foreground">{l.currentE1rm ?? "—"} kg</span>
                </span>
                <DeltaPill value={l.deltaPct} verdict={l.verdict} compact />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Context strip */}
      <footer className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {adherencePct != null && (
          <span className="inline-flex items-center gap-1">
            <Target className="h-3 w-3" /> {t("capacity.adherence", { pct: adherencePct })}
          </span>
        )}
        {rpeDrift != null && (
          <span className="inline-flex items-center gap-1">
            {t("capacity.rpe_drift", { value: `${rpeDrift > 0 ? "+" : ""}${rpeDrift.toFixed(2)}` })}
          </span>
        )}
        {transitionNote && (
          <span className="text-muted-foreground/80 italic">· {transitionNote}</span>
        )}
      </footer>
    </section>
  );
}

function BigDelta({ value, verdict }: { value: number | null; verdict: CapacityRow["verdict"] }) {
  const Icon = verdict === "gain" ? TrendingUp : verdict === "regression" ? TrendingDown : Minus;
  const cls = verdict === "gain" ? "text-emerald-300" :
              verdict === "regression" ? "text-red-300" :
              verdict === "flat" ? "text-amber-300" : "text-muted-foreground";
  return (
    <div className={`flex shrink-0 items-baseline gap-1 ${cls}`}>
      <Icon className="h-4 w-4" />
      <span className="text-2xl font-bold tabular-nums">
        {value == null ? "—" : `${value > 0 ? "+" : ""}${value}%`}
      </span>
    </div>
  );
}

function PatternChip({ row }: { row: CapacityRow }) {
  const cls = row.verdict === "gain"
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
    : row.verdict === "regression"
    ? "border-red-500/40 bg-red-500/10 text-red-200"
    : row.verdict === "flat"
    ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
    : "border-border bg-muted/30 text-muted-foreground";
  return (
    <div className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${cls}`}>
      <span className="font-medium">{row.patternLabel}</span>
      <span className="tabular-nums">
        {row.deltaPct == null ? "—" : `${row.deltaPct > 0 ? "+" : ""}${row.deltaPct}%`}
      </span>
    </div>
  );
}

function DeltaPill({ value, verdict, compact }: { value: number | null; verdict: CapacityRow["verdict"]; compact?: boolean }) {
  const cls = verdict === "gain" ? "bg-emerald-500/15 text-emerald-300"
    : verdict === "regression" ? "bg-red-500/15 text-red-300"
    : verdict === "flat" ? "bg-amber-500/15 text-amber-300"
    : "bg-muted/30 text-muted-foreground";
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${cls} ${compact ? "" : "ml-2"}`}>
      {value == null ? "—" : `${value > 0 ? "+" : ""}${value}%`}
    </span>
  );
}

function verdictBg(v: CapacityRow["verdict"]) {
  switch (v) {
    case "gain":
      return { bg: "bg-gradient-to-br from-emerald-500/10 via-card to-amber-500/5" };
    case "regression":
      return { bg: "bg-gradient-to-br from-red-500/10 via-card to-card" };
    case "flat":
      return { bg: "bg-gradient-to-br from-amber-500/10 via-card to-card" };
    default:
      return { bg: "bg-card/60" };
  }
}