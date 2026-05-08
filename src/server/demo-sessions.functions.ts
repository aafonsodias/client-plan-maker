import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { maybePersonaFeedback, getRpeProfile, rpeForWeek, loadForWeek, type RpeProfile } from "@/lib/demo-personas";

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
  pattern?: string;
  category?: string;
};

function jitter(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

function isCardioLike(ex: ExerciseLike): boolean {
  const blob = `${ex.name ?? ""} ${ex.pattern ?? ""} ${ex.category ?? ""} ${ex.notes ?? ""}`.toLowerCase();
  return /cardio|condition|carry|farmer|run|bike|row|sprint|airbike|sled|jog/.test(blob);
}

/** Fabricate a plausible "actual" performance from the planned exercise.
 *  Persona-aware: RPE/load curves come from the persona profile so each
 *  archetype rides its own progression band. */
function fabricateEntry(
  ex: ExerciseLike,
  weekNumber: number,
  profile: RpeProfile,
  isDeload = false,
) {
  const setsStr = String(ex.sets ?? "");
  const repsStr = String(ex.reps ?? "");
  const cardio = isCardioLike(ex);
  const baseLoad = loadForWeek(profile, weekNumber, isDeload) + jitter(-1.5, 2.5);
  const weight = cardio ? "" : `${Math.max(0, baseLoad).toFixed(1)} kg`;
  const repsHit = repsStr || (cardio ? "" : "8-10");
  // Tiny ±0.3 jitter so it doesn't look mechanical, but never above cap.
  const rpeNum = Math.min(profile.cap, rpeForWeek(profile, weekNumber, isDeload) + jitter(-0.2, 0.3));
  const rpe = rpeNum.toFixed(1);
  const distance = cardio ? `${(0.8 + (weekNumber - 1) * 0.12 + jitter(0, 0.3)).toFixed(2)} km` : "";
  const timeMin = cardio ? `${Math.round(8 + (weekNumber - 1) * 1 + jitter(0, 3))} min` : "";
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
      rpe,
      distance,
      time: timeMin,
      notes: cardio ? `RPE ${rpe} · ${distance} em ${timeMin}` : `RPE ${rpe}`,
    },
  };
}

/** Pulls the demo persona archetype off the latest assessment for a client. */
async function getPersonaArchetype(clientId: string): Promise<string | null> {
  const { data: a } = await supabaseAdmin
    .from("assessments")
    .select("extended")
    .eq("client_id", clientId)
    .order("performed_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((a as any)?.extended?.demo_meta?.archetype as string) ?? null;
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
      // How many weeks BEFORE today should the LAST session of this plan
      // sit on. 0 = last day of plan = today. Used by demo-year to lay out
      // 13 blocks chronologically into the past.
      endsWeeksAgo: z.number().int().min(0).max(520).optional().default(0),
      // Multiplier applied to fabricated loads, so older blocks look lighter
      // and recent blocks look heavier without re-running the AI.
      loadMultiplier: z.number().min(0.4).max(2).optional().default(1),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: plan, error: planErr } = await supabaseAdmin
      .from("workout_plans")
      .select("id, trainer_id, duration_weeks, client_id")
      .eq("id", data.planId)
      .maybeSingle();
    if (planErr || !plan) return { ok: false as const, inserted: 0, error: "plan_not_found" };
    if (plan.trainer_id !== userId) return { ok: false as const, inserted: 0, error: "forbidden" };
    const archetype = (plan as any).client_id
      ? await getPersonaArchetype((plan as any).client_id)
      : null;
    const profile = getRpeProfile(archetype);
    const totalWeeks = plan.duration_weeks ?? 4;

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

    // Anchor: end of the plan = (today - endsWeeksAgo*7).
    // startDate = end - (maxWeek-1) days*7 - extra padding so the FIRST day
    // of week 1 lands maxWeek weeks before the end.
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - data.endsWeeksAgo * 7);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - maxWeek * 7);

    const rows: any[] = [];
    for (const d of days as any[]) {
      const key = `${d.week_number}::${d.day_label}`;
      if (seen.has(key)) continue;
      const exercises: ExerciseLike[] = Array.isArray(d.content?.exercises) ? d.content.exercises : [];
      if (exercises.length === 0) continue;
      const isDeload = totalWeeks >= 3 && d.week_number === totalWeeks;
      const baseEntries = exercises.map((ex) => fabricateEntry(ex, d.week_number, profile, isDeload));
      // Apply per-block load multiplier so older blocks look lighter.
      const entries = data.loadMultiplier === 1 ? baseEntries : baseEntries.map((e) => {
        const m = e.actual?.weight?.match?.(/^([\d.]+)\s*kg$/i);
        if (!m) return e;
        const scaled = (Number(m[1]) * data.loadMultiplier).toFixed(1);
        return { ...e, actual: { ...e.actual, weight: `${scaled} kg` } };
      });
      // Date = startDate + (week-1)*7 + (day_number-1) days.
      const sessionDate = new Date(startDate);
      sessionDate.setDate(sessionDate.getDate() + (d.week_number - 1) * 7 + (d.day_number - 1));
      // Seed = stable per (plan, week, day) so re-seeding never moves feedback around.
      const seed = (data.planId.charCodeAt(0) || 1) + d.week_number * 13 + d.day_number * 7;
      const feedback = maybePersonaFeedback(archetype, seed, 3);
      rows.push({
        plan_id: data.planId,
        trainer_id: userId,
        week_number: d.week_number,
        day_label: d.day_label,
        session_date: sessionDate.toISOString().slice(0, 10),
        session_notes: d.week_number === 1
          ? `Sessão de baseline. ${profile.tone}`
          : isDeload
            ? "Semana de deload. Carga e RPE recuados ~15%."
            : profile.tone,
        entries,
        logged_by: "trainer",
        status: "done" as const,
        client_feedback: feedback ?? null,
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
      const archetype = await getPersonaArchetype(clientId);
      const profile = getRpeProfile(archetype);
      const totalWeeks = plan.duration_weeks ?? 4;
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
      const isDeload = totalWeeks >= 3 && next.week_number === totalWeeks;
      const entries = exercises.map((ex) => fabricateEntry(ex, next.week_number, profile, isDeload));

      const today = new Date().toISOString().slice(0, 10);
      const seed = (plan.id.charCodeAt(0) || 1) + next.week_number * 13 + next.day_number * 7 + Date.now() % 100;
      const feedback = maybePersonaFeedback(archetype, seed, 3);
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
        client_feedback: feedback ?? null,
      });
      if (!error) ticked += 1;
    }

    return { ok: true as const, ticked };
  });

/**
 * simulateDemoMesocycle — founder demo-only history seeder.
 *
 * For a demo client (clients.is_demo = true owned by the caller), generates
 * `weeks` of plausible past history into client_bookings + workout_sessions
 * + client_measurements, deterministically (stable per (clientId, weekIdx)).
 *
 * Hard refusal if the client is NOT flagged is_demo. No schema change.
 * No AI. Existing bump_pack_sessions_used trigger keeps pack accounting
 * coherent automatically. Idempotency: appends history; does not delete
 * prior rows. Caller (UI) confirms before re-running.
 */
function hash32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rand01(seed: number): number {
  // Mulberry32 single step
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const simulateDemoMesocycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      clientId: z.string().uuid(),
      weeks: z.number().int().min(4).max(12).default(12),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // 1. Safety: must be a demo client owned by the caller.
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, trainer_id, is_demo, full_name")
      .eq("id", data.clientId)
      .maybeSingle();
    if (!client || (client as any).trainer_id !== userId || !(client as any).is_demo) {
      return { ok: false as const, error: "not_demo", inserted: { bookings: 0, sessions: 0, measurements: 0 } };
    }

    // 2. Find latest ready plan (any block) for this demo client.
    const { data: planRow } = await supabaseAdmin
      .from("workout_plans")
      .select("id, duration_weeks")
      .eq("client_id", data.clientId)
      .eq("trainer_id", userId)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const plan = planRow as any | null;

    // 3. Pull plan days for fabricating session entries (cycle through them).
    const { data: days } = plan
      ? await supabaseAdmin
          .from("workout_plan_days")
          .select("week_number, day_number, day_label, content")
          .eq("plan_id", plan.id)
          .order("week_number", { ascending: true })
          .order("day_number", { ascending: true })
      : { data: [] as any[] };
    const dayPool = (days ?? []).filter(
      (d: any) => Array.isArray(d.content?.exercises) && d.content.exercises.length > 0,
    );

    // 4. Persona profile (RPE/load curves) from assessment.
    const archetype = await getPersonaArchetype(data.clientId);
    const profile = getRpeProfile(archetype);

    // 5. Optional pack link (first non-archived). Trigger handles sessions_used.
    const { data: packRow } = await supabaseAdmin
      .from("client_packs")
      .select("id, weekly_frequency")
      .eq("client_id", data.clientId)
      .eq("trainer_id", userId)
      .eq("archived", false)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    const pack = packRow as any | null;
    const perWeek = Math.max(1, Math.min(7, pack?.weekly_frequency ?? 3));

    // 6. Build deterministic week timeline ending last Sunday.
    const today = new Date();
    today.setHours(9, 0, 0, 0);
    const skipWeek = hash32(data.clientId) % data.weeks; // 1 low-adherence pocket
    const harderWeek = Math.max(1, Math.floor(data.weeks / 2));
    const deloadWeek = data.weeks >= 6 ? data.weeks - 1 : -1;

    const bookings: any[] = [];
    const sessions: any[] = [];
    let dayIdx = 0;

    for (let w = 0; w < data.weeks; w++) {
      // weekStart Monday of the week, `weeks - w - 1` weeks back from this week
      const weeksBack = data.weeks - w - 1;
      const weekStart = new Date(today);
      const dow = (weekStart.getDay() + 6) % 7; // Monday=0
      weekStart.setDate(weekStart.getDate() - dow - weeksBack * 7);

      const isSkipWeek = w === skipWeek;
      const isDeload = w === deloadWeek;
      const isHarder = w === harderWeek;
      const planWeek = plan ? ((w % (plan.duration_weeks ?? 4)) + 1) : 1;

      // Spread `perWeek` sessions Mon/Wed/Fri-style.
      const slots = [1, 3, 5, 2, 4, 0, 6].slice(0, perWeek);
      for (let s = 0; s < slots.length; s++) {
        const seed = hash32(`${data.clientId}:${w}:${s}`);
        const r = rand01(seed);
        const date = new Date(weekStart);
        date.setDate(date.getDate() + slots[s]);
        if (date > today) continue; // never future

        // Status mix
        let status: "done" | "no_show" | "cancelled" = "done";
        if (isSkipWeek) {
          status = r < 0.5 ? "cancelled" : "no_show";
        } else if (r < 0.05) status = "cancelled";
        else if (r < 0.15) status = "no_show";

        const startsAt = new Date(date);
        startsAt.setHours(8 + (s * 2) % 10, 0, 0, 0);

        bookings.push({
          trainer_id: userId,
          client_id: data.clientId,
          pack_id: pack?.id ?? null,
          starts_at: startsAt.toISOString(),
          duration_min: 60,
          session_type: "in_person",
          status,
          notes: "[demo]",
        });

        if (status === "done" && plan && dayPool.length > 0) {
          const d = dayPool[dayIdx % dayPool.length];
          dayIdx++;
          const exercises: ExerciseLike[] = d.content.exercises;
          const entries = exercises.map((ex) =>
            fabricateEntry(ex, isHarder ? planWeek + 1 : planWeek, profile, isDeload),
          );
          sessions.push({
            plan_id: plan.id,
            trainer_id: userId,
            week_number: planWeek,
            day_label: d.day_label ?? `Day ${d.day_number}`,
            session_date: startsAt.toISOString().slice(0, 10),
            session_notes: isDeload
              ? "[demo] Deload — cargas e RPE recuados."
              : isHarder
                ? "[demo] Semana mais dura — pico de bloco."
                : "[demo] Sessão concluída.",
            entries,
            logged_by: "trainer",
            status: "done" as const,
            client_feedback: maybePersonaFeedback(archetype, seed, 3) ?? null,
          });
        }
      }
    }

    // 7. Weekly capacity snapshots (waist circumference) with mild downward
    // drift. Round 3.1 — write directly to client_capacity_snapshots,
    // bypassing the deprecated client_measurements legacy path.
    const snapshotRows: any[] = [];
    const baseWaist = 88 + (hash32(data.clientId + "w") % 8);
    for (let w = 0; w < data.weeks; w++) {
      const weeksBack = data.weeks - w - 1;
      const day = new Date(today);
      const dow = (day.getDay() + 6) % 7;
      day.setDate(day.getDate() - dow - weeksBack * 7);
      const noise = (rand01(hash32(`${data.clientId}:m:${w}`)) - 0.5) * 0.6;
      const measuredAt = new Date(day);
      measuredAt.setHours(8, 0, 0, 0);
      snapshotRows.push({
        client_id: data.clientId,
        domain_slug: "body_composition",
        test_used: "waist_circumference",
        raw_value: +(baseWaist - w * 0.12 + noise * 0.5).toFixed(1),
        raw_unit: "cm",
        provenance: "pt_assessed",
        measured_at: measuredAt.toISOString(),
        notes: "[demo]",
      });
    }

    // 8. Insert.
    let insBookings = 0, insSessions = 0, insMeasurements = 0;
    if (bookings.length) {
      const { error, count } = await supabaseAdmin
        .from("client_bookings")
        .insert(bookings, { count: "exact" });
      if (!error) insBookings = count ?? bookings.length;
    }
    if (sessions.length) {
      const { error, count } = await supabaseAdmin
        .from("workout_sessions")
        .insert(sessions, { count: "exact" });
      if (!error) insSessions = count ?? sessions.length;
    }
    if (snapshotRows.length) {
      const { error, count } = await supabaseAdmin
        .from("client_capacity_snapshots")
        .insert(snapshotRows, { count: "exact" });
      if (!error) insMeasurements = count ?? snapshotRows.length;
    }

    const doneCount = bookings.filter((b) => b.status === "done").length;
    const missedCount = bookings.filter((b) => b.status !== "done").length;
    const adherencePct = bookings.length
      ? Math.round((doneCount / bookings.length) * 100)
      : 0;

    return {
      ok: true as const,
      weeks: data.weeks,
      adherencePct,
      missed: missedCount,
      inserted: { bookings: insBookings, sessions: insSessions, measurements: insMeasurements },
    };
  });