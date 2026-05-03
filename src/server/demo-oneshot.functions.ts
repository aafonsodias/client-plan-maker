import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runInstantPipelineForUser } from "@/server/demo-oneshot.server";

/**
 * startDemoClientFull — fire-and-poll INSTANT mode.
 *
 * Inserts a `demo_runs` row, kicks off the full pipeline WITHOUT awaiting
 * it, and returns `{ runId }` immediately. The UI polls `getDemoRun` to
 * follow progress and reads `plan_id` to navigate when the run completes.
 * This avoids the upstream timeout that crashed the long-running response.
 */
export const startDemoClientFull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        archetype: z.string().optional(),
        durationWeeks: z.number().int().min(2).max(12).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: runRow, error } = await supabaseAdmin
      .from("demo_runs")
      .insert({ trainer_id: userId, stage: "client", status: "running" })
      .select("id")
      .single();
    if (error || !runRow) {
      return { ok: false as const, runId: null, error: error?.message ?? "Failed to start run." };
    }
    const runId = (runRow as any).id as string;
    // Fire-and-forget: keep the promise alive on the runtime but don't
    // await it inside the HTTP response. Errors are persisted to demo_runs.
    void runInstantPipelineForUser(userId, runId, data).catch((e: unknown) => {
      console.error("[demo-oneshot] background pipeline error", e);
    });
    return { ok: true as const, runId, error: null };
  });

/**
 * Cancel an in-flight demo run. Sets `cancelled = true`; the runner checks
 * between stages and exits early.
 */
export const cancelDemoRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ runId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { error } = await supabaseAdmin
      .from("demo_runs")
      .update({ cancelled: true })
      .eq("id", data.runId)
      .eq("trainer_id", userId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/**
 * Poll a demo run's current stage. Used by the Demo Lab to render real
 * progress and to detect when the plan is ready for navigation.
 */
export const getDemoRun = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ runId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: row } = await supabaseAdmin
      .from("demo_runs")
      .select("id, stage, status, error, cancelled, plan_id, client_id, updated_at")
      .eq("id", data.runId)
      .eq("trainer_id", userId)
      .maybeSingle();
    return row ?? null;
  });
