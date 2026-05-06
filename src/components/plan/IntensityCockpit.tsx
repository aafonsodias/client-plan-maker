import { Gauge, Waves, Scale, Repeat, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import type { ProgrammingVariables } from "@/server/phased/schemas";
import {
  COCKPIT_PRESETS,
  matchesPreset,
  type CockpitPreset,
} from "./CockpitPresets";
import RationaleChip from "@/components/ux/RationaleChip";
import { inferCockpitPreset } from "@/lib/auto-infer";

/**
 * R64 — Intensity Cockpit. Five knobs + six presets, the only surface where a
 * coach modulates how the deterministic engine progresses.
 *
 * - Wave model (volante)            — shape of weekly load
 * - RPE ceiling (limitador)         — hard cap on RPE
 * - Intensity/Volume (caixa)        — load vs reps/sets weighting
 * - Deload frequency (suspensão)    — every N weeks (3–6)
 * - Autoregulation (ABS)            — how strict to react to overshot RPE
 *
 * Presets snap all 5 knobs at once. Any manual change flips preset → "custom".
 */
export default function IntensityCockpit({
  value,
  onChange,
  disabled = false,
  compact = false,
  primaryGoal,
}: {
  value: ProgrammingVariables;
  onChange: (next: ProgrammingVariables) => void;
  disabled?: boolean;
  compact?: boolean;
  primaryGoal?: string;
}) {
  const { t } = useTranslation("plan");
  const apply = (patch: Partial<ProgrammingVariables>) => {
    const next = { ...value, ...patch, cockpit_preset: "custom" as CockpitPreset };
    onChange(next);
  };

  const applyPreset = (preset: Exclude<CockpitPreset, "custom">) => {
    onChange({ ...value, ...COCKPIT_PRESETS[preset], cockpit_preset: preset });
  };

  // Detect if value matches any preset → show that chip selected.
  const detected: CockpitPreset =
    (Object.keys(COCKPIT_PRESETS) as Exclude<CockpitPreset, "custom">[])
      .find((p) => matchesPreset(value, p)) ?? "custom";

  const presets: CockpitPreset[] = [
    "hypertrophy_classic",
    "strength_base",
    "moderate_recomp",
    "high_volume",
    "conservative",
    "custom",
  ];

  const STORAGE_KEY = "pf.cockpit.finetune";
  const [showKnobs, setShowKnobs] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, showKnobs ? "1" : "0");
  }, [showKnobs]);

  const deloadLabel =
    value.deload_frequency === "no_deload"
      ? "sem deload"
      : value.deload_frequency.replace("every_", "deload ").replace("_weeks", "w");
  const summary = `${t(`cockpit.knobs.wave.options.${value.wave_model}`)} · RPE ${value.rpe_ceiling.toFixed(1)} · ${deloadLabel} · ${t(`cockpit.knobs.autoreg.options.${value.autoreg_strictness}`)}`;

  const presetInference = inferCockpitPreset({
    primary_goal: primaryGoal as any,
    current: value.cockpit_preset as CockpitPreset | undefined,
  });

  return (
    <section
      aria-labelledby="cockpit-title"
      className={`rounded-xl border border-border bg-card p-4 ${disabled ? "pointer-events-none opacity-70" : ""}`}
    >
      <header className="mb-3 flex items-center gap-2">
        <Gauge className="h-4 w-4 text-amber-500" aria-hidden />
        <h3 id="cockpit-title" className="text-sm font-bold uppercase tracking-widest text-foreground">
          {t("cockpit.title")}
        </h3>
      </header>

      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        {t("cockpit.intro")}
      </p>

      {/* Presets */}
      <div className="mb-4 flex flex-wrap gap-2">
        {presets.map((p) => {
          const active = detected === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => p !== "custom" && applyPreset(p as Exclude<CockpitPreset, "custom">)}
              aria-pressed={active}
              disabled={p === "custom"}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                active
                  ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              } ${p === "custom" ? "cursor-default" : ""}`}
            >
              {t(`cockpit.presets.${p}`)}
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <p className="text-xs text-foreground">{summary}</p>
          <RationaleChip inference={presetInference} />
        </div>
        <button
          type="button"
          onClick={() => setShowKnobs((s) => !s)}
          className="text-[11px] font-medium uppercase tracking-wider text-amber-600 hover:text-amber-700 dark:text-amber-400"
        >
          {showKnobs ? "Ocultar detalhes" : "Afinar"}
        </button>
      </div>

      {showKnobs && (
      <div className={`grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
        <Knob
          icon={<Waves className="h-4 w-4" />}
          label={t("cockpit.knobs.wave.label")}
          help={t("cockpit.knobs.wave.help")}
        >
          <select
            value={value.wave_model}
            onChange={(e) => apply({ wave_model: e.target.value as ProgrammingVariables["wave_model"] })}
            className="be-input w-full"
          >
            <option value="undulating">{t("cockpit.knobs.wave.options.undulating")}</option>
            <option value="linear">{t("cockpit.knobs.wave.options.linear")}</option>
            <option value="block">{t("cockpit.knobs.wave.options.block")}</option>
            <option value="conjugate" disabled>{t("cockpit.knobs.wave.options.conjugate")}</option>
          </select>
        </Knob>

        <Knob
          icon={<Gauge className="h-4 w-4" />}
          label={`${t("cockpit.knobs.rpe.label")} — ${value.rpe_ceiling.toFixed(1)}`}
          help={t("cockpit.knobs.rpe.help")}
        >
          <input
            type="range"
            min={7.5}
            max={10}
            step={0.5}
            value={value.rpe_ceiling}
            onChange={(e) => apply({ rpe_ceiling: Number(e.target.value) })}
            className="w-full accent-amber-500"
          />
          <div className="mt-1 flex justify-between text-[10px] uppercase text-muted-foreground">
            <span>{t("cockpit.knobs.rpe.marks.low")}</span>
            <span>{t("cockpit.knobs.rpe.marks.mid")}</span>
            <span>{t("cockpit.knobs.rpe.marks.high")}</span>
          </div>
        </Knob>

        <Knob
          icon={<Scale className="h-4 w-4" />}
          label={t("cockpit.knobs.tradeoff.label")}
          help={t("cockpit.knobs.tradeoff.help")}
        >
          <select
            value={value.intensity_volume_tradeoff}
            onChange={(e) => apply({ intensity_volume_tradeoff: e.target.value as ProgrammingVariables["intensity_volume_tradeoff"] })}
            className="be-input w-full"
          >
            <option value="high_int_low_vol">{t("cockpit.knobs.tradeoff.options.high_int_low_vol")}</option>
            <option value="moderate_moderate">{t("cockpit.knobs.tradeoff.options.moderate_moderate")}</option>
            <option value="moderate_int_high_vol">{t("cockpit.knobs.tradeoff.options.moderate_int_high_vol")}</option>
            <option value="low_int_very_high_vol">{t("cockpit.knobs.tradeoff.options.low_int_very_high_vol")}</option>
          </select>
        </Knob>

        <Knob
          icon={<Repeat className="h-4 w-4" />}
          label={t("cockpit.knobs.deload.label")}
          help={t("cockpit.knobs.deload.help")}
        >
          <select
            value={value.deload_frequency}
            onChange={(e) => apply({ deload_frequency: e.target.value as ProgrammingVariables["deload_frequency"] })}
            className="be-input w-full"
          >
            <option value="every_3_weeks">{t("cockpit.knobs.deload.options.every_3_weeks")}</option>
            <option value="every_4_weeks">{t("cockpit.knobs.deload.options.every_4_weeks")}</option>
            <option value="every_5_weeks">{t("cockpit.knobs.deload.options.every_5_weeks")}</option>
            <option value="every_6_weeks">{t("cockpit.knobs.deload.options.every_6_weeks")}</option>
            <option value="no_deload">{t("cockpit.knobs.deload.options.no_deload")}</option>
          </select>
        </Knob>

        <Knob
          icon={<ShieldCheck className="h-4 w-4" />}
          label={t("cockpit.knobs.autoreg.label")}
          help={t("cockpit.knobs.autoreg.help")}
        >
          <select
            value={value.autoreg_strictness}
            onChange={(e) => apply({ autoreg_strictness: e.target.value as ProgrammingVariables["autoreg_strictness"] })}
            className="be-input w-full"
          >
            <option value="strict">{t("cockpit.knobs.autoreg.options.strict")}</option>
            <option value="suggested">{t("cockpit.knobs.autoreg.options.suggested")}</option>
            <option value="off">{t("cockpit.knobs.autoreg.options.off")}</option>
          </select>
        </Knob>
      </div>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        {t("cockpit.sources")}
      </p>
    </section>
  );
}

function Knob({
  icon, label, help, children,
}: { icon: React.ReactNode; label: string; help: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
        <span className="text-amber-500">{icon}</span>
        {label}
      </div>
      {children}
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{help}</p>
    </div>
  );
}