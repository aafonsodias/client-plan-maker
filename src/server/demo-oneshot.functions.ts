import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createDemoClient } from "@/server/demo-client.functions";
import { runDemoPlay } from "@/server/demo-play.functions";
import { seedDemoSessions } from "@/server/demo-sessions.functions";
import { analyzeAssessmentSection } from "@/server/phased/pre-stage.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PHASED_SECTIONS } from "@/server/phased/section-map";

/**
 * createDemoClientFull — INSTANT mode.
 *
 * One-click: AI client + assessment + Pre-Stage analyses + full phased plan
 * + N weeks of logged sessions. Writes a `demo_runs` row up-front so the
 * Demo Lab UI can poll real per-stage progress and trigger a soft cancel.
 *
 * The Pre-Stage 0 fan-out is what fixes the "<UNKNOWN>" placeholders the
 * brief used to emit when its inputs were sparse — Stage 1 now reads cached
 * per-section analyses (esp. mobility / posture / screen) before synthesis.
 */
export const createDemoClientFull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        archetype: z.string().optional(),
        durationWeeks: z.number().int().min(2).max(12).optional(),
        weeksToSeed: z.number().int().min(1).max(8).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Live-progress row for the Demo Lab. Failures here are non-fatal — we
    // still run the demo without a poll handle.
    const { data: runRow } = await supabaseAdmin
      .from("demo_runs")
      .insert({ trainer_id: userId, stage: "client", status: "running" })
      .select("id")
      .single();
    const runId = (runRow as any)?.id as string | undefined;

    const setStage = async (
      stage: string,
      status: "running" | "done" | "failed" = "running",
      error?: string,
    ) => {
      if (!runId) return;
      await supabaseAdmin
        .from("demo_runs")
        .update({ stage, status, error: error ?? null })
        .eq("id", runId);
    };
    const isCancelled = async (): Promise<boolean> => {
      if (!runId) return false;
      const { data: r } = await supabaseAdmin
        .from("demo_runs")
        .select("cancelled")
        .eq("id", runId)
        .maybeSingle();
      return Boolean((r as any)?.cancelled);
    };
    const cancelExit = (clientId: string | null, stage: string) => ({
      ok: false as const,
      stage,
      error: "Cancelled.",
      clientId,
      planId: null,
      sessions: 0,
      runId: runId ?? null,
    });

    // 1) Create the client + assessment.
    await setStage("client", "running");
    const created: any = await createDemoClient({ data: { archetype: data.archetype } });
    if (!created?.clientId) {
      await setStage("client", "failed", "Failed to create demo client.");
      return {
        ok: false as const,
        stage: "create_client",
        error: "Failed to create demo client.",
        clientId: null,
        planId: null,
        sessions: 0,
        runId: runId ?? null,
      };
    }
    const clientId = created.clientId as string;
    if (await isCancelled()) {
      await setStage("client", "failed", "Cancelled.");
      return cancelExit(clientId, "cancelled");
    }

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
        if (await isCancelled()) {
          await setStage("prestage", "failed", "Cancelled.");
          return cancelExit(clientId, "cancelled");
        }
      }
    }
    await setStage("prestage", "done");

    // 2) Full phased plan pipeline.
    await setStage("plan", "running");
    const ran: any = await runDemoPlay({ data: { clientId } });
    if (!ran?.ok || !ran?.planId) {
      await setStage(ran?.failedStep ?? "plan", "failed", ran?.error ?? "Plan generation failed.");
      return {
        ok: false as const,
        stage: ran?.failedStep ?? "plan",
        error: ran?.error ?? "Plan generation failed.",
        clientId,
        planId: null,
        sessions: 0,
        runId: runId ?? null,
      };
    }
    const planId = ran.planId as string;
    if (runId) {
      await supabaseAdmin
        .from("demo_runs")
        .update({ plan_id: planId, client_id: clientId })
        .eq("id", runId);
    }

    // Apply duration override (logbook seed honors it; full bulk-fill at
    // 6/8 weeks is a follow-up that already works because Stage 5 reads
    // duration_weeks before fanning out the remaining weeks).
    if (data.durationWeeks && data.durationWeeks !== 4) {
      await supabaseAdmin
        .from("workout_plans")
        .update({ duration_weeks: data.durationWeeks })
        .eq("id", planId);
    }

    // 3) Seed N weeks of sessions.
    await setStage("logbook", "running");
    let sessions = 0;
    try {
      const weeksToSeed = data.weeksToSeed ?? 2;
      const seeded: any = await seedDemoSessions({
        data: { planId, weeksToSeed },
      });
      sessions = seeded?.inserted ?? 0;
    } catch (e) {
      console.error("[demo-oneshot] seed sessions failed", e);
    }
    await setStage("logbook", "done");
    await setStage("done", "done");

    return {
      ok: true as const,
      stage: "done" as const,
      error: null,
      clientId,
      planId,
      sessions,
      runId: runId ?? null,
    };
  });

/**
 * Cancel an in-flight demo run. Sets `cancelled = true`; the runner checks
 * between stages and exits early. Returns the latest known stage so the UI
 * can render the partial state.
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
 * Poll a demo run's current stage. Used by the Demo Lab to render a real
 * progress list (no fake setInterval animation).
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