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