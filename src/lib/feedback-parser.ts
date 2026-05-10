/**
 * feedback-parser — extracts deterministic Cockpit overrides from trainer
 * free-text feedback in the Regenerate dialog.
 *
 * Why: trainers write things like "começa em rpe 6.5" or "cap RPE at 7" and
 * expect the next plan to honour it. Before this helper, the text was dumped
 * verbatim into the prompt and the model decided whether to comply. Now we
 * parse it deterministically and override `programming_variables.rpe_ceiling`
 * (and optionally rpe_floor) before sending to the AI.
 *
 * Heuristic: scan the text for numeric RPE references and pick the LAST one as
 * the ceiling — trainers tend to refine ("rpe 9 mas cap em 7" → 7). If a range
 * is given ("rpe 6-7"), the higher bound is the ceiling, the lower is the
 * floor. Recognises PT and EN.
 */

export type FeedbackOverride = {
  rpe_ceiling?: number;
  rpe_floor?: number;
};

const RANGE_RE = /\brpe\s*(?:de\s*)?(\d{1,2}(?:[.,]\d)?)\s*[-–a]\s*(\d{1,2}(?:[.,]\d)?)/gi;
const SINGLE_RE = /\b(?:rpe|tecto|ceiling|cap(?:ped)?(?:\s*at)?|m[aá]ximo|max)\s*(?:de|em|at|to|=|:)?\s*(\d{1,2}(?:[.,]\d)?)/gi;

function num(raw: string): number | null {
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  // Accept 5.0–10.0 only — RPE scale.
  if (n < 4 || n > 10) return null;
  return Math.round(n * 10) / 10;
}

export function parseRpeOverrideFromFeedback(text: string | null | undefined): FeedbackOverride | null {
  if (!text) return null;
  const t = text.toLowerCase();

  let ceiling: number | null = null;
  let floor: number | null = null;

  // Ranges win over singles when present — they encode both ends explicitly.
  const rangeMatches = [...t.matchAll(RANGE_RE)];
  if (rangeMatches.length) {
    const last = rangeMatches[rangeMatches.length - 1];
    const a = num(last[1]);
    const b = num(last[2]);
    if (a !== null && b !== null) {
      floor = Math.min(a, b);
      ceiling = Math.max(a, b);
    }
  }

  if (ceiling === null) {
    const singleMatches = [...t.matchAll(SINGLE_RE)];
    if (singleMatches.length) {
      const last = singleMatches[singleMatches.length - 1];
      const v = num(last[1]);
      if (v !== null) ceiling = v;
    }
  }

  if (ceiling === null && floor === null) return null;

  // Clamp to schema bounds (rpe_ceiling: 7.5–10).
  const out: FeedbackOverride = {};
  if (ceiling !== null) out.rpe_ceiling = Math.min(10, Math.max(7.5, ceiling));
  if (floor !== null) out.rpe_floor = Math.min(9.5, Math.max(5, floor));
  return out;
}
