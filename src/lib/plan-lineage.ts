import { supabase } from "@/integrations/supabase/client";

/**
 * Walk the prior_plan_id chain backwards from `planId` and return all plan
 * IDs in the lineage (current + ancestors). Used by Progresso/Resultados so
 * charts include logbook data from previous blocks of the same client.
 *
 * Bounded to 20 hops to stop runaway loops if data is malformed.
 */
export async function fetchPlanLineageIds(planId: string): Promise<string[]> {
  const ids: string[] = [planId];
  let cursor: string | null = planId;
  for (let i = 0; i < 20 && cursor; i++) {
    const { data } = await supabase
      .from("workout_plans")
      .select("prior_plan_id")
      .eq("id", cursor)
      .maybeSingle();
    const next = (data as any)?.prior_plan_id as string | null;
    if (!next || ids.includes(next)) break;
    ids.push(next);
    cursor = next;
  }
  return ids;
}
