/**
 * Deterministic, brief-driven plan summary.
 *
 * Single source of truth used by:
 *  - stage5-bulkfill (when finalizing a phased plan)
 *  - regeneratePlanSummary server fn (one-shot rewrite for legacy / leaked plans)
 *
 * NEVER call AI here. The whole point is to be honest, predictable and free of
 * meta-leakage from internal stage prompts ("Sem análises por secção…").
 */

const goalLabel: Record<string, string> = {
  hypertrophy: "hipertrofia",
  strength: "força",
  conditioning: "condição física",
  mixed: "misto força + condição",
  fat_loss: "perda de gordura",
  general: "preparação geral",
};

const ageLabel: Record<string, string> = {
  beginner: "iniciante",
  intermediate: "intermédio",
  advanced: "avançado",
};

const appetiteLabel: Record<string, string> = {
  conservador: "RPE 5→6→6.5 (deload W4)",
  padrao: "RPE 6→7→7.5 (deload W4)",
  agressivo: "RPE 7→8→8.5 (deload W4)",
};

export function buildDeterministicSummary(
  brief: any,
  weeks: number,
): string {
  const goal = goalLabel[brief?.primary_goal] ?? "preparação geral";
  const age = ageLabel[brief?.training_age_band] ?? "";
  const sessions = brief?.sessions_per_week?.recommended ?? 3;
  const appetite = brief?.intensity_appetite ?? "padrao";
  const wave = appetiteLabel[appetite] ?? appetiteLabel.padrao;
  const flagBit =
    Array.isArray(brief?.red_flags) && brief.red_flags.length > 0
      ? ` Acomodações activas: ${brief.red_flags.slice(0, 2).join("; ")}.`
      : "";
  return `Mesociclo de ${weeks} semanas, ${sessions}× por semana, focado em ${goal}${age ? ` (perfil ${age})` : ""}. Onda de intensidade ${wave}; semana 4 reduz volume/RPE para recuperar.${flagBit}`.trim();
}

/**
 * Heuristic: detects summaries that leaked internal AI meta-commentary or
 * were left empty. Used to decide whether `regeneratePlanSummary` should
 * overwrite an existing summary by default.
 */
const LEAK_MARKERS = [
  "sem análises por secção",
  "notes_for_next_stage",
  "stage hint",
  "internal note",
  "tbd",
  "lorem ipsum",
];

export function summaryLooksLeaked(summary: string | null | undefined): boolean {
  const s = (summary ?? "").toString().trim().toLowerCase();
  if (!s) return true;
  return LEAK_MARKERS.some((m) => s.includes(m));
}