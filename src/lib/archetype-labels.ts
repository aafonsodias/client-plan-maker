/**
 * Friendly display labels for the canonical session archetype ids the
 * blueprint engine emits. We keep the snake_case id in the database (the
 * engine uses it for dependency mapping inside Stage 3 prompts) but show
 * a human-readable label as the primary surface in the UI.
 *
 * Add new ids here as the engine's library grows; unknown ids fall back
 * to title-casing the snake_case id so the UI never reads as raw code.
 */
const PT_LABELS: Record<string, string> = {
  lower_quad_bias: "Inferior · Quadríceps",
  lower_hinge_bias: "Inferior · Posterior + glúteos",
  upper_push_core: "Superior · Empurrar + core",
  upper_pull_bias: "Superior · Puxar + bíceps",
  full_body_metab: "Corpo inteiro · Metabólico",
  full_body: "Corpo inteiro",
  upper_body: "Superior",
  lower_body: "Inferior",
  push: "Empurrar",
  pull: "Puxar",
  legs: "Pernas",
  conditioning: "Condicionamento",
};

const EN_LABELS: Record<string, string> = {
  lower_quad_bias: "Lower · Quad-biased",
  lower_hinge_bias: "Lower · Posterior chain",
  upper_push_core: "Upper · Push + core",
  upper_pull_bias: "Upper · Pull + biceps",
  full_body_metab: "Full body · Metabolic",
  full_body: "Full body",
  upper_body: "Upper body",
  lower_body: "Lower body",
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  conditioning: "Conditioning",
};

function titleCase(id: string): string {
  return id
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function archetypeLabel(id: string, locale: "pt" | "en" = "pt"): string {
  const map = locale === "pt" ? PT_LABELS : EN_LABELS;
  return map[id] ?? titleCase(id);
}