import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GenerationStateSchema, ProgressionPlanSchema } from "./schemas";
import { logGeneration } from "./ai.server";
import { buildDeterministicSummary } from "./summary.server";

// Apply a single delta string to a value string. Returns the new value string.
// Supported deltas: "+2.5kg", "-5lb", "+1rep", "-2reps", "+1set", "+0.5rpe", "-5%"
function applyDelta(currentRaw: string | undefined, delta: string): string {
  const current = (currentRaw ?? "").toString();
  if (!delta) return current;
  const d = delta.trim();
  // Percent of numeric-prefixed value
  const pctMatch = d.match(/^([+-]?\d+(?:\.\d+)?)%$/);
  if (pctMatch) {
    const pct = parseFloat(pctMatch[1]);
    const numMatch = current.match(/(\d+(?:\.\d+)?)/);
    if (!numMatch) return current;
    const base = parseFloat(numMatch[1]);
    const newVal = +(base * (1 + pct / 100)).toFixed(2);
    return current.replace(numMatch[1], String(newVal));
  }
  // +1rep / -2reps / +1set
  const intMatch = d.match(/^([+-]\d+)(rep|reps|set|sets)$/i);
  if (intMatch) {
    const inc = parseInt(intMatch[1], 10);
    // Apply to last numeric token in current
    const tokens = current.match(/\d+/g);
    if (!tokens) return current;
    const last = tokens[tokens.length - 1];
    const newLast = String(Math.max(0, parseInt(last, 10) + inc));
    return current.replace(new RegExp(`${last}(?!.*\\d)`), newLast);
  }
  // +2.5kg / -5lb / +0.5rpe
  const floatUnitMatch = d.match(/^([+-]?\d+(?:\.\d+)?)(kg|lb|rpe)$/i);
  if (floatUnitMatch) {
    const inc = parseFloat(floatUnitMatch[1]);
    const unit = floatUnitMatch[2].toLowerCase();
    const numRe = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit}`, "i");
    const m = current.match(numRe);
    if (m) {
      const base = parseFloat(m[1]);
      const newVal = +(base + inc).toFixed(2);
      return current.replace(m[0], `${newVal}${unit}`);
    }
    // No matching unit — append
    return current ? `${current} (${inc >= 0 ? "+" : ""}${inc}${unit})` : `${inc}${unit}`;
  }
  // Tempo or variant — replace verbatim
  return d;
}

function applyDeltaToExercise(
  ex: any,
  dimension: string,
  delta: string
): any {
  if (!delta) return ex;
  const out = { ...ex };
  switch (dimension) {
    case "load":
      out.notes = applyDelta(ex.notes, delta);
      break;
    case "reps":
      out.reps = applyDelta(ex.reps, delta);
      break;
    case "sets":
      out.sets = applyDelta(ex.sets, delta);
      break;
    case "intensity_rpe":
      out.rpe = applyDelta(ex.rpe, delta);
      break;
    case "tempo":
      out.tempo = delta;
      break;
    case "complexity_variant":
      out.variant = delta;
      break;
  }
  return out;
}

function exerciseId(dayNumber: number, name: string): string {
  return `d${dayNumber}_${(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30)}`;
}

export const bulkFillRemainingWeeks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ planId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const t0 = Date.now();

    const { data: plan } = await supabase
      .from("workout_plans")
      .select("trainer_id, duration_weeks, progression_plan, generation_state, brief, summary")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan || (plan as any).trainer_id !== userId) {
      return { ok: false as const, error: "forbidden" };
    }
    const weeks = (plan as any).duration_weeks ?? 4;
    if (weeks <= 1) return { ok: true as const, inserted: 0 };

    const progParsed = ProgressionPlanSchema.safeParse((plan as any).progression_plan ?? { rows: [] });
    const progRows = progParsed.success ? progParsed.data.rows : [];

    const { data: week1Days } = await supabase
      .from("workout_plan_days")
      .select("day_number, day_label, focus, rationale, content")
      .eq("plan_id", data.planId)
      .eq("week_number", 1)
      .eq("status", "done")
      .order("day_number", { ascending: true });

    if (!week1Days || week1Days.length === 0) {
      return { ok: false as const, error: "Week 1 has no completed days." };
    }

    // Delete any existing weeks 2..N for this plan (idempotent rebuild).
    await supabase
      .from("workout_plan_days")
      .delete()
      .eq("plan_id", data.planId)
      .gt("week_number", 1);

    const rowsToInsert: any[] = [];

    for (let week = 2; week <= weeks; week++) {
      for (const d of week1Days as any[]) {
        const baseContent = d.content ?? {};
        const baseExercises = Array.isArray(baseContent.exercises) ? baseContent.exercises : [];

        const newExercises = baseExercises.map((ex: any) => {
          const id = exerciseId(d.day_number, ex.name);
          const matchingRows = progRows.filter((r) => r.exercise_id === id);
          let next = ex;
          for (const r of matchingRows) {
            const deltaKey =
              week === 2 ? "week_2_delta" : week === 3 ? "week_3_delta" : "week_4_delta";
            const delta = (r as any)[deltaKey] as string | undefined;
            // For week 5+, fall back to week_4_delta as continuing trend.
            const effective = week >= 5 ? (r as any).week_4_delta : delta;
            if (effective) next = applyDeltaToExercise(next, r.dimension, effective);
          }
          return next;
        });

        rowsToInsert.push({
          plan_id: data.planId,
          trainer_id: userId,
          week_number: week,
          day_number: d.day_number,
          day_label: d.day_label,
          focus: d.focus,
          rationale: d.rationale,
          status: "done",
          content: { ...baseContent, exercises: newExercises },
          validation_meta: { source: "deterministic_bulkfill", from_week: 1 },
        });
      }
    }

    if (rowsToInsert.length > 0) {
      const { error: insErr } = await supabase.from("workout_plan_days").insert(rowsToInsert);
      if (insErr) return { ok: false as const, error: insErr.message };
    }

    const newState = GenerationStateSchema.parse({
      stage: "complete",
      approved_stages: ["brief", "blueprint", "microcycle", "progressions", "complete"],
      last_updated_at: new Date().toISOString(),
    });
    // Backfill plan.summary from the brief if it's still empty — phased flow
    // never touches this column otherwise and the cover card renders "(empty)".
    const update: Record<string, unknown> = {
      generation_state: newState as any,
      generation_status: "complete",
      status: "ready",
    };
    const existingSummary = ((plan as any).summary ?? "").toString().trim();
    if (!existingSummary) {
      const brief = (plan as any).brief ?? {};
      // Deterministic programme-level summary derived from brief facts.
      // We avoid `notes_for_next_stage` because it often contains internal
      // meta-commentary ("Sem análises por secção fornecidas…") that leaks
      // into the user-facing card.
      const goalLabel: Record<string, string> = {
        hypertrophy: "hipertrofia",
        strength: "força",
        conditioning: "condição física",
        mixed: "misto força + condição",
        fat_loss: "perda de gordura",
        general: "preparação geral",
      };
      const ageLabel: Record<string, string> = {
        beginner: "iniciante",
        intermediate: "intermédio",
        advanced: "avançado",
      };
      const appetiteLabel: Record<string, string> = {
        conservador: "RPE 5→6→6.5 (deload W4)",
        padrao: "RPE 6→7→7.5 (deload W4)",
        agressivo: "RPE 7→8→8.5 (deload W4)",
      };
      const goal = goalLabel[brief?.primary_goal] ?? "preparação geral";
      const age = ageLabel[brief?.training_age_band] ?? "";
      const sessions = brief?.sessions_per_week?.recommended ?? 3;
      const appetite = brief?.intensity_appetite ?? "padrao";
      const wave = appetiteLabel[appetite] ?? appetiteLabel.padrao;
      const flagBit =
        Array.isArray(brief?.red_flags) && brief.red_flags.length > 0
          ? ` Acomodações activas: ${brief.red_flags.slice(0, 2).join("; ")}.`
          : "";
      update.summary = `Mesociclo de ${weeks} semanas, ${sessions}× por semana, focado em ${goal}${age ? ` (perfil ${age})` : ""}. Onda de intensidade ${wave}; semana 4 reduz volume/RPE para recuperar.${flagBit}`.trim();
    }
    // Surface the appetite on generation_meta so the plan card / future Auditor
    // can show it without re-reading the brief.
    {
      const brief = (plan as any).brief ?? {};
      const meta = ((plan as any).generation_meta ?? {}) as Record<string, unknown>;
      if (brief?.intensity_appetite) {
        update.generation_meta = { ...meta, intensity_appetite: brief.intensity_appetite };
      }
    }
    await supabase.from("workout_plans").update(update as any).eq("id", data.planId);

    const durMs = Date.now() - t0;
    await logGeneration(supabase, {
      trainer_id: userId,
      plan_id: data.planId,
      stage: "stage5:bulkfill",
      model_used: "deterministic",
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      zod_passed: true,
      retry_count: 0,
      duration_ms: durMs,
      output_snapshot: { rows_inserted: rowsToInsert.length, weeks: weeks - 1 },
    });

    return { ok: true as const, inserted: rowsToInsert.length, durationMs: durMs };
  });