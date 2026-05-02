// Display-only currency helpers. EUR is the source of truth; USD and BTC are
// fetched from public, no-key endpoints and cached for 24h in localStorage.
// We never block render on the network call — fallbacks are used immediately
// while the fresh rate is fetched in the background.

export type CurrencyCode = "EUR" | "USD" | "BTC";

export const CURRENCIES: { code: CurrencyCode; label: string; symbol: string }[] = [
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "BTC", label: "Bitcoin", symbol: "₿" },
];

type RateCache = {
  usdPerEur: number;
  btcPerEur: number;
  fetchedAt: number;
};

const CACHE_KEY = "forge.fx.v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Conservative fallbacks if the network is unreachable.
const FALLBACK: RateCache = {
  usdPerEur: 1.08,
  btcPerEur: 1 / 60_000, // ~ 60k EUR per BTC
  fetchedAt: 0,
};

function readCache(): RateCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RateCache;
    if (typeof parsed?.usdPerEur !== "number" || typeof parsed?.btcPerEur !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(rates: RateCache) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rates));
  } catch {
    /* quota or private mode — ignore */
  }
}

let inflight: Promise<RateCache> | null = null;

export async function fetchRates(force = false): Promise<RateCache> {
  const cached = readCache();
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const [usdRes, btcRes] = await Promise.all([
        fetch("https://api.frankfurter.app/latest?from=EUR&to=USD"),
        fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur"),
      ]);
      const usdJson = (await usdRes.json()) as { rates?: { USD?: number } };
      const btcJson = (await btcRes.json()) as { bitcoin?: { eur?: number } };
      const usdPerEur = usdJson?.rates?.USD ?? FALLBACK.usdPerEur;
      const eurPerBtc = btcJson?.bitcoin?.eur ?? 1 / FALLBACK.btcPerEur;
      const next: RateCache = {
        usdPerEur,
        btcPerEur: eurPerBtc > 0 ? 1 / eurPerBtc : FALLBACK.btcPerEur,
        fetchedAt: Date.now(),
      };
      writeCache(next);
      return next;
    } catch {
      return cached ?? FALLBACK;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function getCachedRates(): RateCache {
  return readCache() ?? FALLBACK;
}

export function convertFromEur(eur: number, code: CurrencyCode, rates: RateCache): number {
  if (code === "EUR") return eur;
  if (code === "USD") return eur * rates.usdPerEur;
  return eur * rates.btcPerEur;
}

export function formatPrice(eur: number, code: CurrencyCode, rates: RateCache): string {
  const value = convertFromEur(eur, code, rates);
  if (code === "EUR") {
    return Number.isInteger(value) ? `${value}€` : `${value.toFixed(2)}€`;
  }
  if (code === "USD") {
    return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
  }
  // BTC: show as small fraction. Free price (0) stays clean.
  if (value === 0) return "0 ₿";
  // 6 decimals is enough resolution for a $19 price (~ 0.0003 BTC).
  return `≈ ${value.toFixed(6)} ₿`;
}