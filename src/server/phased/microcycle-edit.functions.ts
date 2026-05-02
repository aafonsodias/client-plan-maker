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