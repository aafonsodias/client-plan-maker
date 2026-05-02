import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CURRENCIES, fetchRates, getCachedRates, type CurrencyCode } from "@/lib/currency";

type CurrencyState = {
  code: CurrencyCode;
  setCode: (code: CurrencyCode) => void;
  rates: ReturnType<typeof getCachedRates>;
};

const CurrencyContext = createContext<CurrencyState | null>(null);

const STORAGE_KEY = "forge.currency.v1";

function detectDefault(): CurrencyCode {
  if (typeof navigator === "undefined") return "EUR";
  const lang = navigator.language?.toLowerCase() ?? "";
  // EUR for European locales, USD elsewhere. Crude but good enough.
  if (/^(pt|es|fr|de|it|nl|pl|sv|fi|el|ga|hr|sk|sl|cs|da|et|hu|lv|lt|lb|mt|ro|bg)\b/.test(lang)) return "EUR";
  if (lang.startsWith("en-gb") || lang.startsWith("en-ie")) return "EUR";
  return "USD";
}

function readStored(): CurrencyCode | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && CURRENCIES.some((c) => c.code === v)) return v as CurrencyCode;
  } catch { /* ignore */ }
  return null;
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  // SSR renders with EUR (no localStorage / navigator). To avoid React
  // hydration mismatches, the FIRST client render MUST also use EUR; we
  // only switch to the persisted/auto-detected currency in a useEffect
  // after hydration. Same pattern as i18n (lng = "en" until hydrated).
  const [code, setCodeState] = useState<CurrencyCode>("EUR");
  const [rates, setRates] = useState(() => getCachedRates());

  useEffect(() => {
    const next = readStored() ?? detectDefault();
    if (next !== "EUR") setCodeState(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchRates().then((r) => { if (!cancelled) setRates(r); });
    return () => { cancelled = true; };
  }, []);

  const setCode = (next: CurrencyCode) => {
    setCodeState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  };

  const value = useMemo<CurrencyState>(() => ({ code, setCode, rates }), [code, rates]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyState {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    // Safe fallback so non-wrapped pages don't crash during SSR / tests.
    return { code: "EUR", setCode: () => {}, rates: getCachedRates() };
  }
  return ctx;
}