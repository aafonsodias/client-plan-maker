import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logGeneration } from "./ai.server";
import { resolveCockpit } from "./programming-defaults";
import { resolveRules } from "@/server/knowledge/resolve.server";

/** Engine version stamped into generation_log + audit_events.
 *  Bump on adherence floor, drift threshold, or cut-percentage changes. */
export const ENGINE_VERSION = "program-next-week@1.0.0" as const;

/**
 * R65 — Deterministic next-week generator.
 *
 * Reads the most recent fully-logged week (W_n) for a plan, computes adherence
 * + average RPE drift, then materialises week W_{n+1} as a copy of W_n with
 * an additional load adjustment driven by `programming_variables.autoreg_strictness`:
 *
 * - strict     : if avg(actual RPE) > prescribed + 0.7 → cut load 5% on flagged exercises
 * - suggested  : copy week, attach a flag note, no load change (coach decides)
 * - off        : copy week, no flag, no change
 *
 * Adherence floor: requires ≥80% of W_n sessions to have at least one logged
 * set. Below that, we refuse to advance and ask the coach to log more.
 */

function num(s: unknown): number | null {
  const m = String(s ?? "").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function avg(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function applyLoadCutPct(notes: string | undefined, pct: number): string {
  const n = String(notes ?? "");
  // Look for the first "<num>kg" or "<num>lb" token and scale it.
  const m = n.match(/(\d+(?:\.\d+)?)\s*(kg|lb)/i);
  if (!m) return n ? `${n} (autoreg ${pct >= 0 ? "+" : ""}${pct}%)` : `autoreg ${pct}%`;
  const base = parseFloat(m[1]);
  const next = +(base * (1 + pct / 100)).toFixed(1);
  return n.replace(m[0], `${next}${m[2]}`);
}

export const programNextWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ planId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const t0 = Date.now();

    const { data: plan } = await supabase
      .from("workout_plans")
      .select("trainer_id, duration_weeks, programming_variables, generation_meta")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan || (plan as any).trainer_id !== userId) {
      return { ok: false as const, error: "forbidden" };
    }

    // Find the latest week that has at least one prescribed day.
    const { data: allDays } = await supabase
      .from("workout_plan_days")
      .select("week_number, day_number, day_label, focus, rationale, content")
      .eq("plan_id", data.planId)
      .eq("status", "done")
      .order("week_number", { ascending: false })
      .order("day_number", { ascending: true });

    const days = (allDays ?? []) as any[];
    if (days.length === 0) return { ok: false as const, error: "Plan has no prescribed days yet." };

    const latestWeek = Math.max(...days.map((d) => d.week_number));
    const sourceDays = days.filter((d) => d.week_number === latestWeek);
    const nextWeek = latestWeek + 1;

    // Adherence + RPE drift from logged sessions for the source week.
    const { data: sessions } = await supabase
      .from("workout_sessions")
      .select("day_label, week_number, entries")
      .eq("plan_id", data.planId)
      .eq("week_number", latestWeek);

    const loggedSessionCount = (sessions ?? []).filter((s: any) => {
      const entries = Array.isArray(s.entries) ? s.entries : [];
      return entries.some((e: any) =>
        Array.isArray(e?.sets) && e.sets.some((set: any) => set?.done || set?.weight || set?.reps)
      );
    }).length;
    const adherence = sourceDays.length === 0 ? 0 : loggedSessionCount / sourceDays.length;

    if (adherence < 0.8) {
      return {
        ok: false as const,
        error: "low_adherence",
        adherence,
        sourceWeek: latestWeek,
        sessionsLogged: loggedSessionCount,
        sessionsExpected: sourceDays.length,
      };
    }

    // Per-exercise RPE drift map: actual − prescribed.
    const driftByExercise = new Map<string, number[]>();
    for (const s of sessions ?? []) {
      const entries = Array.isArray((s as any).entries) ? (s as any).entries : [];
      for (const e of entries) {
        const planned = num(e?.planned?.rpe);
        if (planned == null) continue;
        const setRpes = Array.isArray(e?.sets)
          ? e.sets.map((st: any) => num(st?.rpe)).filter((v: any): v is number => v != null)
          : [];
        if (setRpes.length === 0) continue;
        const a = avg(setRpes);
        if (a == null) continue;
        const key = String(e?.exercise_name || "").trim().toLowerCase();
        if (!key) continue;
        const arr = driftByExercise.get(key) ?? [];
        arr.push(a - planned);
        driftByExercise.set(key, arr);
      }
    }

    const pv = (plan as any).programming_variables ?? {};
    // R73 — PKL fallback for autoreg strictness when the cockpit is silent.
    const { rules: pklRules } = await resolveRules(supabase, userId);
    const strictness = resolveCockpit(pv, pklRules).autoreg_strictness;

    // Wipe any pre-existing rows for nextWeek so this stays idempotent.
    await supabase
      .from("workout_plan_days")
      .delete()
      .eq("plan_id", data.planId)
      .eq("week_number", nextWeek);

    const flaggedExercises: string[] = [];
    const rowsToInsert: any[] = [];
    for (const d of sourceDays) {
      const baseContent = d.content ?? {};
      const baseExercises = Array.isArray(baseContent.exercises) ? baseContent.exercises : [];
      const newExercises = baseExercises.map((ex: any) => {
        const key = String(ex.name || "").trim().toLowerCase();
        const drifts = driftByExercise.get(key) ?? [];
        const meanDrift = avg(drifts);
        if (meanDrift == null || meanDrift <= 0.7) return ex;
        flaggedExercises.push(ex.name);
        if (strictness === "strict") {
          return {
            ...ex,
            notes: applyLoadCutPct(ex.notes, -5),
            cue: ex.cue ? `${ex.cue} · autoreg −5%` : "autoreg −5% (RPE acima do prescrito)",
          };
        }
        if (strictness === "suggested") {
          return {
            ...ex,
            cue: ex.cue
              ? `${ex.cue} · ⚠ rever carga`
              : "⚠ RPE realizado acima do prescrito — rever carga",
          };
        }
        return ex; // off
      });

      rowsToInsert.push({
        plan_id: data.planId,
        trainer_id: userId,
        week_number: nextWeek,
        day_number: d.day_number,
        day_label: d.day_label,
        focus: d.focus,
        rationale: d.rationale,
        status: "done",
        content: { ...baseContent, exercises: newExercises },
        validation_meta: {
          source: "program_next_week",
          from_week: latestWeek,
          autoreg_strictness: strictness,
          adherence,
          flagged_count: flaggedExercises.length,
        },
      });
    }

    if (rowsToInsert.length > 0) {
      const { error: insErr } = await supabase.from("workout_plan_days").insert(rowsToInsert);
      if (insErr) return { ok: false as const, error: insErr.message };
    }

    // Bump duration_weeks if we extended past the original block.
    const dur = (plan as any).duration_weeks ?? nextWeek;
    if (nextWeek > dur) {
      await supabase
        .from("workout_plans")
        .update({ duration_weeks: nextWeek } as any)
        .eq("id", data.planId);
    }

    const durMs = Date.now() - t0;
    await logGeneration(supabase, {
      trainer_id: userId,
      plan_id: data.planId,
      stage: "program_next_week",
      model_used: "deterministic-autoreg",
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      zod_passed: true,
      retry_count: 0,
      duration_ms: durMs,
      input_snapshot: { sourceWeek: latestWeek, sessionsLogged: loggedSessionCount, strictness },
      output_snapshot: { nextWeek, flagged: flaggedExercises.length, dayCount: rowsToInsert.length },
    });

    return {
      ok: true as const,
      sourceWeek: latestWeek,
      nextWeek,
      adherence,
      flaggedCount: flaggedExercises.length,
      strictness,
    };
  });