import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkPlanQuota } from "@/server/quota.server";

/**
 * Plan templates — trainers save finalized plans as reusable blueprints
 * and instantiate new plans for any client without re-running the AI
 * pipeline. Massive time-saver for trainers with archetypal programs
 * (e.g. "Hipertrofia 12sem iniciante", "Força 5x5 intermédio").
 */

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("plan_templates")
      .select("id, name, description, duration_weeks, tags, use_count, updated_at")
      .eq("trainer_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, templates: data ?? [] };
  });

export const saveTemplateFromPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        name: z.string().min(1).max(120),
        description: z.string().max(500).optional(),
        tags: z.array(z.string()).max(8).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: plan, error } = await supabaseAdmin
      .from("workout_plans")
      .select("trainer_id, plan_data, blueprint, programming_variables, brief, duration_weeks")
      .eq("id", data.planId)
      .maybeSingle();
    if (error || !plan) return { ok: false as const, error: error?.message ?? "Plan not found" };
    if ((plan as any).trainer_id !== userId) return { ok: false as const, error: "forbidden" };

    const { data: tpl, error: insErr } = await supabaseAdmin
      .from("plan_templates")
      .insert({
        trainer_id: userId,
        name: data.name,
        description: data.description ?? null,
        source_plan_id: data.planId,
        duration_weeks: (plan as any).duration_weeks ?? 4,
        plan_data: (plan as any).plan_data ?? { weeks: [] },
        blueprint: (plan as any).blueprint ?? null,
        programming_variables: (plan as any).programming_variables ?? null,
        brief: (plan as any).brief ?? null,
        tags: data.tags ?? [],
      })
      .select("id")
      .single();
    if (insErr || !tpl) return { ok: false as const, error: insErr?.message ?? "Failed to save" };
    return { ok: true as const, templateId: (tpl as any).id as string };
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ templateId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("plan_templates")
      .delete()
      .eq("id", data.templateId)
      .eq("trainer_id", context.userId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/**
 * Apply a template to a client → creates a fully-formed workout_plans row
 * + workout_plan_days rows, status="ready". Skips the AI pipeline.
 * Counts against plan quota.
 */
export const applyTemplateToClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ templateId: z.string().uuid(), clientId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const quota = await checkPlanQuota(userId);
    if (!quota.ok) return { ok: false as const, error: "quota_exceeded" };

    const { data: tpl, error: tplErr } = await supabaseAdmin
      .from("plan_templates")
      .select("*")
      .eq("id", data.templateId)
      .eq("trainer_id", userId)
      .maybeSingle();
    if (tplErr || !tpl) return { ok: false as const, error: "Template not found" };

    const { data: client, error: clientErr } = await supabaseAdmin
      .from("clients")
      .select("id, full_name, trainer_id")
      .eq("id", data.clientId)
      .maybeSingle();
    if (clientErr || !client) return { ok: false as const, error: "Client not found" };
    if ((client as any).trainer_id !== userId) return { ok: false as const, error: "forbidden" };

    const { data: assessment } = await supabaseAdmin
      .from("assessments")
      .select("id")
      .eq("client_id", data.clientId)
      .order("performed_on", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: planRow, error: planErr } = await supabaseAdmin
      .from("workout_plans")
      .insert({
        trainer_id: userId,
        client_id: data.clientId,
        assessment_id: (assessment as any)?.id ?? null,
        title: `${(tpl as any).name} · ${(client as any).full_name}`,
        duration_weeks: (tpl as any).duration_weeks,
        status: "ready",
        generation_status: "complete",
        plan_data: (tpl as any).plan_data ?? { weeks: [] },
        blueprint: (tpl as any).blueprint ?? null,
        programming_variables: (tpl as any).programming_variables ?? null,
        brief: (tpl as any).brief ?? null,
        completion_state: "ready",
        generation_meta: { source: "template", template_id: data.templateId },
      })
      .select("id")
      .single();
    if (planErr || !planRow) return { ok: false as const, error: planErr?.message ?? "Failed" };
    const planId = (planRow as any).id as string;

    // Materialize days from plan_data weeks/days into workout_plan_days rows
    const weeks = ((tpl as any).plan_data?.weeks ?? []) as any[];
    const dayRows: any[] = [];
    for (const wk of weeks) {
      const days = (wk?.days ?? []) as any[];
      for (const d of days) {
        dayRows.push({
          plan_id: planId,
          trainer_id: userId,
          week_number: Number(wk?.week_number ?? wk?.week ?? 1),
          day_number: Number(d?.day_number ?? d?.day ?? 1),
          day_label: d?.day_label ?? d?.label ?? null,
          focus: d?.focus ?? null,
          rationale: d?.rationale ?? null,
          content: d ?? {},
          status: "done",
        });
      }
    }
    if (dayRows.length > 0) {
      await supabaseAdmin.from("workout_plan_days").insert(dayRows);
    }

    // bump use count
    await supabaseAdmin
      .from("plan_templates")
      .update({ use_count: ((tpl as any).use_count ?? 0) + 1 })
      .eq("id", data.templateId);

    return { ok: true as const, planId };
  });