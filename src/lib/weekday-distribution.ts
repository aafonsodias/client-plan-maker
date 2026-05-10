/**
 * Distribute N training sessions across the week.
 *
 * Returns an array of ISO weekdays (1=Mon … 7=Sun), one per session,
 * spaced for recovery. Examples:
 *   3 sessions → [1, 3, 5]   (Mon/Wed/Fri)
 *   4 sessions → [1, 2, 4, 5] (Mon/Tue/Thu/Fri)
 *   5 sessions → [1, 2, 3, 5, 6]
 *   2 sessions → [2, 5]      (Tue/Fri)
 *   6 sessions → [1, 2, 3, 4, 5, 6]
 *   7 sessions → [1, 2, 3, 4, 5, 6, 7]
 *   1 session  → [3]         (Wed — neutral)
 *
 * Hand-tuned table beats a generic spacing algorithm for ≤7 sessions:
 * trainers expect the "obvious" weekday split.
 */
const TABLE: Record<number, number[]> = {
  1: [3],
  2: [2, 5],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
  7: [1, 2, 3, 4, 5, 6, 7],
};

export function distributeWeekdays(sessionCount: number): number[] {
  const n = Math.max(1, Math.min(7, Math.round(sessionCount)));
  return TABLE[n] ?? [];
}

/** ISO day-of-week for a JS Date (1=Mon … 7=Sun). */
export function isoWeekday(d: Date): number {
  const dow = d.getDay(); // 0=Sun … 6=Sat
  return dow === 0 ? 7 : dow;
}
