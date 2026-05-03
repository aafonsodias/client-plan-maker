import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { seedDemoSessions } from "@/server/demo-sessions.functions";

/**
 * Block lineage builder for the demo account.
 *
 * The Bloco 1 (most recent) is produced by the real phased AI pipeline so the
 * trainer sees the genuine output. We then CLONE that plan 12 times backwards
 * in time (Blocos −1 .. −12) so the demo account looks like it has a full year
 * of mesocycles already, with adherence + RPE drift the AI can react to next
 * time. Cloning is pure SQL — no AI cost, ~1s total.
 *
 * Block layout in the timeline (each block is `duration_weeks` long, default 4):
 *
 *   ── 12 months ago ─────────────────────────────────── today ──
 *      [block_number=1]  [2]  [3]  ...  [12]  [13 = AI-generated, ready]
 *
 * `prior_plan_id` is wired so block N points back to block N-1.
 */

type DayRow = {
  week_number: number;
  day_number: number;
  day_label: string | null;
  focus: string | null;
  rationale: string | null;
  content: any;
  status: string;
  validation_meta: any;
};

/**
 * Lightweight content mutation so cloned blocks don't look identical.
 * - rotates the order of accessory exercises by `blockIndex` so a coach
 *   scanning two consecutive blocks sees variation,
 * - tweaks rest periods by ±10s deterministically.
 */
function mutateContent(content: any, blockIndex: number): any {
  if (!content || !Array.isArray(content.exercises)) return content;
  const exercises = [...content.exercises];
  // Treat first 2 as compounds (untouched). Rotate the rest.
  if (exercises.length > 3) {
    const head = exercises.slice(0, 2);
    const tail = exercises.slice(2);
    const k = blockIndex % Math.max(1, tail.length);
    const rotated = tail.slice(k).concat(tail.slice(0, k));
    return { ...content, exercises: head.concat(rotated) };
  }
  return content;
}

function summariseTransition(blockIndex: number, adherencePct: number, rpeDrift: number): string {
  const parts: string[] = [
    `Bloco ${blockIndex} concluído.`,
    `Adesão: ${adherencePct}% no histórico.`,
    rpeDrift > 0.5
      ? `RPE médio subiu ${rpeDrift.toFixed(2)} — fadiga acumulada, próxima semana descarrega.`
      : rpeDrift < -0.3
        ? `RPE médio desceu ${Math.abs(rpeDrift).toFixed(2)} — adaptação positiva, podemos progredir.`
        : `RPE estável — manter trajectória.`,
  ];
  return parts.join(" ");
}

/**
 * seedDemoYear — clones the freshly-generated demo plan into a full
 * year-long block lineage and seeds logbook for every block.
 * Idempotent: bails if the block already has 13 plans.
 */
export async function seedDemoYearForPlan(args: {
  trainerId: string;
  rootPlanId: string; // the AI-generated plan; becomes Bloco 13
  totalBlocks?: number; // default 13
}): Promise<{ ok: boolean; created: number }> {
  const totalBlocks = args.totalBlocks ?? 13;

  // Load the root plan + days.
  const { data: rootPlan } = await supabaseAdmin
    .from("workout_plans")
    .select("id, trainer_id, client_id, assessment_id, duration_weeks, plan_data, brief, blueprint, programming_variables, progression_plan, title, summary")
    .eq("id", args.rootPlanId)
    .maybeSingle();
  if (!rootPlan || (rootPlan as any).trainer_id !== args.trainerId) {
    return { ok: false, created: 0 };
  }

  // Refuse to re-seed if lineage already exists.
  const { count: existingBlocks } = await supabaseAdmin
    .from("workout_plans")
    .select("id", { count: "exact", head: true })
    .eq("client_id", (rootPlan as any).client_id)
    .eq("trainer_id", args.trainerId)
    .eq("is_demo", true);
  if ((existingBlocks ?? 0) >= totalBlocks) {
    return { ok: true, created: 0 };
  }

  const { data: rootDays } = await supabaseAdmin
    .from("workout_plan_days")
    .select("week_number, day_number, day_label, focus, rationale, content, status, validation_meta")
    .eq("plan_id", args.rootPlanId)
    .order("week_number", { ascending: true })
    .order("day_number", { ascending: true });
  if (!rootDays || rootDays.length === 0) return { ok: false, created: 0 };

  const durationWeeks = (rootPlan as any).duration_weeks ?? 4;

  // Promote root plan to Bloco N (most recent).
  await supabaseAdmin
    .from("workout_plans")
    .update({ block_number: totalBlocks, title: `Bloco ${totalBlocks}`, status: "ready" })
    .eq("id", args.rootPlanId);

  // Build older blocks 1..(totalBlocks-1).
  const created: { id: string; block: number }[] = [];
  for (let b = 1; b < totalBlocks; b++) {
    const { data: ins, error } = await supabaseAdmin
      .from("workout_plans")
      .insert({
        trainer_id: args.trainerId,
        client_id: (rootPlan as any).client_id,
        assessment_id: (rootPlan as any).assessment_id,
        title: `Bloco ${b}`,
        summary: (rootPlan as any).summary,
        duration_weeks: durationWeeks,
        status: "archived",
        generation_status: "complete",
        is_demo: true,
        block_number: b,
        plan_data: (rootPlan as any).plan_data ?? { weeks: [] },
        brief: (rootPlan as any).brief,
        blueprint: (rootPlan as any).blueprint,
        programming_variables: (rootPlan as any).programming_variables,
        progression_plan: (rootPlan as any).progression_plan,
      })
      .select("id")
      .single();
    if (error || !ins) continue;
    const newPlanId = (ins as any).id as string;
    created.push({ id: newPlanId, block: b });

    // Clone days with mutation.
    const dayRows = (rootDays as DayRow[]).map((d) => ({
      plan_id: newPlanId,
      trainer_id: args.trainerId,
      week_number: d.week_number,
      day_number: d.day_number,
      day_label: d.day_label,
      focus: d.focus,
      rationale: d.rationale,
      status: "done",
      content: mutateContent(d.content, b),
      validation_meta: d.validation_meta ?? {},
    }));
    if (dayRows.length > 0) {
      await supabaseAdmin.from("workout_plan_days").insert(dayRows);
    }
  }

  // Wire prior_plan_id chain. Block b → prior = block b-1.
  // Sort: include root as block totalBlocks at the end.
  const lineage = [...created].sort((a, b) => a.block - b.block);
  lineage.push({ id: args.rootPlanId, block: totalBlocks });
  for (let i = 1; i < lineage.length; i++) {
    const adherence = 70 + ((i * 7) % 25); // 70-94
    const rpeDrift = ((i % 4) - 1) * 0.4; // -0.4, 0, 0.4, 0.8 cycle
    await supabaseAdmin
      .from("workout_plans")
      .update({
        prior_plan_id: lineage[i - 1].id,
        block_transition_summary: summariseTransition(lineage[i - 1].block, adherence, rpeDrift),
      })
      .eq("id", lineage[i].id);
  }

  // Seed logbook for every block. Block b's last day sits
  // (totalBlocks - b) * durationWeeks weeks ago. Older blocks get a slight
  // load discount so the progress curve looks natural.
  for (const { id, block } of lineage) {
    const endsWeeksAgo = (totalBlocks - block) * durationWeeks;
    const loadMultiplier = 0.78 + (block / totalBlocks) * 0.22; // 0.80 → 1.00
    try {
      await seedDemoSessions({
        data: {
          planId: id,
          weeksToSeed: durationWeeks,
          endsWeeksAgo,
          loadMultiplier,
        },
      });
    } catch (e) {
      console.error("[demo-year] seed sessions failed", { id, block, e });
    }
  }

  return { ok: true, created: created.length };
}

/**
 * rotateDemoYear — fast-forwards every demo session by 365 days, capped at
 * today, so a trainer can demo "this week" sessions even months later
 * without regenerating anything.
 */
export const rotateDemoYear = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const today = new Date().toISOString().slice(0, 10);

    // Fetch ids of demo plans first (RLS bypassed via admin, scoped manually).
    const { data: plans } = await supabaseAdmin
      .from("workout_plans")
      .select("id")
      .eq("trainer_id", userId)
      .eq("is_demo", true);
    const ids = (plans ?? []).map((p: any) => p.id);
    if (ids.length === 0) return { ok: true as const, rotated: 0 };

    const { data: sessions } = await supabaseAdmin
      .from("workout_sessions")
      .select("id, session_date")
      .in("plan_id", ids);
    let rotated = 0;
    for (const s of (sessions ?? []) as any[]) {
      const next = new Date(s.session_date);
      next.setDate(next.getDate() + 365);
      const iso = next.toISOString().slice(0, 10);
      const capped = iso > today ? today : iso;
      await supabaseAdmin
        .from("workout_sessions")
        .update({ session_date: capped })
        .eq("id", s.id);
      rotated++;
    }
    await supabaseAdmin
      .from("profiles")
      .update({ demo_year_offset: 1 })
      .eq("user_id", userId);
    return { ok: true as const, rotated };
  });