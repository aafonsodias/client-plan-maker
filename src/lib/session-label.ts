/**
 * Periodization-aware session label normaliser.
 *
 * Data in `workout_plan_days.day_label` is messy: AI returns variants like
 * "Day 1", "Day 1: Squat & Push", "Week 3, Day 4: Total Body", etc. The
 * product's vocabulary is Bloco (mesocycle) / Semana (microcycle) / Sessão
 * (single workout), so the UI should always read "Sessão N · <Focus>" in
 * PT and "Session N · <Focus>" in EN, regardless of how the row was stored.
 *
 * Pure function — no React, no i18n runtime dep. Pass the resolved locale.
 */
export function formatSessionLabel(
  rawLabel: string | null | undefined,
  /** 0-based index of this session within its week. */
  indexInWeek: number,
  locale?: string | null,
): { sessionLabel: string; focus: string | null } {
  const isPt = !locale || /^pt/i.test(String(locale));
  const sessionWord = isPt ? "Sessão" : "Session";
  const n = indexInWeek + 1;

  const raw = (rawLabel ?? "").trim();
  // Strip leading "Week N", "Semana N", "Day N" prefixes and any combination
  // thereof, plus separators (:, —, –, -, ·).
  let focus = raw
    .replace(/^\s*(week|semana)\s*\d+\s*[,·:\-–—]?\s*/i, "")
    .replace(/^\s*(day|dia|sess[ãa]o|session)\s*\d+(\s*of\s*\d+)?\s*(\(\s*(week|semana)\s*\d+\s*\))?\s*[,·:\-–—]?\s*/i, "")
    .replace(/^\s*[—–\-:·]\s*/, "")
    .trim();

  // If what's left is itself junk like "Week 1", drop it.
  if (/^\s*(week|semana)\s*\d+\s*$/i.test(focus)) focus = "";

  return {
    sessionLabel: `${sessionWord} ${n}`,
    focus: focus || null,
  };
}

/** Convenience: returns the joined display string `Sessão N · Focus`. */
export function joinedSessionLabel(
  rawLabel: string | null | undefined,
  indexInWeek: number,
  locale?: string | null,
): string {
  const { sessionLabel, focus } = formatSessionLabel(rawLabel, indexInWeek, locale);
  return focus ? `${sessionLabel} · ${focus}` : sessionLabel;
}