import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createDemoClient } from "@/server/demo-client.functions";
import { runDemoPlay } from "@/server/demo-play.functions";
import { seedDemoSessions } from "@/server/demo-sessions.functions";
import { seedDemoYearForPlan } from "@/server/demo-year.functions";
import { analyzeAssessmentSection } from "@/server/phased/pre-stage.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PHASED_SECTIONS } from "@/server/phased/section-map";

/**
 * Inner pipeline — runs the full instant demo (client + pre-stage + plan +
 * logbook) and writes per-stage progress to `demo_runs`. Designed to be
 * fire-and-forget: callers should NOT await this inside an HTTP handler
 * (Cloudflare Workers cap response wall-time at ~30s but keep the
 * invocation alive for pending promises). The UI polls `demo_runs`.
 */
export async function runInstantPipelineForUser(
  _userId: string,
  runId: string,
  data: { archetype?: string; durationWeeks?: number },
): Promise<void> {
  const setStage = async (
    stage: string,
    status: "running" | "done" | "failed" = "running",
    error?: string,
  ) => {
    await supabaseAdmin
      .from("demo_runs")
      .update({ stage, status, error: error ?? null })
      .eq("id", runId);
  };
  const isCancelled = async (): Promise<boolean> => {
    const { data: r } = await supabaseAdmin
      .from("demo_runs")
      .select("cancelled")
      .eq("id", runId)
      .maybeSingle();
    return Boolean((r as any)?.cancelled);
  };

  try {
    // 1) Create the client + assessment.
    await setStage("client", "running");
    const created: any = await createDemoClient({ data: { archetype: data.archetype } });
    if (!created?.clientId) {
      await setStage("client", "failed", "Failed to create demo client.");
      return;
    }
    const clientId = created.clientId as string;
    await supabaseAdmin.from("demo_runs").update({ client_id: clientId }).eq("id", runId);
    // Mark this client as demo so it's excluded from quotas and easy to wipe.
    await supabaseAdmin.from("clients").update({ is_demo: true }).eq("id", clientId);
    if (await isCancelled()) { await setStage("client", "failed", "Cancelled."); return; }

    // 1b) Pre-Stage 0 — analyze each assessment section in parallel batches.
    await setStage("prestage", "running");
    const { data: latestAssessment } = await supabaseAdmin
      .from("assessments")
      .select("id")
      .eq("client_id", clientId)
      .order("performed_on", { ascending: false })
      .limit(1)
      .maybeSingle();
    const assessmentId = (latestAssessment as any)?.id as string | undefined;
    if (assessmentId) {
      const sections = [...PHASED_SECTIONS];
      for (let i = 0; i < sections.length; i += 4) {
        const batch = sections.slice(i, i + 4);
        await Promise.allSettled(
          batch.map((s) =>
            analyzeAssessmentSection({ data: { assessmentId, section: s } }),
          ),
        );
        if (await isCancelled()) { await setStage("prestage", "failed", "Cancelled."); return; }
      }
    }
    await setStage("prestage", "done");

    // 2) Full phased plan pipeline.
    await setStage("plan", "running");
    const ran: any = await runDemoPlay({ data: { clientId } });
    if (!ran?.ok || !ran?.planId) {
      await setStage(ran?.failedStep ?? "plan", "failed", ran?.error ?? "Plan generation failed.");
      return;
    }
    const planId = ran.planId as string;
    await supabaseAdmin
      .from("demo_runs")
      .update({ plan_id: planId, client_id: clientId })
      .eq("id", runId);
    // Mark plan as demo BEFORE setting generation_status=complete elsewhere so
    // the quota trigger never bumps the trainer's used quota for demo content.
    await supabaseAdmin.from("workout_plans").update({ is_demo: true }).eq("id", planId);

    // Apply duration override.
    if (data.durationWeeks && data.durationWeeks !== 4) {
      await supabaseAdmin
        .from("workout_plans")
        .update({ duration_weeks: data.durationWeeks })
        .eq("id", planId);
    }

    // 3) Build a FULL YEAR of mesocycle history by cloning the AI plan into
    // 12 prior blocks (cheap SQL) and seeding logbook for every block. The
    // AI-generated plan becomes Bloco 13 (most recent). Skip year-seed if
    // the trainer just wants the founder Demo Lab one-shot — heuristic: only
    // year-seed when this run was kicked from the dashboard onboarding,
    // detected by absence of a custom archetype.
    await setStage("logbook", "running");
    try {
      if (!data.archetype) {
        await seedDemoYearForPlan({ trainerId: _userId, rootPlanId: planId });
      } else {
        const weeksToSeed = data.durationWeeks ?? 4;
        await seedDemoSessions({ data: { planId, weeksToSeed } });
      }
    } catch (e) {
      console.error("[demo-oneshot] seed sessions failed", e);
    }
    await setStage("logbook", "done");
    await setStage("done", "done");
  } catch (e: any) {
    console.error("[demo-oneshot] pipeline crashed", e);
    try {
      await supabaseAdmin
        .from("demo_runs")
        .update({ status: "failed", error: e?.message ?? "Pipeline error" })
        .eq("id", runId);
    } catch { /* ignore */ }
  }
}

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
