/**
 * Curated portrait pool for demo clients.
 *
 * The randomuser.me CDN serves stable, royalty-free portraits without an
 * API key — perfect for instant demos. We pick deterministically from the
 * persona's archetype + name so the same name always gets the same face,
 * which makes the leaderboard / list views feel "real".
 *
 * Update: we use the `images.cdn` paths directly (not the API) so the URLs
 * stay stable across reseeds and never need a network round-trip just to
 * resolve.
 */

const FEMALE_PORTRAITS: string[] = [
  "https://randomuser.me/api/portraits/women/12.jpg",
  "https://randomuser.me/api/portraits/women/24.jpg",
  "https://randomuser.me/api/portraits/women/33.jpg",
  "https://randomuser.me/api/portraits/women/41.jpg",
  "https://randomuser.me/api/portraits/women/55.jpg",
  "https://randomuser.me/api/portraits/women/63.jpg",
  "https://randomuser.me/api/portraits/women/68.jpg",
  "https://randomuser.me/api/portraits/women/72.jpg",
  "https://randomuser.me/api/portraits/women/79.jpg",
  "https://randomuser.me/api/portraits/women/85.jpg",
];

const MALE_PORTRAITS: string[] = [
  "https://randomuser.me/api/portraits/men/3.jpg",
  "https://randomuser.me/api/portraits/men/14.jpg",
  "https://randomuser.me/api/portraits/men/22.jpg",
  "https://randomuser.me/api/portraits/men/31.jpg",
  "https://randomuser.me/api/portraits/men/45.jpg",
  "https://randomuser.me/api/portraits/men/52.jpg",
  "https://randomuser.me/api/portraits/men/61.jpg",
  "https://randomuser.me/api/portraits/men/67.jpg",
  "https://randomuser.me/api/portraits/men/74.jpg",
  "https://randomuser.me/api/portraits/men/83.jpg",
];

/** Stable hash for deterministic picking (FNV-1a 32-bit). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Deterministically pick a portrait for a demo client.
 * Same (sex, archetype, fullName) always returns the same URL.
 */
export function pickDemoAvatar(opts: {
  sex: "male" | "female";
  archetype: string;
  fullName: string;
}): string {
  const pool = opts.sex === "female" ? FEMALE_PORTRAITS : MALE_PORTRAITS;
  const idx = hash(`${opts.archetype}::${opts.fullName}`) % pool.length;
  return pool[idx];
}