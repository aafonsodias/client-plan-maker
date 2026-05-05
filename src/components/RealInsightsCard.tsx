import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Activity, Sparkles, TrendingUp, TrendingDown, Minus, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listMeasurements } from "@/server/measurements.functions";

/**
 * Wires the landing-page promise (VO2máx, dead/active hang, plank trends) to
 * real client_measurements rows. Reads last 60 periodic measurements, picks
 * the two latest values per metric, computes Δ and renders one chip per
 * metric that has data. Empty state offers an explicit "Reavaliar" CTA so the
 * trainer is never staring at fake numbers.
 */
type MetricKey = "vo2max" | "dead_hang_s" | "active_hang_s" | "plank_s";

type MetricSpec = {
  key: MetricKey;
  unit: string;
  // higher = better for all four; flip if we ever add e.g. RHR
  betterWhen: "higher";
};

const METRICS: MetricSpec[] = [
  { key: "vo2max", unit: "ml/kg/min", betterWhen: "higher" },
  { key: "dead_hang_s", unit: "s", betterWhen: "higher" },
  { key: "active_hang_s", unit: "s", betterWhen: "higher" },
  { key: "plank_s", unit: "s", betterWhen: "higher" },
];

type Row = { measured_on: string; values: Record<string, unknown> | null };

function fmtVal(key: MetricKey, v: number) {
  if (key === "vo2max") return v.toFixed(1);
  return Math.round(v).toString();
}

function daysBetween(a: string, b: string) {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

export function RealInsightsCard({
  clientId,
  onReassessClick,
}: {
  clientId: string;
  onReassessClick: () => void;
}) {
  const { t } = useTranslation("plan");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await listMeasurements({ data: { clientId, cadence: "periodic", limit: 60 } });
        if (cancelled) return;
        if (r.ok) setRows(r.rows as any);
        else setErr(r.error ?? "load_failed");
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "load_failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const insights = useMemo(() => {
    if (!rows) return null;
    return METRICS.map((m) => {
      const series = rows
        .map((r) => {
          const raw = (r.values as any)?.[m.key];
          const n = typeof raw === "number" ? raw : raw != null ? Number(raw) : NaN;
          return { d: r.measured_on, v: Number.isFinite(n) ? n : null };
        })
        .filter((p) => p.v != null) as Array<{ d: string; v: number }>;
      if (series.length === 0) return { spec: m, latest: null, prev: null, delta: null, days: null };
      const [latest, prev] = series; // already sorted desc by measured_on
      const delta = prev ? latest.v - prev.v : null;
      const days = prev ? daysBetween(prev.d, latest.d) : null;
      return { spec: m, latest, prev: prev ?? null, delta, days };
    });
  }, [rows]);

  const hasAny = insights && insights.some((i) => i.latest != null);

  if (rows === null && !err) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t("insights.loading", { defaultValue: "A ler medições…" })}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/80 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          {t("insights.header", { defaultValue: "Insights de capacidade" })}
        </div>
        <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px]" onClick={onReassessClick}>
          <Plus className="mr-1 h-3 w-3" /> {t("insights.cta_record", { defaultValue: "Registar medição" })}
        </Button>
      </div>

      {!hasAny ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-background/40 p-4 text-center">
          <p className="text-sm text-foreground">
            {t("insights.empty_title", { defaultValue: "Sem medições ainda." })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("insights.empty_body", {
              defaultValue: "VO₂máx, suspensão (dead/active hang) e prancha aparecem aqui assim que registares uma reavaliação.",
            })}
          </p>
          <Button size="sm" variant="default" className="mt-3 h-8" onClick={onReassessClick}>
            {t("insights.empty_cta", { defaultValue: "Abrir reavaliação" })}
          </Button>
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {insights!.map((i) => {
            const labelKey = `insights.metric.${i.spec.key}` as const;
            const label = t(labelKey, {
              defaultValue:
                i.spec.key === "vo2max"
                  ? "VO₂máx"
                  : i.spec.key === "dead_hang_s"
                  ? "Dead hang"
                  : i.spec.key === "active_hang_s"
                  ? "Active hang"
                  : "Prancha",
            });
            if (i.latest == null) {
              return (
                <li
                  key={i.spec.key}
                  className="flex items-center justify-between rounded-xl border border-dashed border-border/60 bg-background/30 p-3"
                >
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
                    {t("insights.no_data", { defaultValue: "sem dados" })}
                  </span>
                </li>
              );
            }
            const tone =
              i.delta == null || i.delta === 0
                ? "neutral"
                : i.delta > 0
                ? "up"
                : "down";
            const toneCls =
              tone === "up"
                ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5"
                : tone === "down"
                ? "text-red-400 border-red-500/30 bg-red-500/5"
                : "text-muted-foreground border-border bg-background/40";
            const Icon = tone === "up" ? TrendingUp : tone === "down" ? TrendingDown : Minus;
            return (
              <li
                key={i.spec.key}
                className="rounded-xl border border-border bg-background/50 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-foreground">{label}</span>
                  {i.delta != null && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${toneCls}`}
                    >
                      <Icon className="h-3 w-3" />
                      {i.delta > 0 ? "+" : ""}
                      {fmtVal(i.spec.key, i.delta)} {i.spec.unit}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <Activity className="h-3 w-3 text-accent/70" />
                  <span className="font-mono text-base tabular-nums text-foreground">
                    {fmtVal(i.spec.key, i.latest.v)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{i.spec.unit}</span>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {i.days != null
                    ? t("insights.delta_window", {
                        defaultValue: "Δ vs há {{days}} dias",
                        days: i.days,
                      })
                    : t("insights.first_measurement", { defaultValue: "primeira medição" })}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {hasAny && (
        <p className="mt-3 text-[10px] italic text-muted-foreground/70">
          {t("insights.disclaimer", {
            defaultValue: "Derivado das medições registadas. VO₂máx submáximo é estimativa, não medição clínica.",
          })}
        </p>
      )}
    </div>
  );
}
