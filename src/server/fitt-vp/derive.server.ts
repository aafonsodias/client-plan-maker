// ============================================================================
// FITT-VP derivation — emits the structured `prescription_parameters` block
// for a workout plan, sourced from `acsm_thresholds` (R2.1 seed).
//
// Pure function w/ a single DB read for the threshold catalogue (cached per
// request via the supabase client passed in). NO AI calls. Output is
// deterministic given (brief, tier, thresholds, opts).
//
// Citations use the source-discriminator shape so Bompa 6e and NSCA 3e can
// drop in additively in R2.5/R3.5 without refactoring readers:
//   { source: 'acsm_12e' | 'bompa_6e' | 'nsca_3e', ref: '§5.6' }
// ============================================================================

import type { Brief } from "@/server/phased/schemas";
import type { Tier } from "@/server/phased/programming-tier.server";
import type { PreparticipationResult } from "@/server/screening/preparticipation.server";

export type CitationSource = "acsm_12e" | "bompa_6e" | "nsca_3e";

/** Engine version stamped into generation_log + audit_events.
 *  Bump on threshold catalogue changes or FITT-VP derivation logic. */
export const ENGINE_VERSION = "fitt-vp-derive@1.0.0" as const;

export interface Citation {
  source: CitationSource;
  ref: string;
}

export interface ThresholdRow {
  parameter: string;
  applies_to: string;
  value_low: number | null;
  value_high: number | null;
  unit: string | null;
  severity: "safety_floor" | "default" | "validator";
  citation: string; // e.g. "ACSM 12e §5.6"
}

export interface FittVpCardio {
  intensity_pct_hrr: { low: number; high: number; zone: "moderate" | "vigorous" };
  weekly_minutes: { min: number; max: number };
  weekly_frequency_days: { min: number; max: number };
}

export interface FittVpResistance {
  frequency_days_per_week: { min: number; max: number };
  inter_set_rest_seconds_strength: { min: number; max: number };
  progression_rule: {
    name: "two_for_two";
    load_step_pct_1rm: { min: number; max: number };
  };
}

export interface FittVpFlexibility {
  static_stretch_hold_seconds: { min: number; max: number };
  pre_exercise_static_max_seconds: number;
}

export interface SafetyFloors {
  bp_test_stop_sbp_mmhg: number;
  bp_test_stop_dbp_mmhg: number;
  submax_stop_pct_hrr: number;
  submax_stop_pct_age_pred_hrmax: number;
  cardiac_rehab_resting_sbp_mmhg: number | null;
  cardiac_rehab_resting_dbp_mmhg: number | null;
}

export interface PrescriptionParameters {
  cardio: FittVpCardio;
  resistance: FittVpResistance;
  flexibility: FittVpFlexibility;
  safety_floors: SafetyFloors;
  citations: Citation[];
  // Free-form audit trail of any threshold the derivation skipped or capped.
  notes: string[];
}

// ----------------------------------------------------------------------------
// Threshold lookup helpers
// ----------------------------------------------------------------------------

function findRow(
  rows: ThresholdRow[],
  parameter: string,
  appliesTo: string,
): ThresholdRow | null {
  const r = rows.find((x) => x.parameter === parameter && x.applies_to === appliesTo);
  return r ?? null;
}

function citationFromRow(row: ThresholdRow): Citation {
  // Strip the "ACSM 12e " prefix so { source, ref } stays clean.
  const m = row.citation.match(/^ACSM\s*12e\s*(.+)$/i);
  return { source: "acsm_12e", ref: m ? m[1].trim() : row.citation };
}

function pushUnique(arr: Citation[], c: Citation) {
  if (!arr.some((x) => x.source === c.source && x.ref === c.ref)) arr.push(c);
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

export interface DeriveOpts {
  /** Cardio intensity zone — picked from screening output (vigorous needs clearance). */
  cardioZone?: "moderate" | "vigorous";
  /** Population overlay for the static-stretch row: 'older_adults' | 'general'. */
  population?: "general" | "older_adults";
  /** Whether to include cardiac-rehab BP floors (when screening flagged exclusion). */
  includeCardiacRehabFloors?: boolean;
}

/**
 * Build the typed FITT-VP block from the threshold catalogue + brief + tier.
 * Pure given thresholds; safe to call in tests with a fixture rows array.
 */
export function buildPrescriptionParameters(
  brief: Brief,
  tier: Tier,
  rows: ThresholdRow[],
  opts: DeriveOpts = {},
): PrescriptionParameters {
  const citations: Citation[] = [];
  const notes: string[] = [];

  // ---- Cardio ----
  const zone: "moderate" | "vigorous" = opts.cardioZone ?? "moderate";
  const intensityRow =
    zone === "vigorous"
      ? findRow(rows, "cardio_intensity_pct_hrr_vigorous", "general")
      : findRow(rows, "cardio_intensity_pct_hrr_moderate", "general");
  const weeklyTimeRow = findRow(rows, "cardio_weekly_time_moderate", "general");

  if (!intensityRow || !weeklyTimeRow) {
    notes.push("Missing cardio threshold rows — using fallback ACSM defaults.");
  }
  const cardio: FittVpCardio = {
    intensity_pct_hrr: {
      low: intensityRow?.value_low ?? (zone === "vigorous" ? 60 : 40),
      high: intensityRow?.value_high ?? (zone === "vigorous" ? 89 : 59),
      zone,
    },
    weekly_minutes: {
      min: weeklyTimeRow?.value_low ?? 150,
      max: weeklyTimeRow?.value_high ?? 300,
    },
    weekly_frequency_days: { min: 3, max: 5 },
  };
  if (intensityRow) pushUnique(citations, citationFromRow(intensityRow));
  if (weeklyTimeRow) pushUnique(citations, citationFromRow(weeklyTimeRow));

  // ---- Resistance ----
  const freqRow = findRow(rows, "resistance_frequency_per_week", "general");
  const restRow = findRow(rows, "resistance_inter_set_rest_strength", "general");
  const progRow = findRow(rows, "resistance_progression_two_for_two_load_step", "general");
  const resistance: FittVpResistance = {
    frequency_days_per_week: {
      min: freqRow?.value_low ?? 2,
      max: freqRow?.value_high ?? 4,
    },
    inter_set_rest_seconds_strength: {
      min: restRow?.value_low ?? 120,
      max: restRow?.value_high ?? 300,
    },
    progression_rule: {
      name: "two_for_two",
      load_step_pct_1rm: {
        min: progRow?.value_low ?? 2.5,
        max: progRow?.value_high ?? 5,
      },
    },
  };
  if (freqRow) pushUnique(citations, citationFromRow(freqRow));
  if (restRow) pushUnique(citations, citationFromRow(restRow));
  if (progRow) pushUnique(citations, citationFromRow(progRow));

  // Tier override: remedial sits at the LOW end of resistance frequency.
  if (tier === "remedial") {
    resistance.frequency_days_per_week = { min: 2, max: 2 };
    notes.push("Remedial tier: resistance frequency capped at 2 d/wk regardless of ACSM range.");
  }

  // ---- Flexibility ----
  const stretchPop = opts.population ?? "general";
  const stretchRow = findRow(rows, "flexibility_static_stretch_hold", stretchPop);
  const preMaxRow = findRow(rows, "flexibility_pre_exercise_static_stretch_max", "general");
  const flexibility: FittVpFlexibility = {
    static_stretch_hold_seconds: {
      min: stretchRow?.value_low ?? (stretchPop === "older_adults" ? 30 : 10),
      max: stretchRow?.value_high ?? (stretchPop === "older_adults" ? 60 : 30),
    },
    pre_exercise_static_max_seconds: preMaxRow?.value_high ?? 60,
  };
  if (stretchRow) pushUnique(citations, citationFromRow(stretchRow));
  if (preMaxRow) pushUnique(citations, citationFromRow(preMaxRow));

  // ---- Safety floors ----
  const sbpRow = findRow(rows, "bp_test_stop_sbp", "general");
  const dbpRow = findRow(rows, "bp_test_stop_dbp", "general");
  const submaxHrrRow = findRow(rows, "submax_test_stop_pct_hrr", "general");
  const submaxHrmaxRow = findRow(rows, "submax_test_stop_pct_age_pred_hrmax", "general");
  const crSbpRow = findRow(rows, "bp_resting_exclusion_cardiac_rehab_sbp", "cardiac_rehab");
  const crDbpRow = findRow(rows, "bp_resting_exclusion_cardiac_rehab_dbp", "cardiac_rehab");

  const safety_floors: SafetyFloors = {
    bp_test_stop_sbp_mmhg: sbpRow?.value_high ?? 250,
    bp_test_stop_dbp_mmhg: dbpRow?.value_high ?? 115,
    submax_stop_pct_hrr: submaxHrrRow?.value_high ?? 70,
    submax_stop_pct_age_pred_hrmax: submaxHrmaxRow?.value_high ?? 85,
    cardiac_rehab_resting_sbp_mmhg: opts.includeCardiacRehabFloors
      ? crSbpRow?.value_high ?? 180
      : null,
    cardiac_rehab_resting_dbp_mmhg: opts.includeCardiacRehabFloors
      ? crDbpRow?.value_high ?? 110
      : null,
  };
  if (sbpRow) pushUnique(citations, citationFromRow(sbpRow));
  if (dbpRow) pushUnique(citations, citationFromRow(dbpRow));
  if (submaxHrrRow) pushUnique(citations, citationFromRow(submaxHrrRow));
  if (submaxHrmaxRow) pushUnique(citations, citationFromRow(submaxHrmaxRow));
  if (opts.includeCardiacRehabFloors && crSbpRow) pushUnique(citations, citationFromRow(crSbpRow));
  if (opts.includeCardiacRehabFloors && crDbpRow) pushUnique(citations, citationFromRow(crDbpRow));

  return { cardio, resistance, flexibility, safety_floors, citations, notes };
}

/**
 * Server-side wrapper: load the threshold catalogue from `acsm_thresholds`
 * and call `buildPrescriptionParameters`. Caller passes an authenticated
 * supabase client (RLS allows authenticated read on the table).
 */
export async function deriveFittVpFromDb(
  supabase: any,
  brief: Brief,
  tier: Tier,
  screening: Pick<PreparticipationResult, "cardiac_rehab_bp_exclusion" | "desired_intensity">,
  population: "general" | "older_adults" = "general",
): Promise<PrescriptionParameters | null> {
  const { data, error } = await supabase
    .from("acsm_thresholds")
    .select("parameter, applies_to, value_low, value_high, unit, severity, citation");
  if (error || !Array.isArray(data) || data.length === 0) return null;
  const cardioZone: "moderate" | "vigorous" =
    screening.desired_intensity === "vigorous" ? "vigorous" : "moderate";
  return buildPrescriptionParameters(brief, tier, data as ThresholdRow[], {
    cardioZone,
    population,
    includeCardiacRehabFloors: !!screening.cardiac_rehab_bp_exclusion,
  });
}

// ----------------------------------------------------------------------------
// Validators (post-Stage-3) — flag exercises that violate FITT-VP floors.
// Returns a list of violations (empty = clean).
// ----------------------------------------------------------------------------

export interface FittVpViolation {
  exercise: string;
  field: "rest_seconds" | "static_stretch_seconds";
  observed: number;
  threshold: { min?: number; max?: number };
  citation: Citation;
}

function parseSecondsLoose(v: unknown): number | null {
  if (typeof v === "number") return v >= 0 ? v : null;
  if (typeof v !== "string") return null;
  const s = v.toLowerCase().trim();
  const colon = s.match(/^(\d+):(\d{1,2})$/);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
  let total = 0;
  const min = s.match(/(\d+(?:[.,]\d+)?)\s*m/);
  const sec = s.match(/(\d+)\s*s/);
  if (min) total += parseFloat(min[1].replace(",", ".")) * 60;
  if (sec) total += parseInt(sec[1], 10);
  if (!min && !sec) {
    const n = parseFloat(s);
    if (!isNaN(n)) total = n;
  }
  return total > 0 ? total : null;
}

export function validateDayAgainstFittVp(
  day: any,
  pp: PrescriptionParameters,
): FittVpViolation[] {
  const out: FittVpViolation[] = [];
  if (!day) return out;

  // Rule: strength-tier exercises (RPE >= 8) MUST rest >= safety_floor min seconds.
  const restMin = pp.resistance.inter_set_rest_seconds_strength.min;
  const restCit: Citation = { source: "acsm_12e", ref: "Tbl 5.7" };
  for (const ex of (day.exercises ?? []) as any[]) {
    const rpeStr = String(ex?.rpe ?? "");
    const m = rpeStr.match(/(\d+(?:\.\d+)?)/g);
    const rpeMax = m ? Math.max(...m.map(Number)) : 0;
    if (rpeMax < 8) continue; // floor applies only to strength loads
    const restSec = parseSecondsLoose(ex?.rest);
    if (restSec === null) continue;
    if (restSec < restMin) {
      out.push({
        exercise: String(ex?.name ?? "(unnamed)"),
        field: "rest_seconds",
        observed: restSec,
        threshold: { min: restMin },
        citation: restCit,
      });
    }
  }

  // Rule: pre-exercise static stretch hold must be <= max seconds.
  const stretchMax = pp.flexibility.pre_exercise_static_max_seconds;
  const stretchCit: Citation = { source: "acsm_12e", ref: "§5.7" };
  const prep = [
    ...((day.warmup ?? []) as any[]),
    ...((day.activation ?? []) as any[]),
    ...((day.dynamic_stretches ?? []) as any[]),
  ];
  for (const item of prep) {
    const name = String(item?.name ?? "").toLowerCase();
    if (!/static|hold|estática|estatic/.test(name)) continue;
    const sec = parseSecondsLoose(item?.duration);
    if (sec !== null && sec > stretchMax) {
      out.push({
        exercise: String(item?.name ?? "(unnamed)"),
        field: "static_stretch_seconds",
        observed: sec,
        threshold: { max: stretchMax },
        citation: stretchCit,
      });
    }
  }

  return out;
}
