import type {
  Brief,
  ProgrammingVariables,
  RedFlagAccommodation,
} from "@/server/phased/schemas";
import { FLAG_STRATEGY_LABELS_PT } from "@/lib/brief-labels";

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

  return (
    <div className={`space-y-4 ${disabled ? "pointer-events-none opacity-70" : ""}`}>
      <Card title="Objetivo">
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
        </Field>
      </Card>

      <Card title="Agenda e ênfase">
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

      <Card title="Competência de movimento">
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

      <Card title="Segurança e equipamento">
        <Field label="Sinais de alerta (um por linha)">
          <textarea
            value={brief.red_flags.join("\n")}
            onChange={(e) =>
              set(
                "red_flags",
                e.target.value.split("\n").map((s) => s.trim()).filter(Boolean)
              )
            }
            rows={3}
            className="be-input"
          />
        </Field>
        <Field label="Restrições de equipamento (uma por linha)">
          <textarea
            value={brief.equipment_constraints.join("\n")}
            onChange={(e) =>
              set(
                "equipment_constraints",
                e.target.value.split("\n").map((s) => s.trim()).filter(Boolean)
              )
            }
            rows={3}
            className="be-input"
          />
        </Field>
        <Field label="Notas para a próxima etapa">
          <textarea
            value={brief.notes_for_next_stage}
            onChange={(e) => set("notes_for_next_stage", e.target.value)}
            rows={4}
            className="be-input"
          />
        </Field>
      </Card>

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
            </Field>
            <Field label="Frequência de deload">
              <select
                value={programmingVariables.deload_frequency}
                onChange={(e) => setPv("deload_frequency", e.target.value as ProgrammingVariables["deload_frequency"])}
                className="be-input"
              >
                <option value="every_3_weeks">A cada 3 semanas</option>
                <option value="every_4_weeks">A cada 4 semanas</option>
                <option value="every_5_weeks">A cada 5 semanas</option>
                <option value="every_6_weeks">A cada 6 semanas</option>
                <option value="no_deload">Sem deload</option>
              </select>
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
            <Field label="Tecto de RPE">
              <input
                type="number"
                min={7.5}
                max={10}
                step={0.5}
                value={programmingVariables.rpe_ceiling}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) setPv("rpe_ceiling", n);
                }}
                className="be-input"
              />
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
            <Field label="Trade-off intensidade / volume">
              <select
                value={programmingVariables.intensity_volume_tradeoff}
                onChange={(e) => setPv("intensity_volume_tradeoff", e.target.value as ProgrammingVariables["intensity_volume_tradeoff"])}
                className="be-input"
              >
                <option value="high_int_low_vol">Alta intensidade / baixo volume</option>
                <option value="moderate_moderate">Moderado / moderado</option>
                <option value="moderate_int_high_vol">Intensidade moderada / alto volume</option>
                <option value="low_int_very_high_vol">Baixa intensidade / volume muito alto</option>
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
        .be-input { width: 100%; border-radius: 8px; border: 1px solid hsl(var(--border)); background: hsl(var(--background)); padding: 6px 10px; font-size: 14px; color: hsl(var(--foreground)); }
        .be-input:focus { outline: 2px solid hsl(var(--primary) / 0.4); outline-offset: 1px; }
      `}</style>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="space-y-3">{children}</div>
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