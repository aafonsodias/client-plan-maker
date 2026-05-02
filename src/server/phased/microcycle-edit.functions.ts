import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PatchSchema = z.object({
  sets: z.string().optional(),
  reps: z.string().optional(),
  rpe: z.string().optional(),
  rest: z.string().optional(),
  tempo: z.string().optional(),
  notes: z.string().optional(),
});

const NewExerciseSchema = z.object({
  name: z.string().min(1).max(120),
  sets: z.string().default("3"),
  reps: z.string().default("10"),
  rpe: z.string().default("7"),
  rest: z.string().default("90s"),
  tempo: z.string().optional(),
  notes: z.string().optional(),
  /** -1 (default) = append to the end. Otherwise inserted AFTER this index. */
  insertAfterIndex: z.number().int().min(-1).default(-1),
});

/**
 * Patch a single exercise inside workout_plan_days.content.exercises.
 * Trainer-scoped via RLS; we also re-check trainer_id defensively.
 */
export const updateExerciseInWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        weekNumber: z.number().int().min(1),
        dayLabel: z.string(),
        exerciseIndex: z.number().int().min(0),
        patch: PatchSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: row, error } = await supabase
      .from("workout_plan_days")
      .select("id, trainer_id, content")
      .eq("plan_id", data.planId)
      .eq("week_number", data.weekNumber)
      .eq("day_label", data.dayLabel)
      .maybeSingle();

    if (error) return { ok: false as const, error: error.message };
    if (!row || (row as any).trainer_id !== userId) {
      return { ok: false as const, error: "forbidden" };
    }

    const content = ((row as any).content ?? {}) as Record<string, unknown>;
    const exercises = Array.isArray((content as any).exercises) ? [...(content as any).exercises] : [];
    if (data.exerciseIndex >= exercises.length) {
      return { ok: false as const, error: "exercise index out of range" };
    }
    exercises[data.exerciseIndex] = { ...exercises[data.exerciseIndex], ...data.patch };
    const newContent = { ...content, exercises };

    const { error: upErr } = await supabase
      .from("workout_plan_days")
      .update({ content: newContent })
      .eq("id", (row as any).id);
    if (upErr) return { ok: false as const, error: upErr.message };
    return { ok: true as const };
  });

/**
 * Delete a single exercise from workout_plan_days.content.exercises across
 * ALL weeks of a plan, matched by name (case-insensitive). This keeps the
 * mesocycle coherent — you wouldn't want a removed lift reappearing in W3.
 */
export const deleteExerciseAcrossWeeks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        dayLabel: z.string(),
        exerciseName: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("workout_plan_days")
      .select("id, trainer_id, content, week_number")
      .eq("plan_id", data.planId)
      .eq("day_label", data.dayLabel);
    if (error) return { ok: false as const, error: error.message };
    if (!rows?.length) return { ok: false as const, error: "no matching days" };
    const target = data.exerciseName.trim().toLowerCase();
    let touched = 0;
    for (const row of rows as any[]) {
      if (row.trainer_id !== userId) continue;
      const content = (row.content ?? {}) as Record<string, unknown>;
      const exs = Array.isArray((content as any).exercises) ? (content as any).exercises : [];
      const next = exs.filter(
        (e: any) => String(e?.name ?? "").trim().toLowerCase() !== target,
      );
      if (next.length === exs.length) continue;
      const { error: upErr } = await supabase
        .from("workout_plan_days")
        .update({ content: { ...content, exercises: next } })
        .eq("id", row.id);
      if (upErr) return { ok: false as const, error: upErr.message };
      touched++;
    }
    return { ok: true as const, touched };
  });

/**
 * Insert a single exercise into workout_plan_days.content.exercises across
 * ALL weeks of a plan, matched by `day_label`. Deterministic — same object
 * inserted at the same position on every week. The trainer can then tune
 * the per-week wave manually or re-run Stage 4 progressions.
 */
export const addExerciseAcrossWeeks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        dayLabel: z.string(),
        exercise: NewExerciseSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("workout_plan_days")
      .select("id, trainer_id, content, week_number")
      .eq("plan_id", data.planId)
      .eq("day_label", data.dayLabel);
    if (error) return { ok: false as const, error: error.message };
    if (!rows?.length) return { ok: false as const, error: "no matching days" };

    const { insertAfterIndex, ...exFields } = data.exercise;
    const newEx: Record<string, unknown> = { ...exFields };
    if (!newEx.tempo) delete newEx.tempo;
    if (!newEx.notes) delete newEx.notes;

    let touched = 0;
    for (const row of rows as any[]) {
      if (row.trainer_id !== userId) continue;
      const content = (row.content ?? {}) as Record<string, unknown>;
      const exs = Array.isArray((content as any).exercises)
        ? [...(content as any).exercises]
        : [];
      const at =
        insertAfterIndex < 0 || insertAfterIndex >= exs.length
          ? exs.length
          : insertAfterIndex + 1;
      exs.splice(at, 0, { ...newEx });
      const { error: upErr } = await supabase
        .from("workout_plan_days")
        .update({ content: { ...content, exercises: exs } })
        .eq("id", row.id);
      if (upErr) return { ok: false as const, error: upErr.message };
      touched++;
    }
    return { ok: true as const, touched };
  });