import { createDemoClient } from "@/server/demo-client.functions";
import { runDemoPlay } from "@/server/demo-play.functions";
import { seedDemoSessions } from "@/server/demo-sessions.functions";
import { seedDemoYearForPlan } from "@/server/demo-year.server";
import { analyzeAssessmentSection } from "@/server/phased/pre-stage.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PHASED_SECTIONS } from "@/server/phased/section-map";

/**
 * Inner pipeline — runs the full instant demo (client + pre-stage + plan +
 * logbook) and writes per-stage progress to `demo_runs`. Designed to be
 * fire-and-forget.
 */
export async function runInstantPipelineForUser(
  _userId: string,
  runId: string,
  data: { archetype?: string; durationWeeks?: number; locale?: string },
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
    await setStage("client", "running");
    const created: any = await createDemoClient({ data: { archetype: data.archetype } });
    if (!created?.clientId) {
      await setStage("client", "failed", "Failed to create demo client.");
      return;
    }
    const clientId = created.clientId as string;
    await supabaseAdmin.from("demo_runs").update({ client_id: clientId }).eq("id", runId);
    await supabaseAdmin.from("clients").update({ is_demo: true }).eq("id", clientId);
    if (await isCancelled()) { await setStage("client", "failed", "Cancelled."); return; }

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
    await supabaseAdmin.from("workout_plans").update({ is_demo: true }).eq("id", planId);

    if (data.durationWeeks && data.durationWeeks !== 4) {
      await supabaseAdmin
        .from("workout_plans")
        .update({ duration_weeks: data.durationWeeks })
        .eq("id", planId);
    }

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