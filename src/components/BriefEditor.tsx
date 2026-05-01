import type { Brief } from "@/server/phased/schemas";

export default function BriefEditor({
  brief,
  onChange,
  disabled = false,
}: {
  brief: Brief;
  onChange: (b: Brief) => void;
  disabled?: boolean;
}) {
  const set = <K extends keyof Brief>(k: K, v: Brief[K]) => onChange({ ...brief, [k]: v });

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