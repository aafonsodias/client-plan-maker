// ============================================================================
// ACSM 12e Ch.2 — Preparticipation health screening algorithm.
//
// Pure function. No I/O, no DB, no AI calls. Deterministic given an
// assessment row + 9 cardinal signs/symptoms.
//
// Decision flow (faithful to ACSM 12e Box 2.1 + Algorithm fig 2.x):
//   1. Known CV / metabolic / renal disease?
//   2. Any of the 9 cardinal signs/symptoms present?
//   3. Currently exercising (>=30 min moderate >= 3d/wk for >= 3 months)?
//   4. Desired exercise intensity (light/moderate/vigorous)?
//   -> Output: clearance_required + reason + intermediate flags.
//
// References cited inline below as `[ACSM 12e §X.Y / Box X.Y / Algorithm 2.x]`.
// ============================================================================

export type Sex = "male" | "female" | string | null | undefined;

/** Engine version stamped into screening_evaluations + audit_events.
 *  Bump on any change to the algorithm decision tree or risk thresholds. */
export const ENGINE_VERSION = "parq-plus-acsm@2023.1.0" as const;

export interface SignsSymptoms {
  chest_discomfort?: boolean;
  unreasonable_dyspnea?: boolean;
  dizziness_syncope?: boolean;
  orthopnea_pnd?: boolean;
  ankle_edema?: boolean;
  palpitations_tachycardia?: boolean;
  intermittent_claudication?: boolean;
  known_heart_murmur?: boolean;
  unusual_fatigue?: boolean;
}

export const SIGN_KEYS: (keyof SignsSymptoms)[] = [
  "chest_discomfort",
  "unreasonable_dyspnea",
  "dizziness_syncope",
  "orthopnea_pnd",
  "ankle_edema",
  "palpitations_tachycardia",
  "intermittent_claudication",
  "known_heart_murmur",
  "unusual_fatigue",
];

export interface CvdRiskFactors {
  age: boolean;            // men >=45, women >=55
  family_history: boolean; // MI/revasc/sudden death <55 in 1st-deg male relative or <65 female
  smoking: boolean;        // current or quit <6 mo
  sedentary: boolean;      // not meeting >=30 min mod 3d/wk for 3 mo
  obesity: boolean;        // BMI >=30 OR waist >102 cm men / >88 cm women
  hypertension: boolean;   // SBP >=130 or DBP >=80, or on meds
  dyslipidemia: boolean;   // LDL>=130 or HDL<40 (men) / <50 (women) or on meds
  prediabetes: boolean;    // FBG 100-125, or A1c 5.7-6.4
  // Negative risk: HDL >= 60 subtracts 1 from total count
  negative_hdl: boolean;
  // Derived total (sum minus negative_hdl)
  count: number;
}

export type DesiredIntensity = "light" | "moderate" | "vigorous" | "unknown";

export interface PreparticipationInput {
  assessment: Record<string, any>;
  signs?: SignsSymptoms | null;
  desired_intensity?: DesiredIntensity;
}

export interface PreparticipationResult {
  exerciser_status: "current" | "not_current";
  signs_symptoms_present: boolean;
  signs_symptoms_list: (keyof SignsSymptoms)[];
  known_disease: boolean;
  known_disease_list: string[];
  desired_intensity: DesiredIntensity;
  cvd_risk_factors: CvdRiskFactors;
  clearance_required: boolean;
  clearance_reason: string;
  // BP gate distinct from clearance — used by tier classifier:
  cardiac_rehab_bp_exclusion: boolean;
}

// -- Helpers ----------------------------------------------------------------

function num(x: any): number | null {
  if (typeof x === "number" && isFinite(x)) return x;
  return null;
}

function getAge(a: Record<string, any>): number | null {
  const ext = (a?.extended ?? {}) as Record<string, any>;
  return num(ext?.age) ?? num(a?.age) ?? null;
}

function getSex(a: Record<string, any>): "male" | "female" | null {
  const s = String(a?.sex ?? "").toLowerCase();
  if (s === "male" || s === "m") return "male";
  if (s === "female" || s === "f") return "female";
  return null;
}

function isCurrentExerciser(a: Record<string, any>): boolean {
  // Explicit field wins.
  const explicit = String(a?.exerciser_status ?? "").toLowerCase();
  if (explicit === "current") return true;
  if (explicit === "not_current") return false;
  // Fallback heuristic from intake.
  const days = num(a?.training_days_per_week);
  const years = num(a?.years_training);
  if (days !== null && days >= 3 && years !== null && years >= 0.25) return true;
  return false;
}

// -- 9 cardinal signs/symptoms ---------------------------------------------

function readSigns(input: PreparticipationInput): {
  present: boolean;
  list: (keyof SignsSymptoms)[];
} {
  const fromInput = input.signs ?? null;
  const fromAssessment =
    (input.assessment?.signs_symptoms ?? null) as SignsSymptoms | null;
  const merged: SignsSymptoms = { ...(fromAssessment ?? {}), ...(fromInput ?? {}) };
  const list = SIGN_KEYS.filter((k) => merged[k] === true);
  return { present: list.length > 0, list };
}

// -- Known CV / metabolic / renal disease -----------------------------------
// We accept either explicit fields on the assessment OR a free-text scan of
// `medical_conditions` for unambiguous matches. Ambiguous text never auto-flags
// — the algorithm errs on the side of NOT inventing disease.

const DISEASE_PATTERNS: Array<[RegExp, string]> = [
  [/\b(MI|enfarte|infarto|infarction)\b/i, "myocardial_infarction"],
  [/\bangina\b/i, "angina"],
  [/\b(CABG|stent|PCI|revascular)\w*/i, "revascularization"],
  [/\b(insufici[eê]ncia card[ií]aca|heart failure|HFrEF|HFpEF|CHF)\b/i, "heart_failure"],
  [/\b(valvular|estenose a[óo]rtica|insufici[eê]ncia mitral)\b/i, "valvular_disease"],
  [/\b(arritmia|atrial fib|fibrila[cç][ãa]o auricular|AFib)\b/i, "arrhythmia"],
  [/\bpacemaker|cardiov[ée]rsor|ICD\b/i, "implanted_device"],
  [/\b(diabetes|DM ?[12]|DM\s+tipo\s+[12]|diabetes\s+mellitus|T1D|T2D)\b/i, "diabetes"],
  [/\b(insufici[eê]ncia renal|chronic kidney disease|CKD|di[áa]lise|dialysis)\b/i, "renal_disease"],
  [/\b(DPOC|COPD|asma severa)\b/i, "pulmonary_disease"],
  [/\b(AVC|stroke|TIA)\b/i, "cerebrovascular"],
];

function detectKnownDisease(a: Record<string, any>): string[] {
  const list: string[] = [];
  const flags = Array.isArray(a?.med_flags) ? (a.med_flags as string[]) : [];
  if (flags.includes("diabetes")) list.push("diabetes");
  if (flags.includes("heart_failure")) list.push("heart_failure");
  if (flags.includes("renal_disease")) list.push("renal_disease");
  if (flags.includes("known_cvd")) list.push("cvd");
  // Free-text scan of medical_conditions
  const txt = String(a?.medical_conditions ?? "");
  for (const [re, tag] of DISEASE_PATTERNS) {
    if (re.test(txt) && !list.includes(tag)) list.push(tag);
  }
  return list;
}

// -- CVD risk factor count (ACSM 12e Tbl 2.x) -------------------------------

function bmi(a: Record<string, any>): number | null {
  const ext = (a?.extended ?? {}) as Record<string, any>;
  const h = num(ext?.height_cm) ?? num(a?.height_cm);
  const w = num(ext?.weight_kg) ?? num(a?.weight_kg);
  if (h === null || w === null || h <= 0) return null;
  return w / Math.pow(h / 100, 2);
}

export function classifyCvdRiskFactors(a: Record<string, any>): CvdRiskFactors {
  const sex = getSex(a);
  const age = getAge(a);
  const ext = (a?.extended ?? {}) as Record<string, any>;
  const flags = Array.isArray(a?.med_flags) ? (a.med_flags as string[]) : [];

  const ageRisk =
    age !== null &&
    ((sex === "male" && age >= 45) || (sex === "female" && age >= 55));

  const familyHistory = !!ext?.family_history_cvd_premature;

  const smoking = ext?.smoking === "current" || flags.includes("current_smoker");

  // Sedentary = NOT meeting >=30 min mod 3d/wk for 3 mo
  const days = num(a?.training_days_per_week);
  const years = num(a?.years_training);
  const sedentary =
    !(days !== null && days >= 3 && years !== null && years >= 0.25) ||
    flags.includes("sedentary");

  // Obesity: BMI>=30 OR waist >102 men / >88 women
  const b = bmi(a);
  const waist = num(a?.waist_cm);
  const obesity =
    (b !== null && b >= 30) ||
    (waist !== null && sex === "male" && waist > 102) ||
    (waist !== null && sex === "female" && waist > 88);

  // Hypertension: BP>=130/80 OR on BP meds (per AHA/ACC, 12e adopts)
  const sys = num(a?.systolic_bp_mmhg);
  const dia = num(a?.diastolic_bp_mmhg);
  const onBpMeds = flags.includes("bp_meds");
  const hypertension =
    onBpMeds ||
    (sys !== null && sys >= 130) ||
    (dia !== null && dia >= 80);

  // Dyslipidemia: explicit flag, or labs in extended
  const ldl = num(ext?.ldl_mg_dl);
  const hdl = num(ext?.hdl_mg_dl);
  const onStatin = flags.includes("statin") || flags.includes("dyslipidemia");
  const dyslipidemia =
    onStatin ||
    (ldl !== null && ldl >= 130) ||
    (hdl !== null && sex === "male" && hdl < 40) ||
    (hdl !== null && sex === "female" && hdl < 50);

  // Prediabetes: A1c 5.7-6.4 or FBG 100-125
  const a1c = num(ext?.a1c_pct);
  const fbg = num(ext?.fasting_glucose_mg_dl);
  const prediabetes =
    (a1c !== null && a1c >= 5.7 && a1c <= 6.4) ||
    (fbg !== null && fbg >= 100 && fbg <= 125);

  // Negative risk factor: HDL >= 60 subtracts 1
  const negative_hdl = hdl !== null && hdl >= 60;

  const positives = [
    ageRisk,
    familyHistory,
    smoking,
    sedentary,
    obesity,
    hypertension,
    dyslipidemia,
    prediabetes,
  ].filter(Boolean).length;
  const count = Math.max(0, positives - (negative_hdl ? 1 : 0));

  return {
    age: ageRisk,
    family_history: familyHistory,
    smoking,
    sedentary,
    obesity,
    hypertension,
    dyslipidemia,
    prediabetes,
    negative_hdl,
    count,
  };
}

// -- Cardiac-rehab BP exclusion (ACSM 12e Box 8.3) --------------------------
// Resting >= 180/110 disqualifies entry into cardiac rehab. Either threshold
// breached triggers the gate.

export function cardiacRehabBpExclusion(a: Record<string, any>): boolean {
  const sys = num(a?.systolic_bp_mmhg);
  const dia = num(a?.diastolic_bp_mmhg);
  if (sys !== null && sys >= 180) return true;
  if (dia !== null && dia >= 110) return true;
  return false;
}

// -- Main algorithm (ACSM 12e Algorithm Fig 2.x) ----------------------------

export function runPreparticipationAlgorithm(
  input: PreparticipationInput,
): PreparticipationResult {
  const a = input.assessment ?? {};
  const exerciser = isCurrentExerciser(a);
  const signs = readSigns(input);
  const knownDisease = detectKnownDisease(a);
  const desiredIntensity: DesiredIntensity = input.desired_intensity ?? "moderate";
  const cvd = classifyCvdRiskFactors(a);
  const cardiacRehabBp = cardiacRehabBpExclusion(a);

  // Decision tree per ACSM 12e Algorithm Fig 2.x:
  //   - Known disease + asymptomatic + currently exercising:
  //       light/moderate -> NO clearance; vigorous -> clearance.
  //   - Known disease + asymptomatic + NOT exercising: clearance.
  //   - Known disease + symptomatic (any signs): ALWAYS clearance.
  //   - No disease + symptomatic: clearance.
  //   - No disease + asymptomatic + exercising:
  //       continue current intensity OK; vigorous escalation OK without clearance
  //       UNLESS cardiac-rehab BP gate trips.
  //   - No disease + asymptomatic + NOT exercising:
  //       light/moderate OK; vigorous -> clearance recommended.

  let clearance_required = false;
  let clearance_reason = "";

  if (signs.present) {
    clearance_required = true;
    clearance_reason = `Signs/symptoms suggestive of CV/metabolic/renal disease present (${signs.list.join(", ")}). [ACSM 12e Box 2.1]`;
  } else if (knownDisease.length > 0) {
    if (!exerciser) {
      clearance_required = true;
      clearance_reason = `Known disease (${knownDisease.join(", ")}) and not currently exercising. [ACSM 12e Algorithm 2.x]`;
    } else if (desiredIntensity === "vigorous") {
      clearance_required = true;
      clearance_reason = `Known disease (${knownDisease.join(", ")}) and intends to escalate to vigorous intensity. [ACSM 12e Algorithm 2.x]`;
    } else {
      clearance_required = false;
      clearance_reason = `Known disease but asymptomatic and continuing established light/moderate exercise — clearance not mandated. [ACSM 12e Algorithm 2.x]`;
    }
  } else if (!exerciser && desiredIntensity === "vigorous") {
    clearance_required = true;
    clearance_reason = `No known disease but sedentary and intends to begin vigorous-intensity exercise. [ACSM 12e Algorithm 2.x]`;
  }

  // BP gate is independent — even an asymptomatic, healthy-looking client with
  // resting >=180/110 must be cleared before any structured load. This is the
  // cardiac-rehab cutoff but we apply it to all preparticipation as a safety floor.
  if (cardiacRehabBp) {
    clearance_required = true;
    clearance_reason = clearance_reason
      ? `${clearance_reason} Resting BP at or above 180/110 mmHg — independent safety gate. [ACSM 12e Box 8.3]`
      : `Resting BP at or above 180/110 mmHg requires medical clearance before loaded exercise. [ACSM 12e Box 8.3]`;
  }

  return {
    exerciser_status: exerciser ? "current" : "not_current",
    signs_symptoms_present: signs.present,
    signs_symptoms_list: signs.list,
    known_disease: knownDisease.length > 0,
    known_disease_list: knownDisease,
    desired_intensity: desiredIntensity,
    cvd_risk_factors: cvd,
    clearance_required,
    clearance_reason,
    cardiac_rehab_bp_exclusion: cardiacRehabBp,
  };
}
