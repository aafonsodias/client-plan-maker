/* eslint-disable no-console */
// R2.2 Smoke #2 — end-to-end (Sofia persona).
//
// Steps:
//   1. Build Sofia's brief + assessment (same shape as Smoke #1).
//   2. Run runPreparticipationAlgorithm + classifyTier.
//   3. Pull acsm_thresholds from the live DB via service-role and build
//      prescription_parameters with deriveFittVpFromDb.
//   4. Call Anthropic ONCE with the same Stage 3 system prompt + FITT-VP
//      injection, schema = PhasedDay.
//   5. Run validateDayAgainstFittVp; on violations, do a 1× retry.
//   6. Append Sections 4 + 5 to .lovable/r2.2-smoke-report.md.
//
// Run: bun run scripts/r2.2-smoke2.ts

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

import { getDefaultAiProvider } from "../src/server/ai/provider-adapter.server";
import {
  runPreparticipationAlgorithm,
  type DesiredIntensity,
} from "../src/server/screening/preparticipation.server";
import { classifyTier, tierGuidelines } from "../src/server/phased/programming-tier.server";
import {
  deriveFittVpFromDb,
  validateDayAgainstFittVp,
  type PrescriptionParameters,
} from "../src/server/fitt-vp/derive.server";
import { PhasedDaySchema, type Brief } from "../src/server/phased/schemas";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const aiProvider = getDefaultAiProvider();
const MODEL = process.env.FORGE_MODEL_STAGE_3 || "openai/gpt-5";

if (!SUPABASE_URL || !SERVICE_ROLE || !aiProvider.isConfigured()) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / configured AI provider env vars.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

// ---- Sofia (jovem ativa, saudável) ---------------------------------------
const sofiaBrief: Brief = {
  primary_goal: "general",
  secondary_goals: [],
  red_flags: [],
  movement_competency_summary: { squat: "ok", hinge: "ok", push: "ok", pull: "ok", carry: "ok", lunge: "ok" },
  training_age_band: "intermediate",
  sessions_per_week: { recommended: 3, min: 3, max: 4 },
  mesocycle_length_weeks: 4,
  emphasis_split: { upper: 0.4, lower: 0.4, conditioning: 0.2 },
  equipment_constraints: ["dumbbells", "barbell", "rack", "bench", "cable"],
  notes_for_next_stage: "",
  current_capacity_vs_pb: 7,
  intensity_appetite: "padrao",
} as Brief;

const sofiaAssessment: Record<string, any> = {
  sex: "female",
  age: 28,
  extended: { age: 28, height_cm: 165, weight_kg: 60 },
  training_days_per_week: 4,
  years_training: 3,
  systolic_bp_mmhg: 118,
  diastolic_bp_mmhg: 74,
  parq_passed: true,
  acsm_risk_category: "low",
  signs_symptoms: {},
  medical_conditions: "",
  med_flags: [],
  stress_level: 4,
  sleep_quality: 7,
};

function fittVpPromptBlock(pp: PrescriptionParameters | null): string {
  if (!pp) return "";
  const c = pp.cardio, r = pp.resistance, f = pp.flexibility, sf = pp.safety_floors;
  const cits = (pp.citations ?? []).map((x) => `${x.source} ${x.ref}`).join("; ");
  return `\n\nCONSTRAINTS — FITT-VP Non-Negotiable (ACSM 12e):
- Cardio intensity: ${c.intensity_pct_hrr.low}-${c.intensity_pct_hrr.high}% HRR (${c.intensity_pct_hrr.zone})
- Cardio weekly time: ${c.weekly_minutes.min}-${c.weekly_minutes.max} min/week
- Resistance frequency: ${r.frequency_days_per_week.min}-${r.frequency_days_per_week.max} d/wk
- Resistance inter-set rest (strength, RPE >= 8): ${r.inter_set_rest_seconds_strength.min}-${r.inter_set_rest_seconds_strength.max} sec
- Static stretch hold: ${f.static_stretch_hold_seconds.min}-${f.static_stretch_hold_seconds.max} sec (pre-exercise max ${f.pre_exercise_static_max_seconds}s)

Safety floors: BP test stop SBP>=${sf.bp_test_stop_sbp_mmhg} or DBP>=${sf.bp_test_stop_dbp_mmhg}; submax stop >=${sf.submax_stop_pct_hrr}% HRR or >=${sf.submax_stop_pct_age_pred_hrmax}% HRmax.

Citations: ${cits}

Your generated exercise selections, rest periods, and stretch durations MUST fit within these ranges. Do not negotiate.`;
}

const DAY_TOOL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "day_label","focus","rationale","warmup","activation","dynamic_stretches",
    "cooldown","finisher","finisher_enabled","cardio","exercises",
  ],
  properties: {
    day_label: { type: "string" },
    focus: { type: "string" },
    rationale: { type: "string" },
    warmup: { type: "array", items: { type: "object", additionalProperties: false, required: ["name","duration","cue","notes"], properties: { name: {type:"string"}, duration: {type:"string"}, cue: {type:"string"}, notes: {type:"string"} } } },
    activation: { type: "array", items: { type: "object", additionalProperties: false, required: ["name","duration","cue","notes"], properties: { name: {type:"string"}, duration: {type:"string"}, cue: {type:"string"}, notes: {type:"string"} } } },
    dynamic_stretches: { type: "array", items: { type: "object", additionalProperties: false, required: ["name","duration","cue","notes"], properties: { name: {type:"string"}, duration: {type:"string"}, cue: {type:"string"}, notes: {type:"string"} } } },
    cooldown: { type: "array", items: { type: "object", additionalProperties: false, required: ["name","duration","cue","notes"], properties: { name: {type:"string"}, duration: {type:"string"}, cue: {type:"string"}, notes: {type:"string"} } } },
    finisher: { type: "array", items: { type: "object", additionalProperties: false, required: ["name","duration","cue","notes"], properties: { name: {type:"string"}, duration: {type:"string"}, cue: {type:"string"}, notes: {type:"string"} } } },
    finisher_enabled: { type: "boolean" },
    cardio: { type: "array", items: { type: "object", additionalProperties: false, required: ["name","duration","cue","notes"], properties: { name: {type:"string"}, duration: {type:"string"}, cue: {type:"string"}, notes: {type:"string"} } } },
    exercises: {
      type: "array", minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name","sets","reps","rest","notes","primary_muscles","secondary_muscles","rpe","tempo","technique_cues","cue","rationale","superset_id","variant","optional","equipment"],
        properties: {
          name: {type:"string"}, sets: {type:"string"}, reps: {type:"string"}, rest: {type:"string"},
          notes: {type:"string"}, primary_muscles: {type:"array", items:{type:"string"}},
          secondary_muscles: {type:"array", items:{type:"string"}}, rpe: {type:"string"},
          tempo: {type:"string"}, technique_cues: {type:"string"}, cue: {type:"string"},
          rationale: {type:"string"}, superset_id: {type:["string","null"]},
          variant: {type:["string","null"]}, optional: {type:"boolean"},
          equipment: {type:"array", items:{type:"string"}},
        },
      },
    },
  },
};

// Approximate provider pricing (USD per 1M tokens). Used only for the
// smoke report; true billing is via the configured provider.
const PRICING: Record<string, { in: number; out: number }> = {
  "openai/gpt-5": { in: 1.25, out: 10.0 },
  "openai/gpt-5-mini": { in: 0.25, out: 2.0 },
  "google/gemini-3-flash-preview": { in: 0.1, out: 0.4 },
  "google/gemini-2.5-pro": { in: 1.25, out: 10.0 },
};

async function callProvider(system: string, userMessage: string) {
  const t0 = Date.now();
  const aiResult = await aiProvider.createChatCompletion({
    model: MODEL,
    max_completion_tokens: 16000,
    reasoning_effort: "low",
    messages: [
      { role: "system", content: system },
      { role: "user", content: userMessage },
    ],
    tools: [
      {
        type: "function",
        function: { name: "record_day", description: "Record one training session.", parameters: DAY_TOOL_SCHEMA },
      },
    ],
    tool_choice: { type: "function", function: { name: "record_day" } },
  });
  if (!aiResult.ok) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / configured AI provider env vars.");
  }
  const resp = aiResult.response;
  const dur = Date.now() - t0;
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`AI provider ${resp.status}: ${body.slice(0, 500)}`);
  }
  const json: any = await resp.json();
  const inTok = Number(json?.usage?.prompt_tokens ?? json?.usage?.input_tokens ?? 0);
  const outTok = Number(json?.usage?.completion_tokens ?? json?.usage?.output_tokens ?? 0);
  const p = PRICING[MODEL] ?? { in: 1.25, out: 10.0 };
  const cost = (inTok * p.in + outTok * p.out) / 1_000_000;
  const choice = json?.choices?.[0];
  const toolCalls = choice?.message?.tool_calls ?? [];
  const match = toolCalls.find((tc: any) => tc?.type === "function" && tc?.function?.name === "record_day");
  if (!match) throw new Error("No tool_call returned. Raw: " + JSON.stringify(choice?.message ?? json).slice(0, 400));
  const argsRaw = match.function.arguments;
  const argsJson = typeof argsRaw === "string" ? JSON.parse(argsRaw) : argsRaw;
  const parsed = PhasedDaySchema.safeParse(argsJson);
  if (!parsed.success) {
    throw new Error(`Zod fail: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).slice(0, 5).join("; ")}`);
  }
  return { day: parsed.data, inTok, outTok, cost, dur };
}

(async () => {
  console.log("→ Computing prepart + tier for Sofia…");
  const desiredIntensity: DesiredIntensity = "moderate";
  const prepart = runPreparticipationAlgorithm({ assessment: sofiaAssessment, desired_intensity: desiredIntensity });
  const tier = classifyTier(sofiaBrief, sofiaAssessment);
  const guidelines = tierGuidelines(tier, sofiaBrief.sessions_per_week.recommended, sofiaBrief.primary_goal);
  console.log(`  tier=${tier} clearance=${prepart.clearance_required}`);

  console.log("→ Loading acsm_thresholds + deriving FITT-VP…");
  const pp = await deriveFittVpFromDb(supabase, sofiaBrief, tier, prepart, "general");
  if (!pp) throw new Error("FITT-VP derivation returned null (no thresholds in DB?)");
  console.log(`  ${pp.citations.length} citations; cardio ${pp.cardio.intensity_pct_hrr.low}-${pp.cardio.intensity_pct_hrr.high}%HRR`);

  const fittBlock = fittVpPromptBlock(pp);
  const system = `You are a senior strength coach generating ONE single training session.

Output ONE day matching the record_day tool. NO weeks, NO multi-day, NO programming notes outside the schema.

RULES:
- Order: warmup → activation → dynamic_stretches → exercises → cooldown.
- exercises: ${guidelines.exercisesPerSessionMin}-${guidelines.exercisesPerSessionMax} entries. Order: primer → main lift → secondary → accessories → optional.
- Main lift: the FIRST exercise with RPE >= 8.
- All required fields must be filled.

PROGRAMMING TIER: ${tier.toUpperCase()} — RPE ${guidelines.rpeRange}.${fittBlock}`;

  const userMsg = `Day 1 of Week 1.
Archetype: full_body — Full-body strength
Primary movements: squat, horizontal push, horizontal pull

Brief context:
- primary_goal: ${sofiaBrief.primary_goal}
- training_age_band: ${sofiaBrief.training_age_band}
- sessions_per_week: ${sofiaBrief.sessions_per_week.recommended}
- equipment available: ${sofiaBrief.equipment_constraints.join(", ")}

Generate ONLY this single day's session.`;

  console.log(`Calling AI provider (model=${MODEL}, initial)...`);
  const initial = await callProvider(system, userMsg);
  let violationsInitial = validateDayAgainstFittVp(initial.day as any, pp);
  console.log(`  initial violations=${violationsInitial.length} cost=$${initial.cost.toFixed(4)}`);

  let finalDay: any = initial.day;
  let violationsAfter = violationsInitial;
  let totalCost = initial.cost;
  let retried = false;
  if (violationsInitial.length > 0) {
    retried = true;
    const lines = violationsInitial.map((v) => `- ${v.exercise}: ${v.field}=${v.observed}, threshold ${JSON.stringify(v.threshold)}`).join("\n");
    const retrySys = `${system}\n\nPREVIOUS OUTPUT VIOLATED FITT-VP CONSTRAINTS:\n${lines}\n\nRegenerate ensuring ALL exercises fit the ranges above. Non-negotiable.`;
    console.log("Calling AI provider (retry)...");
    const retry = await callProvider(retrySys, userMsg);
    totalCost += retry.cost;
    const retryViolations = validateDayAgainstFittVp(retry.day as any, pp);
    if (retryViolations.length < violationsInitial.length) {
      finalDay = retry.day;
      violationsAfter = retryViolations;
    }
    console.log(`  after retry violations=${violationsAfter.length} totalCost=$${totalCost.toFixed(4)}`);
  }

  // ---- Append sections 4 + 5 to the smoke report --------------------------
  const reportPath = resolve(".lovable/r2.2-smoke-report.md");
  mkdirSync(dirname(reportPath), { recursive: true });
  const append = `

---

## 4. prescription_parameters — Sample output (Sofia end-to-end)

\`\`\`json
${JSON.stringify(pp, null, 2)}
\`\`\`

## 5. Validator results (Sofia end-to-end, Stage 3 single day)

- Model: ${MODEL}
- Violations initial: ${violationsInitial.length}${violationsInitial.length > 0 ? "\n  - " + violationsInitial.map((v) => `${v.exercise}: ${v.field}=${v.observed}, threshold=${JSON.stringify(v.threshold)} (${v.citation.source} ${v.citation.ref})`).join("\n  - ") : ""}
- Retry executed: ${retried ? "yes" : "no"}
- Violations after retry: ${violationsAfter.length}
- Plan status: ${violationsAfter.length === 0 ? "pass ✅" : "best-effort ⚠️"}
- Cost (Smoke #2 total): $${totalCost.toFixed(4)}

### Generated day — exercises summary

| # | Name | Sets×Reps | Rest | RPE |
|---|---|---|---|---|
${(finalDay.exercises ?? []).map((ex: any, i: number) => `| ${i + 1} | ${ex.name} | ${ex.sets}×${ex.reps} | ${ex.rest} | ${ex.rpe} |`).join("\n")}
`;

  appendFileSync(reportPath, append, "utf8");
  console.log(`→ Wrote sections 4+5 to ${reportPath}`);
  console.log(`✅ Smoke #2 done. status=${violationsAfter.length === 0 ? "pass" : "best-effort"} cost=$${totalCost.toFixed(4)}`);
})().catch((e) => {
  console.error("❌ Smoke #2 failed:", e);
  process.exit(1);
});
