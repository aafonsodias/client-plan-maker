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