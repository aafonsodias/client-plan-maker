import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runDemoPlay } from "@/server/demo-play.functions";
import { seedDemoSessions } from "@/server/demo-sessions.functions";
import { summarizePriorBlock, verdictLabelPt } from "@/lib/block-feedback";
import { MUSCLE_GROUP_LABELS_PT } from "@/lib/volume-landmarks";

/**
 * archivePlanAndStartNextBlock — closes the current plan as "archived" and
 * spawns Block N+1 for the same client. Block N+1 reuses the same assessment
 * but tags `prior_plan_id`, increments `block_number`, and stamps a brief
 * `block_transition_summary` derived from the prior plan's adherence + RPE
 * drift. The new plan goes through the standard phased pipeline so the AI
 * proposes a coherent next block (deload-then-progress).
 *
 * Demo-only flow: we trust the founder gate at the UI layer; the function
 * itself enforces row ownership via RLS-backed admin queries.
 */
export const archivePlanAndStartNextBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ priorPlanId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Load prior plan (with brief + block info) and its session log so we
    // can build a transition summary that the next block can react to.
    const { data: prior, error: priorErr } = await supabaseAdmin
      .from("workout_plans")
      .select("id, trainer_id, client_id, block_number, brief, duration_weeks")
      .eq("id", data.priorPlanId)
      .maybeSingle();
    if (priorErr || !prior) return { ok: false as const, error: priorErr?.message ?? "Plan not found." };
    if ((prior as any).trainer_id !== userId) return { ok: false as const, error: "forbidden" };

    const { data: sessions } = await supabaseAdmin
      .from("workout_sessions")
      .select("week_number, status, entries")
      .eq("plan_id", data.priorPlanId)
      .order("week_number", { ascending: true });

    const summaryStruct = summarizePriorBlock((sessions ?? []) as any[]);
    const totalLogged = summaryStruct.totalSessions;
    const completed = summaryStruct.completedSessions;
    const adherencePct = summaryStruct.adherencePct;

    // Best-effort RPE drift: average RPE in the first vs last logged week.
    const rpePerWeek = new Map<number, number[]>();
    for (const s of sessions ?? []) {
      const wk = (s as any).week_number ?? 0;
      const entries = ((s as any).entries ?? []) as any[];
      const rpes = entries
        .flatMap((e) => (e?.sets ?? []).map((set: any) => Number(set?.rpe)))
        .filter((n) => Number.isFinite(n));
      if (rpes.length === 0) continue;
      const arr = rpePerWeek.get(wk) ?? [];
      arr.push(...rpes);
      rpePerWeek.set(wk, arr);
    }
    const weeks = [...rpePerWeek.keys()].sort((a, b) => a - b);
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const firstRpe = weeks.length ? avg(rpePerWeek.get(weeks[0])!) : null;
    const lastRpe = weeks.length ? avg(rpePerWeek.get(weeks[weeks.length - 1])!) : null;
    const rpeDrift =
      firstRpe !== null && lastRpe !== null ? Number((lastRpe - firstRpe).toFixed(2)) : null;

    const offTarget = summaryStruct.perMuscle.filter((p) => p.verdict !== "on_target");
    const offTargetLine = offTarget.length
      ? `Adaptação: ${offTarget
          .map((p) => `${MUSCLE_GROUP_LABELS_PT[p.muscle]} (${verdictLabelPt(p.verdict)})`)
          .join(", ")}.`
      : "Todos os grupos musculares no alvo.";

    const summary = [
      `Bloco ${(prior as any).block_number ?? 1} concluído.`,
      `Adesão: ${adherencePct}% (${completed}/${totalLogged} sessões).`,
      rpeDrift !== null
        ? `RPE médio variou ${rpeDrift > 0 ? "+" : ""}${rpeDrift} entre semana ${weeks[0]} e ${weeks[weeks.length - 1]}.`
        : "RPE sem dados suficientes.",
      offTargetLine,
      adherencePct >= 80 && (rpeDrift ?? 0) < 1
        ? "Próximo bloco: progride carga 5–7%, mantém volume."
        : adherencePct < 60
        ? "Próximo bloco: deload (volume −20%), reforça padrões base."
        : "Próximo bloco: mantém carga, varia exercícios acessórios.",
    ].join(" ");

    // Archive the prior plan.
    await supabaseAdmin
      .from("workout_plans")
      .update({ status: "archived", block_transition_summary: summary })
      .eq("id", data.priorPlanId);

    // Find the latest assessment for the client (re-used by next block).
    const { data: assessment } = await supabaseAdmin
      .from("assessments")
      .select("id")
      .eq("client_id", (prior as any).client_id)
      .order("performed_on", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextBlock = ((prior as any).block_number ?? 1) + 1;

    // Run the phased pipeline against the existing client. Pass priorPlanId
    // so runDemoPlay stamps the per-muscle verdict map onto generation_meta;
    // Stage 2/3 prompts read it to adapt the volume prescription.
    const ran: any = await runDemoPlay({
      data: { clientId: (prior as any).client_id, priorPlanId: data.priorPlanId },
    });
    if (!ran?.ok || !ran?.planId) {
      return {
        ok: false as const,
        error: ran?.error ?? "Block 2 generation failed.",
        failedStep: ran?.failedStep ?? null,
      };
    }

    // Tag the freshly-generated plan as Block N+1 of the lineage.
    await supabaseAdmin
      .from("workout_plans")
      .update({
        block_number: nextBlock,
        prior_plan_id: data.priorPlanId,
        block_transition_summary: summary,
        title: `Bloco ${nextBlock}`,
        assessment_id: (assessment as any)?.id ?? null,
      })
      .eq("id", ran.planId);

    // Seed 2 weeks of sessions so Resultados has data immediately.
    // Apply a gentle inter-block load curve (+4% per block, capped at 1.4×)
    // so the "Top 5 lifts" chart shows real progression across blocks.
    const loadMultiplier = Math.min(1.4, 1 + 0.04 * (nextBlock - 1));
    try {
      await seedDemoSessions({ data: { planId: ran.planId, weeksToSeed: 2, loadMultiplier } });
    } catch (e) {
      console.error("[archivePlanAndStartNextBlock] seed sessions failed", e);
    }

    return {
      ok: true as const,
      planId: ran.planId as string,
      blockNumber: nextBlock,
      summary,
    };
  });
