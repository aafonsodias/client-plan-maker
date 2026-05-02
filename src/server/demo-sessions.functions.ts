import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Demo session generator + simulation tick.
 *
 * Two responsibilities:
 *  1. seedDemoSessions(planId)  — after a plan is finalized for a demo client,
 *     write 2 weeks of realistic workout_sessions (entries with planned/actual,
 *     RPE-style notes, gentle load progression).
 *  2. advanceSimulation()       — for ALL the trainer's demo clients with a
 *     ready plan, log ONE more session each (the next un-logged day in the
 *     program). Lets the trainer click "advance" and watch the network breathe
 *     without setting up cron.
 *
 * "Demo client" detection: full_name LIKE '% (demo)'. No schema change.
 */

type ExerciseLike = {
  name?: string;
  sets?: string | number;
  reps?: string | number;
  rest?: string;
  notes?: string;
};

function jitter(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

/** Fabricate a plausible "actual" performance from the planned exercise. */
function fabricateEntry(ex: ExerciseLike, weekIndex: number) {
  const setsStr = String(ex.sets ?? "");
  const repsStr = String(ex.reps ?? "");
  // Light, deterministic load that bumps with week.
  const baseLoad = 20 + weekIndex * 2.5 + jitter(-2, 4);
  const weight = `${Math.max(0, baseLoad).toFixed(1)} kg`;
  // Simulate small misses on later sets occasionally.
  const repsHit = repsStr || "8-10";
  const rpe = Math.min(9, 6 + weekIndex * 0.3 + jitter(0, 1.2)).toFixed(1);
  return {
    exercise_name: ex.name ?? "Exercise",
    planned: {
      sets: setsStr,
      reps: repsStr,
      rest: ex.rest ?? "",
      notes: ex.notes ?? "",
    },
    actual: {
      sets: setsStr,
      reps: repsHit,
      weight,
      notes: `RPE ${rpe}`,
    },
  };
}

/**
 * Seeds 2 weeks of sessions from the workout_plan_days table.
 * Idempotent: skips weeks that already have any sessions logged.
 */
export const seedDemoSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      planId: z.string().uuid(),
      weeksToSeed: z.number().int().min(1).max(8).optional().default(2),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: plan, error: planErr } = await supabaseAdmin
      .from("workout_plans")
      .select("id, trainer_id, duration_weeks")
      .eq("id", data.planId)
      .maybeSingle();
    if (planErr || !plan) return { ok: false as const, inserted: 0, error: "plan_not_found" };
    if (plan.trainer_id !== userId) return { ok: false as const, inserted: 0, error: "forbidden" };

    const maxWeek = Math.min(data.weeksToSeed, plan.duration_weeks ?? 4);

    const { data: days } = await supabaseAdmin
      .from("workout_plan_days")
      .select("week_number, day_number, day_label, content")
      .eq("plan_id", data.planId)
      .lte("week_number", maxWeek)
      .order("week_number", { ascending: true })
      .order("day_number", { ascending: true });
    if (!days || days.length === 0) return { ok: false as const, inserted: 0, error: "no_days" };

    // Find which (week, day_label) already have sessions logged — skip them.
    const { data: existing } = await supabaseAdmin
      .from("workout_sessions")
      .select("week_number, day_label")
      .eq("plan_id", data.planId);
    const seen = new Set((existing ?? []).map((r: any) => `${r.week_number}::${r.day_label}`));

    // Anchor: walk back from today so the most recent week is "this week".
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (maxWeek * 7));

    const rows: any[] = [];
    for (const d of days as any[]) {
      const key = `${d.week_number}::${d.day_label}`;
      if (seen.has(key)) continue;
      const exercises: ExerciseLike[] = Array.isArray(d.content?.exercises) ? d.content.exercises : [];
      if (exercises.length === 0) continue;
      const entries = exercises.map((ex) => fabricateEntry(ex, d.week_number - 1));
      // Date = startDate + (week-1)*7 + (day_number-1) days.
      const sessionDate = new Date(startDate);
      sessionDate.setDate(sessionDate.getDate() + (d.week_number - 1) * 7 + (d.day_number - 1));
      rows.push({
        plan_id: data.planId,
        trainer_id: userId,
        week_number: d.week_number,
        day_label: d.day_label,
        session_date: sessionDate.toISOString().slice(0, 10),
        session_notes: d.week_number === 1
          ? "Sessão de baseline. Foco em técnica e RPE conservador."
          : "Boa execução. Subida ligeira de carga conforme progressão.",
        entries,
        logged_by: "trainer",
        status: "done" as const,
      });
    }

    if (rows.length === 0) return { ok: true as const, inserted: 0 };

    const { error } = await supabaseAdmin.from("workout_sessions").insert(rows);
    if (error) return { ok: false as const, inserted: 0, error: error.message };
    return { ok: true as const, inserted: rows.length };
  });

/**
 * Advances every demo client of the trainer by ONE more logged session
 * (the next un-logged day in chronological order). Returns how many ticks
 * were applied. Lets the trainer "feel" the network without cron.
 */
export const advanceSimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    // 1) Fetch all demo clients of this trainer.
    const { data: demoClients } = await supabaseAdmin
      .from("clients")
      .select("id, full_name")
      .eq("trainer_id", userId)
      .like("full_name", "% (demo)");
    if (!demoClients || demoClients.length === 0) {
      return { ok: true as const, ticked: 0, message: "No demo clients yet." };
    }

    const clientIds = demoClients.map((c) => c.id);

    // 2) For each demo client, find their READY plan (most recent).
    const { data: plans } = await supabaseAdmin
      .from("workout_plans")
      .select("id, client_id, duration_weeks")
      .in("client_id", clientIds)
      .eq("trainer_id", userId)
      .eq("status", "ready")
      .order("created_at", { ascending: false });
    if (!plans || plans.length === 0) return { ok: true as const, ticked: 0, message: "No ready plans." };

    // Map: clientId -> first ready plan (most recent).
    const planByClient = new Map<string, any>();
    for (const p of plans as any[]) {
      if (!planByClient.has(p.client_id)) planByClient.set(p.client_id, p);
    }

    let ticked = 0;
    for (const [clientId, plan] of planByClient) {
      void clientId;
      // Find next un-logged (week, day) for this plan.
      const { data: days } = await supabaseAdmin
        .from("workout_plan_days")
        .select("week_number, day_number, day_label, content")
        .eq("plan_id", plan.id)
        .order("week_number", { ascending: true })
        .order("day_number", { ascending: true });
      if (!days || days.length === 0) continue;

      const { data: existing } = await supabaseAdmin
        .from("workout_sessions")
        .select("week_number, day_label")
        .eq("plan_id", plan.id);
      const seen = new Set((existing ?? []).map((r: any) => `${r.week_number}::${r.day_label}`));

      const next = (days as any[]).find((d) => !seen.has(`${d.week_number}::${d.day_label}`));
      if (!next) continue; // plan fully logged, skip.

      const exercises: ExerciseLike[] = Array.isArray(next.content?.exercises) ? next.content.exercises : [];
      if (exercises.length === 0) continue;
      const entries = exercises.map((ex) => fabricateEntry(ex, next.week_number - 1));

      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabaseAdmin.from("workout_sessions").insert({
        plan_id: plan.id,
        trainer_id: userId,
        week_number: next.week_number,
        day_label: next.day_label,
        session_date: today,
        session_notes: "[sim] Sessão automática.",
        entries,
        logged_by: "client",
        status: "done" as const,
      });
      if (!error) ticked += 1;
    }

    return { ok: true as const, ticked };
  });