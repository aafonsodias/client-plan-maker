import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { synthesizeBrief, approveBrief } from "@/server/phased/stage1-brief.functions";
import { BriefSchema, type Brief } from "@/server/phased/schemas";
import { Loader2, RefreshCw, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/plans/$planId/brief")({
  component: () => (
    <AppShell>
      <BriefReview />
    </AppShell>
  ),
});

function BriefReview() {
  const { planId } = Route.useParams();
  const navigate = useNavigate();
  const synthesizeFn = useServerFn(synthesizeBrief);
  const approveFn = useServerFn(approveBrief);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [planTitle, setPlanTitle] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("workout_plans")
      .select("id, title, client_id, brief, generation_state")
      .eq("id", planId)
      .maybeSingle();
    if (error || !data) {
      toast.error("Plan not found.");
      setLoading(false);
      return;
    }
    setPlanTitle((data as any).title ?? "");
    setClientId((data as any).client_id ?? null);
    const parsed = BriefSchema.safeParse((data as any).brief);
    console.log(
      "[brief route] planId=",
      planId,
      "raw brief=",
      (data as any).brief,
      "parsed.success=",
      parsed.success,
      parsed.success ? null : parsed.error.issues
    );
    setBrief(parsed.success ? parsed.data : null);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  async function regenerate() {
    setRegenerating(true);
    const res = await synthesizeFn({ data: { planId } });
    setRegenerating(false);
    if (!res.ok) {
      toast.error(res.error || "Regenerate failed");
      return;
    }
    toast.success("Brief regenerated");
    await load();
  }

  async function approve() {
    if (!brief) return;
    const parsed = BriefSchema.safeParse(brief);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Brief is invalid");
      return;
    }
    setApproving(true);
    const res = await approveFn({ data: { planId, brief: parsed.data } });
    setApproving(false);
    if (!res.ok) {
      toast.error(res.error || "Approve failed");
      return;
    }
    toast.success("Brief approved — moving to blueprint");
    navigate({ to: "/plans/$planId/blueprint", params: { planId } });
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center text-muted-foreground">
        <Loader2 className="mx-auto h-6 w-6 animate-spin" /> Loading brief…
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center">
        <p className="font-mono text-sm text-destructive">
          DEBUG: Brief is null or failed schema parse (plan {planId})
        </p>
        <p className="mt-2 text-muted-foreground">No brief yet.</p>
        <button
          onClick={regenerate}
          disabled={regenerating}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Generate brief
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          {clientId && (
            <Link
              to="/clients/$clientId"
              params={{ clientId }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> Client
            </Link>
          )}
          <h1 className="truncate text-xl font-semibold text-foreground">{planTitle}</h1>
          <p className="text-xs text-muted-foreground">Stage 1 — Brief review</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={regenerate}
            disabled={regenerating || approving}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Regenerate
          </button>
          <button
            onClick={approve}
            disabled={approving || regenerating}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Approve brief
          </button>
        </div>
      </div>

      <BriefEditor brief={brief} onChange={setBrief} />
    </div>
  );
}

function BriefEditor({ brief, onChange }: { brief: Brief; onChange: (b: Brief) => void }) {
  const set = <K extends keyof Brief>(k: K, v: Brief[K]) => onChange({ ...brief, [k]: v });

  return (
    <div className="space-y-4">
      <Card title="Goal">
        <Field label="Primary goal">
          <select
            value={brief.primary_goal}
            onChange={(e) => set("primary_goal", e.target.value as Brief["primary_goal"])}
            className="input"
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
            className="input"
          />
        </Field>
        <Field label="Training age">
          <select
            value={brief.training_age_band}
            onChange={(e) => set("training_age_band", e.target.value as Brief["training_age_band"])}
            className="input"
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
              onChange={(n) =>
                set("sessions_per_week", { ...brief.sessions_per_week, recommended: n })
              }
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
              className="input"
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
            className="input"
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
            className="input"
          />
        </Field>
        <Field label="Notes for next stage">
          <textarea
            value={brief.notes_for_next_stage}
            onChange={(e) => set("notes_for_next_stage", e.target.value)}
            rows={4}
            className="input"
          />
        </Field>
      </Card>

      <style>{`
        .input { width: 100%; border-radius: 8px; border: 1px solid hsl(var(--border)); background: hsl(var(--background)); padding: 6px 10px; font-size: 14px; color: hsl(var(--foreground)); }
        .input:focus { outline: 2px solid hsl(var(--primary) / 0.4); outline-offset: 1px; }
      `}</style>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
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
      className="input"
    />
  );
}