import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Founder-only telemetry helpers. RLS already restricts generation_log to the
 * trainer (auth.uid() = trainer_id), so any trainer can call these for their
 * own data — but the UI gates rendering to the founder account.
 */

export type StageTelemetry = {
  stage: string;
  calls: number;
  cost_usd: number;
  avg_duration_ms: number;
  failures: number;
  last_at: string | null;
  last_error: string | null;
  last_model: string | null;
};

function rollup(rows: any[]): StageTelemetry[] {
  const byStage = new Map<string, StageTelemetry>();
  for (const r of rows ?? []) {
    const stage = String(r.stage ?? "unknown");
    const cur =
      byStage.get(stage) ??
      {
        stage,
        calls: 0,
        cost_usd: 0,
        avg_duration_ms: 0,
        failures: 0,
        last_at: null,
        last_error: null,
        last_model: null,
      };
    cur.calls += 1;
    cur.cost_usd += Number(r.cost_usd ?? 0);
    cur.avg_duration_ms += Number(r.duration_ms ?? 0);
    if (!r.zod_passed) cur.failures += 1;
    const at = r.created_at ? new Date(r.created_at).toISOString() : null;
    if (!cur.last_at || (at && at > cur.last_at)) {
      cur.last_at = at;
      cur.last_error = r.error ?? null;
      cur.last_model = r.model_used ?? null;
    }
    byStage.set(stage, cur);
  }
  const out = Array.from(byStage.values()).map((s) => ({
    ...s,
    avg_duration_ms: s.calls > 0 ? Math.round(s.avg_duration_ms / s.calls) : 0,
    cost_usd: Number(s.cost_usd.toFixed(6)),
  }));
  out.sort((a, b) => (a.stage < b.stage ? -1 : a.stage > b.stage ? 1 : 0));
  return out;
}

export const getPlanGenerationTelemetry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ planId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("generation_log")
      .select("stage, model_used, cost_usd, duration_ms, zod_passed, error, created_at")
      .eq("plan_id", data.planId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return { ok: false as const, error: error.message };
    const stages = rollup(rows ?? []);
    const total_cost_usd = Number(stages.reduce((s, x) => s + x.cost_usd, 0).toFixed(6));
    const total_calls = stages.reduce((s, x) => s + x.calls, 0);
    const total_failures = stages.reduce((s, x) => s + x.failures, 0);
    return { ok: true as const, stages, total_cost_usd, total_calls, total_failures };
  });

export const getTrainerGenerationTelemetry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ days: z.number().int().min(1).max(90).default(7) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();
    const { data: rows, error } = await supabase
      .from("generation_log")
      .select("stage, model_used, cost_usd, duration_ms, zod_passed, error, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) return { ok: false as const, error: error.message };
    const stages = rollup(rows ?? []);
    const total_cost_usd = Number(stages.reduce((s, x) => s + x.cost_usd, 0).toFixed(6));
    const total_calls = stages.reduce((s, x) => s + x.calls, 0);
    const total_failures = stages.reduce((s, x) => s + x.failures, 0);
    const avg_duration_ms =
      total_calls > 0
        ? Math.round(
            stages.reduce((s, x) => s + x.avg_duration_ms * x.calls, 0) / total_calls,
          )
        : 0;
    return {
      ok: true as const,
      since,
      days: data.days,
      stages,
      total_cost_usd,
      total_calls,
      total_failures,
      avg_duration_ms,
    };
  });