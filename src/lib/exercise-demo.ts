/**
 * Build a YouTube search URL for an exercise demo.
 * Strategy: search query, not a specific video — avoids broken links and
 * lets the client pick a familiar coach. Zero API key required.
 */
export function exerciseDemoUrl(exerciseName: string): string | null {
  const cleaned = exerciseName?.trim();
  if (!cleaned || cleaned.length < 2) return null;
  const q = encodeURIComponent(`${cleaned} exercise technique`);
  return `https://www.youtube.com/results?search_query=${q}`;
}