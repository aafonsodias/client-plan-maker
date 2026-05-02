/**
 * Persona-aware feedback templates for demo bots.
 * Used by demo-sessions to make logged sessions feel like real clients used the app:
 * a question, a complaint, or a stress signal pulled from their archetype.
 *
 * Keys are loose strings — anything not in the map falls back to "default".
 */

export type FeedbackKind = "question" | "complaint" | "stress";

export type FeedbackEntry = {
  kind: FeedbackKind;
  text: string;
};

const TEMPLATES: Record<string, FeedbackEntry[]> = {
  cardiac_rehab: [
    { kind: "complaint", text: "Senti aperto no peito a meio da sessão. Parei e respirei, passou em 1 min." },
    { kind: "question", text: "Posso fazer cardio em jejum ou é melhor comer antes?" },
    { kind: "stress", text: "Dormi 5h, hoje a sessão custou-me mais. RPE subjectivo +1." },
  ],
  hypertensive: [
    { kind: "complaint", text: "Tonturas ao levantar do banco. Fiquei sentado 1 min antes de continuar." },
    { kind: "question", text: "Devo medir a tensão antes ou depois do treino?" },
    { kind: "stress", text: "Cefaleia ligeira após a última série. Bebi água, melhorou." },
  ],
  powerlifter: [
    { kind: "complaint", text: "Cotovelo direito a queixar-se no bench. Termino a série mas RPE 9." },
    { kind: "question", text: "Posso trocar low-bar por safety bar esta semana?" },
    { kind: "stress", text: "Última série de squats falhei rep 3, RPE 10. Carga ficou pesada hoje." },
  ],
  hypertrophy: [
    { kind: "complaint", text: "DOMS forte nos peitorais 48h depois. Próxima sessão posso reduzir volume?" },
    { kind: "question", text: "Faz sentido fazer drop sets na última série?" },
    { kind: "stress", text: "Trabalhei 12h, cheguei sem energia. Mantive sets mas RPE +1." },
  ],
  beginner_general: [
    { kind: "question", text: "Não percebi bem a diferença entre RPE 7 e 8. Podes explicar?" },
    { kind: "complaint", text: "O agachamento ainda não me sai natural, sinto desequilíbrio à frente." },
    { kind: "stress", text: "Esta semana foi cheia, hoje custou começar." },
  ],
  postpartum: [
    { kind: "complaint", text: "Notei pequena perda urinária no último set de prancha. Devo ajustar?" },
    { kind: "question", text: "Posso já voltar a cargas mais altas no agachamento?" },
    { kind: "stress", text: "Bebé acordou várias vezes esta noite. Sessão sentida mais pesada." },
  ],
  default: [
    { kind: "question", text: "Posso trocar este exercício por uma alternativa? Não me sinto confortável." },
    { kind: "complaint", text: "Última série não consegui acabar, RPE 10." },
    { kind: "stress", text: "Dormi mal, sessão pesada." },
  ],
};

/** Returns one feedback entry roughly 1 in N times (default 1 in 3). Deterministic via seed. */
export function maybePersonaFeedback(
  archetype: string | null | undefined,
  seed: number,
  oddsDenominator = 3,
): FeedbackEntry | null {
  // Cheap deterministic PRNG so the same (plan, week, day) replays the same answer.
  const r = Math.abs(Math.sin(seed) * 10000) % 1;
  if (r > 1 / oddsDenominator) return null;
  const key = (archetype && TEMPLATES[archetype]) ? archetype : "default";
  const list = TEMPLATES[key]!;
  const idx = Math.floor(r * oddsDenominator * list.length) % list.length;
  return list[idx];
}

/**
 * RPE + load progression profile per persona.
 * - base: starting RPE in W1
 * - delta: weekly increase (clamped at cap; deload subtracts 1.0)
 * - cap: ceiling RPE the bot will not exceed
 * - loadDelta: kg added per week to non-cardio lifts
 * - loadBase: starting load in W1 (kg)
 * - tone: short note flavor injected into session_notes
 */
export type RpeProfile = {
  base: number;
  delta: number;
  cap: number;
  loadBase: number;
  loadDelta: number;
  tone: string;
};

const RPE_PROFILES: Record<string, RpeProfile> = {
  postpartum:     { base: 5.0, delta: 0.20, cap: 7.5, loadBase: 12, loadDelta: 1.5, tone: "Sessão calma, foco em técnica e core profundo." },
  hypertensive:   { base: 5.0, delta: 0.15, cap: 7.0, loadBase: 14, loadDelta: 1.5, tone: "RPE controlado, evitar Valsalva." },
  cardiac_rehab:  { base: 4.5, delta: 0.15, cap: 6.5, loadBase: 10, loadDelta: 1.0, tone: "Conservador, monitorizar resposta cardiovascular." },
  beginner_general: { base: 5.5, delta: 0.25, cap: 7.5, loadBase: 16, loadDelta: 2.0, tone: "Aprender o padrão antes de subir carga." },
  hypertrophy:    { base: 6.5, delta: 0.30, cap: 9.0, loadBase: 22, loadDelta: 3.0, tone: "Sensação boa, bombei a série final." },
  powerlifter:    { base: 7.0, delta: 0.40, cap: 9.5, loadBase: 60, loadDelta: 5.0, tone: "Top set sentido, RPE pesado mas técnica firme." },
  default:        { base: 6.0, delta: 0.30, cap: 9.0, loadBase: 20, loadDelta: 2.5, tone: "Boa execução. Subida ligeira de carga." },
};

export function getRpeProfile(archetype: string | null | undefined): RpeProfile {
  if (archetype && RPE_PROFILES[archetype]) return RPE_PROFILES[archetype]!;
  return RPE_PROFILES.default!;
}

/** Compute the prescribed RPE for week N (1-based). Always monotonic up to cap; deload subtracts 1.0. */
export function rpeForWeek(profile: RpeProfile, weekNumber: number, isDeload = false): number {
  const raw = profile.base + Math.max(0, weekNumber - 1) * profile.delta;
  const capped = Math.min(profile.cap, raw);
  const final = isDeload ? Math.max(profile.base - 0.5, capped - 1.0) : capped;
  return Math.round(final * 10) / 10;
}

export function loadForWeek(profile: RpeProfile, weekNumber: number, isDeload = false): number {
  const raw = profile.loadBase + Math.max(0, weekNumber - 1) * profile.loadDelta;
  const final = isDeload ? raw * 0.85 : raw;
  return Math.round(final * 10) / 10;
}