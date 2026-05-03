import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeCapacityGain } from "@/lib/capacity-gain";

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
        for (const r of rows) empty[r.id] = { hasPrior: false, deltaPct: null, verdict: "unknown" };
        if (!cancelled) setOut(empty);
        return;
      }
      const { data: sessions } = await supabase
        .from("workout_sessions")
        .select("plan_id, entries")
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
          result[r.id] = { hasPrior: false, deltaPct: null, verdict: "unknown" };
          continue;
        }
        const cur = byPlan.get(r.id) ?? [];
        const prior = byPlan.get(r.prior_plan_id) ?? [];
        if (cur.length === 0 || prior.length === 0) {
          result[r.id] = { hasPrior: true, deltaPct: null, verdict: "unknown" };
          continue;
        }
        const summary = computeCapacityGain(prior, cur);
        result[r.id] = {
          hasPrior: true,
          deltaPct: summary.overall.deltaPct,
          verdict: summary.overall.verdict,
        };
      }
      if (!cancelled) setOut(result);
    })();
    return () => { cancelled = true; };
  }, [planIds.join(",")]);
  return out;
}