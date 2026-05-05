import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GenerationStateSchema, ProgressionPlanSchema } from "./schemas";
import { logGeneration } from "./ai.server";
import { buildWavePlan, pickWaveTier, type WaveTier } from "./programming-defaults";

/**
 * Round 63: AI is no longer allowed to generate progressions.
 *
 * Per project rule: "AI gera só 1 semana, nunca mais." Weeks 2..N are derived
 * deterministically from Week 1 + the wave model (Bompa 6e §7.3-7.5) + a load
 * step keyed to coach intensity appetite (NSCA 4e §17.4 increment table).
 *
 * The next-week programming uses real logged sessions (see programNextWeek
 * in src/server/blocks.functions.ts → next-week function) — this stage just
 * provides the *plan* skeleton so trainer can preview the full mesocycle
 * before the client trains a single rep.
 */

function classifyExercise(name: string): "compound" | "isolator" | "machine" | "bodyweight" {
  const n = (name ?? "").toLowerCase();
  if (/\b(squat|deadlift|bench|press|row|clean|snatch|pull[- ]?up|chin[- ]?up|dip)\b/.test(n)) {
    if (/machine|smith|hack|leg press|chest press|cable/.test(n)) return "machine";
    return "compound";
  }
  if (/curl|extension|raise|fly|kickback|pushdown|crunch|plank/.test(n)) return "isolator";
  if (/machine|cable|smith|leg press|hack|chest press|lat pulldown/.test(n)) return "machine";
  if (/bodyweight|push[- ]?up|pull[- ]?up|chin[- ]?up|dip|lunge|step[- ]?up/.test(n)) return "bodyweight";
  return "isolator";
}

function deltaForExercise(
  cat: ReturnType<typeof classifyExercise>,
  appetite: "conservador" | "padrao" | "agressivo",
  weekTag: "base" | "+volume" | "+intensity" | "deload",
): Array<{ dimension: "load" | "reps" | "intensity_rpe" | "sets"; value: string }> {
  if (weekTag === "deload") {
    return [{ dimension: "intensity_rpe", value: "-1.5rpe" }, { dimension: "sets", value: "-1set" }];
  }
  const big = appetite === "agressivo" ? "+5kg" : "+2.5kg";
  const small = appetite === "agressivo" ? "+5%" : appetite === "conservador" ? "+2.5%" : "+2.5%";
  if (weekTag === "+volume") {
    if (cat === "compound") return [{ dimension: "reps", value: "+1rep" }, { dimension: "intensity_rpe", value: "+0.5rpe" }];
    if (cat === "machine") return [{ dimension: "reps", value: appetite === "agressivo" ? "+2reps" : "+1rep" }];
    if (cat === "isolator") return [{ dimension: "reps", value: appetite === "agressivo" ? "+2reps" : "+1rep" }];
    return [{ dimension: "reps", value: "+1rep" }];
  }
  // +intensity
  if (cat === "compound") return [{ dimension: "load", value: big }, { dimension: "intensity_rpe", value: "+0.5rpe" }];
  if (cat === "machine") return [{ dimension: "load", value: small }, { dimension: "intensity_rpe", value: "+0.5rpe" }];
  if (cat === "isolator") return [{ dimension: "intensity_rpe", value: "+1rpe" }];
  return [{ dimension: "intensity_rpe", value: "+0.5rpe" }];
}

export const proposeProgressions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ planId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const t0 = Date.now();

    const { data: plan } = await supabase
      .from("workout_plans")
      .select("trainer_id, brief, blueprint, duration_weeks, generation_meta, programming_variables")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan || (plan as any).trainer_id !== userId) {
      return { ok: false as const, error: "forbidden" };
    }

    const { data: days } = await supabase
      .from("workout_plan_days")
      .select("day_number, content")
      .eq("plan_id", data.planId)
      .eq("week_number", 1)
      .eq("status", "done")
      .order("day_number", { ascending: true });

    const exerciseList: { id: string; name: string; sets: string; reps: string; rpe: string }[] = [];
    for (const d of (days ?? []) as any[]) {
      const exs = d?.content?.exercises ?? [];
      for (const ex of exs) {
        exerciseList.push({
          id: `d${d.day_number}_${ex.name?.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30)}`,
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          rpe: ex.rpe,
        });
      }
    }

    const weeks = (plan as any).duration_weeks ?? 4;
    const appetite = (String(
      (plan as any).brief?.intensity_appetite ?? "padrao",
    ).toLowerCase() as "conservador" | "padrao" | "agressivo");
    // Bompa & Buzzichelli 6e §7.3-7.5 wave: tier from brief + red flags,
    // shifted by coach intensity appetite. Citation persisted on plan.
    const briefRedFlags: string[] = ((plan as any).brief?.red_flags ?? []) as string[];
    const briefAge = String((plan as any).brief?.training_age_band ?? "").toLowerCase();
    let waveTier: WaveTier = pickWaveTier({
      trainingAgeBand: briefAge,
      redFlagsCount: briefRedFlags.length,
      injuryActive: briefRedFlags.length >= 1 && /pain|acute|sharp|inflam/.test(briefRedFlags.join(" ").toLowerCase()),
    });
    if (appetite === "agressivo") waveTier = waveTier === "beginner" ? "intermediate" : "advanced";
    if (appetite === "conservador") waveTier = waveTier === "advanced" ? "intermediate" : "beginner";
    // R64 cockpit knobs — wave model + deload frequency.
    const pv = (plan as any).programming_variables ?? {};
    const waveModel = (["linear", "undulating", "block", "conjugate"] as const).includes(pv.wave_model)
      ? pv.wave_model
      : "undulating";
    const deloadEveryN = (() => {
      const m = String(pv.deload_frequency ?? "every_4_weeks").match(/(\d+)/);
      return m ? Math.min(6, Math.max(3, parseInt(m[1], 10))) : 4;
    })();
    const wave = buildWavePlan(waveTier, weeks, { model: waveModel, deloadEveryN });

    // Deterministic build: one row per exercise per week-tag, keyed by category.
    const rows: Array<{
      exercise_id: string;
      dimension: string;
      week_2_delta: string;
      week_3_delta: string;
      week_4_delta: string;
      rationale: string;
    }> = [];
    for (const ex of exerciseList) {
      const cat = classifyExercise(ex.name);
      const get = (w: number) => {
        const tag = wave.find((x) => x.week === w)?.tag ?? "base";
        if (tag === "base") return null;
        return deltaForExercise(cat, appetite, tag);
      };
      const w2 = get(2) ?? [];
      const w3 = get(3) ?? [];
      const w4 = get(4) ?? [];
      // Collapse onto one row per primary dimension (load > reps > intensity_rpe > sets).
      const dimPriority = ["load", "reps", "intensity_rpe", "sets"] as const;
      const used = new Set<string>();
      for (const dim of dimPriority) {
        const w2v = w2.find((d) => d.dimension === dim)?.value ?? "";
        const w3v = w3.find((d) => d.dimension === dim)?.value ?? "";
        const w4v = w4.find((d) => d.dimension === dim)?.value ?? "";
        if (!w2v && !w3v && !w4v) continue;
        used.add(dim);
        rows.push({
          exercise_id: ex.id,
          dimension: dim,
          week_2_delta: w2v,
          week_3_delta: w3v,
          week_4_delta: w4v,
          rationale: `${cat} · ${appetite}`,
        });
        if (used.size >= 2) break;
      }
    }
    const progressionData = { rows };
    const durMs = Date.now() - t0;

    await logGeneration(supabase, {
      trainer_id: userId,
      plan_id: data.planId,
      stage: "stage4:progressions:deterministic",
      model_used: "deterministic-bompa-nsca",
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      zod_passed: true,
      retry_count: 0,
      duration_ms: durMs,
      error: null,
      input_snapshot: { exerciseCount: exerciseList.length, weeks, appetite, waveTier },
      output_snapshot: { rowCount: rows.length },
    });

    // Validate against the public schema so callers and DB share contract.
    const parsed = ProgressionPlanSchema.safeParse(progressionData);
    if (!parsed.success) {
      return { ok: false as const, error: "Deterministic progression failed schema." };
    }

    const { error: updErr } = await supabase
      .from("workout_plans")
      .update({
        progression_plan: parsed.data as any,
        generation_meta: {
          ...((plan as any).generation_meta ?? {}),
          wave_periodization: {
            tier: waveTier,
            citation: "Bompa & Buzzichelli 6e §7.3-7.5",
            weeks: wave,
          },
          cockpit: {
            wave_model: waveModel,
            deload_every_n_weeks: deloadEveryN,
            rpe_ceiling: pv.rpe_ceiling ?? null,
            intensity_volume_tradeoff: pv.intensity_volume_tradeoff ?? null,
            autoreg_strictness: pv.autoreg_strictness ?? "suggested",
            preset: pv.cockpit_preset ?? "custom",
          },
          progressions_source: "deterministic",
        } as any,
      })
      .eq("id", data.planId);
    if (updErr) return { ok: false as const, error: updErr.message };
    return { ok: true as const, progressionPlan: parsed.data, exerciseList, wave };
  });

export const approveProgressions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ planId: z.string().uuid(), progressionPlan: ProgressionPlanSchema }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: plan } = await supabase
      .from("workout_plans")
      .select("trainer_id, generation_state")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan || (plan as any).trainer_id !== userId) {
      return { ok: false as const, error: "forbidden" };
    }
    const prev = GenerationStateSchema.safeParse((plan as any).generation_state ?? {});
    const approved = new Set(prev.success ? prev.data.approved_stages : []);
    approved.add("brief");
    approved.add("blueprint");
    approved.add("microcycle");
    approved.add("progressions");
    const newState = GenerationStateSchema.parse({
      stage: "complete",
      approved_stages: Array.from(approved),
      last_updated_at: new Date().toISOString(),
    });
    const { error } = await supabase
      .from("workout_plans")
      .update({ progression_plan: data.progressionPlan as any, generation_state: newState as any })
      .eq("id", data.planId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });