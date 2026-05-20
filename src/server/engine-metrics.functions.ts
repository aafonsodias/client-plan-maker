// ============================================================================
// engine-metrics — the 3 leap-of-faith numbers (see mem/strategy/leap-of-faith).
//   value         — % of finalized plans the trainer edited (≥60% target)
//   engagement    — session-log adherence last 28d (≥80% target)
//   differentiation — % of clients with a finalized plan ≥28d old that reached
//                     a Block ≥2 plan (≥70% target)
// All computed from real rows. No vanity counts.
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type EngineMetric = {
  key: "value" | "engagement" | "differentiation";
  pct: number | null; // null = insufficient data
  sample: number;     // denominator
  target: number;     // % target from leap-of-faith doc
};

const EDIT_GRACE_MS = 60 * 1000; // updated_at > created_at + 60s ⇒ trainer touched it
const WINDOW_MS = 28 * 24 * 3600 * 1000;

export const loadEngineMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const since = new Date(Date.now() - WINDOW_MS).toISOString();

    const [{ data: finalized }, { data: days }, { data: sessions }, { data: blockPlans }] =
      await Promise.all([
        supabaseAdmin
          .from("workout_plans")
          .select("id, client_id, created_at, updated_at, block_number")
          .eq("trainer_id", userId)
          .eq("is_demo", false)
          .eq("status", "finalized"),
        supabaseAdmin
          .from("workout_plan_days")
          .select("plan_id, status, workout_plans!inner(trainer_id, is_demo)")
          .gte("created_at", since)
          .eq("workout_plans.trainer_id", userId)
          .eq("workout_plans.is_demo", false),
        supabaseAdmin
          .from("workout_sessions")
          .select("plan_id, workout_plans!inner(trainer_id, is_demo)")
          .gte("session_date", since.slice(0, 10))
          .eq("workout_plans.trainer_id", userId)
          .eq("workout_plans.is_demo", false),
        supabaseAdmin
          .from("workout_plans")
          .select("client_id, block_number")
          .eq("trainer_id", userId)
          .eq("is_demo", false)
          .gte("block_number", 2),
      ]);

    // 1. Value — edited rate on finalized plans
    const finalizedRows = (finalized ?? []) as Array<{ id: string; client_id: string; created_at: string; updated_at: string; block_number: number }>;
    const valueSample = finalizedRows.length;
    const edited = finalizedRows.filter((p) => {
      const c = new Date(p.created_at).getTime();
      const u = new Date(p.updated_at).getTime();
      return u - c > EDIT_GRACE_MS;
    }).length;
    const value: EngineMetric = {
      key: "value",
      pct: valueSample >= 3 ? Math.round((edited / valueSample) * 100) : null,
      sample: valueSample,
      target: 60,
    };

    // 2. Engagement — sessions logged / days prescribed (status=done) in last 28d
    const prescribedDays = (days ?? []).filter((d: any) => d.status === "done" || d.status === "prescribed" || d.status === "planned").length;
    const loggedSessions = (sessions ?? []).length;
    const engagement: EngineMetric = {
      key: "engagement",
      pct: prescribedDays >= 4 ? Math.min(100, Math.round((loggedSessions / prescribedDays) * 100)) : null,
      sample: prescribedDays,
      target: 80,
    };

    // 3. Differentiation — of clients with a finalized plan ≥28d old, % with a Block ≥2 plan
    const cutoff = Date.now() - WINDOW_MS;
    const eligibleClients = new Set(
      finalizedRows.filter((p) => new Date(p.created_at).getTime() < cutoff).map((p) => p.client_id),
    );
    const block2Clients = new Set(((blockPlans ?? []) as Array<{ client_id: string }>).map((p) => p.client_id));
    const reached = [...eligibleClients].filter((c) => block2Clients.has(c)).length;
    const differentiation: EngineMetric = {
      key: "differentiation",
      pct: eligibleClients.size >= 3 ? Math.round((reached / eligibleClients.size) * 100) : null,
      sample: eligibleClients.size,
      target: 70,
    };

    return { ok: true as const, metrics: [value, engagement, differentiation] };
  });