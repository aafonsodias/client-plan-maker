import { useEffect, useState } from "react";
import { ChevronDown, Lightbulb } from "lucide-react";
import { AutoTextarea } from "@/components/AutoTextarea";
import type {
  Brief,
  ProgrammingVariables,
  RedFlagAccommodation,
} from "@/server/phased/schemas";
import { FLAG_STRATEGY_LABELS_PT } from "@/lib/brief-labels";
import IntensityCockpit from "@/components/plan/IntensityCockpit";
import RationaleChip from "@/components/ux/RationaleChip";
import { inferTier, inferSplit } from "@/lib/auto-infer";
import { useTranslation } from "react-i18next";
import {
  getStoredInterfaceMode,
  setStoredInterfaceMode,
  type InterfaceMode,
} from "@/lib/interface-mode";

export default function BriefEditor({
  brief,
  onChange,
  disabled = false,
  programmingVariables,
  onProgrammingChange,
  accommodations,
  onAccommodationsChange,
}: {
  brief: Brief;
  onChange: (b: Brief) => void;
  disabled?: boolean;
  programmingVariables?: ProgrammingVariables;
  onProgrammingChange?: (p: ProgrammingVariables) => void;
  accommodations?: RedFlagAccommodation[];
  onAccommodationsChange?: (a: RedFlagAccommodation[]) => void;
}) {
  const { t } = useTranslation("common");
  const [mode, setModeState] = useState<InterfaceMode>("quick");
  useEffect(() => {
    setModeState(getStoredInterfaceMode());
  }, []);
  const setMode = (next: InterfaceMode) => {
    setStoredInterfaceMode(next);
    setModeState(next);
  };
  const set = <K extends keyof Brief>(k: K, v: Brief[K]) => onChange({ ...brief, [k]: v });
  const setPv = <K extends keyof ProgrammingVariables>(
    k: K,
    v: ProgrammingVariables[K]
  ) => {
    if (programmingVariables && onProgrammingChange) {
      onProgrammingChange({ ...programmingVariables, [k]: v });
    }
  };
  const setAcc = (idx: number, patch: Partial<RedFlagAccommodation>) => {
    if (!accommodations || !onAccommodationsChange) return;
    onAccommodationsChange(
      accommodations.map((a, i) => (i === idx ? { ...a, ...patch } : a))
    );
  };

  // R/Phase 4C — top-level computed inferences (no hooks; pure derivations).
  // Extracted from JSX IIFEs so render paths stay flat and predictable on
  // legacy plans where parts of the brief / programming_variables may be missing.
  const tierInference = inferTier({
    red_flags: brief.red_flags ?? [],
    training_age_band: brief.training_age_band,
    manual: null,
  });
  const splitSystem = inferSplit({
    sessions_per_week: brief.sessions_per_week?.recommended ?? 0,
    manual: null,
  });
  const splitMatches =
    !!programmingVariables &&
    programmingVariables.training_split === splitSystem.value;
  const splitChipInf = splitMatches
    ? splitSystem
    : inferSplit({ manual: (programmingVariables?.training_split ?? null) as any });
  const splitLabels: Record<string, string> = {
    full_body: "Corpo inteiro",
    upper_lower: "Superior / Inferior",
    ppl: "Empurrar / Puxar / Pernas",
    pplc: "Empurrar / Puxar / Pernas / Core",
    ppl_x2: "Empurrar / Puxar / Pernas (×2/sem)",
    body_part_split: "Divisão por grupo muscular",
    custom: "Personalizada",
  };

  return (
    <div className={`space-y-3 ${disabled ? "pointer-events-none opacity-70" : ""}`}>
      <div
        role="group"
        aria-label={t("ux.mode.aria_label")}
        className="rounded-2xl border border-border bg-card p-2 shadow-sm"
      >
        <div className="grid grid-cols-2 gap-1">
          {(["quick", "lab"] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                onClick={() => setMode(m)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 ${
                  active
                    ? "border border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "border border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(m === "quick" ? "ux.mode.quick_path" : "ux.mode.lab_mode")}
              </button>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-[11px] leading-snug text-muted-foreground">
          {t(mode === "quick" ? "ux.mode.quick_description" : "ux.mode.lab_description")}
        </p>
        <p className="mt-1 px-1 text-[10px] leading-snug text-muted-foreground/80">
          {t("ux.mode.saved_locally")}
        </p>
      </div>

      <Card
        title="Objetivo"
        conclusion={buildObjectiveConclusion(brief)}
      >
        <Field label="Objetivo principal">
          <select
            value={brief.primary_goal}
            onChange={(e) => set("primary_goal", e.target.value as Brief["primary_goal"])}
            className="be-input"
          >
            {([
              ["hypertrophy", "Hipertrofia"],
              ["strength", "Força"],
              ["conditioning", "Condição física"],
              ["mixed", "Misto"],
              ["fat_loss", "Perda de gordura"],
              ["general", "Geral"],
            ] as const).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Objetivos secundários (separados por vírgula)">
          <input
            value={brief.secondary_goals.join(", ")}
            onChange={(e) =>
              set(
                "secondary_goals",
                e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
              )
            }
            className="be-input"
          />
        </Field>
        <Field label="Experiência de treino">
          <select
            value={brief.training_age_band}
            onChange={(e) => set("training_age_band", e.target.value as Brief["training_age_band"])}
            className="be-input"
          >
            {([
              ["beginner", "Iniciante"],
              ["intermediate", "Intermédio"],
              ["advanced", "Avançado"],
            ] as const).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          {(() => {
            const tierInf = inferTier({
              red_flags: brief.red_flags ?? [],
              training_age_band: brief.training_age_band,
              manual: null,
            });
            if (mode === "quick" && tierInf.confidence !== "assumed") return null;
            return (
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span>{t("ux.rationale.labels.inferred")}:</span>
                <RationaleChip inference={tierInf} label={tierInf.value} mode={mode} />
              </div>
            );
          })()}
        </Field>
      </Card>

      <Card title="Agenda e ênfase" conclusion={buildEmphasisConclusion(brief)}>
        {typeof brief.current_capacity_vs_pb === "number" && (
          <div className="mb-2">
            <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
              Capacidade actual: {brief.current_capacity_vs_pb}/10 — {
                brief.current_capacity_vs_pb <= 3
                  ? "modo reconstrução"
                  : brief.current_capacity_vs_pb >= 8
                    ? "modo progressão"
                    : "modo manutenção"
              }
            </span>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Sessões/sem (rec.)">
            <NumInput
              value={brief.sessions_per_week.recommended}
              min={1}
              max={7}
              onChange={(n) => set("sessions_per_week", { ...brief.sessions_per_week, recommended: n })}
            />
          </Field>
          <Field label="Mín.">
            <NumInput
              value={brief.sessions_per_week.min}
              min={1}
              max={7}
              onChange={(n) => set("sessions_per_week", { ...brief.sessions_per_week, min: n })}
            />
          </Field>
          <Field label="Máx.">
            <NumInput
              value={brief.sessions_per_week.max}
              min={1}
              max={7}
              onChange={(n) => set("sessions_per_week", { ...brief.sessions_per_week, max: n })}
            />
          </Field>
        </div>
        <Field label="Duração do mesociclo (semanas)">
          <NumInput
            value={brief.mesocycle_length_weeks}
            min={2}
            max={12}
            onChange={(n) => set("mesocycle_length_weeks", n)}
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          {([
            ["upper", "Superior"],
            ["lower", "Inferior"],
            ["conditioning", "Condição"],
          ] as const).map(([k, l]) => (
            <Field key={k} label={`Quota ${l.toLowerCase()}`}>
              <NumInput
                value={brief.emphasis_split[k]}
                step={0.05}
                min={0}
                max={1}
                onChange={(n) => set("emphasis_split", { ...brief.emphasis_split, [k]: n })}
              />
            </Field>
          ))}
        </div>
      </Card>

      <Card title="Competência de movimento" conclusion={buildMovementConclusion(brief)}>
        {([
          ["squat", "Agachamento"],
          ["hinge", "Dobra de anca"],
          ["push", "Empurrar"],
          ["pull", "Puxar"],
          ["carry", "Transporte"],
          ["lunge", "Avanço"],
        ] as const).map(([p, l]) => (
          <Field key={p} label={l}>
            <input
              value={brief.movement_competency_summary[p]}
              onChange={(e) =>
                set("movement_competency_summary", {
                  ...brief.movement_competency_summary,
                  [p]: e.target.value,
                })
              }
              className="be-input"
              placeholder="ex. ADM completa, restrito, sem notas"
            />
          </Field>
        ))}
      </Card>

      <Card title="Segurança e equipamento" conclusion={buildSafetyConclusion(brief)}>
        <Field label="Sinais de alerta (um por linha)">
          <AutoTextarea
            value={brief.red_flags.join("\n")}
            onChange={(e) =>
              set(
                "red_flags",
                e.target.value.split("\n").map((s) => s.trim()).filter(Boolean)
              )
            }
            minRows={2}
            className="be-input"
          />
        </Field>
        <Field label="Restrições de equipamento (uma por linha)">
          <AutoTextarea
            value={brief.equipment_constraints.join("\n")}
            onChange={(e) =>
              set(
                "equipment_constraints",
                e.target.value.split("\n").map((s) => s.trim()).filter(Boolean)
              )
            }
            minRows={2}
            className="be-input"
          />
        </Field>
        <Field label="Notas para a próxima etapa">
          <AutoTextarea
            value={brief.notes_for_next_stage}
            onChange={(e) => set("notes_for_next_stage", e.target.value)}
            minRows={3}
            className="be-input"
          />
        </Field>
        <Field label="Apetite de intensidade">
          <select
            value={brief.intensity_appetite ?? "padrao"}
            onChange={(e) =>
              set(
                "intensity_appetite",
                e.target.value as Brief["intensity_appetite"],
              )
            }
            className="be-input"
          >
            <option value="conservador">
              Conservador — RPE 5→6→6.5, saltos pequenos de carga
            </option>
            <option value="padrao">
              Padrão — RPE 6→7→7.5, +2.5–5%/sem em compostos
            </option>
            <option value="agressivo">
              Agressivo — RPE 7→8→8.5, +5%/sem em compostos
            </option>
          </select>
        </Field>
      </Card>

      {programmingVariables && onProgrammingChange && (
        <IntensityCockpit
          value={programmingVariables}
          onChange={onProgrammingChange}
          disabled={disabled}
          primaryGoal={brief.primary_goal}
          mode={mode}
        />
      )}

      {programmingVariables && onProgrammingChange && (
        <Card title="Configuração de programação">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Divisão de treino">
              <select
                value={programmingVariables.training_split}
                onChange={(e) => setPv("training_split", e.target.value as ProgrammingVariables["training_split"])}
                className="be-input"
              >
                <option value="full_body">Corpo inteiro</option>
                <option value="upper_lower">Superior / Inferior</option>
                <option value="ppl">Empurrar / Puxar / Pernas</option>
                <option value="pplc">Empurrar / Puxar / Pernas / Core</option>
                <option value="ppl_x2">Empurrar / Puxar / Pernas (×2/sem)</option>
                <option value="body_part_split">Divisão por grupo muscular</option>
                <option value="custom">Personalizada</option>
              </select>
              {(() => {
                const systemSplit = inferSplit({
                  sessions_per_week: brief.sessions_per_week?.recommended ?? 0,
                  manual: null,
                });
                const matches = programmingVariables.training_split === systemSplit.value;
                const chipInf = matches
                  ? systemSplit
                  : inferSplit({ manual: programmingVariables.training_split as any });
                const labels: Record<string, string> = {
                  full_body: "Corpo inteiro",
                  upper_lower: "Superior / Inferior",
                  ppl: "Empurrar / Puxar / Pernas",
                  pplc: "Empurrar / Puxar / Pernas / Core",
                  ppl_x2: "Empurrar / Puxar / Pernas (×2/sem)",
                  body_part_split: "Divisão por grupo muscular",
                  custom: "Personalizada",
                };
                // Quick Path: only show the nudge row when the user diverges
                // from the recommendation. Stay silent otherwise.
                if (mode === "quick" && matches) return null;
                return (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <RationaleChip
                      inference={chipInf}
                      label={matches ? t("ux.rationale.labels.inferred") : t("ux.rationale.labels.manually_overridden")}
                      mode={mode}
                    />
                    {!matches ? (
                      <>
                        <span>{t("ux.rationale.labels.recommended_default")}: {labels[systemSplit.value] ?? systemSplit.value}</span>
                        <button
                          type="button"
                          onClick={() => setPv("training_split", systemSplit.value as ProgrammingVariables["training_split"])}
                          className="rounded-full border border-amber-500/40 px-2 py-0.5 text-[10px] font-medium text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                        >
                          {t("ux.rationale.labels.recommended_apply")}
                        </button>
                      </>
                    ) : null}
                  </div>
                );
              })()}
            </Field>
            <Field label="Estilo de deload">
              <select
                value={programmingVariables.deload_style}
                onChange={(e) => setPv("deload_style", e.target.value as ProgrammingVariables["deload_style"])}
                className="be-input"
              >
                <option value="volume_reduction">Redução de volume (-30%)</option>
                <option value="intensity_reduction">Redução de intensidade (-15% carga)</option>
                <option value="full_rest_week">Semana de repouso total</option>
                <option value="mixed">Misto (-15% carga e -30% volume)</option>
              </select>
            </Field>
            <Field label="Tendência de selecção de exercícios">
              <select
                value={programmingVariables.exercise_bias}
                onChange={(e) => setPv("exercise_bias", e.target.value as ProgrammingVariables["exercise_bias"])}
                className="be-input"
              >
                <option value="compound_first">Compostos primeiro</option>
                <option value="balanced">Equilibrado</option>
                <option value="isolation_friendly">Favorável a isolamento</option>
                <option value="bodyweight_friendly">Favorável a peso corporal</option>
                <option value="equipment_flexible">Flexível em equipamento</option>
              </select>
            </Field>
          </div>
        </Card>
      )}

      {accommodations && onAccommodationsChange && (
        <section className="space-y-2 pt-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Acomodações de sinais de alerta
          </h3>
          {accommodations.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sem sinais de alerta no brief — nada a acomodar.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {accommodations.map((a, idx) => (
                <li key={`${a.flag}-${idx}`} className="py-3 first:pt-0 last:pb-0">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px] sm:items-start sm:gap-3">
                    <p className="min-w-0 text-sm font-medium leading-snug text-foreground">
                      {a.flag}
                    </p>
                    <select
                      value={a.strategy}
                      onChange={(e) =>
                        setAcc(idx, {
                          strategy: e.target.value as RedFlagAccommodation["strategy"],
                        })
                      }
                      className="be-input w-full sm:w-[180px]"
                    >
                      {(["AVOID", "MODIFY", "MONITOR", "ACCOMMODATE"] as const).map((s) => (
                        <option key={s} value={s}>
                          {FLAG_STRATEGY_LABELS_PT[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(a.strategy === "MODIFY" || a.strategy === "MONITOR") && (
                    <input
                      value={a.detail}
                      onChange={(e) => setAcc(idx, { detail: e.target.value })}
                      placeholder={
                        a.strategy === "MODIFY"
                          ? "ex. para pega neutra"
                          : "ex. em exercícios dependentes de dorsiflexão"
                      }
                      className="be-input mt-2 w-full"
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <style>{`
        .be-input { width: 100%; border-radius: 8px; border: 1px solid hsl(var(--border)); background: hsl(var(--background)); padding: 5px 9px; font-size: 13.5px; color: hsl(var(--foreground)); }
        .be-input:focus { outline: 2px solid hsl(var(--primary) / 0.4); outline-offset: 1px; }
      `}</style>
    </div>
  );
}

function Card({
  title,
  children,
  conclusion,
}: {
  title: string;
  children: React.ReactNode;
  /** One-line takeaway shown in a soft amber footer to brief the AI / trainer. */
  conclusion?: string | null;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const onExp = () => setOpen(true);
    const onCol = () => setOpen(false);
    window.addEventListener("brief:expand-all", onExp);
    window.addEventListener("brief:collapse-all", onCol);
    return () => {
      window.removeEventListener("brief:expand-all", onExp);
      window.removeEventListener("brief:collapse-all", onCol);
    };
  }, []);
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left transition hover:bg-muted/30 sm:px-5"
      >
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && (
        <div className="space-y-2.5 px-4 pb-3 sm:px-5 sm:pb-4">{children}</div>
      )}
      {open && conclusion && (
        <div className="border-t border-amber-500/20 bg-amber-500/[0.05] px-4 py-2 sm:px-5">
          <div className="flex items-start gap-2">
            <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
            <p className="text-[11px] leading-snug text-amber-100/80">
              <span className="font-semibold uppercase tracking-wider text-amber-300/90">
                Conclusão para a programação ·{" "}
              </span>
              {conclusion}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function NumInput({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
      className="be-input"
    />
  );
}

/* ─────────── Conclusion builders ───────────
 * Deterministic one-liners derived from the brief itself — no extra AI call.
 * Each gives the trainer (and downstream prompts) a crisp practical takeaway. */

function buildObjectiveConclusion(b: Brief): string {
  const goalMap: Record<string, string> = {
    hypertrophy: "priorizar volume mecânico e proximidade da falha",
    strength: "priorizar carga e qualidade de séries baixas em reps",
    conditioning: "priorizar densidade, descansos curtos e variabilidade aeróbia",
    mixed: "balancear força e condicionamento por dia",
    fat_loss: "manter intensidade, gerir fadiga, dieta como driver principal",
    general: "padrões fundamentais, sem especialização",
  };
  const exp =
    b.training_age_band === "beginner"
      ? "técnica antes de carga"
      : b.training_age_band === "intermediate"
      ? "progressão linear sustentável"
      : "stress periodizado e variação";
  return `${goalMap[b.primary_goal] ?? b.primary_goal}; ${exp}.`;
}

function buildEmphasisConclusion(b: Brief): string {
  const e = b.emphasis_split;
  const total = (e.upper ?? 0) + (e.lower ?? 0) + (e.conditioning ?? 0);
  if (total === 0) return "Sem ênfase definida — assumir distribuição equilibrada.";
  const pct = (n: number) => Math.round((n / total) * 100);
  const parts = [
    e.upper > 0 ? `${pct(e.upper)}% superior` : null,
    e.lower > 0 ? `${pct(e.lower)}% inferior` : null,
    e.conditioning > 0 ? `${pct(e.conditioning)}% condição` : null,
  ].filter(Boolean);
  return `${b.sessions_per_week.recommended}× por semana · ${parts.join(" · ")}.`;
}

function buildMovementConclusion(b: Brief): string {
  const failed: string[] = [];
  const PT: Record<string, string> = {
    squat: "agachamento",
    hinge: "anca",
    push: "empurrar",
    pull: "puxar",
    lunge: "avanço",
    carry: "transporte",
  };
  for (const k of Object.keys(PT) as (keyof typeof PT)[]) {
    const txt = (b.movement_competency_summary as any)?.[k] ?? "";
    if (/falh|restri|défice|dor|insuficien/i.test(txt)) failed.push(PT[k]);
  }
  if (failed.length === 0) return "Padrões fundamentais sem falhas críticas — pode-se carregar.";
  if (failed.length >= 4)
    return `Falhas em ${failed.length} padrões — começar com versões assistidas / regredidas e enfatizar controlo motor.`;
  return `Atenção a: ${failed.join(", ")}. Usar variantes regredidas e cuidar amplitude antes de carga.`;
}

function buildSafetyConclusion(b: Brief): string {
  const flags = b.red_flags.length;
  const eq = b.equipment_constraints.length;
  if (flags === 0 && eq === 0) return "Sem restrições — escolha de exercícios livre.";
  const bits: string[] = [];
  if (flags > 0) bits.push(`${flags} sinal${flags === 1 ? "" : "is"} de alerta a acomodar`);
  if (eq > 0) bits.push(`${eq} restrição${eq === 1 ? "" : "ões"} de equipamento`);
  return `${bits.join(" · ")}. Aplicar estratégias AVOID/MODIFY antes de prescrever.`;
}