// ============================================================================
// Adaptation engine v1 — scaffold.
//
// Implements `AdaptationEngine` from src/domain/ports.
//
// Reads:
//   - assessments (latest by client_id)
//   - workout_plans + workout_plan_days for the prior plan (prescription)
//   - workout_sessions for the prior plan (logged data — `entries` jsonb)
//   - programming_variables for the prior plan (Cockpit state)
//
// Computes deterministically:
//   - adherence %  = sessions logged / sessions prescribed
//   - per-pattern e1RM delta  (Epley, first vs last logged session)
//   - per-pattern RPE drift   (avg actual − avg prescribed)
//   - pain flag count         (TODO: needs per-set pain flags — wired but stubs to 0)
//
// Returns a `NextBlockProposal` with structured `prescriptionDiff` items and
// rationale chips. The AI is NOT called here — only the deterministic kernel.
// A separate stage (Stage 3 of the next block) consumes this proposal as
// input.
//
// What's still TODO before this is production-ready:
//   - `session_set_logs` table for per-set load/RPE/pain (Phase 3.1 in
//     forge-gap-may-2026.md). Today we read aggregate `entries` jsonb.
//   - Volume vs MEV/MAV/MRV computation per muscle group.
//   - Movement-pattern tagging on each exercise (today inferred from name).
//   - Trigger wiring: archivePlanAndStartNextBlock should call this and
//     pipe the proposal into Stage 3 instead of regenerating from scratch.
// ============================================================================
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  AdaptationEngine,
  AdaptationInput,
  EngineVersion,
  MovementMetric,
  MovementPattern,
  NextBlockProposal,
} from "@/domain/ports";
import { logAuditEvent } from "@/server/audit/log-event.server";

export const ENGINE_VERSION: EngineVersion = "adaptation-next-block@0.1.0";

// ----------------------------------------------------------------------------
// Movement pattern inference — string-match over exercise names.
// Replaced once exercises carry a canonical pattern field.
// ----------------------------------------------------------------------------
const PATTERN_RULES: Array<{ pattern: MovementPattern; needles: RegExp }> = [
  { pattern: "squat", needles: /\b(squat|agachamento|leg press)\b/i },
  { pattern: "hinge", needles: /\b(deadlift|hinge|rdl|good morning|hip thrust|peso morto)\b/i },
  { pattern: "horizontal_push", needles: /\b(bench|push.?up|chest press|supino)\b/i },
  { pattern: "horizontal_pull", needles: /\b(row|remada|t.?bar)\b/i },
  { pattern: "vertical_push", needles: /\b(overhead|ohp|shoulder press|military|desenvolvimento)\b/i },
  { pattern: "vertical_pull", needles: /\b(pull.?up|chin.?up|lat pull|pulldown)\b/i },
  { pattern: "lunge", needles: /\b(lunge|split squat|step.?up|afundo)\b/i },
  { pattern: "carry", needles: /\b(carry|farmer|suitcase)\b/i },
];

function inferPattern(exerciseName: string): MovementPattern | null {
  for (const rule of PATTERN_RULES) {
    if (rule.needles.test(exerciseName)) return rule.pattern;
  }
  return null;
}

/** Epley 1RM estimator — load * (1 + reps/30). */
function epley(load: number, reps: number): number {
  if (load <= 0 || reps <= 0) return 0;
  return load * (1 + reps / 30);
}

function num(s: unknown): number | null {
  const m = String(s ?? "").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

interface SetReading {
  exerciseName: string;
  pattern: MovementPattern | null;
  load: number;
  reps: number;
  rpe: number | null;
  prescribedRpe: number | null;
  weekNumber: number | null;
  sessionDate: string;
}

function flattenEntries(rows: Array<Record<string, any>>): SetReading[] {
  const out: SetReading[] = [];
  for (const row of rows) {
    const entries = Array.isArray(row.entries) ? row.entries : [];
    for (const entry of entries) {
      const exerciseName = String(entry?.exercise ?? entry?.name ?? "").trim();
      if (!exerciseName) continue;
      const pattern = inferPattern(exerciseName);
      const sets = Array.isArray(entry?.sets) ? entry.sets : [];
      for (const set of sets) {
        const load = num(set?.load) ?? num(set?.weight) ?? 0;
        const reps = num(set?.reps) ?? 0;
        const rpe = num(set?.rpe);
        const prescribedRpe = num(entry?.prescribed_rpe ?? entry?.target_rpe);
        if (load <= 0 || reps <= 0) continue;
        out.push({
          exerciseName,
          pattern,
          load,
          reps,
          rpe,
          prescribedRpe,
          weekNumber: row.week_number ?? null,
          sessionDate: row.session_date,
        });
      }
    }
  }
  return out;
}

function flattenSetLogs(rows: Array<Record<string, any>>): SetReading[] {
  const out: SetReading[] = [];
  for (const r of rows) {
    const load = num(r.actual_load_kg) ?? 0;
    const reps = num(r.actual_reps) ?? 0;
    if (load <= 0 || reps <= 0) continue;
    const exerciseName = String(r.exercise_name ?? "").trim();
    const pattern = (r.movement_pattern as MovementPattern | null) ?? inferPattern(exerciseName);
    out.push({
      exerciseName,
      pattern,
      load,
      reps,
      rpe: num(r.actual_rpe),
      prescribedRpe: num(r.prescribed_rpe),
      weekNumber: r.week_number ?? null,
      sessionDate: String(r.created_at ?? ""),
    });
  }
  return out;
}

function computeMetrics(readings: SetReading[]): MovementMetric[] {
  const byPattern = new Map<MovementPattern, SetReading[]>();
  for (const r of readings) {
    if (!r.pattern) continue;
    const arr = byPattern.get(r.pattern) ?? [];
    arr.push(r);
    byPattern.set(r.pattern, arr);
  }

  const metrics: MovementMetric[] = [];
  for (const [pattern, sets] of byPattern.entries()) {
    const sorted = [...sets].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
    const firstQuartile = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 4)));
    const lastQuartile = sorted.slice(-Math.max(1, Math.ceil(sorted.length / 4)));
    const e1rmStart = Math.max(...firstQuartile.map((s) => epley(s.load, s.reps)));
    const e1rmEnd = Math.max(...lastQuartile.map((s) => epley(s.load, s.reps)));
    const e1rmDeltaPct = e1rmStart > 0 ? ((e1rmEnd - e1rmStart) / e1rmStart) * 100 : 0;

    const drifts = sorted
      .filter((s) => s.rpe != null && s.prescribedRpe != null)
      .map((s) => (s.rpe as number) - (s.prescribedRpe as number));
    const rpeDriftPoints = drifts.length
      ? drifts.reduce((a, b) => a + b, 0) / drifts.length
      : 0;

    metrics.push({
      pattern,
      e1rmDeltaPct: +e1rmDeltaPct.toFixed(1),
      rpeDriftPoints: +rpeDriftPoints.toFixed(2),
      setsCompletedVsPrescribed: sorted.length, // placeholder until we have prescribed-set count by pattern
    });
  }
  return metrics;
}

function buildDiff(metrics: MovementMetric[]): NextBlockProposal["prescriptionDiff"] {
  const out: NextBlockProposal["prescriptionDiff"] = [];
  for (const m of metrics) {
    let loadDeltaPct = 0;
    let setsDelta = 0;
    let rpeTarget = 8;
    let reasonChip = "Manter — dados insuficientes";

    if (m.rpeDriftPoints > 0.7 && m.e1rmDeltaPct < 1) {
      loadDeltaPct = -5;
      setsDelta = -1;
      rpeTarget = 7.5;
      reasonChip = `${m.pattern}: RPE +${m.rpeDriftPoints.toFixed(1)} sem ganho — descarregar 5%`;
    } else if (m.e1rmDeltaPct >= 3 && m.rpeDriftPoints <= 0.3) {
      loadDeltaPct = +5;
      setsDelta = 0;
      rpeTarget = 8;
      reasonChip = `${m.pattern}: +${m.e1rmDeltaPct}% e1RM com RPE estável — subir 5%`;
    } else if (m.e1rmDeltaPct >= 1) {
      loadDeltaPct = +2.5;
      reasonChip = `${m.pattern}: +${m.e1rmDeltaPct}% e1RM — manter padrão, +2.5% carga`;
    } else if (m.rpeDriftPoints > 0.3) {
      reasonChip = `${m.pattern}: RPE a subir — manter carga`;
    }

    out.push({
      exerciseSlug: m.pattern,
      loadDeltaPct,
      setsDelta,
      rpeTarget,
      reasonChip,
    });
  }
  return out;
}

// ----------------------------------------------------------------------------
// Adapter
// ----------------------------------------------------------------------------
export const adaptationEngine: AdaptationEngine = {
  version: ENGINE_VERSION,
  async proposeNextBlock(input: AdaptationInput): Promise<NextBlockProposal> {
    const { trainerId, clientId, priorPlanId } = input;

    const [{ data: plan }, { data: sessions }, { data: days }, { data: setLogs }] = await Promise.all([
      supabaseAdmin
        .from("workout_plans")
        .select("id, trainer_id, client_id, generation_meta")
        .eq("id", priorPlanId)
        .maybeSingle(),
      supabaseAdmin
        .from("workout_sessions")
        .select("week_number, session_date, entries")
        .eq("plan_id", priorPlanId)
        .order("session_date", { ascending: true }),
      supabaseAdmin
        .from("workout_plan_days")
        .select("week_number, day_number, status")
        .eq("plan_id", priorPlanId)
        .eq("status", "done"),
      supabaseAdmin
        .from("session_set_logs")
        .select("week_number, exercise_name, movement_pattern, actual_load_kg, actual_reps, actual_rpe, prescribed_rpe, pain_flag, created_at")
        .eq("plan_id", priorPlanId)
        .order("created_at", { ascending: true }),
    ]);

    if (!plan || (plan as any).trainer_id !== trainerId) {
      throw new Error("Adaptation engine: prior plan not found or forbidden.");
    }

    const sessionRows = (sessions ?? []) as Array<Record<string, any>>;
    const prescribedSessions = (days ?? []).length;
    const loggedSessions = sessionRows.length;
    const adherencePct = prescribedSessions > 0
      ? Math.round((loggedSessions / prescribedSessions) * 100)
      : 0;

    // Prefer per-set logs when present (Phase 3.1), fall back to entries jsonb.
    const setLogRows = (setLogs ?? []) as Array<Record<string, any>>;
    const readings: SetReading[] =
      setLogRows.length > 0 ? flattenSetLogs(setLogRows) : flattenEntries(sessionRows);
    const metrics = computeMetrics(readings);
    const prescriptionDiff = buildDiff(metrics);

    const painFlagsCount = setLogRows.filter((r) => r.pain_flag === true).length;

    const recommendDeload =
      adherencePct < 60 ||
      painFlagsCount > 3 ||
      metrics.some((m) => m.e1rmDeltaPct < -5) ||
      metrics.some((m) => m.rpeDriftPoints > 0.7 && m.e1rmDeltaPct <= 0);

    const deloadReason = recommendDeload
      ? adherencePct < 60
        ? `Adesão ${adherencePct}% — descarregar e revisitar.`
        : "Sinais de fadiga acumulada — semana de descarga recomendada."
      : undefined;

    const proposal: NextBlockProposal = {
      prescriptionDiff,
      metrics,
      adherencePct,
      painFlagsCount,
      recommendDeload,
      deloadReason,
      transitionPrompt: buildTransitionPrompt({
        adherencePct,
        metrics,
        recommendDeload,
      }),
    };

    await logAuditEvent({
      trainerId,
      eventType: "next_block_proposed",
      entityType: "plan",
      entityId: priorPlanId,
      payload: {
        clientId,
        adherencePct,
        recommendDeload,
        metricsCount: metrics.length,
        diffCount: prescriptionDiff.length,
      },
      engineVersions: { adaptation: ENGINE_VERSION },
    });

    return proposal;
  },
};

function buildTransitionPrompt(args: {
  adherencePct: number;
  metrics: MovementMetric[];
  recommendDeload: boolean;
}): string {
  const wins = args.metrics
    .filter((m) => m.e1rmDeltaPct >= 2)
    .map((m) => `${m.pattern} +${m.e1rmDeltaPct}%`);
  const flags = args.metrics
    .filter((m) => m.rpeDriftPoints > 0.5)
    .map((m) => `${m.pattern} (RPE +${m.rpeDriftPoints.toFixed(1)})`);

  const parts: string[] = [
    `Adesão do bloco: ${args.adherencePct}%.`,
  ];
  if (wins.length) parts.push(`Ganhos: ${wins.join(", ")}.`);
  if (flags.length) parts.push(`A vigiar: ${flags.join(", ")}.`);
  if (args.recommendDeload) parts.push("Recomendação: descarga antes do próximo bloco.");
  return parts.join(" ");
}