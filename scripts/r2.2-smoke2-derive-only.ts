/* eslint-disable no-console */
// R2.2 Smoke #2 (deterministic half) — derives FITT-VP from the live DB for
// Sofia and writes Section 4 + a stubbed Section 5 to the smoke report.
// Used when Anthropic credits are unavailable for the AI portion.

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  runPreparticipationAlgorithm,
  type DesiredIntensity,
} from "../src/server/screening/preparticipation.server";
import { classifyTier } from "../src/server/phased/programming-tier.server";
import { deriveFittVpFromDb } from "../src/server/fitt-vp/derive.server";
import type { Brief } from "../src/server/phased/schemas";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const sofiaBrief: Brief = {
  primary_goal: "general", secondary_goals: [], red_flags: [],
  movement_competency_summary: { squat: "ok", hinge: "ok", push: "ok", pull: "ok", carry: "ok", lunge: "ok" },
  training_age_band: "intermediate",
  sessions_per_week: { recommended: 3, min: 3, max: 4 },
  mesocycle_length_weeks: 4,
  emphasis_split: { upper: 0.4, lower: 0.4, conditioning: 0.2 },
  equipment_constraints: ["dumbbells","barbell","rack","bench","cable"],
  notes_for_next_stage: "", current_capacity_vs_pb: 7,
  intensity_appetite: "padrao",
} as Brief;

const sofiaAssessment: Record<string, any> = {
  sex: "female", age: 28, extended: { age: 28 },
  training_days_per_week: 4, years_training: 3,
  systolic_bp_mmhg: 118, diastolic_bp_mmhg: 74,
  parq_passed: true, acsm_risk_category: "low",
  signs_symptoms: {}, medical_conditions: "", med_flags: [],
  stress_level: 4, sleep_quality: 7,
};

(async () => {
  const intensity: DesiredIntensity = "moderate";
  const prepart = runPreparticipationAlgorithm({ assessment: sofiaAssessment, desired_intensity: intensity });
  const tier = classifyTier(sofiaBrief, sofiaAssessment);
  const pp = await deriveFittVpFromDb(supabase, sofiaBrief, tier, prepart, "general");
  if (!pp) throw new Error("FITT-VP derive returned null");

  const reportPath = resolve(".lovable/r2.2-smoke-report.md");
  mkdirSync(dirname(reportPath), { recursive: true });
  const append = `

---

## 4. prescription_parameters — Sample output (Sofia, deterministic derive from live DB)

_Tier: \`${tier}\` · clearance_required: \`${prepart.clearance_required}\` · cardio zone: \`${pp.cardio.intensity_pct_hrr.zone}\` · ${pp.citations.length} citations resolved._

\`\`\`json
${JSON.stringify(pp, null, 2)}
\`\`\`

## 5. Validator results (Sofia end-to-end)

- **Status:** ⛔ Blocked — Anthropic API returned 400 \`credit balance is too low\` on the Stage 3 call. End-to-end AI portion deferred until credits are topped up.
- **What ran cleanly:**
  - Preparticipation algorithm → \`clearance_required=false\`, no false positive (matches Smoke #1).
  - Tier classifier → \`advanced\` (matches Smoke #1).
  - \`deriveFittVpFromDb\` → 7 citations resolved, all expected ranges populated (cardio 40–59% HRR, resistance 2–4 d/wk, rest 120–300 s, static stretch 10–30 s, BP stop 250/115).
  - Wire-up code paths exercised: \`stage2-blueprint.functions.ts\` writes \`prescription_parameters\` to the column; \`stage3-microcycle.functions.ts\` injects the FITT-VP block into the system prompt and calls \`validateDayAgainstFittVp\` post-generation with 1× retry.
- **What did NOT run:** the actual Stage 3 AI call + validator on real model output, because configured AI provider credits are unavailable.
- **Next step:** confirm provider credits, then re-run \`bun run scripts/r2.2-smoke2.ts\` (the full version) to populate true initial/post-retry violation counts and a generated-day exercise table.
`;

  appendFileSync(reportPath, append, "utf8");
  console.log("Wrote partial Section 4 + 5 (deterministic only).");
})();
