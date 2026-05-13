// ============================================================================
// R-A · Foundation refactor — single source of truth for programming context.
//
// Today the answer to "what tier is this plan? what RPE floor? what wave?"
// has to be reconciled by hand from THREE places:
//   1. deriveStartingFloor(brief)         — heuristic from brief alone
//   2. classifyTier(brief, assessment)    — full ACSM-aware classifier
//   3. workout_plans.programming_variables — coach-facing Cockpit overrides
//
// Every consumer (Stage 3, Stage 4, Cockpit, PDF, UI chips, program-next-week)
// has to remember to merge these in the same order, and the order is wrong
// often enough that "tier divergent in 3 places" is a recurring bug class.
//
// This module exposes ONE function that returns a fully-reconciled view with
// `source` annotations per field. New code should read from here. Legacy
// call-sites will be migrated incrementally — no behaviour change in this
// round (R-A first slice = additive only).
//
// Pure server module: imports nothing from `client.ts`.
// ============================================================================

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  classifyTier,
  rpeFloors,
  type Appetite,
  type RpeFloors,
  type Tier,
} from "@/server/phased/programming-tier.server";
import {
  deriveStartingFloor,
  resolveCockpit,
  type ResolvedCockpit,
  type StartingFloor,
} from "@/server/phased/programming-defaults";
import { BriefSchema, type Brief, type ProgrammingVariables } from "@/server/phased/schemas";
import type { KnowledgeRules } from "@/server/knowledge/schema";

import { ENGINE_VERSION as TIER_VERSION } from "@/server/phased/programming-tier.server";
import { ENGINE_VERSION as DEFAULTS_VERSION } from "@/server/phased/programming-defaults";

/** Engine versions consumed by this resolver. Surfaced on every
 *  ProgrammingContext so callers can stamp them into audit_events. */
export const RESOLVER_ENGINE_VERSIONS = {
  resolver: "programming-context@1.0.0" as const,
  tier: TIER_VERSION,
  defaults: DEFAULTS_VERSION,
};

/** Why a particular value won — used in audit + UI tooltips. */
export type ProgrammingSource =
  | "user_override" // coach moved a Cockpit knob by hand
  | "tier_engine"   // classifyTier(brief + full assessment)
  | "starting_floor"// deriveStartingFloor(brief alone) — fallback when no assessment
  | "knowledge_pkl" // trainer's Knowledge Profile default
  | "system_default";

export interface ProgrammingContext {
  planId: string;
  /** Final tier honoured by Stage 3 floor enforcement + chips. */
  tier: Tier;
  /** Starting RPE window for Week 1 (role-aware). */
  rpeFloor: RpeFloors;
  /** Cockpit ceiling — never exceeded by Bompa wave. */
  rpeCeiling: number;
  /** Number of weeks until +1 set / +5% load. */
  weeksToProgress: 2 | 3 | 4;
  /** Resolved wave/deload/autoreg knobs (already merges PV ← PKL). */
  cockpit: ResolvedCockpit;
  /** Per-field provenance — drives "why is this number here?" tooltips. */
  source: {
    tier: ProgrammingSource;
    rpeFloor: ProgrammingSource;
    rpeCeiling: ProgrammingSource;
    weeksToProgress: ProgrammingSource;
  };
  /** Raw inputs kept for callers that need to drill in (avoid extra round-trips). */
  inputs: {
    brief: Brief | null;
    programmingVariables: Partial<ProgrammingVariables> | null;
    assessmentPresent: boolean;
    knowledgeRules: KnowledgeRules | null;
  };
  /** Human-readable reasons (concatenation of starting-floor + tier-engine). */
  reasons: string[];
}

const DEFAULT_RPE_CEILING = 9.0;

function safeBrief(raw: unknown): Brief | null {
  if (!raw) return null;
  const parsed = BriefSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function appetiteFromBrief(brief: Brief | null): Appetite {
  const a = String((brief as any)?.intensity_appetite ?? "padrao").toLowerCase();
  if (a === "conservador" || a === "agressivo") return a;
  return "padrao";
}

/**
 * Reconcile the programming context for a single plan.
 *
 * Reads workout_plans + (optionally) the linked assessment + the trainer's
 * Knowledge Profile rules. Falls back gracefully when any layer is missing —
 * a brand-new plan with only a brief still gets a sensible starting floor.
 */
export async function resolveProgrammingContext(
  planId: string,
  opts: { knowledgeRules?: KnowledgeRules | null } = {},
): Promise<ProgrammingContext> {
  const { data: plan, error } = await supabaseAdmin
    .from("workout_plans")
    .select("id, brief, programming_variables, assessment_id, client_id")
    .eq("id", planId)
    .maybeSingle();

  if (error || !plan) {
    throw new Error(`resolveProgrammingContext: plan ${planId} not found (${error?.message ?? "no row"})`);
  }

  const brief = safeBrief(plan.brief);
  const pv = (plan.programming_variables ?? null) as Partial<ProgrammingVariables> | null;

  // 1. Starting floor — always available from brief alone.
  const floor: StartingFloor | null = brief ? deriveStartingFloor(brief) : null;

  // 2. Tier engine — only when we have a real assessment to classify against.
  let tierFromEngine: Tier | null = null;
  let assessmentPresent = false;
  if (brief) {
    let assessment: Record<string, any> | null = null;
    if (plan.assessment_id) {
      const { data: a } = await supabaseAdmin
        .from("assessments")
        .select("*")
        .eq("id", plan.assessment_id)
        .maybeSingle();
      assessment = (a ?? null) as Record<string, any> | null;
    }
    // Fallback: latest assessment for the same client (mirrors the legacy
    // behaviour in getPlanConstraints — plans created before assessment_id
    // wiring can still be classified).
    if (!assessment && (plan as any).client_id) {
      const { data: a } = await supabaseAdmin
        .from("assessments")
        .select("*")
        .eq("client_id", (plan as any).client_id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      assessment = (a ?? null) as Record<string, any> | null;
    }
    if (assessment) {
      assessmentPresent = true;
      tierFromEngine = classifyTier(brief, assessment);
    }
  }

  // 3. Cockpit — already merges PV ← PKL ← system defaults.
  const cockpit = resolveCockpit(pv, opts.knowledgeRules ?? null);

  // ---- Reconcile with explicit precedence ---------------------------------
  // Tier: engine > starting_floor (mapped MEV/MAV/MRV → tier) > system.
  let tier: Tier = "conservative";
  let tierSource: ProgrammingSource = "system_default";
  if (tierFromEngine) {
    tier = tierFromEngine;
    tierSource = "tier_engine";
  } else if (floor) {
    tier = floor.volume_tier === "MEV" ? "conservative" : "advanced";
    tierSource = "starting_floor";
  }

  // RPE floor: derived from tier + brief.intensity_appetite.
  const appetite = appetiteFromBrief(brief);
  const rpeFloor = rpeFloors(tier, appetite);
  const rpeFloorSource: ProgrammingSource = tierSource;

  // RPE ceiling: cockpit override > starting_floor > system default.
  let rpeCeiling = DEFAULT_RPE_CEILING;
  let rpeCeilingSource: ProgrammingSource = "system_default";
  if (typeof cockpit.rpe_ceiling === "number") {
    rpeCeiling = cockpit.rpe_ceiling;
    rpeCeilingSource = "user_override";
  } else if (floor) {
    rpeCeiling = floor.rpe_ceiling;
    rpeCeilingSource = "starting_floor";
  }

  // Weeks to progress: starting_floor only (no cockpit knob today).
  const weeksToProgress: 2 | 3 | 4 = floor?.weeks_to_progress ?? 3;
  const weeksToProgressSource: ProgrammingSource = floor ? "starting_floor" : "system_default";

  const reasons: string[] = [];
  if (floor) reasons.push(...floor.reason);
  if (tierFromEngine) reasons.push(`tier_engine=${tierFromEngine}`);
  if (rpeCeilingSource === "user_override") reasons.push(`rpe_ceiling=cockpit(${rpeCeiling})`);

  return {
    planId,
    tier,
    rpeFloor,
    rpeCeiling,
    weeksToProgress,
    cockpit,
    source: {
      tier: tierSource,
      rpeFloor: rpeFloorSource,
      rpeCeiling: rpeCeilingSource,
      weeksToProgress: weeksToProgressSource,
    },
    inputs: {
      brief,
      programmingVariables: pv,
      assessmentPresent,
      knowledgeRules: opts.knowledgeRules ?? null,
    },
    reasons,
  };
}

/**
 * Cheap variant that does NOT hit the database — useful in places that
 * already have brief + PV in hand (e.g. the Cockpit editor in BriefEditor).
 * Skips the tier engine (no assessment access), so `source.tier` will be
 * `starting_floor` at best.
 */
export function resolveProgrammingContextSync(input: {
  brief: Brief | null;
  programmingVariables: Partial<ProgrammingVariables> | null;
  knowledgeRules?: KnowledgeRules | null;
}): Omit<ProgrammingContext, "planId"> {
  const { brief, programmingVariables: pv } = input;
  const floor = brief ? deriveStartingFloor(brief) : null;
  const cockpit = resolveCockpit(pv, input.knowledgeRules ?? null);

  let tier: Tier = "conservative";
  let tierSource: ProgrammingSource = "system_default";
  if (floor) {
    tier = floor.volume_tier === "MEV" ? "conservative" : "advanced";
    tierSource = "starting_floor";
  }

  const appetite = appetiteFromBrief(brief);
  const rpeFloor = rpeFloors(tier, appetite);

  let rpeCeiling = DEFAULT_RPE_CEILING;
  let rpeCeilingSource: ProgrammingSource = "system_default";
  if (typeof cockpit.rpe_ceiling === "number") {
    rpeCeiling = cockpit.rpe_ceiling;
    rpeCeilingSource = "user_override";
  } else if (floor) {
    rpeCeiling = floor.rpe_ceiling;
    rpeCeilingSource = "starting_floor";
  }

  const weeksToProgress: 2 | 3 | 4 = floor?.weeks_to_progress ?? 3;
  const weeksToProgressSource: ProgrammingSource = floor ? "starting_floor" : "system_default";

  return {
    tier,
    rpeFloor,
    rpeCeiling,
    weeksToProgress,
    cockpit,
    source: {
      tier: tierSource,
      rpeFloor: tierSource,
      rpeCeiling: rpeCeilingSource,
      weeksToProgress: weeksToProgressSource,
    },
    inputs: {
      brief,
      programmingVariables: pv,
      assessmentPresent: false,
      knowledgeRules: input.knowledgeRules ?? null,
    },
    reasons: floor?.reason ?? [],
  };
}