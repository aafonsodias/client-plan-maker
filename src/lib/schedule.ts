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
  // Therapeutic palette — cool-dominant (sage/mist/ocean/moss),
  // muted warm accents (clay/wheat) and earth tones (stone/plum)
  // at low frequency. Order matters: earlier slots fire more often via
  // colorFromId hashing. See plan: healthcare colour study (cool-blue/
  // green dominant + muted warm accents + earth tones).
  "sage",
  "mist",
  "clay",
  "ocean",
  "wheat",
  "stone",
  "plum",
  "moss",
] as const;
export type PackColor = (typeof PACK_COLORS)[number];

/** Tailwind classes per palette colour.
 *
 * Text colour is intentionally `text-foreground` for every chip — the chip is
 * identified by its dot + ring + tint, not by the text hue. Combined with the
 * `label-on-tint` utility (added at call sites) this gives readable labels in
 * Dark / Slate / Cream without per-theme overrides. The fill uses /18 in dark
 * surfaces and /12 in light, both via the same `dark:` Tailwind variant.
 *
 * The colour names map to closest Tailwind hues:
 *   sage  → emerald (cool green)
 *   mist  → sky    (soft blue)
 *   clay  → orange (terracotta accent)
 *   ocean → teal   (deeper cool)
 *   wheat → amber  (muted warm)
 *   stone → stone  (warm grey-brown earth tone)
 *   plum  → fuchsia (desaturated mauve)
 *   moss  → green  (deep cool)
 */
export const PACK_BLOCK: Record<string, { bg: string; ring: string; text: string; dot: string }> = {
  sage:    { bg: "bg-emerald-500/12 dark:bg-emerald-500/20",  ring: "ring-emerald-500/45",  text: "text-foreground",                 dot: "bg-emerald-500" },
  mist:    { bg: "bg-sky-500/12 dark:bg-sky-500/20",          ring: "ring-sky-500/45",      text: "text-foreground",                 dot: "bg-sky-500" },
  clay:    { bg: "bg-orange-500/12 dark:bg-orange-500/20",    ring: "ring-orange-500/45",   text: "text-foreground",                 dot: "bg-orange-500" },
  ocean:   { bg: "bg-teal-500/12 dark:bg-teal-500/20",        ring: "ring-teal-500/45",     text: "text-foreground",                 dot: "bg-teal-500" },
  wheat:   { bg: "bg-amber-500/12 dark:bg-amber-500/20",      ring: "ring-amber-500/45",    text: "text-foreground",                 dot: "bg-amber-500" },
  stone:   { bg: "bg-stone-500/14 dark:bg-stone-400/22",      ring: "ring-stone-400/50",    text: "text-foreground",                 dot: "bg-stone-400" },
  plum:    { bg: "bg-fuchsia-500/12 dark:bg-fuchsia-500/20",  ring: "ring-fuchsia-500/45",  text: "text-foreground",                 dot: "bg-fuchsia-500" },
  moss:    { bg: "bg-green-700/14 dark:bg-green-500/22",      ring: "ring-green-600/45",    text: "text-foreground",                 dot: "bg-green-600" },

  // Legacy keys — anything stored in the DB before the rename keeps rendering.
  emerald: { bg: "bg-emerald-500/12 dark:bg-emerald-500/20",  ring: "ring-emerald-500/45",  text: "text-foreground", dot: "bg-emerald-500" },
  amber:   { bg: "bg-amber-500/12 dark:bg-amber-500/20",      ring: "ring-amber-500/45",    text: "text-foreground", dot: "bg-amber-500" },
  blue:    { bg: "bg-sky-500/12 dark:bg-sky-500/20",          ring: "ring-sky-500/45",      text: "text-foreground", dot: "bg-sky-500" },
  violet:  { bg: "bg-fuchsia-500/12 dark:bg-fuchsia-500/20",  ring: "ring-fuchsia-500/45",  text: "text-foreground", dot: "bg-fuchsia-500" },
  rose:    { bg: "bg-orange-500/12 dark:bg-orange-500/20",    ring: "ring-orange-500/45",   text: "text-foreground", dot: "bg-orange-500" },
  cyan:    { bg: "bg-teal-500/12 dark:bg-teal-500/20",        ring: "ring-teal-500/45",     text: "text-foreground", dot: "bg-teal-500" },
  orange:  { bg: "bg-orange-500/12 dark:bg-orange-500/20",    ring: "ring-orange-500/45",   text: "text-foreground", dot: "bg-orange-500" },
  lime:    { bg: "bg-green-700/14 dark:bg-green-500/22",      ring: "ring-green-600/45",    text: "text-foreground", dot: "bg-green-600" },
};

export function packBlockClasses(color: string) {
  return PACK_BLOCK[color] ?? PACK_BLOCK.sage;
}

/** Stable color picked from PACK_COLORS for a given client id (when no explicit color set). */
export function colorFromId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return PACK_COLORS[Math.abs(h) % PACK_COLORS.length];
}

/** Resolve the display color for a client. The client's stored `color` wins;
 *  fallback is a stable hash-derived pick so the same client always renders
 *  in the same colour even before a migration backfill runs. */
export function clientColor(client?: { id: string; color?: string | null } | null, fallbackPack?: string | null): string {
  if (client?.color) return client.color;
  if (fallbackPack) return fallbackPack;
  if (client?.id) return colorFromId(client.id);
  return "emerald";
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