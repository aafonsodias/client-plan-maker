import { Gauge, Waves, Scale, Repeat, ShieldCheck } from "lucide-react";
import type { ProgrammingVariables } from "@/server/phased/schemas";
import {
  COCKPIT_PRESETS,
  COCKPIT_PRESET_LABELS,
  matchesPreset,
  type CockpitPreset,
} from "./CockpitPresets";

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
}: {
  value: ProgrammingVariables;
  onChange: (next: ProgrammingVariables) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
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

  return (
    <section
      aria-labelledby="cockpit-title"
      className={`rounded-xl border border-border bg-card p-4 ${disabled ? "pointer-events-none opacity-70" : ""}`}
    >
      <header className="mb-3 flex items-center gap-2">
        <Gauge className="h-4 w-4 text-amber-500" aria-hidden />
        <h3 id="cockpit-title" className="text-sm font-bold uppercase tracking-widest text-foreground">
          Cockpit de intensidade
        </h3>
      </header>

      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        Cinco controlos que moldam como a Semana 1 se transforma nas semanas seguintes. Comece num preset e ajuste o que importa para este cliente.
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
              {COCKPIT_PRESET_LABELS[p]}
            </button>
          );
        })}
      </div>

      <div className={`grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
        <Knob
          icon={<Waves className="h-4 w-4" />}
          label="Modelo de onda"
          help="Como a carga e o volume oscilam ao longo do bloco."
        >
          <select
            value={value.wave_model}
            onChange={(e) => apply({ wave_model: e.target.value as ProgrammingVariables["wave_model"] })}
            className="be-input w-full"
          >
            <option value="undulating">Ondulante (DUP) — alterna volume/intensidade</option>
            <option value="linear">Linear — intensidade sobe semana a semana</option>
            <option value="block">Bloco — acumula volume → intensifica</option>
            <option value="conjugate" disabled>Conjugado (Westside) — Em breve</option>
          </select>
        </Knob>

        <Knob
          icon={<Gauge className="h-4 w-4" />}
          label={`Tecto de RPE — ${value.rpe_ceiling.toFixed(1)}`}
          help="Acima deste RPE nenhuma série é prescrita, mesmo no pico do bloco."
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
            <span>7.5 leve</span><span>9.0 padrão</span><span>10 limite</span>
          </div>
        </Knob>

        <Knob
          icon={<Scale className="h-4 w-4" />}
          label="Intensidade vs volume"
          help="Onde investir mais — carga pesada ou mais séries/reps."
        >
          <select
            value={value.intensity_volume_tradeoff}
            onChange={(e) => apply({ intensity_volume_tradeoff: e.target.value as ProgrammingVariables["intensity_volume_tradeoff"] })}
            className="be-input w-full"
          >
            <option value="high_int_low_vol">Alta intensidade · baixo volume</option>
            <option value="moderate_moderate">Moderado · moderado</option>
            <option value="moderate_int_high_vol">Intensidade moderada · alto volume</option>
            <option value="low_int_very_high_vol">Baixa intensidade · volume muito alto</option>
          </select>
        </Knob>

        <Knob
          icon={<Repeat className="h-4 w-4" />}
          label="Frequência de deload"
          help="A cada quantas semanas a carga semanal recua para recuperar."
        >
          <select
            value={value.deload_frequency}
            onChange={(e) => apply({ deload_frequency: e.target.value as ProgrammingVariables["deload_frequency"] })}
            className="be-input w-full"
          >
            <option value="every_3_weeks">A cada 3 semanas</option>
            <option value="every_4_weeks">A cada 4 semanas</option>
            <option value="every_5_weeks">A cada 5 semanas</option>
            <option value="every_6_weeks">A cada 6 semanas</option>
            <option value="no_deload">Sem deload</option>
          </select>
        </Knob>

        <Knob
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Autoregulação"
          help="Quão duro reagir quando o RPE realizado fica acima do prescrito."
        >
          <select
            value={value.autoreg_strictness}
            onChange={(e) => apply({ autoreg_strictness: e.target.value as ProgrammingVariables["autoreg_strictness"] })}
            className="be-input w-full"
          >
            <option value="strict">Estrito — corta carga 5% se RPE +0.7</option>
            <option value="suggested">Sugerido — sinaliza, decide o coach</option>
            <option value="off">Desligado — segue a onda nominal</option>
          </select>
        </Knob>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Fontes: Bompa &amp; Buzzichelli 6e §7.3-7.5 (ondas), NSCA Essentials 4e §17.4 (incrementos).
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