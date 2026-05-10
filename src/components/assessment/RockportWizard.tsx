import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/**
 * Round D · Bug 4 — Rockport 1-mile walk test wizard.
 *
 * Computes VO₂max via the Rockport formula:
 *   VO₂max (ml/kg/min) =
 *     132.853
 *     - 0.0769 × weight_lbs
 *     - 0.3877 × age
 *     + 6.315 × sex   (1 = male, 0 = female)
 *     - 3.2649 × time_min
 *     - 0.1565 × HR
 *
 * Reads weight/age/sex from props (from the assessment + client). Asks
 * for walk time (mm:ss) and post-walk HR. Writes a single human-readable
 * string into `value` so the existing `ext_cardio_value` field remains
 * the source of truth.
 */
export function RockportWizard({
  weightKg,
  age,
  sex,
  value,
  onChange,
}: {
  weightKg: number | null | undefined;
  age: number | null | undefined;
  sex: "male" | "female" | string | null | undefined;
  value: string | null | undefined;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation("assessment");
  const [mm, setMm] = useState<string>("");
  const [ss, setSs] = useState<string>("");
  const [hr, setHr] = useState<string>("");

  const computed = useMemo(() => {
    const w = Number(weightKg);
    const a = Number(age);
    const m = Number(mm);
    const s = Number(ss);
    const h = Number(hr);
    if (!isFinite(w) || w <= 0) return null;
    if (!isFinite(a) || a <= 0) return null;
    if (!isFinite(m) || m <= 0) return null;
    if (!isFinite(s) || s < 0 || s >= 60) return null;
    if (!isFinite(h) || h <= 0) return null;
    const sexCoef = String(sex).toLowerCase().startsWith("m") ? 1 : 0;
    const weightLbs = w * 2.20462;
    const timeMin = m + s / 60;
    const vo2 =
      132.853 -
      0.0769 * weightLbs -
      0.3877 * a +
      6.315 * sexCoef -
      3.2649 * timeMin -
      0.1565 * h;
    if (!isFinite(vo2)) return null;
    return { vo2: Math.max(0, vo2), timeMin, m, s, h };
  }, [weightKg, age, sex, mm, ss, hr]);

  function classify(vo2: number): { key: string; tone: string } {
    // ACSM age-adjusted bands (rough, sex-neutral floor for MVP):
    if (vo2 >= 50) return { key: "excellent", tone: "text-emerald-500" };
    if (vo2 >= 42) return { key: "good", tone: "text-emerald-400" };
    if (vo2 >= 35) return { key: "fair", tone: "text-amber-400" };
    return { key: "poor", tone: "text-red-400" };
  }

  const apply = () => {
    if (!computed) return;
    const cls = classify(computed.vo2);
    const cat = t(`performance_block.rockport_band.${cls.key}` as never) as string;
    const txt = `VO₂max ${computed.vo2.toFixed(1)} ml/kg/min · ${pad(computed.m)}:${pad(computed.s)} · HR ${computed.h} · ${cat}`;
    onChange(txt);
  };

  const ignore = () => onChange("");

  const sexLabel = sex
    ? String(sex).toLowerCase().startsWith("m")
      ? t("performance_block.rockport_sex_male")
      : t("performance_block.rockport_sex_female")
    : "—";

  const missingPrereq = !weightKg || !age || !sex;

  return (
    <div className="sm:col-span-2 space-y-3 rounded-md border border-border/60 bg-muted/15 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="label-caps text-[10px] text-muted-foreground">
            {t("performance_block.rockport_title")}
          </p>
          <p className="body-prose text-[11px] text-muted-foreground">
            {t("performance_block.rockport_protocol")}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={ignore}>
          {t("performance_block.rockport_ignore")}
        </Button>
      </div>

      <div className="rounded-md bg-background/50 px-2.5 py-1.5 text-[11px] text-muted-foreground">
        {missingPrereq ? (
          <span className="text-amber-400">
            {t("performance_block.rockport_missing_prereq")}
          </span>
        ) : (
          <span>
            {t("performance_block.rockport_prereq", {
              weight: Number(weightKg).toFixed(0),
              age: Number(age).toFixed(0),
              sex: sexLabel,
            })}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="label-caps text-[10px] text-muted-foreground">
            {t("performance_block.rockport_minutes")}
          </Label>
          <Input
            inputMode="numeric"
            type="number"
            min={5}
            max={30}
            value={mm}
            onChange={(e) => setMm(e.target.value)}
            className="h-8 text-sm tabular-nums"
            placeholder="14"
          />
        </div>
        <div className="space-y-1">
          <Label className="label-caps text-[10px] text-muted-foreground">
            {t("performance_block.rockport_seconds")}
          </Label>
          <Input
            inputMode="numeric"
            type="number"
            min={0}
            max={59}
            value={ss}
            onChange={(e) => setSs(e.target.value)}
            className="h-8 text-sm tabular-nums"
            placeholder="22"
          />
        </div>
        <div className="space-y-1">
          <Label className="label-caps text-[10px] text-muted-foreground">
            {t("performance_block.rockport_hr")}
          </Label>
          <Input
            inputMode="numeric"
            type="number"
            min={50}
            max={220}
            value={hr}
            onChange={(e) => setHr(e.target.value)}
            className="h-8 text-sm tabular-nums"
            placeholder="142"
          />
        </div>
      </div>

      {computed && (
        <div className="flex items-center justify-between rounded-md bg-background/50 px-3 py-2">
          <div>
            <p className="label-caps text-[10px] text-muted-foreground">
              {t("performance_block.rockport_result")}
            </p>
            <p className={`text-sm font-semibold tabular-nums ${classify(computed.vo2).tone}`}>
              VO₂max {computed.vo2.toFixed(1)}{" "}
              <span className="text-muted-foreground font-normal">ml/kg/min</span>
              <span className="ml-2 text-xs text-muted-foreground">
                · {t(`performance_block.rockport_band.${classify(computed.vo2).key}` as never) as string}
              </span>
            </p>
          </div>
          <Button type="button" size="sm" onClick={apply}>
            {t("performance_block.rockport_apply")}
          </Button>
        </div>
      )}

      {value && (
        <p className="rounded-md bg-emerald-500/[0.06] px-2.5 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
          {value}
        </p>
      )}
    </div>
  );
}

function pad(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}