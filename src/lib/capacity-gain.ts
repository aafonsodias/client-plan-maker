import { parseRpe } from "@/lib/rpe-tone";
import { exerciseIdentityKey } from "@/lib/exercise-taxonomy";

/**
 * Capacity-gain analytics across two consecutive blocks.
 *
 * We summarise what the trainer/cliente actually wants to see between
 * Bloco N-1 and Bloco N: did average load go up? Did estimated 1RM rise?
 * Adesão e RPE drift acompanham para contexto.
 *
 * Inputs are workout_sessions rows (or anything with `entries`).
 * We deliberately keep this client-side and tolerant: missing data ⇒ null.
 */

export type CapacityRow = {
  pattern: "squat" | "hinge" | "push" | "pull" | "carry" | "other";
  patternLabel: string;
  priorAvgLoadKg: number | null;
  currentAvgLoadKg: number | null;
  deltaPct: number | null;
  verdict: "gain" | "flat" | "regression" | "unknown";
};

export type CapacitySummary = {
  rows: CapacityRow[];
  topLifts: TopLiftDelta[];
  overall: { deltaPct: number | null; verdict: CapacityRow["verdict"] };
};

export type TopLiftDelta = {
  name: string;
  priorBest: number | null;
  currentBest: number | null;
  priorE1rm: number | null;
  currentE1rm: number | null;
  deltaPct: number | null;
  verdict: CapacityRow["verdict"];
};

const PATTERN_LABEL: Record<CapacityRow["pattern"], string> = {
  squat: "Agachamento",
  hinge: "Hinge",
  push: "Empurrar",
  pull: "Puxar",
  carry: "Carry",
  other: "Outros",
};

function classifyPattern(name: string): CapacityRow["pattern"] {
  const n = name.toLowerCase();
  if (/(squat|agach|leg press|hack|pistol|lunge|step.?up)/.test(n)) return "squat";
  if (/(deadlift|hinge|rdl|romanian|good ?morning|kettlebell swing|hip thrust|glute bridge|pull.?through)/.test(n)) return "hinge";
  if (/(bench|press|push|dip|incline|overhead|ohp|landmine press)/.test(n)) return "push";
  if (/(row|pull.?up|chin|lat pulldown|pulldown|face pull|curl)/.test(n)) return "pull";
  if (/(carry|farmer|suitcase|pallof|dead.?bug|plank)/.test(n)) return "carry";
  return "other";
}

function loadKg(entry: any): number | null {
  const m = String(entry?.actual?.weight ?? "").match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}
function reps(entry: any): number {
  const m = String(entry?.actual?.reps ?? "").match(/\d+/);
  return m ? Number(m[0]) : 0;
}
function sets(entry: any): number {
  const m = String(entry?.actual?.sets ?? "").match(/\d+/);
  return m ? Number(m[0]) : 0;
}
/** Epley e1RM = load × (1 + reps/30). Conservative + readable. */
export function epley(load: number, r: number): number | null {
  if (!load || !r) return null;
  return load * (1 + r / 30);
}
const e1rm = epley;

function verdictFor(deltaPct: number | null): CapacityRow["verdict"] {
  if (deltaPct == null) return "unknown";
  if (deltaPct >= 3) return "gain";
  if (deltaPct <= -3) return "regression";
  return "flat";
}

export function computeCapacityGain(
  prior: Array<{ entries?: any[] }> = [],
  current: Array<{ entries?: any[] }> = [],
): CapacitySummary {
  type Bucket = { prior: number[]; current: number[] };
  type Lift = {
    prior: number[];
    current: number[];
    priorRepsAtBest: Map<number, number>;
    currentRepsAtBest: Map<number, number>;
  };
  const buckets = new Map<CapacityRow["pattern"], Bucket>();
  // Keyed by stable exercise identity (canonical key or `unknown:<normalized>`)
  // so "Goblet Squat" and "agachamento goblet" don't split into two lifts.
  const liftLoads = new Map<string, { displayName: string; data: Lift }>();

  function ingest(rows: typeof prior, side: "prior" | "current") {
    for (const s of rows) {
      for (const e of s.entries ?? []) {
        const load = loadKg(e);
        if (!load) continue;
        const name = String(e?.exercise_name ?? e?.name ?? "").trim();
        if (!name) continue;
        const p = classifyPattern(name);
        const b: Bucket = buckets.get(p) ?? { prior: [], current: [] };
        b[side].push(load);
        buckets.set(p, b);

        const id = exerciseIdentityKey(name);
        const slot = liftLoads.get(id) ?? {
          displayName: name,
          data: {
            prior: [], current: [],
            priorRepsAtBest: new Map(), currentRepsAtBest: new Map(),
          },
        };
        const lift = slot.data;
        lift[side].push(load);
        const r = reps(e);
        if (r) {
          const map = side === "prior" ? lift.priorRepsAtBest : lift.currentRepsAtBest;
          if (!map.has(load) || (map.get(load) ?? 0) < r) map.set(load, r);
        }
        liftLoads.set(id, slot);
      }
    }
  }
  ingest(prior, "prior");
  ingest(current, "current");

  const rows: CapacityRow[] = [];
  for (const [pattern, b] of buckets.entries()) {
    const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    const pAvg = avg(b.prior);
    const cAvg = avg(b.current);
    const delta = pAvg && cAvg ? ((cAvg - pAvg) / pAvg) * 100 : null;
    rows.push({
      pattern,
      patternLabel: PATTERN_LABEL[pattern],
      priorAvgLoadKg: pAvg,
      currentAvgLoadKg: cAvg,
      deltaPct: delta != null ? Number(delta.toFixed(1)) : null,
      verdict: verdictFor(delta),
    });
  }
  rows.sort((a, b) => (a.pattern === "other" ? 1 : b.pattern === "other" ? -1 : 0));

  // Top lifts: pick the 3 lifts with most data on BOTH sides.
  const topLifts: TopLiftDelta[] = [...liftLoads.entries()]
    .filter(([, v]) => v.data.prior.length > 0 && v.data.current.length > 0)
    .sort(([, a], [, b]) => (b.data.prior.length + b.data.current.length) - (a.data.prior.length + a.data.current.length))
    .slice(0, 3)
    .map(([, slot]) => {
      const v = slot.data;
      const pBest = v.prior.length ? Math.max(...v.prior) : null;
      const cBest = v.current.length ? Math.max(...v.current) : null;
      const pE1 = pBest != null ? e1rm(pBest, v.priorRepsAtBest.get(pBest) ?? 5) : null;
      const cE1 = cBest != null ? e1rm(cBest, v.currentRepsAtBest.get(cBest) ?? 5) : null;
      const delta = pE1 && cE1 ? ((cE1 - pE1) / pE1) * 100 : pBest && cBest ? ((cBest - pBest) / pBest) * 100 : null;
      return {
        name: slot.displayName,
        priorBest: pBest,
        currentBest: cBest,
        priorE1rm: pE1 != null ? Number(pE1.toFixed(1)) : null,
        currentE1rm: cE1 != null ? Number(cE1.toFixed(1)) : null,
        deltaPct: delta != null ? Number(delta.toFixed(1)) : null,
        verdict: verdictFor(delta),
      };
    });

  // Overall = weighted by # samples.
  const totals = rows.reduce((acc, r) => {
    if (r.deltaPct == null) return acc;
    return { sum: acc.sum + r.deltaPct, n: acc.n + 1 };
  }, { sum: 0, n: 0 });
  const overallDelta = totals.n > 0 ? Number((totals.sum / totals.n).toFixed(1)) : null;

  return {
    rows,
    topLifts,
    overall: { deltaPct: overallDelta, verdict: verdictFor(overallDelta) },
  };
}

// Helpers reused by UI.
export function avgRpe(sessions: Array<{ entries?: any[] }>): number | null {
  const all: number[] = [];
  for (const s of sessions) {
    for (const e of s.entries ?? []) {
      const r = parseRpe(e?.actual?.rpe);
      if (r != null) all.push(r);
    }
  }
  return all.length ? Number((all.reduce((a, b) => a + b, 0) / all.length).toFixed(2)) : null;
}