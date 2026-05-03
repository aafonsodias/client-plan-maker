import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

/**
 * Pesa-papéis — calculadora de 1RM + plate math.
 * Client-only, zero backend. Princípio: instantâneo e legível.
 */

const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const LB_PLATES = [45, 35, 25, 10, 5, 2.5];

function platesPerSide(targetTotal: number, barWeight: number, available: number[]): number[] {
  let perSide = (targetTotal - barWeight) / 2;
  if (perSide <= 0) return [];
  const out: number[] = [];
  for (const p of available) {
    while (perSide + 1e-6 >= p) {
      out.push(p);
      perSide -= p;
    }
  }
  return out;
}

export function OneRepMaxCalculator() {
  const { t } = useTranslation("common");
  const [unit, setUnit] = useState<"kg" | "lb">("kg");
  const [weight, setWeight] = useState(80);
  const [reps, setReps] = useState(5);
  const [pct, setPct] = useState(75);

  const epley = useMemo(() => weight * (1 + reps / 30), [weight, reps]);
  const brzycki = useMemo(() => weight * (36 / (37 - reps)), [weight, reps]);
  const lombardi = useMemo(() => weight * Math.pow(reps, 0.10), [weight, reps]);
  const avg = useMemo(() => (epley + brzycki + lombardi) / 3, [epley, brzycki, lombardi]);

  const target = useMemo(() => (avg * pct) / 100, [avg, pct]);
  const barWeight = unit === "kg" ? 20 : 45;
  const plates = unit === "kg" ? KG_PLATES : LB_PLATES;
  const sidePlates = useMemo(
    () => platesPerSide(roundToPlate(target, unit), barWeight, plates),
    [target, barWeight, plates, unit],
  );
  const achievable = useMemo(
    () => barWeight + sidePlates.reduce((a, b) => a + b, 0) * 2,
    [sidePlates, barWeight],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">{t("calculator.title")}</h3>
        <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
          {(["kg", "lb"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={cn(
                "rounded px-2 py-0.5 font-mono uppercase",
                unit === u ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("calculator.load", { unit })}</Label>
          <Input
            type="number"
            inputMode="decimal"
            value={weight}
            min={0}
            step={unit === "kg" ? 2.5 : 5}
            onChange={(e) => setWeight(Number(e.target.value) || 0)}
            className="mt-1 font-mono"
          />
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("calculator.reps")}</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={reps}
            min={1}
            max={20}
            onChange={(e) => setReps(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
            className="mt-1 font-mono"
          />
        </div>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-transparent p-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-500/80">{t("calculator.estimated_1rm")}</p>
        <p className="mt-1 font-mono text-3xl font-light text-foreground">
          {avg.toFixed(1)} <span className="text-base text-muted-foreground">{unit}</span>
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
          <Cell label="Epley" v={epley} unit={unit} />
          <Cell label="Brzycki" v={brzycki} unit={unit} />
          <Cell label="Lombardi" v={lombardi} unit={unit} />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("calculator.pct_of_1rm")}</Label>
          <span className="font-mono text-xs text-foreground">{pct}%</span>
        </div>
        <Slider value={[pct]} min={30} max={100} step={5} onValueChange={(v) => setPct(v[0]!)} />
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">{t("calculator.target_load")}</span>
          <span className="font-mono text-xl text-foreground">
            {roundToPlate(target, unit).toFixed(unit === "kg" ? 1 : 0)} {unit}
          </span>
        </div>
      </div>

      <PlateRack plates={sidePlates} unit={unit} achievable={achievable} bar={barWeight} />
    </div>
  );
}

function Cell({ label, v, unit }: { label: string; v: number; unit: string }) {
  return (
    <div className="rounded border border-border/60 bg-background/40 p-2">
      <p className="font-medium text-foreground/70">{label}</p>
      <p className="mt-0.5 font-mono text-sm text-foreground">
        {v.toFixed(1)} {unit}
      </p>
    </div>
  );
}

function roundToPlate(v: number, unit: "kg" | "lb") {
  const inc = unit === "kg" ? 2.5 : 5;
  return Math.round(v / inc) * inc;
}

function PlateRack({
  plates,
  unit,
  achievable,
  bar,
}: {
  plates: number[];
  unit: "kg" | "lb";
  achievable: number;
  bar: number;
}) {
  const { t } = useTranslation("common");
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="mb-2 flex items-baseline justify-between text-[11px]">
        <span className="uppercase tracking-wider text-muted-foreground">{t("calculator.plates_per_side")}</span>
        <span className="font-mono text-foreground">
          {t("calculator.bar_summary", { bar, plates: achievable - bar, total: achievable, unit })}
        </span>
      </div>
      <div className="flex items-center justify-center gap-1 overflow-x-auto py-2">
        {plates.length === 0 ? (
          <span className="text-xs text-muted-foreground">{t("calculator.bar_only")}</span>
        ) : (
          plates.map((p, i) => (
            <div
              key={`${p}-${i}`}
              className="flex items-center justify-center rounded-sm border border-amber-500/40 bg-gradient-to-b from-amber-500/20 to-amber-600/10 font-mono text-[10px] font-bold text-amber-500"
              style={{
                height: 30 + Math.min(60, p * (unit === "kg" ? 2 : 1)),
                width: 14 + Math.min(20, p * (unit === "kg" ? 0.6 : 0.3)),
              }}
              title={`${p} ${unit}`}
            >
              {p}
            </div>
          ))
        )}
      </div>
    </div>
  );
}