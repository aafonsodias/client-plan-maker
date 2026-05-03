import type { Tone } from "@/lib/status-tone";

export type Pack = {
  id: string;
  client_id: string;
  label: string;
  session_type: "in_person" | "online";
  price_per_session_eur: number;
  pack_size: number;
  sessions_used: number;
  weekly_frequency: number;
  start_date: string;
  color: string;
  archived: boolean;
};

export type Booking = {
  id: string;
  client_id: string;
  pack_id: string | null;
  starts_at: string;
  duration_min: number;
  session_type: "in_person" | "online";
  status: "scheduled" | "done" | "cancelled" | "no_show";
  notes: string | null;
};

export const PACK_COLORS = [
  "emerald",
  "amber",
  "blue",
  "violet",
  "rose",
  "cyan",
  "orange",
  "lime",
] as const;
export type PackColor = (typeof PACK_COLORS)[number];

/** Tailwind classes per palette color. Both themes legible. */
export const PACK_BLOCK: Record<string, { bg: string; ring: string; text: string; dot: string }> = {
  emerald: { bg: "bg-emerald-500/15", ring: "ring-emerald-500/40", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  amber:   { bg: "bg-amber-500/15",   ring: "ring-amber-500/40",   text: "text-amber-700 dark:text-amber-300",   dot: "bg-amber-500" },
  blue:    { bg: "bg-blue-500/15",    ring: "ring-blue-500/40",    text: "text-blue-700 dark:text-blue-300",    dot: "bg-blue-500" },
  violet:  { bg: "bg-violet-500/15",  ring: "ring-violet-500/40",  text: "text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
  rose:    { bg: "bg-rose-500/15",    ring: "ring-rose-500/40",    text: "text-rose-700 dark:text-rose-300",    dot: "bg-rose-500" },
  cyan:    { bg: "bg-cyan-500/15",    ring: "ring-cyan-500/40",    text: "text-cyan-700 dark:text-cyan-300",    dot: "bg-cyan-500" },
  orange:  { bg: "bg-orange-500/15",  ring: "ring-orange-500/40",  text: "text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  lime:    { bg: "bg-lime-500/15",    ring: "ring-lime-500/40",    text: "text-lime-700 dark:text-lime-300",    dot: "bg-lime-500" },
};

export function packBlockClasses(color: string) {
  return PACK_BLOCK[color] ?? PACK_BLOCK.emerald;
}

/** Returns Monday at 00:00 of the week containing `d`. */
export function startOfIsoWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const dow = out.getDay() || 7;
  out.setDate(out.getDate() - (dow - 1));
  return out;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function packStatus(p: Pack): { tone: Tone; key: "active" | "ending_soon" | "expired" } {
  const left = Math.max(0, p.pack_size - p.sessions_used);
  if (left <= 0) return { tone: "danger", key: "expired" };
  if (left <= 2) return { tone: "warn", key: "ending_soon" };
  return { tone: "success", key: "active" };
}

export function fmtWeekRange(monday: Date, locale = "pt-PT"): string {
  const sunday = addDays(monday, 6);
  const fmt = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" });
  return `${fmt.format(monday)} – ${fmt.format(sunday)}`;
}