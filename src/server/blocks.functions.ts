import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runDemoPlay } from "@/server/demo-play.functions";
import { seedDemoSessions } from "@/server/demo-sessions.functions";
import { summarizePriorBlock, verdictLabelPt } from "@/lib/block-feedback";
import { MUSCLE_GROUP_LABELS_PT } from "@/lib/volume-landmarks";
import { adaptationEngine, proposeAndPersist } from "@/server/adaptation/propose-next-block.server";
import { logAuditEvent } from "@/server/audit/log-event.server";

/**
 * archivePlanAndStartNextBlock — RESTRAINT REFACTOR (R-D.1).
 *
 * Closes the current plan as "archived" and produces a *pending*
 * `adaptation_proposals` row for the trainer to review. **Does NOT** create
 * the next block automatically. The trainer reviews evidence + proposal at
 * `/clients/$clientId/adaptation/$proposalId` and submits a decision via
 * `decideAdaptation`. Only `accept` / `adjustUpcoming` decisions trigger
 * Block N+1 generation.
 *
 * This honours the doc's restraint principle: nothing changes without
 * explicit trainer action.
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

    // Compute + persist the proposal as PENDING. No plan is generated here.
    let proposalId: string;
    try {
      const out = await proposeAndPersist({
        trainerId: userId,
        clientId: (prior as any).client_id,
        priorPlanId: data.priorPlanId,
      });
      proposalId = out.proposalId;
    } catch (e) {
      console.error("[archivePlanAndStartNextBlock] proposeAndPersist failed", e);
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Failed to compute next-block proposal.",
      };
    }

    return {
      ok: true as const,
      proposalId,
      blockNumber: ((prior as any).block_number ?? 1) + 1,
      summary,
      // No planId — the new plan only exists after decideAdaptation accepts
      // or adjusts the proposal.
    };
  });

/**
 * decideAdaptation — required gate (R-D.2). The trainer reviews a pending
 * proposal and picks one of: continueAsIs / adjustCurrentSession /
 * adjustUpcoming / defer / accept. Only `accept` and `adjustUpcoming`
 * trigger Block N+1 generation. `defer` and `continueAsIs` mark the
 * proposal decided without spawning a new plan.
 *
 * The `rationale` field is required at the type and DB level — there is
 * no path that records a decision without one.
 */
const DecisionKind = z.enum([
  "continueAsIs",
  "adjustCurrentSession",
  "adjustUpcoming",
  "defer",
  "accept",
]);

export const decideAdaptation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        proposalId: z.string().uuid(),
        kind: DecisionKind,
        rationale: z.string().min(1, "Rationale is required").max(2000),
        // Only used when kind ∈ {accept, adjustUpcoming}; the trainer-edited
        // diff that overrides the engine proposal for next-block generation.
        changes: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Load + verify ownership.
    const { data: proposal, error: pErr } = await supabaseAdmin
      .from("adaptation_proposals")
      .select("id, trainer_id, client_id, prior_plan_id, proposal, status")
      .eq("id", data.proposalId)
      .maybeSingle();
    if (pErr || !proposal) return { ok: false as const, error: "Proposal not found." };
    if ((proposal as any).trainer_id !== userId) return { ok: false as const, error: "forbidden" };
    if ((proposal as any).status !== "pending") {
      return { ok: false as const, error: "Proposal already decided." };
    }

    // Append-only decision row.
    const { error: dErr } = await supabaseAdmin
      .from("adaptation_decisions")
      .insert({
        proposal_id: data.proposalId,
        trainer_id: userId,
        kind: data.kind,
        rationale: data.rationale,
        changes: (data.changes ?? {}) as Record<string, unknown>,
        decided_by: userId,
      } as never);
    if (dErr) return { ok: false as const, error: dErr.message };

    // Mark proposal as decided so it cannot be decided twice.
    await supabaseAdmin
      .from("adaptation_proposals")
      .update({ status: "decided" })
      .eq("id", data.proposalId);

    await logAuditEvent({
      trainerId: userId,
      eventType: "block_advanced",
      entityType: "block",
      entityId: (proposal as any).prior_plan_id,
      payload: {
        proposalId: data.proposalId,
        kind: data.kind,
        rationale: data.rationale,
        hasChanges: !!data.changes,
      },
      engineVersions: { adaptation: adaptationEngine.version },
    });

    // Defer / continueAsIs / adjustCurrentSession do NOT spawn a new plan.
    if (data.kind === "defer" || data.kind === "continueAsIs" || data.kind === "adjustCurrentSession") {
      return { ok: true as const, decided: true, planId: null as string | null };
    }

    // Accept / adjustUpcoming → generate the next block, with the
    // (possibly trainer-edited) proposal as Stage 3 hard input.
    const priorPlanId = (proposal as any).prior_plan_id as string;
    const clientId = (proposal as any).client_id as string;
    const engineProposal = (proposal as any).proposal as Record<string, unknown>;
    const effectiveProposal =
      data.changes && Object.keys(data.changes).length > 0
        ? { ...engineProposal, ...data.changes }
        : engineProposal;

    // Find the prior plan to compute next block number + assessment ref.
    const { data: prior } = await supabaseAdmin
      .from("workout_plans")
      .select("block_number, block_transition_summary")
      .eq("id", priorPlanId)
      .maybeSingle();
    const nextBlock = ((prior as any)?.block_number ?? 1) + 1;
    const summary = (prior as any)?.block_transition_summary ?? "";

    const { data: assessment } = await supabaseAdmin
      .from("assessments")
      .select("id")
      .eq("client_id", clientId)
      .order("performed_on", { ascending: false })
      .limit(1)
      .maybeSingle();

    const ran: any = await runDemoPlay({
      data: { clientId, priorPlanId },
    });
    if (!ran?.ok || !ran?.planId) {
      return {
        ok: false as const,
        error: ran?.error ?? "Block N+1 generation failed.",
        failedStep: ran?.failedStep ?? null,
      };
    }

    const { data: curPlanRow } = await supabaseAdmin
      .from("workout_plans")
      .select("generation_meta")
      .eq("id", ran.planId)
      .maybeSingle();
    const curMeta = ((curPlanRow as any)?.generation_meta ?? {}) as Record<string, any>;
    if (nextBlock >= 4) curMeta.suggest_main_lift_swap = true;
    curMeta.next_block_proposal = effectiveProposal;
    curMeta.adaptation_engine_version = adaptationEngine.version;
    curMeta.adaptation_proposal_id = data.proposalId;
    curMeta.adaptation_decision_kind = data.kind;

    await supabaseAdmin
      .from("workout_plans")
      .update({
        block_number: nextBlock,
        prior_plan_id: priorPlanId,
        block_transition_summary: summary,
        title: `Bloco ${nextBlock}`,
        assessment_id: (assessment as any)?.id ?? null,
        generation_meta: curMeta,
      })
      .eq("id", ran.planId);

    const loadMultiplier = Math.min(1.4, 1 + 0.04 * (nextBlock - 1));
    try {
      await seedDemoSessions({ data: { planId: ran.planId, weeksToSeed: 2, loadMultiplier } });
    } catch (e) {
      console.error("[decideAdaptation] seed sessions failed", e);
    }

    return { ok: true as const, decided: true, planId: ran.planId as string, blockNumber: nextBlock };
  });
