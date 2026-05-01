import type {
  Brief,
  ProgrammingVariables,
  RedFlagAccommodation,
} from "@/server/phased/schemas";

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
      <Card title="Goal">
        <Field label="Primary goal">
          <select
            value={brief.primary_goal}
            onChange={(e) => set("primary_goal", e.target.value as Brief["primary_goal"])}
            className="be-input"
          >
            {["hypertrophy", "strength", "conditioning", "mixed", "fat_loss", "general"].map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </Field>
        <Field label="Secondary goals (comma-sep)">
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
        <Field label="Training age">
          <select
            value={brief.training_age_band}
            onChange={(e) => set("training_age_band", e.target.value as Brief["training_age_band"])}
            className="be-input"
          >
            {["beginner", "intermediate", "advanced"].map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </Field>
      </Card>

      <Card title="Schedule & emphasis">
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
          <Field label="Sessions/wk (rec.)">
            <NumInput
              value={brief.sessions_per_week.recommended}
              min={1}
              max={7}
              onChange={(n) => set("sessions_per_week", { ...brief.sessions_per_week, recommended: n })}
            />
          </Field>
          <Field label="Min">
            <NumInput
              value={brief.sessions_per_week.min}
              min={1}
              max={7}
              onChange={(n) => set("sessions_per_week", { ...brief.sessions_per_week, min: n })}
            />
          </Field>
          <Field label="Max">
            <NumInput
              value={brief.sessions_per_week.max}
              min={1}
              max={7}
              onChange={(n) => set("sessions_per_week", { ...brief.sessions_per_week, max: n })}
            />
          </Field>
        </div>
        <Field label="Mesocycle length (weeks)">
          <NumInput
            value={brief.mesocycle_length_weeks}
            min={2}
            max={12}
            onChange={(n) => set("mesocycle_length_weeks", n)}
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          {(["upper", "lower", "conditioning"] as const).map((k) => (
            <Field key={k} label={`${k} share`}>
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

      <Card title="Movement competency">
        {(["squat", "hinge", "push", "pull", "carry", "lunge"] as const).map((p) => (
          <Field key={p} label={p}>
            <input
              value={brief.movement_competency_summary[p]}
              onChange={(e) =>
                set("movement_competency_summary", {
                  ...brief.movement_competency_summary,
                  [p]: e.target.value,
                })
              }
              className="be-input"
              placeholder="e.g. full ROM, restricted, no notes"
            />
          </Field>
        ))}
      </Card>

      <Card title="Safety & equipment">
        <Field label="Red flags (one per line)">
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
        <Field label="Equipment constraints (one per line)">
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
        <Field label="Notes for next stage">
          <textarea
            value={brief.notes_for_next_stage}
            onChange={(e) => set("notes_for_next_stage", e.target.value)}
            rows={4}
            className="be-input"
          />
        </Field>
      </Card>

      {programmingVariables && onProgrammingChange && (
        <Card title="Programming setup">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Training split">
              <select
                value={programmingVariables.training_split}
                onChange={(e) => setPv("training_split", e.target.value as ProgrammingVariables["training_split"])}
                className="be-input"
              >
                <option value="full_body">Full-body</option>
                <option value="upper_lower">Upper / Lower</option>
                <option value="ppl">Push / Pull / Legs</option>
                <option value="pplc">Push / Pull / Legs / Core</option>
                <option value="ppl_x2">Push / Pull / Legs (×2/wk)</option>
                <option value="body_part_split">Body-part split</option>
                <option value="custom">Custom</option>
              </select>
            </Field>
            <Field label="Deload frequency">
              <select
                value={programmingVariables.deload_frequency}
                onChange={(e) => setPv("deload_frequency", e.target.value as ProgrammingVariables["deload_frequency"])}
                className="be-input"
              >
                <option value="every_3_weeks">Every 3 weeks</option>
                <option value="every_4_weeks">Every 4 weeks</option>
                <option value="every_5_weeks">Every 5 weeks</option>
                <option value="every_6_weeks">Every 6 weeks</option>
                <option value="no_deload">No deload</option>
              </select>
            </Field>
            <Field label="Deload style">
              <select
                value={programmingVariables.deload_style}
                onChange={(e) => setPv("deload_style", e.target.value as ProgrammingVariables["deload_style"])}
                className="be-input"
              >
                <option value="volume_reduction">Volume reduction (-30%)</option>
                <option value="intensity_reduction">Intensity reduction (-15% load)</option>
                <option value="full_rest_week">Full rest week</option>
                <option value="mixed">Mixed (-15% load AND -30% volume)</option>
              </select>
            </Field>
            <Field label="RPE ceiling">
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
            <Field label="Exercise selection bias">
              <select
                value={programmingVariables.exercise_bias}
                onChange={(e) => setPv("exercise_bias", e.target.value as ProgrammingVariables["exercise_bias"])}
                className="be-input"
              >
                <option value="compound_first">Compound-first</option>
                <option value="balanced">Balanced</option>
                <option value="isolation_friendly">Isolation-friendly</option>
                <option value="bodyweight_friendly">Bodyweight-friendly</option>
                <option value="equipment_flexible">Equipment-flexible</option>
              </select>
            </Field>
            <Field label="Intensity / volume trade-off">
              <select
                value={programmingVariables.intensity_volume_tradeoff}
                onChange={(e) => setPv("intensity_volume_tradeoff", e.target.value as ProgrammingVariables["intensity_volume_tradeoff"])}
                className="be-input"
              >
                <option value="high_int_low_vol">High intensity / low volume</option>
                <option value="moderate_moderate">Moderate / moderate</option>
                <option value="moderate_int_high_vol">Moderate intensity / high volume</option>
                <option value="low_int_very_high_vol">Low intensity / very high volume</option>
              </select>
            </Field>
          </div>
        </Card>
      )}

      {accommodations && onAccommodationsChange && (
        <Card title="Red flag accommodations">
          {accommodations.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No red flags from the brief — nothing to accommodate.
            </p>
          ) : (
            <div className="space-y-3">
              {accommodations.map((a, idx) => (
                <div
                  key={`${a.flag}-${idx}`}
                  className="rounded-lg border border-border bg-background/50 p-3"
                >
                  <div className="mb-2 text-sm font-medium text-foreground">{a.flag}</div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[160px_1fr]">
                    <select
                      value={a.strategy}
                      onChange={(e) =>
                        setAcc(idx, {
                          strategy: e.target.value as RedFlagAccommodation["strategy"],
                        })
                      }
                      className="be-input"
                    >
                      <option value="AVOID">Avoid</option>
                      <option value="MODIFY">Modify</option>
                      <option value="MONITOR">Monitor</option>
                      <option value="ACCOMMODATE">Accommodate</option>
                    </select>
                    {(a.strategy === "MODIFY" || a.strategy === "MONITOR") && (
                      <input
                        value={a.detail}
                        onChange={(e) => setAcc(idx, { detail: e.target.value })}
                        placeholder={
                          a.strategy === "MODIFY"
                            ? "e.g. to neutral grip"
                            : "e.g. in dorsiflexion-dependent exercises"
                        }
                        className="be-input"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
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