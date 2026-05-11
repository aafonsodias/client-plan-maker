/**
 * Deterministic post-session summary helpers.
 *
 * Computes per-exercise top-set, e1RM (Epley) and week-over-week deltas
 * given the current session entries and (optionally) the homologous
 * session from the previous week (same plan_id + day_label).
 *
 * Pure functions — safe in client + server. No AI, no DB, no i18n
 * (consumer renders copy in PT/EN).
 */

import { epley } from "./capacity-gain";

/* ─────────── Input types (mirror saved entries shape) ─────────── */

type SetLike = {
  reps?: string | number;
  weight?: string | number;
  rpe?: string | number;
  done?: boolean;
};

type EntryLike = {
  exercise_name: string;
  planned?: { reps?: string; rpe?: string; sets?: string };
  /** v2 — set-by-set logging */
  sets?: SetLike[];
  /** v1 — single aggregate */
  actual?: { sets?: string; reps?: string; weight?: string };
  felt?: "easy" | "right" | "hard";
  notes?: string;
};

/* ─────────── Output types ─────────── */

export type DeltaTone = "success" | "neutral" | "warn" | "danger";

export type ExerciseDelta = {
  exercise_name: string;
  /** Top set this session: best load × reps (only completed sets count). */
  top_load: number | null;
  top_reps: number;
  e1rm: number | null;
  avg_rpe: number | null;
  /** Comparison vs prior session (same slot, week-1). */
  prior_top_load: number | null;
  prior_top_reps: number;
  prior_e1rm: number | null;
  prior_avg_rpe: number | null;
  /** Δ e1RM as percentage. null when no prior. */
  delta_pct: number | null;
  /** Human label, PT-first. Caller may translate. */
  label: string;
  tone: DeltaTone;
  /** Personal record flag — top set strictly heavier at ≥ same reps. */
  is_pr: boolean;
};

export type SessionSummary = {
  total_sets: number;
  done_sets: number;
  adherence_pct: number;
  /** Aggregate session metrics. */
  e1rm_total: number | null;
  prior_e1rm_total: number | null;
  delta_pct: number | null;
  /** Per-exercise rows. */
  exercises: ExerciseDelta[];
  /** Highlights ready to render (top 3 best deltas). */
  highlights: ExerciseDelta[];
  /** True when no prior session was found — show baseline copy, hide deltas. */
  is_baseline: boolean;
};

/* ─────────── Number coercion (tolerant of strings + commas) ─────────── */

function num(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).replace(",", ".").trim();
  if (!s) return null;
  const m = s.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/* ─────────── Per-entry rollup (handles v1 + v2) ─────────── */

function rollup(entry: EntryLike): {
  top_load: number | null;
  top_reps: number;
  e1rm: number | null;
  avg_rpe: number | null;
  done_sets: number;
  total_sets: number;
} {
  // v2: array of sets, only count `done`
  if (Array.isArray(entry.sets) && entry.sets.length) {
    let topLoad = 0;
    let topReps = 0;
    let topE1 = 0;
    let rpeSum = 0;
    let rpeN = 0;
    let done = 0;
    for (const s of entry.sets) {
      if (!s?.done) continue;
      const w = num(s.weight) ?? 0;
      const r = num(s.reps) ?? 0;
      done += 1;
      if (w > 0 && r > 0) {
        const e1 = epley(w, r) ?? 0;
        if (e1 > topE1) {
          topE1 = e1;
          topLoad = w;
          topReps = r;
        }
      }
      const rpe = num(s.rpe);
      if (rpe != null) {
        rpeSum += rpe;
        rpeN += 1;
      }
    }
    return {
      top_load: topLoad || null,
      top_reps: topReps,
      e1rm: topE1 || null,
      avg_rpe: rpeN ? rpeSum / rpeN : null,
      done_sets: done,
      total_sets: entry.sets.length,
    };
  }
  // v1 fallback
  const w = num(entry.actual?.weight);
  const r = num(entry.actual?.reps) ?? 0;
  const setsCount = num(entry.actual?.sets) ?? 0;
  const e1 = w && r ? epley(w, r) : null;
  return {
    top_load: w,
    top_reps: r,
    e1rm: e1,
    avg_rpe: null,
    done_sets: setsCount,
    total_sets: setsCount,
  };
}

/* ─────────── Name normalization for matching across weeks ─────────── */

function nameKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/* ─────────── Verdict ─────────── */

function verdict(
  cur: ReturnType<typeof rollup>,
  prior: ReturnType<typeof rollup> | null,
): { label: string; tone: DeltaTone; delta_pct: number | null; is_pr: boolean } {
  if (!prior || !prior.e1rm) {
    if (cur.top_load && cur.top_reps) {
      return {
        label: `${cur.top_load} kg × ${cur.top_reps} registado`,
        tone: "neutral",
        delta_pct: null,
        is_pr: false,
      };
    }
    return { label: "Registado", tone: "neutral", delta_pct: null, is_pr: false };
  }
  if (!cur.e1rm) {
    return {
      label: "Sem séries concluídas",
      tone: "warn",
      delta_pct: null,
      is_pr: false,
    };
  }
  const deltaPct = ((cur.e1rm - prior.e1rm) / prior.e1rm) * 100;
  const isPR =
    cur.top_load != null &&
    prior.top_load != null &&
    cur.top_load > prior.top_load &&
    cur.top_reps >= prior.top_reps;

  // RPE drift signal (same load+reps but harder than last week)
  const sameWork =
    cur.top_load != null &&
    prior.top_load != null &&
    Math.abs(cur.top_load - prior.top_load) < 0.5 &&
    cur.top_reps === prior.top_reps;
  if (sameWork && cur.avg_rpe != null && prior.avg_rpe != null) {
    const dRpe = cur.avg_rpe - prior.avg_rpe;
    if (dRpe >= 1) {
      return {
        label: `Mesmo peso, RPE +${dRpe.toFixed(1)} — atenção`,
        tone: "warn",
        delta_pct: deltaPct,
        is_pr: false,
      };
    }
  }

  if (deltaPct >= 3) {
    const tag = isPR ? " · PR" : "";
    const loadDelta =
      cur.top_load && prior.top_load
        ? ` (+${(cur.top_load - prior.top_load).toFixed(1)} kg)`
        : "";
    return {
      label: `+${deltaPct.toFixed(1)}% e1RM${loadDelta}${tag}`,
      tone: "success",
      delta_pct: deltaPct,
      is_pr: isPR,
    };
  }
  if (deltaPct <= -3) {
    return {
      label: `${deltaPct.toFixed(1)}% e1RM`,
      tone: "danger",
      delta_pct: deltaPct,
      is_pr: false,
    };
  }
  return {
    label: "Mantido vs semana anterior",
    tone: "neutral",
    delta_pct: deltaPct,
    is_pr: false,
  };
}

/* ─────────── Public API ─────────── */

export function buildSessionSummary(
  current: EntryLike[] | null | undefined,
  prior: EntryLike[] | null | undefined,
): SessionSummary {
  const cur = Array.isArray(current) ? current : [];
  const pri = Array.isArray(prior) ? prior : [];

  // Index prior by normalized name; first match wins (no plan duplicates same exercise twice in practice).
  const priorIdx = new Map<string, EntryLike>();
  for (const p of pri) {
    const k = nameKey(p.exercise_name ?? "");
    if (k && !priorIdx.has(k)) priorIdx.set(k, p);
  }

  let totalSets = 0;
  let doneSets = 0;
  let curE1Total = 0;
  let priorE1Total = 0;
  let priorE1Has = false;

  const exercises: ExerciseDelta[] = cur.map((e) => {
    const r = rollup(e);
    const priorEntry = priorIdx.get(nameKey(e.exercise_name ?? ""));
    const pr = priorEntry ? rollup(priorEntry) : null;
    totalSets += r.total_sets;
    doneSets += r.done_sets;
    if (r.e1rm) curE1Total += r.e1rm;
    if (pr?.e1rm) {
      priorE1Total += pr.e1rm;
      priorE1Has = true;
    }
    const v = verdict(r, pr);
    return {
      exercise_name: e.exercise_name,
      top_load: r.top_load,
      top_reps: r.top_reps,
      e1rm: r.e1rm,
      avg_rpe: r.avg_rpe,
      prior_top_load: pr?.top_load ?? null,
      prior_top_reps: pr?.top_reps ?? 0,
      prior_e1rm: pr?.e1rm ?? null,
      prior_avg_rpe: pr?.avg_rpe ?? null,
      delta_pct: v.delta_pct,
      label: v.label,
      tone: v.tone,
      is_pr: v.is_pr,
    };
  });

  const isBaseline = !priorE1Has;
  const deltaPct =
    !isBaseline && priorE1Total > 0
      ? ((curE1Total - priorE1Total) / priorE1Total) * 100
      : null;

  // Highlights = top 3 by descending delta_pct, prioritising PRs and gains.
  const highlights = [...exercises]
    .filter((e) => e.tone === "success" || e.is_pr)
    .sort((a, b) => (b.delta_pct ?? 0) - (a.delta_pct ?? 0))
    .slice(0, 3);

  return {
    total_sets: totalSets,
    done_sets: doneSets,
    adherence_pct: totalSets ? Math.round((doneSets / totalSets) * 100) : 0,
    e1rm_total: curE1Total || null,
    prior_e1rm_total: priorE1Has ? priorE1Total : null,
    delta_pct: deltaPct,
    exercises,
    highlights,
    is_baseline: isBaseline,
  };
}