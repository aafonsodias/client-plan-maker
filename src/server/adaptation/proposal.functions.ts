// ============================================================================
// Server fns for the adaptation proposal review screen.
// `loadProposal` returns the pending (or decided) proposal + evidence so the
// trainer can review before submitting a decision via `decideAdaptation`.
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const loadProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ proposalId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: proposal, error } = await supabaseAdmin
      .from("adaptation_proposals")
      .select(
        "id, trainer_id, client_id, prior_plan_id, proposal, evidence, engine_versions, inputs_hash, status, created_at",
      )
      .eq("id", data.proposalId)
      .maybeSingle();
    if (error || !proposal) {
      return { ok: false as const, error: "Proposal not found." };
    }
    if ((proposal as any).trainer_id !== userId) {
      return { ok: false as const, error: "forbidden" };
    }

    const [{ data: client }, { data: priorPlan }, { data: markers }, { data: decision }] =
      await Promise.all([
        supabaseAdmin
          .from("clients")
          .select("id, full_name")
          .eq("id", (proposal as any).client_id)
          .maybeSingle(),
        supabaseAdmin
          .from("workout_plans")
          .select("id, title, block_number, block_transition_summary")
          .eq("id", (proposal as any).prior_plan_id)
          .maybeSingle(),
        supabaseAdmin
          .from("progress_markers")
          .select("metric, scope, value, computed_at")
          .eq("plan_id", (proposal as any).prior_plan_id)
          .eq("inputs_hash", (proposal as any).inputs_hash)
          .order("metric", { ascending: true }),
        supabaseAdmin
          .from("adaptation_decisions")
          .select("id, kind, rationale, changes, decided_at")
          .eq("proposal_id", data.proposalId)
          .order("decided_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    return {
      ok: true as const,
      proposal: proposal as Record<string, any>,
      client: (client ?? null) as Record<string, any> | null,
      priorPlan: (priorPlan ?? null) as Record<string, any> | null,
      markers: (markers ?? []) as Array<Record<string, any>>,
      decision: (decision ?? null) as Record<string, any> | null,
    };
  });

// ---------------------------------------------------------------------------
// listPendingProposals — dashboard surface. Returns trainer's `pending`
// adaptation proposals so the trainer can decide before any new block is
// generated. Decision gate lives at /clients/$clientId/adaptation/$proposalId.
// ---------------------------------------------------------------------------
export const listPendingProposals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await supabaseAdmin
      .from("adaptation_proposals")
      .select("id, client_id, prior_plan_id, created_at, status")
      .eq("trainer_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error || !data || data.length === 0) {
      return { ok: true as const, items: [] as Array<{ id: string; clientId: string; clientName: string | null; priorPlanTitle: string | null; createdAt: string }> };
    }
    const clientIds = Array.from(new Set(data.map((d: any) => d.client_id)));
    const planIds = Array.from(new Set(data.map((d: any) => d.prior_plan_id).filter(Boolean)));
    const [{ data: clients }, { data: plans }] = await Promise.all([
      supabaseAdmin.from("clients").select("id, full_name").in("id", clientIds),
      planIds.length
        ? supabaseAdmin.from("workout_plans").select("id, title, block_number").in("id", planIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const cmap = new Map((clients ?? []).map((c: any) => [c.id, c.full_name]));
    const pmap = new Map((plans ?? []).map((p: any) => [p.id, p]));
    return {
      ok: true as const,
      items: data.map((d: any) => ({
        id: d.id,
        clientId: d.client_id,
        clientName: cmap.get(d.client_id) ?? null,
        priorPlanTitle: (pmap.get(d.prior_plan_id) as any)?.title ?? null,
        priorBlock: (pmap.get(d.prior_plan_id) as any)?.block_number ?? null,
        createdAt: d.created_at,
      })),
    };
  });