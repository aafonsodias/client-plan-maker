import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeCapacityGain, epley } from "@/lib/capacity-gain";

/**
 * usePlanBlockEvolution — for a list of plan ids, returns a map of
 * `{ [planId]: { deltaPct, verdict, hasPrior } }` so the dashboard can show
 * a small chip per plan with capacity evolution vs the prior block.
 *
 * Skips plans without `prior_plan_id`. Cheap by design: a single batched
 * query for plans + a single batched query for sessions across the union of
 * (planId, priorPlanId).
 */
export type PlanEvolution = {
  hasPrior: boolean;
  deltaPct: number | null;
  verdict: "gain" | "flat" | "regression" | "unknown";
  series: number[]; // up to 8 e1RM points for the most-frequent lift in current plan
};

export function usePlanBlockEvolution(planIds: string[]): Record<string, PlanEvolution> {
  const [out, setOut] = useState<Record<string, PlanEvolution>>({});
  useEffect(() => {
    if (planIds.length === 0) { setOut({}); return; }
    let cancelled = false;
    void (async () => {
      const { data: plans } = await supabase
        .from("workout_plans")
        .select("id, prior_plan_id, block_number")
        .in("id", planIds);
      const rows = (plans ?? []) as Array<{ id: string; prior_plan_id: string | null; block_number: number }>;
      const idsToFetch = new Set<string>();
      for (const r of rows) {
        if (r.prior_plan_id) { idsToFetch.add(r.id); idsToFetch.add(r.prior_plan_id); }
      }
      if (idsToFetch.size === 0) {
        const empty: Record<string, PlanEvolution> = {};
        for (const r of rows) empty[r.id] = { hasPrior: false, deltaPct: null, verdict: "unknown", series: [] };
        if (!cancelled) setOut(empty);
        return;
      }
      const { data: sessions } = await supabase
        .from("workout_sessions")
        .select("plan_id, entries, session_date")
        .in("plan_id", Array.from(idsToFetch));
      const byPlan = new Map<string, any[]>();
      for (const s of (sessions ?? []) as any[]) {
        const arr = byPlan.get(s.plan_id) ?? [];
        arr.push(s);
        byPlan.set(s.plan_id, arr);
      }
      const result: Record<string, PlanEvolution> = {};
      for (const r of rows) {
        if (!r.prior_plan_id) {
          result[r.id] = { hasPrior: false, deltaPct: null, verdict: "unknown", series: [] };
          continue;
        }
        const cur = byPlan.get(r.id) ?? [];
        const prior = byPlan.get(r.prior_plan_id) ?? [];
        if (cur.length === 0 || prior.length === 0) {
          result[r.id] = { hasPrior: true, deltaPct: null, verdict: "unknown", series: [] };
          continue;
        }
        const summary = computeCapacityGain(prior, cur);
        const series = topLiftE1rmSeries(cur);
        result[r.id] = {
          hasPrior: true,
          deltaPct: summary.overall.deltaPct,
          verdict: summary.overall.verdict,
          series,
        };
      }
      if (!cancelled) setOut(result);
    })();
    return () => { cancelled = true; };
  }, [planIds.join(",")]);
  return out;
}

/**
 * For sparkline: pick the lift with the most logged sets in the current
 * plan, then return up to 8 e1RM datapoints (best set per session, in
 * chronological order).
 */
function topLiftE1rmSeries(sessions: Array<{ session_date?: string; entries?: any[] }>): number[] {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    for (const e of s.entries ?? []) {
      const name = String(e?.exercise_name ?? e?.name ?? "").trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  let topName = ""; let topN = 0;
  for (const [n, c] of counts) if (c > topN) { topN = c; topName = n; }
  if (!topName) return [];
  const sorted = [...sessions].sort((a, b) =>
    String(a.session_date ?? "").localeCompare(String(b.session_date ?? "")),
  );
  const points: number[] = [];
  for (const s of sorted) {
    let best = 0;
    for (const e of s.entries ?? []) {
      const name = String(e?.exercise_name ?? e?.name ?? "").trim();
      if (name !== topName) continue;
      const loadStr = String(e?.actual?.weight ?? "");
      const repsStr = String(e?.actual?.reps ?? "");
      const load = Number((loadStr.match(/(\d+(?:\.\d+)?)/) ?? [])[1] ?? 0);
      const reps = Number((repsStr.match(/\d+/) ?? [])[0] ?? 0);
      const e1 = epley(load, reps) ?? 0;
      if (e1 > best) best = e1;
    }
    if (best > 0) points.push(Number(best.toFixed(1)));
  }
  return points.slice(-8);
}