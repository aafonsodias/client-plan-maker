import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * DOBField — three independent Day / Month / Year inputs that are
 * dramatically faster to fill than a native `<input type="date">` on mobile.
 *
 * Year is a plain numeric input (4 digits, e.g. "1994"), not a stepper —
 * the user types the year once instead of tapping a chevron 30 times.
 *
 * Emits an ISO date string ("YYYY-MM-DD") when all three parts form a
 * valid calendar date. Emits "" while still being filled.
 */
export function DOBField({
  value,
  onChange,
  className,
  autoFocus,
}: {
  value: string | null | undefined;
  onChange: (iso: string) => void;
  className?: string;
  autoFocus?: boolean;
}) {
  const parts = useMemo(() => splitISO(value ?? ""), [value]);
  const [d, setD] = useState(parts.d);
  const [m, setM] = useState(parts.m);
  const [y, setY] = useState(parts.y);

  // Re-sync when parent value changes externally.
  useEffect(() => {
    setD(parts.d);
    setM(parts.m);
    setY(parts.y);
  }, [parts.d, parts.m, parts.y]);

  const commit = (nd: string, nm: string, ny: string) => {
    const dn = parseInt(nd, 10);
    const mn = parseInt(nm, 10);
    const yn = parseInt(ny, 10);
    if (
      Number.isFinite(dn) && dn >= 1 && dn <= 31 &&
      Number.isFinite(mn) && mn >= 1 && mn <= 12 &&
      Number.isFinite(yn) && yn >= 1900 && yn <= 2100
    ) {
      const dt = new Date(Date.UTC(yn, mn - 1, dn));
      if (dt.getUTCDate() === dn && dt.getUTCMonth() === mn - 1) {
        onChange(`${String(yn).padStart(4, "0")}-${String(mn).padStart(2, "0")}-${String(dn).padStart(2, "0")}`);
        return;
      }
    }
    onChange("");
  };

  const cellCls =
    "h-10 rounded-md border border-input bg-transparent px-2 text-center text-base tabular-nums shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        placeholder="DD"
        autoFocus={autoFocus}
        value={d}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 2);
          setD(v);
          commit(v, m, y);
        }}
        aria-label="Dia"
        className={cn(cellCls, "w-14")}
      />
      <span className="text-muted-foreground/60">/</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        placeholder="MM"
        value={m}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 2);
          setM(v);
          commit(d, v, y);
        }}
        aria-label="Mês"
        className={cn(cellCls, "w-14")}
      />
      <span className="text-muted-foreground/60">/</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        placeholder="AAAA"
        value={y}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 4);
          setY(v);
          commit(d, m, v);
        }}
        aria-label="Ano"
        className={cn(cellCls, "w-20")}
      />
    </div>
  );
}

function splitISO(iso: string): { d: string; m: string; y: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!match) return { d: "", m: "", y: "" };
  return { y: match[1], m: match[2], d: match[3] };
}