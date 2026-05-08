import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TrendingUp, TrendingDown, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listClientCapacitySnapshots } from "@/server/capacity.functions";
import { cn } from "@/lib/utils";
import { toneChip, toneText, type Tone } from "@/lib/status-tone";

/**
 * Snapshot-backed replacement for the legacy RealInsightsCard.
 *
 * Reads the last 90 days of `client_capacity_snapshots`, picks the two most
 * recent comparable snapshots per `domain_slug` (matching test_used + unit,
 * or both normalized 0–100), and renders a Δ chip per domain. Empty state
 * dispatches `open-add-snapshot` so <CapacityMap /> opens the AddSnapshotSheet.
 */

// Tests where lower raw values mean improvement. Default: higher-better.
const LOWER_BETTER = new Set<string>([
  "body_fat_percent",
  "waist_circumference",
  "waist_to_hip",
  "bmi",
  "resting_heart_rate",
  "blood_pressure_systolic",
  "blood_pressure_diastolic",
  "breath_rate_resting",
  "orthostatic_test",
]);

type Snap = {
  domain_slug: string;
  measured_at: string;
  raw_value: number | null;
  raw_unit: string | null;
  normalized_score: number | null;
  test_used: string | null;
};

function pickPair(rows: Snap[]): { latest: Snap; prev: Snap } | null {
  if (rows.length < 2) return null;
  const latest = rows[0];
  const prev = rows.slice(1).find((r) => {
    if ((r.test_used ?? null) !== (latest.test_used ?? null)) return false;
    const bothNorm =
      latest.normalized_score != null && r.normalized_score != null;
    const bothRaw =
      latest.raw_value != null &&
      r.raw_value != null &&
      (r.raw_unit ?? null) === (latest.raw_unit ?? null);
    return bothNorm || bothRaw;
  });
  return prev ? { latest, prev } : null;
}

function deltaTone(pctChange: number, lowerBetter: boolean): Tone {
  const improvement = lowerBetter ? pctChange < -1 : pctChange > 1;
  const regression = lowerBetter ? pctChange > 5 : pctChange < -5;
  if (improvement) return "success";
  if (regression) return "warn";
  return "neutral";
}

function fmt(n: number): string {
  if (Math.abs(n) >= 10) return n.toFixed(0);
  return Math.abs(n % 1) < 0.05 ? n.toFixed(0) : n.toFixed(1);
}

export function CapacityDeltasCard({ clientId }: { clientId: string }) {
  const { t } = useTranslation("common");
  const fetchFn = useServerFn(listClientCapacitySnapshots);
  const { data, isLoading } = useQuery({
    queryKey: ["capacity-snapshots", clientId, 90],
    queryFn: () => fetchFn({ data: { clientId, days: 90 } }),
  });

  const deltas = useMemo(() => {
    const rows = (data?.snapshots ?? []) as Snap[];
    const byDomain = new Map<string, Snap[]>();
    for (const r of rows) {
      const arr = byDomain.get(r.domain_slug) ?? [];
      arr.push(r);
      byDomain.set(r.domain_slug, arr);
    }
    const out: Array<{
      slug: string;
      delta: number;
      pct: number;
      unit: string;
      tone: Tone;
    }> = [];
    for (const [slug, arr] of byDomain) {
      const pair = pickPair(arr);
      if (!pair) continue;
      const useNorm =
        pair.latest.normalized_score != null &&
        pair.prev.normalized_score != null;
      const latestVal = useNorm
        ? pair.latest.normalized_score!
        : pair.latest.raw_value!;
      const prevVal = useNorm
        ? pair.prev.normalized_score!
        : pair.prev.raw_value!;
      const unit = useNorm ? "/100" : pair.latest.raw_unit ?? "";
      const delta = latestVal - prevVal;
      const pct = prevVal === 0 ? 0 : (delta / prevVal) * 100;
      const lowerBetter = useNorm
        ? false
        : pair.latest.test_used
          ? LOWER_BETTER.has(pair.latest.test_used)
          : false;
      out.push({ slug, delta, pct, unit, tone: deltaTone(pct, lowerBetter) });
    }
    return out;
  }, [data]);

  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground">
        {t("capacityDeltas.loading", { defaultValue: "Loading…" })}
      </div>
    );
  }

  if (deltas.length === 0) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">
            {t("capacityDeltas.empty_title")}
          </div>
          <div className="text-xs text-muted-foreground">
            {t("capacityDeltas.empty_subtitle")}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("open-add-snapshot"))
          }
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t("capacityDeltas.add_button")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t("capacityDeltas.title")}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("open-add-snapshot"))
          }
        >
          <Plus className="mr-1 h-3 w-3" />
          {t("capacityDeltas.add_button")}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {deltas.map((d) => {
          const Icon =
            d.tone === "success"
              ? TrendingUp
              : d.tone === "warn"
                ? TrendingDown
                : Minus;
          const sign = d.delta > 0 ? "+" : "";
          const pctSign = d.pct > 0 ? "+" : "";
          return (
            <div
              key={d.slug}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs",
                toneChip(d.tone),
              )}
            >
              <span className="font-medium">
                {t(`capacity.${d.slug}.short`, { defaultValue: d.slug })}
              </span>
              <Icon className="h-3 w-3" />
              <span className="tabular-nums">
                {sign}
                {fmt(d.delta)}
                {d.unit}
              </span>
              <span className={cn("tabular-nums", toneText("neutral"))}>
                ({pctSign}
                {d.pct.toFixed(0)}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}