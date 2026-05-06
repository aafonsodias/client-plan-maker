import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkPlanQuota } from "@/server/quota.server";
import { runQuickPlanPipelineForUser } from "@/server/quick-plan.server";

const QuickPlanSchema = z.object({
  fullName: z.string().trim().min(1).max(80),
  age: z.number().int().min(14).max(90),
  sex: z.enum(["male", "female", "other"]),
  primaryGoal: z.enum(["hypertrophy", "strength", "recomp", "general_health", "performance"]),
  experience: z.enum(["beginner", "intermediate", "advanced"]),
  daysPerWeek: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  equipment: z.array(z.string()).min(1).max(8),
});

/**
 * R70 — startQuickPlan: 5-input → full plan, fire-and-forget, polled via
 * demo_runs. Reuses the same progress channel as demo-oneshot so the
 * global indicator pill renders the same stages.
 */
export const startQuickPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => QuickPlanSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const quota = await checkPlanQuota(supabase as any, userId);
    if (!quota.ok) {
      return {
        ok: false as const,
        runId: null,
        error: "quota_exceeded",
        used: quota.used,
        limit: quota.limit,
      };
    }

    const { data: runRow, error } = await supabaseAdmin
      .from("demo_runs")
      .insert({ trainer_id: userId, stage: "client", status: "running" })
      .select("id")
      .single();
    if (error || !runRow) {
      return { ok: false as const, runId: null, error: error?.message ?? "Falhou iniciar." };
    }
    const runId = (runRow as any).id as string;

    void runQuickPlanPipelineForUser(userId, runId, data).catch((e: unknown) => {
      console.error("[quick-plan] background error", e);
    });
    return { ok: true as const, runId, error: null };
  });