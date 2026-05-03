import { supabase } from "@/integrations/supabase/client";
import { computeWeeklyVolume, type PlanLike } from "./volume-compute";
import {
  MUSCLE_GROUP_ORDER,
  type MuscleGroup,
} from "./volume-landmarks";

/**
 * Longitudinal aggregation — walks every plan a client has and folds the
 * matching workout_sessions into a single time-ordered series. Used by the
 * Year View to chart strength, adherence, RPE and volume across blocks.
 *
 * No mutations, no admin client — read-only helpers safe for the browser.
 */

type DayContent = {
  exercises?: Array<{
    exercise_name?: string;
    primary_muscles?: string[];
    secondary_muscles?: string[];
    sets?: string | number;
  }> | null;
};

export type ClientPlanRow = {
  id: string;
  block_number: number;
  duration_weeks: number;
  title: string | null;
  status: string;
  created_at: string;
  prior_plan_id: string | null;
  generation_meta?: any;
};

export type SessionRow = {
  id: string;
  plan_id: string;
  week_number: number;
  day_label: string;
  session_date: string;
  status: string;
  entries: Array<{
    exercise_name?: string;
    sets?: Array<{ reps?: number; weight?: number; rpe?: number }>;
    planned?: { sets?: string | number };
  }> | null;
};

export type YearWeekPoint = {
  /** Absolute week index across the entire lineage (1 = block 1, week 1). */
  globalWeek: number;
  blockNumber: number;
  blockLabel: string;
  weekInBlock: number;
  /** Sessions logged this week (any status). */
  sessionsLogged: number;
  /** Sessions planned this week (from plan_data). */
  sessionsPlanned: number;
  adherencePct: number;
  avgRpe: number | null;
  totalTonnage: number;
  topSetWeight: Record<string, number>; // exercise -> heaviest set this week
  volumeByMuscle: Record<MuscleGroup, number>;
};

export type YearSummary = {
  client_id: string;
  totalBlocks: number;
  totalWeeks: number;
  totalSessions: number;
  overallAdherencePct: number;
  weeks: YearWeekPoint[];
  /** Block boundaries for chart annotation. */
  blockBoundaries: Array<{ blockNumber: number; startWeek: number; endWeek: number; title: string; blockFeedback?: any }>;
};

function emptyVolume(): Record<MuscleGroup, number> {
  return MUSCLE_GROUP_ORDER.reduce((a, m) => {
    a[m] = 0;
    return a;
  }, {} as Record<MuscleGroup, number>);
}

export async function fetchClientPlans(clientId: string): Promise<ClientPlanRow[]> {
  const { data } = await supabase
    .from("workout_plans")
    .select("id, block_number, duration_weeks, title, status, created_at, prior_plan_id, generation_meta")
    .eq("client_id", clientId)
    .order("block_number", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []) as ClientPlanRow[];
}

export async function fetchSessionsForPlans(planIds: string[]): Promise<SessionRow[]> {
  if (planIds.length === 0) return [];
  const { data } = await supabase
    .from("workout_sessions")
    .select("id, plan_id, week_number, day_label, session_date, status, entries")
    .in("plan_id", planIds)
    .order("session_date", { ascending: true });
  return (data ?? []) as SessionRow[];
}

async function fetchPlanWeekShape(
  planId: string,
): Promise<Map<number, { plannedDays: number; weekDayContent: DayContent[] }>> {
  const { data } = await supabase
    .from("workout_plan_days")
    .select("week_number, content")
    .eq("plan_id", planId);
  const out = new Map<number, { plannedDays: number; weekDayContent: DayContent[] }>();
  for (const row of (data ?? []) as any[]) {
    const wk = row.week_number as number;
    const cur = out.get(wk) ?? { plannedDays: 0, weekDayContent: [] };
    cur.plannedDays += 1;
    cur.weekDayContent.push((row.content ?? {}) as DayContent);
    out.set(wk, cur);
  }
  return out;
}

function topSetFromEntries(entries: SessionRow["entries"]): {
  rpe: number[];
  tonnage: number;
  topByExercise: Record<string, number>;
} {
  const rpe: number[] = [];
  let tonnage = 0;
  const topByExercise: Record<string, number> = {};
  for (const e of entries ?? []) {
    const name = (e.exercise_name ?? "").trim();
    for (const s of e.sets ?? []) {
      const w = Number(s.weight ?? 0);
      const r = Number(s.reps ?? 0);
      const rp = Number(s.rpe ?? 0);
      if (Number.isFinite(w) && Number.isFinite(r) && w > 0 && r > 0) {
        tonnage += w * r;
        if (name) topByExercise[name] = Math.max(topByExercise[name] ?? 0, w);
      }
      if (Number.isFinite(rp) && rp > 0) rpe.push(rp);
    }
  }
  return { rpe, tonnage, topByExercise };
}

export async function buildYearSummary(clientId: string): Promise<YearSummary> {
  const plans = await fetchClientPlans(clientId);
  const planIds = plans.map((p) => p.id);
  const [sessions, ...shapes] = await Promise.all([
    fetchSessionsForPlans(planIds),
    ...plans.map((p) => fetchPlanWeekShape(p.id)),
  ]);
  const shapeByPlan = new Map<string, Awaited<ReturnType<typeof fetchPlanWeekShape>>>();
  plans.forEach((p, i) => shapeByPlan.set(p.id, shapes[i]));

  const weeks: YearWeekPoint[] = [];
  const blockBoundaries: YearSummary["blockBoundaries"] = [];
  let globalWeek = 0;

  for (const plan of plans) {
    const shape = shapeByPlan.get(plan.id) ?? new Map();
    const dur = plan.duration_weeks ?? 4;
    const startWeek = globalWeek + 1;
    const blockSessions = sessions.filter((s) => s.plan_id === plan.id);
    // Build a "PlanLike" from the shape so we can reuse computeWeeklyVolume per week
    const planLike: PlanLike = {
      weeks: Array.from(shape.entries()).map(([wn, info]: [number, { plannedDays: number; weekDayContent: DayContent[] }]) => ({
        week_number: wn,
        days: info.weekDayContent.map((c: DayContent) => ({ exercises: (c.exercises ?? []) as any })),
      })),
    };
    const volByWeek = computeWeeklyVolume(planLike);

    for (let wk = 1; wk <= dur; wk++) {
      globalWeek += 1;
      const weekSessions = blockSessions.filter((s) => s.week_number === wk);
      const plannedDays = shape.get(wk)?.plannedDays ?? 0;
      const allRpe: number[] = [];
      let tonnage = 0;
      const topByExercise: Record<string, number> = {};
      for (const s of weekSessions) {
        const { rpe, tonnage: t, topByExercise: tx } = topSetFromEntries(s.entries);
        allRpe.push(...rpe);
        tonnage += t;
        for (const [k, v] of Object.entries(tx)) {
          topByExercise[k] = Math.max(topByExercise[k] ?? 0, v);
        }
      }
      const adherence = plannedDays > 0
        ? Math.min(100, Math.round((weekSessions.length / plannedDays) * 100))
        : 0;
      const avgRpe = allRpe.length > 0
        ? Math.round((allRpe.reduce((a, b) => a + b, 0) / allRpe.length) * 10) / 10
        : null;
      weeks.push({
        globalWeek,
        blockNumber: plan.block_number,
        blockLabel: plan.title ?? `Bloco ${plan.block_number}`,
        weekInBlock: wk,
        sessionsLogged: weekSessions.length,
        sessionsPlanned: plannedDays,
        adherencePct: adherence,
        avgRpe,
        totalTonnage: Math.round(tonnage),
        topSetWeight: topByExercise,
        volumeByMuscle: (volByWeek.get(wk) as Record<MuscleGroup, number>) ?? emptyVolume(),
      });
    }
    blockBoundaries.push({
      blockNumber: plan.block_number,
      startWeek,
      endWeek: globalWeek,
      title: plan.title ?? `Bloco ${plan.block_number}`,
      blockFeedback: (plan as any).generation_meta?.block_feedback ?? null,
    });
  }

  const totalSessions = sessions.length;
  const totalPlanned = weeks.reduce((a, w) => a + w.sessionsPlanned, 0);
  const overallAdherencePct = totalPlanned > 0
    ? Math.round((totalSessions / totalPlanned) * 100)
    : 0;

  return {
    client_id: clientId,
    totalBlocks: plans.length,
    totalWeeks: weeks.length,
    totalSessions,
    overallAdherencePct,
    weeks,
    blockBoundaries,
  };
}

/** Per-exercise weekly top-set series across the whole year. */
export function exerciseStrengthSeries(
  summary: YearSummary,
  exerciseName: string,
): Array<{ globalWeek: number; weight: number; blockNumber: number }> {
  return summary.weeks
    .map((w) => ({
      globalWeek: w.globalWeek,
      blockNumber: w.blockNumber,
      weight: w.topSetWeight[exerciseName] ?? 0,
    }))
    .filter((p) => p.weight > 0);
}

/** All exercises that appear in any week's top-set log, ordered by frequency. */
export function exercisesInSummary(summary: YearSummary): string[] {
  const counts = new Map<string, number>();
  for (const w of summary.weeks) {
    for (const ex of Object.keys(w.topSetWeight)) {
      counts.set(ex, (counts.get(ex) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}