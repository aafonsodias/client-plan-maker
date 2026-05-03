/* eslint-disable no-console */
// R2.2 Smoke #1 — algorithm-only.
// Pure offline run (no DB, no AI). Builds 10 synthetic personas covering
// the false-positive watchlist + BP gate + clearance edge cases, runs the
// dual classifier, and writes .lovable/r2.2-smoke-report.md.
//
// Run: bun run scripts/r2.2-smoke.ts

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  classifyTierWithDual,
  type DualTierResult,
} from "../src/server/phased/programming-tier.server";
import type { Brief } from "../src/server/phased/schemas";

type Persona = {
  name: string;
  why: string; // why this persona is in the matrix
  expected: { tier: string; clearance: boolean; reason: string };
  brief: Brief;
  assessment: Record<string, any>;
};

function baseBrief(overrides: Partial<Brief> = {}): Brief {
  return {
    primary_goal: "general",
    secondary_goals: [],
    red_flags: [],
    movement_competency_summary: {
      squat: "ok", hinge: "ok", push: "ok", pull: "ok", carry: "ok", lunge: "ok",
    },
    training_age_band: "intermediate",
    sessions_per_week: { recommended: 3, min: 3, max: 4 },
    equipment_constraints: [],
    recovery_profile: "average",
    intensity_appetite: "padrao",
    ...overrides,
  } as unknown as Brief;
}

function baseAssessment(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    sex: "female",
    age: 30,
    extended: { age: 30, height_cm: 165, weight_kg: 60 },
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
    ...overrides,
  };
}

const personas: Persona[] = [
  {
    name: "Sofia (jovem ativa, saudável)",
    why: "Watchlist — default case. clearance=true seria bug.",
    expected: { tier: "advanced", clearance: false, reason: "no flags" },
    brief: baseBrief({ training_age_band: "intermediate" }),
    assessment: baseAssessment({ sex: "female", age: 28 }),
  },
  {
    name: "Pedro Vieira (atleta vigoroso saudável)",
    why: "Watchlist — current exerciser + intent vigorous ≠ clearance.",
    expected: { tier: "advanced", clearance: false, reason: "current exerciser, no signs/disease" },
    brief: baseBrief({ intensity_appetite: "agressivo", training_age_band: "advanced" } as any),
    assessment: baseAssessment({ sex: "male", age: 32, extended: { age: 32, height_cm: 180, weight_kg: 78 }, training_days_per_week: 5, years_training: 8 }),
  },
  {
    name: "Marta (gestante, sem disease)",
    why: "Watchlist — pregnancy NÃO deve flagear via Ch.2 (R3 overlay).",
    expected: { tier: "advanced", clearance: false, reason: "pregnancy not a Ch.2 trigger; sem outros flags" },
    brief: baseBrief({ training_age_band: "intermediate" }),
    assessment: baseAssessment({ sex: "female", age: 31, extended: { age: 31, pregnancy: true, height_cm: 165, weight_kg: 68 } }),
  },
  {
    name: "Manuel Cardoso (sedentário + hipertensão grave)",
    why: "BP gate — SBP 188/108 deve disparar safety floor.",
    expected: { tier: "remedial", clearance: true, reason: "BP ≥180" },
    brief: baseBrief(),
    assessment: baseAssessment({ sex: "male", age: 58, extended: { age: 58, height_cm: 175, weight_kg: 92 }, systolic_bp_mmhg: 188, diastolic_bp_mmhg: 108, training_days_per_week: 0, years_training: 0 }),
  },
  {
    name: "Inês Bento (idosa sedentária, intent vigorous)",
    why: "Não-exerciser + vigorous → clearance.",
    expected: { tier: "remedial", clearance: true, reason: "sedentary + vigorous intent" },
    brief: baseBrief({ intensity_appetite: "agressivo", training_age_band: "beginner" } as any),
    assessment: baseAssessment({ sex: "female", age: 67, extended: { age: 67, height_cm: 160, weight_kg: 70 }, training_days_per_week: 0, years_training: 0 }),
  },
  {
    name: "João (DM2 conhecido, ativo, moderate intent)",
    why: "Known disease + asymptomatic + exercising + moderate → SEM clearance.",
    expected: { tier: "conservative", clearance: false, reason: "known disease → conservative (sem clearance)" },
    brief: baseBrief(),
    assessment: baseAssessment({ sex: "male", age: 45, extended: { age: 45, height_cm: 178, weight_kg: 88 }, medical_conditions: "DM2 controlada", training_days_per_week: 4, years_training: 2 }),
  },
  {
    name: "Rui (DM2, ativo, intent vigorous)",
    why: "Known disease + escalada vigorous → clearance.",
    expected: { tier: "remedial", clearance: true, reason: "known disease + vigorous → clearance → remedial" },
    brief: baseBrief({ intensity_appetite: "agressivo" } as any),
    assessment: baseAssessment({ sex: "male", age: 50, extended: { age: 50, height_cm: 178, weight_kg: 92 }, medical_conditions: "DM tipo 2", training_days_per_week: 4, years_training: 2 }),
  },
  {
    name: "Catarina (sintomas — dor torácica esforço)",
    why: "Cardinal sign present → ALWAYS clearance.",
    expected: { tier: "remedial", clearance: true, reason: "signs present" },
    brief: baseBrief(),
    assessment: baseAssessment({ sex: "female", age: 42, signs_symptoms: { chest_discomfort: true } }),
  },
  {
    name: "Hugo (5+ falhas movement screen)",
    why: "Movement floor → remedial mesmo sem clearance.",
    expected: { tier: "remedial", clearance: false, reason: "movement failures ≥5" },
    brief: baseBrief(),
    assessment: baseAssessment({
      sex: "male", age: 35,
      squat_form_criteria: { a:false,b:false,c:false },
      hinge_form_criteria: { a:false,b:false,c:false },
      push_form_criteria:  { a:false,b:false,c:false },
      pull_form_criteria:  { a:false,b:false,c:false },
      carry_form_criteria: { a:false,b:false,c:false },
    }),
  },
  {
    name: "Beatriz (CVD risk count ≥2: HTN + sedentária + obesa)",
    why: "CVD count ≥2 sem signs → conservative (não remedial).",
    expected: { tier: "conservative", clearance: false, reason: "CVD risk count ≥2, asymptomatic" },
    brief: baseBrief(),
    assessment: baseAssessment({
      sex: "female", age: 48,
      extended: { age: 48, height_cm: 162, weight_kg: 90 },
      systolic_bp_mmhg: 138, diastolic_bp_mmhg: 86,
      training_days_per_week: 1, years_training: 0.1,
    }),
  },
];

function row(p: Persona, r: DualTierResult): string {
  const reasonShort = r.prepart.clearance_reason
    ? r.prepart.clearance_reason.slice(0, 80) + (r.prepart.clearance_reason.length > 80 ? "…" : "")
    : "—";
  return `| ${p.name} | — | ${r.tier} | ${r.oldFlag} | ${r.prepart.clearance_required} | ${reasonShort} |`;
}

function main() {
  const results = personas.map((p) => ({
    persona: p,
    result: classifyTierWithDual(p.brief, p.assessment),
  }));

  // Section 1 — Tier transitions table
  const sec1 = [
    "## 1. Tier transitions",
    "",
    "| persona | tier_old (legacy) | tier_new (ACSM) | clearance_old | clearance_new | reason |",
    "|---|---|---|---|---|---|",
    ...results.map(({ persona, result }) => row(persona, result)),
    "",
    "_Nota: `tier_old` não existia como pipeline separado — o tier classifier sempre consumiu o `hasMedicalClearanceFlag()`. A coluna mostrada compara `oldFlag` vs `newResult.clearance_required` para o gate principal._",
  ].join("\n");

  // Section 2 — Clearance deltas
  const deltas = results.filter(({ result }) => result.oldFlag !== result.prepart.clearance_required);
  const sec2 = [
    "",
    "## 2. Clearance flag deltas (oldFlag ≠ newResult.clearance_required)",
    "",
    deltas.length === 0
      ? "_Sem deltas — algoritmo concorda com heurística legacy nesta amostra._"
      : deltas.map(({ persona, result }) =>
          `- **${persona.name}** — old=${result.oldFlag} → new=${result.prepart.clearance_required}\n  - Razão: ${result.prepart.clearance_reason || "(novo algoritmo dispensa clearance)"}`,
        ).join("\n"),
  ].join("\n");

  // Section 3 — BP cardiac rehab gate
  const bpHits = results.filter(({ result }) => result.prepart.cardiac_rehab_bp_exclusion);
  const sec3 = [
    "",
    "## 3. BP cardiac rehab gate (≥180/110)",
    "",
    bpHits.length === 0
      ? "_Ninguém na amostra dispara o gate._"
      : bpHits.map(({ persona, result }) => {
          const a = persona.assessment;
          return `- **${persona.name}** — ${a.systolic_bp_mmhg}/${a.diastolic_bp_mmhg} mmHg → clearance forçado`;
        }).join("\n"),
  ].join("\n");

  // Watchlist verification
  const watch = [
    "",
    "## False-positive watchlist (verificação explícita)",
    "",
    ...results.map(({ persona, result }) => {
      const exp = persona.expected;
      const ok = result.prepart.clearance_required === exp.clearance && result.tier === exp.tier;
      return `- ${ok ? "✅" : "❌"} **${persona.name}** — esperado tier=${exp.tier} clearance=${exp.clearance}; obtido tier=${result.tier} clearance=${result.prepart.clearance_required}`;
    }),
  ].join("\n");

  // CVD risk factor counts (debugging aid)
  const cvdTable = [
    "",
    "## Anexo A — CVD risk factor counts",
    "",
    "| persona | count | breakdown |",
    "|---|---|---|",
    ...results.map(({ persona, result }) => {
      const c = result.prepart.cvd_risk_factors;
      const parts = Object.entries(c)
        .filter(([k, v]) => k !== "count" && v === true)
        .map(([k]) => k);
      return `| ${persona.name} | ${c.count} | ${parts.join(", ") || "—"} |`;
    }),
  ].join("\n");

  const allOk = results.every(({ persona, result }) =>
    result.prepart.clearance_required === persona.expected.clearance &&
    result.tier === persona.expected.tier,
  );

  const header = [
    "# R2.2 Smoke Report #1 — Preparticipation algorithm only",
    "",
    `_Gerado: ${new Date().toISOString()}_`,
    "",
    `**Status:** ${allOk ? "✅ Todas as 10 personas batem com o esperado." : "❌ Há divergências — investigar antes de avançar para Fase C."}`,
    "",
    "Smoke offline puro (sem DB, sem AI). 10 personas sintéticas que cobrem: watchlist (Sofia, Pedro, Marta gestante), BP gate, known disease ± vigorous escalation, signs/symptoms, movement-screen floor, CVD risk count ≥2.",
    "",
  ].join("\n");

  const body = [header, sec1, sec2, sec3, watch, cvdTable].join("\n");

  const outPath = resolve(process.cwd(), ".lovable/r2.2-smoke-report.md");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, body, "utf8");
  console.log(`Wrote ${outPath}`);
  console.log(allOk ? "All personas passed expectation." : "DIVERGENCES present — see report.");
  if (!allOk) process.exit(1);
}

main();