/** Tiny birthday helpers — pure, no deps. */
export function daysUntilBirthday(dob: string | null | undefined, today = new Date()): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  if (!m || !d) return null;
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let next = new Date(today.getFullYear(), m - 1, d);
  if (next < t) next = new Date(today.getFullYear() + 1, m - 1, d);
  return Math.round((next.getTime() - t.getTime()) / 86400000);
}

export function turningAge(dob: string | null | undefined, today = new Date()): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  if (!y || !m || !d) return null;
  const next = new Date(today.getFullYear(), m - 1, d);
  const yr = next < new Date(today.getFullYear(), today.getMonth(), today.getDate())
    ? today.getFullYear() + 1
    : today.getFullYear();
  return yr - y;
}