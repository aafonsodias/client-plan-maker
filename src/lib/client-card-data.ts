// Pure helpers for the dashboard player card.
// Keep math here so the component stays presentational.

export type CardPlan = {
  id: string;
  title: string | null;
  status: string;
  duration_weeks: number | null;
  block_number: number | null;
  block_transition_summary: string | null;
  generation_status: string | null;
  created_at: string;
  updated_at: string;
};

export type CardLog = {
  session_date: string; // ISO date
  week_number: number | null;
};

/** Pull a short focus phrase from the plan: prefer the transition summary,
 *  fall back to the title, fall back to null. Trim to ~28 chars for the chip. */
export function planFocus(plan: CardPlan | null): string | null {
  if (!plan) return null;
  const raw = (plan.block_transition_summary || plan.title || "").trim();
  if (!raw) return null;
  // Strip "Bloco N — " / "Block N — " prefixes if present so we don't double-up.
  const cleaned = raw.replace(/^(Bloco|Block)\s+\d+\s*[—–\-:·]\s*/i, "").trim();
  if (!cleaned) return null;
  return cleaned.length > 32 ? cleaned.slice(0, 30).trimEnd() + "…" : cleaned;
}

/** Days since the most recent log; Infinity if never. */
export function daysSinceLog(log: CardLog | null): number {
  if (!log) return Infinity;
  const t = new Date(log.session_date).getTime();
  if (Number.isNaN(t)) return Infinity;
  return Math.floor((Date.now() - t) / 86400000);
}

/** Localised "há 2 dias" / "2 days ago" / "hoje" / "ontem". */
export function formatRelativeDays(days: number, lang: "pt" | "en"): string {
  if (!Number.isFinite(days)) return lang === "pt" ? "—" : "—";
  if (days <= 0) return lang === "pt" ? "hoje" : "today";
  if (days === 1) return lang === "pt" ? "ontem" : "yesterday";
  return lang === "pt" ? `há ${days} dias` : `${days} days ago`;
}

/** Current week of the plan, computed from the highest week_number logged.
 *  Falls back to 1 if a plan exists but nothing logged yet. */
export function currentWeek(plan: CardPlan | null, logs: CardLog[]): number | null {
  if (!plan) return null;
  let max = 0;
  for (const l of logs) if ((l.week_number ?? 0) > max) max = l.week_number ?? 0;
  return Math.max(1, max);
}