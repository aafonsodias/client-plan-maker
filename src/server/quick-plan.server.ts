import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { analyzeAssessmentSection } from "@/server/phased/pre-stage.functions";
import { runDemoPlay } from "@/server/demo-play.functions";
import { PHASED_SECTIONS } from "@/server/phased/section-map";
import { PATTERN_IDS, FORM_CRITERIA, CAPACITY_FIELDS } from "@/lib/movement-criteria";

/**
 * R70 — Quick onboarding pipeline.
 * Creates a real client + minimal assessment from 5 inputs, runs pre-stage
 * analysis on every section, then drives the full phased pipeline (brief
 * → progressions → bulk fill). Writes per-stage progress into demo_runs so
 * the global DemoRunsIndicator pill mirrors progress (no separate spinner).
 */

export type QuickPlanInput = {
  fullName: string;
  age: number;
  sex: "male" | "female" | "other";
  primaryGoal: "hypertrophy" | "strength" | "recomp" | "general_health" | "performance";
  experience: "beginner" | "intermediate" | "advanced";
  daysPerWeek: 2 | 3 | 4 | 5;
  equipment: string[];
};

const GOAL_LABEL: Record<QuickPlanInput["primaryGoal"], string> = {
  hypertrophy: "Hipertrofia",
  strength: "Força máxima",
  recomp: "Recomposição corporal",
  general_health: "Saúde geral",
  performance: "Performance desportiva",
};

function estimateAnthro(age: number, sex: QuickPlanInput["sex"]) {
  // Honest defaults — population means for a sedentary adult. Trainer can
  // edit later in the full intake.
  if (sex === "female") return { height_cm: 165, weight_kg: 64 };
  if (sex === "male") return { height_cm: 178, weight_kg: 78 };
  return { height_cm: 170, weight_kg: 70 };
}

function passingFormCriteria(): Record<string, Record<string, boolean>> {
  // Optimistic baseline: assume all form criteria pass (no screen done).
  // Pre-stage analysis will flag null capacity → "screen not assessed".
  const out: Record<string, Record<string, boolean>> = {};
  for (const p of PATTERN_IDS) {
    const o: Record<string, boolean> = {};
    for (const c of FORM_CRITERIA[p]) o[c.key] = true;
    out[`${p}_form_criteria`] = o;
  }
  return out;
}

function emptyCapacity(): Record<string, Record<string, number | null>> {
  const out: Record<string, Record<string, number | null>> = {};
  for (const p of PATTERN_IDS) {
    const o: Record<string, number | null> = {};
    for (const f of CAPACITY_FIELDS[p]) o[f.key] = null;
    out[`${p}_capacity`] = o;
  }
  return out;
}

export async function runQuickPlanPipelineForUser(
  userId: string,
  runId: string,
  data: QuickPlanInput,
): Promise<void> {
  const setStage = async (
    stage: string,
    status: "running" | "done" | "failed" = "running",
    error?: string,
  ) => {
    await supabaseAdmin
      .from("demo_runs")
      .update({ stage, status, error: error ?? null })
      .eq("id", runId);
  };
  const isCancelled = async (): Promise<boolean> => {
    const { data: r } = await supabaseAdmin
      .from("demo_runs")
      .select("cancelled")
      .eq("id", runId)
      .maybeSingle();
    return Boolean((r as any)?.cancelled);
  };

  try {
    await setStage("client", "running");

    const { height_cm, weight_kg } = estimateAnthro(data.age, data.sex);
    const sex = data.sex === "other" ? "male" : data.sex;

    // 1. Client
    const { data: client, error: cErr } = await supabaseAdmin
      .from("clients")
      .insert({
        trainer_id: userId,
        full_name: data.fullName,
        age: data.age,
        sex,
        height_cm,
        weight_kg,
        intake_status: "reviewed",
        notes: "Plano rápido — sem intake clínico completo. Pedir intake normal antes do bloco 2.",
      })
      .select("id")
      .single();
    if (cErr || !client) {
      await setStage("client", "failed", cErr?.message ?? "Falhou criar cliente.");
      return;
    }
    const clientId = (client as any).id as string;
    await supabaseAdmin.from("demo_runs").update({ client_id: clientId }).eq("id", runId);

    // 2. Minimal assessment — fields Stage 1 actually needs.
    const today = new Date().toISOString().slice(0, 10);
    const screenNotAssessed: Record<string, boolean> = {};
    for (const p of PATTERN_IDS) screenNotAssessed[p] = true;

    const { data: assessment, error: aErr } = await supabaseAdmin
      .from("assessments")
      .insert({
        trainer_id: userId,
        client_id: clientId,
        performed_on: today,
        primary_goal: GOAL_LABEL[data.primaryGoal],
        secondary_goals: [],
        experience_level: data.experience,
        training_days_per_week: data.daysPerWeek,
        session_duration_minutes: 60,
        available_equipment: data.equipment,
        training_location: data.equipment.includes("home") ? ["home"] : ["gym"],
        injuries: "",
        medical_conditions: "",
        preferences: "",
        sleep_quality: 7,
        stress_level: 5,
        hydration_glasses_per_day: 6,
        nutrition_habits: "Não informado.",
        energy_levels: "Moderada",
        recovery_capacity: "Moderada",
        lifestyle: "Não informado.",
        standing_posture_notes: "",
        known_imbalances: "",
        ...passingFormCriteria(),
        ...emptyCapacity(),
        screen_not_assessed: screenNotAssessed,
        squat_depth_score: null,
        hip_hinge_score: null,
        overhead_reach_score: null,
        single_leg_balance_score: null,
        acsm_risk_category: "low",
        parq_passed: true,
        years_training:
          data.experience === "beginner" ? 0.5 : data.experience === "intermediate" ? 2 : 5,
        previous_program_style: "Não informado.",
        max_lifts: "Sem PRs registados.",
        current_capacity_vs_pb:
          data.experience === "beginner" ? 5 : data.experience === "intermediate" ? 6 : 7,
        extended: {
          parq: {},
          risk: {},
          provenance: {},
          quick_plan: {
            generated_at: new Date().toISOString(),
            inputs: data,
          },
        },
      })
      .select("id")
      .single();
    if (aErr || !assessment) {
      await supabaseAdmin.from("clients").delete().eq("id", clientId);
      await setStage("client", "failed", aErr?.message ?? "Falhou criar avaliação.");
      return;
    }
    if (await isCancelled()) { await setStage("client", "failed", "Cancelado."); return; }

    // 3. Pre-stage section analyses (in parallel batches of 4).
    await setStage("prestage", "running");
    const assessmentId = (assessment as any).id as string;
    const sections = [...PHASED_SECTIONS];
    for (let i = 0; i < sections.length; i += 4) {
      const batch = sections.slice(i, i + 4);
      await Promise.allSettled(
        batch.map((s) =>
          analyzeAssessmentSection({ data: { assessmentId, section: s } }),
        ),
      );
      if (await isCancelled()) { await setStage("prestage", "failed", "Cancelado."); return; }
    }
    await setStage("prestage", "done");

    // 4. Full plan — reuse the demo-play 5-stage driver.
    await setStage("plan", "running");
    const ran: any = await runDemoPlay({ data: { clientId } });
    if (!ran?.ok || !ran?.planId) {
      await setStage(ran?.failedStep ?? "plan", "failed", ran?.error ?? "Geração falhou.");
      return;
    }
    const planId = ran.planId as string;
    await supabaseAdmin
      .from("demo_runs")
      .update({ plan_id: planId })
      .eq("id", runId);

    await setStage("done", "done");
  } catch (e: any) {
    console.error("[quick-plan] pipeline crashed", e);
    try {
      await supabaseAdmin
        .from("demo_runs")
        .update({ status: "failed", error: e?.message ?? "Pipeline error" })
        .eq("id", runId);
    } catch { /* ignore */ }
  }
}