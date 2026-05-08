/**
 * Brief Mínimo Viável (BMV) — gate a geração do brief IA atrás de uma
 * checklist humana que qualquer PT em domicílio (ou pessoa comum) consegue
 * preencher SEM laboratório.
 *
 * Pure function, sem React, sem rede. Recebe os mesmos `client` e
 * `assessment` que o ecrã já tem em memória, mais a lista de snapshots de
 * capacidade (composição corporal, FC repouso, TA, força de preensão...) que
 * podem vir de aparelhos (Tanita, Jamar, tensiómetro) e satisfazem
 * automaticamente alguns dos itens "recomendados".
 */

export type BmvItem = {
  /** Stable id so o popover sabe a que campo dar scroll. */
  key: string;
  /** Label humano em PT, sem jargão. */
  label: string;
  /** Para onde fazer scroll quando o utilizador carrega "ver". */
  sectionId: string;
  /** True quando o requisito está satisfeito. */
  ok: boolean;
};

export type BmvResult = {
  required: BmvItem[];
  recommended: BmvItem[];
  /** Quantos obrigatórios ainda em falta. */
  missingRequired: number;
  /** Quantos recomendados ainda em falta. */
  missingRecommended: number;
  /** True quando todos os obrigatórios estão preenchidos. */
  ready: boolean;
  /** "lean" quando ready mas faltam ≥2 recomendados; "rich" caso contrário. */
  confidence: "blocked" | "lean" | "rich";
};

function has(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "number") return Number.isFinite(v) && v !== 0;
  return true;
}

/** Slim shape so the checker doesn't depend on the page's huge state types. */
export type BmvSnapshot = {
  domain_slug: string;
  test_used: string | null;
  raw_value: number | null;
};

export function computeBmv(input: {
  client: {
    sex?: string | null;
    date_of_birth?: string | null;
    age?: number | null;
    height_cm?: number | null;
    weight_kg?: number | null;
  };
  assessment: Record<string, any> | null | undefined;
  snapshots?: BmvSnapshot[];
}): BmvResult {
  const c = input.client ?? {};
  const a = input.assessment ?? {};
  const snaps = input.snapshots ?? [];

  // ---------- Obrigatórios (BMV) ----------

  const identityOk =
    has(c.sex) &&
    (has(c.date_of_birth) || has(c.age)) &&
    has(c.height_cm) &&
    has(c.weight_kg);

  const parqAns = (a.parq ?? {}) as Record<string, unknown>;
  const parqAnswered =
    Object.keys(parqAns).length > 0 &&
    Object.values(parqAns).every((v) => v === true || v === false);

  const goalOk = has(a.primary_goal) && has(a.smart_specific);

  const availabilityOk =
    has(a.training_days_per_week) && has(a.session_duration_minutes);

  const contextOk =
    has(a.training_location) && (a.available_equipment?.length ?? 0) > 0;

  const readinessSignalOk =
    has(a.readiness_stage) || has(a.sleep_quality) || has(a.stress_level);

  const required: BmvItem[] = [
    { key: "identity", label: "Sexo, data nascimento, altura e peso", sectionId: "anthro", ok: identityOk },
    { key: "parq", label: "PAR-Q respondido", sectionId: "parq", ok: parqAnswered },
    { key: "goal", label: "Objetivo principal e o que quer alcançar", sectionId: "goal", ok: goalOk },
    { key: "availability", label: "Dias por semana e duração da sessão", sectionId: "training", ok: availabilityOk },
    { key: "context", label: "Local de treino e equipamento disponível", sectionId: "training", ok: contextOk },
    { key: "readiness", label: "Um sinal de prontidão (sono, stress ou fase)", sectionId: "readiness", ok: readinessSignalOk },
  ];

  // ---------- Recomendados (não bloqueiam) ----------

  const hasSnap = (domain: string, tests: string[]) =>
    snaps.some(
      (s) =>
        s.domain_slug === domain &&
        s.test_used != null &&
        tests.includes(s.test_used) &&
        s.raw_value != null,
    );

  const compositionOk =
    has(a.waist_cm) ||
    has(a.body_fat_pct) ||
    hasSnap("body_composition", [
      "waist_circumference",
      "hip_circumference",
      "body_fat_bia",
      "body_fat_calipers",
      "body_fat_dexa",
      "body_fat_percent",
      "muscle_mass_pct",
      "visceral_fat",
    ]);

  const cardioOk =
    has(a.resting_heart_rate) ||
    has(a.systolic_bp_mmhg) ||
    hasSnap("autonomic_regulation", [
      "resting_heart_rate",
      "blood_pressure_systolic",
      "blood_pressure_diastolic",
    ]);

  const movementOk =
    has(a.squat_depth_score) ||
    has(a.hip_hinge_score) ||
    has(a.overhead_reach_score) ||
    has(a.single_leg_balance_score);

  const recommended: BmvItem[] = [
    { key: "composition", label: "Cintura ou % gordura (fita ou Tanita)", sectionId: "anthro", ok: compositionOk },
    { key: "cardio", label: "FC repouso ou tensão arterial", sectionId: "performance", ok: cardioOk },
    { key: "movement", label: "Pelo menos um movimento avaliado", sectionId: "screen", ok: movementOk },
  ];

  const missingRequired = required.filter((r) => !r.ok).length;
  const missingRecommended = recommended.filter((r) => !r.ok).length;
  const ready = missingRequired === 0;
  const confidence: BmvResult["confidence"] = !ready
    ? "blocked"
    : missingRecommended >= 2
      ? "lean"
      : "rich";

  return { required, recommended, missingRequired, missingRecommended, ready, confidence };
}
