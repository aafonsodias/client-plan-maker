import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { loadIntake, saveIntake, type IntakeContext } from "@/server/intake.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";

export const Route = createFileRoute("/intake/$token")({
  component: IntakePage,
});

const EQUIPMENT = ["Barbell", "Dumbbells", "Kettlebells", "Cable machine", "Bench", "Pull-up bar", "Bands", "Bodyweight only"];
const READINESS = [
  { id: "precontemplation", label: "Just exploring" },
  { id: "contemplation", label: "Thinking about it" },
  { id: "preparation", label: "Ready to start" },
  { id: "action", label: "Already started" },
  { id: "maintenance", label: "Keeping it going" },
];

type FormState = {
  smart_specific: string;
  smart_measurable: string;
  smart_deadline: string;
  smart_extra: string;
  readiness_stage: string;
  experience_level: string;
  training_days_per_week: string;
  session_duration_minutes: string;
  training_location: string;
  available_equipment: string[];
  injuries: string;
  medical_conditions: string;
  preferences: string;
  sleep_quality: number;
  stress_level: number;
  ext_hours_seated: string;
  ext_daily_steps: string;
  ext_job_type: string;
  energy_levels: string;
  recovery_capacity: string;
  ext_meals_per_day: string;
  ext_water_l_per_day: string;
  ext_processed_food: number;
  ext_alcohol_units_week: string;
  nutrition_habits: string;
};

const EMPTY: FormState = {
  smart_specific: "", smart_measurable: "", smart_deadline: "", smart_extra: "",
  readiness_stage: "",
  experience_level: "", training_days_per_week: "", session_duration_minutes: "",
  training_location: "", available_equipment: [], injuries: "", medical_conditions: "", preferences: "",
  sleep_quality: 7, stress_level: 5,
  ext_hours_seated: "", ext_daily_steps: "", ext_job_type: "", energy_levels: "", recovery_capacity: "",
  ext_meals_per_day: "", ext_water_l_per_day: "", ext_processed_food: 2, ext_alcohol_units_week: "", nutrition_habits: "",
};

function fromAssessment(a: any | null): FormState {
  if (!a) return EMPTY;
  const ext = a.extended ?? {};
  return {
    ...EMPTY,
    smart_specific: a.smart_specific ?? "",
    smart_measurable: a.smart_measurable ?? "",
    smart_deadline: a.smart_deadline ?? "",
    smart_extra: ext.smart_extra ?? "",
    readiness_stage: a.readiness_stage ?? "",
    experience_level: a.experience_level ?? "",
    training_days_per_week: a.training_days_per_week?.toString() ?? "",
    session_duration_minutes: a.session_duration_minutes?.toString() ?? "",
    training_location: a.training_location ?? "",
    available_equipment: a.available_equipment ?? [],
    injuries: a.injuries ?? "",
    medical_conditions: a.medical_conditions ?? "",
    preferences: a.preferences ?? "",
    sleep_quality: a.sleep_quality ?? 7,
    stress_level: a.stress_level ?? 5,
    ext_hours_seated: ext.ext_hours_seated?.toString() ?? "",
    ext_daily_steps: ext.ext_daily_steps?.toString() ?? "",
    ext_job_type: ext.ext_job_type ?? "",
    energy_levels: a.energy_levels ?? "",
    recovery_capacity: a.recovery_capacity ?? "",
    ext_meals_per_day: ext.ext_meals_per_day?.toString() ?? "",
    ext_water_l_per_day: ext.ext_water_l_per_day?.toString() ?? "",
    ext_processed_food: ext.ext_processed_food ?? 2,
    ext_alcohol_units_week: ext.ext_alcohol_units_week?.toString() ?? "",
    nutrition_habits: a.nutrition_habits ?? "",
  };
}

function toPayload(f: FormState): { fields: Record<string, any>; sections: string[] } {
  return {
    fields: {
      smart_specific: f.smart_specific || null,
      smart_measurable: f.smart_measurable || null,
      smart_deadline: f.smart_deadline || null,
      readiness_stage: f.readiness_stage || null,
      experience_level: f.experience_level || null,
      training_days_per_week: f.training_days_per_week ? Number(f.training_days_per_week) : null,
      session_duration_minutes: f.session_duration_minutes ? Number(f.session_duration_minutes) : null,
      training_location: f.training_location || null,
      available_equipment: f.available_equipment,
      injuries: f.injuries || null,
      medical_conditions: f.medical_conditions || null,
      preferences: f.preferences || null,
      sleep_quality: f.sleep_quality,
      stress_level: f.stress_level,
      energy_levels: f.energy_levels || null,
      recovery_capacity: f.recovery_capacity || null,
      nutrition_habits: f.nutrition_habits || null,
      extended: {
        smart_extra: f.smart_extra || null,
        ext_hours_seated: f.ext_hours_seated ? Number(f.ext_hours_seated) : null,
        ext_daily_steps: f.ext_daily_steps ? Number(f.ext_daily_steps) : null,
        ext_job_type: f.ext_job_type || null,
        ext_meals_per_day: f.ext_meals_per_day ? Number(f.ext_meals_per_day) : null,
        ext_water_l_per_day: f.ext_water_l_per_day ? Number(f.ext_water_l_per_day) : null,
        ext_processed_food: f.ext_processed_food,
        ext_alcohol_units_week: f.ext_alcohol_units_week ? Number(f.ext_alcohol_units_week) : null,
      },
    },
    sections: ["smart_goal", "readiness", "training", "lifestyle", "nutrition"],
  };
}

function IntakePage() {
  const { token } = Route.useParams();
  const load = useServerFn(loadIntake);
  const save = useServerFn(saveIntake);

  const [ctx, setCtx] = useState<IntakeContext | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const debounceRef = useRef<number | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    void (async () => {
      try {
        const c = await load({ data: { token } });
        setCtx(c);
        if (c.status === "valid") {
          setForm(fromAssessment(c.assessment));
          // localStorage backup
          try {
            const saved = localStorage.getItem(`forge_intake_draft_${token}`);
            if (saved) {
              const parsed = JSON.parse(saved);
              setForm((cur) => ({ ...cur, ...parsed }));
            }
          } catch {}
          hydrated.current = true;
        }
      } catch (e: any) {
        setCtx({ status: "expired" });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Debounced auto-save
  useEffect(() => {
    if (!hydrated.current || ctx?.status !== "valid" || submitted) return;
    try { localStorage.setItem(`forge_intake_draft_${token}`, JSON.stringify(form)); } catch {}
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await save({ data: { token, ...toPayload(form), submit: false } });
        setSaveStatus("saved");
        setLastSavedAt(Date.now());
      } catch {
        setSaveStatus("idle");
      }
    }, 1500);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  if (!ctx) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (ctx.status === "expired") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-light tracking-tight">This link has expired.</h1>
          <p className="mt-3 text-sm text-muted-foreground">Please ask your trainer for a new one.</p>
          <PoweredBy />
        </div>
      </div>
    );
  }

  if (ctx.status === "submitted") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-light tracking-tight">Already submitted{ctx.submittedAt ? ` on ${new Date(ctx.submittedAt).toLocaleDateString()}` : ""}.</h1>
          <p className="mt-3 text-sm text-muted-foreground">Contact your trainer if you need to update something.</p>
          <PoweredBy />
        </div>
      </div>
    );
  }

  if (submitted) {
    return <ThankYou ctx={ctx} />;
  }

  const trainerName = ctx.trainer?.business_name || ctx.trainer?.full_name || "Your trainer";

  const submit = async () => {
    setSubmitting(true);
    try {
      await save({ data: { token, ...toPayload(form), submit: true } });
      try { localStorage.removeItem(`forge_intake_draft_${token}`); } catch {}
      setSubmitted(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not submit. Try again.");
    } finally { setSubmitting(false); }
  };

  const saveDraft = async () => {
    try {
      await save({ data: { token, ...toPayload(form), submit: false } });
      toast.success("Saved. Come back anytime.");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save.");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border bg-card/40">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-5">
          {ctx.trainer?.logo_url ? (
            <img src={ctx.trainer.logo_url} alt="" className="h-10 w-10 rounded-md object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-xs font-semibold text-muted-foreground">
              {(trainerName[0] ?? "T").toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold">{trainerName}</p>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Intake form</p>
          </div>
          <SaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-8">
        <h1 className="text-2xl font-light tracking-tight sm:text-3xl">Hi {ctx.client?.first_name} 👋</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your trainer asked you to fill this before your first session. Takes about 10 minutes.
          You can come back later — we'll save your progress.
        </p>

        <div className="mt-10 space-y-10">
          {/* SMART GOAL */}
          <Section number={1} title="Your goal">
            <Field label="What do you want to achieve?">
              <Textarea value={form.smart_specific} onChange={(e) => setForm({ ...form, smart_specific: e.target.value })} placeholder="e.g. lose 5kg, run a 10k, get stronger…" rows={3} />
            </Field>
            <Field label="How will you measure success?">
              <Input value={form.smart_measurable} onChange={(e) => setForm({ ...form, smart_measurable: e.target.value })} />
            </Field>
            <Field label="By when?">
              <Input type="date" value={form.smart_deadline} onChange={(e) => setForm({ ...form, smart_deadline: e.target.value })} />
            </Field>
            <Field label="Anything else we should know about your goal?" optional>
              <Textarea value={form.smart_extra} onChange={(e) => setForm({ ...form, smart_extra: e.target.value })} rows={2} />
            </Field>
          </Section>

          {/* READINESS */}
          <Section number={2} title="How ready do you feel right now?">
            <div className="flex flex-wrap gap-2">
              {READINESS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setForm({ ...form, readiness_stage: r.id })}
                  className={`rounded-full border px-4 py-2 text-sm transition ${form.readiness_stage === r.id ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </Section>

          {/* TRAINING SETUP */}
          <Section number={3} title="Training setup">
            <Field label="Have you trained before?">
              <Pills options={["Beginner", "Intermediate", "Advanced"]} value={form.experience_level} onChange={(v) => setForm({ ...form, experience_level: v })} />
            </Field>
            <Field label="How many days a week can you train?">
              <Pills options={["1","2","3","4","5","6","7"]} value={form.training_days_per_week} onChange={(v) => setForm({ ...form, training_days_per_week: v })} />
            </Field>
            <Field label="How long can each session be?">
              <Pills options={["30","45","60","75","90"]} value={form.session_duration_minutes} onChange={(v) => setForm({ ...form, session_duration_minutes: v })} suffix="min" />
            </Field>
            <Field label="Where will you train?">
              <Pills options={["Home","Gym","Outdoor","Mixed"]} value={form.training_location} onChange={(v) => setForm({ ...form, training_location: v })} />
            </Field>
            <Field label="What equipment do you have?">
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT.map((eq) => {
                  const on = form.available_equipment.includes(eq);
                  return (
                    <button
                      key={eq}
                      type="button"
                      onClick={() => setForm({
                        ...form,
                        available_equipment: on ? form.available_equipment.filter((x) => x !== eq) : [...form.available_equipment, eq],
                      })}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${on ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground"}`}
                    >{eq}</button>
                  );
                })}
              </div>
            </Field>
            <Field label="Any current injuries or pain?" optional>
              <Textarea rows={2} value={form.injuries} onChange={(e) => setForm({ ...form, injuries: e.target.value })} />
            </Field>
            <Field label="Any medical conditions we should know about?" optional>
              <Textarea rows={2} value={form.medical_conditions} onChange={(e) => setForm({ ...form, medical_conditions: e.target.value })} />
            </Field>
            <Field label="Anything you really like or really dislike doing?" optional>
              <Textarea rows={2} value={form.preferences} onChange={(e) => setForm({ ...form, preferences: e.target.value })} />
            </Field>
          </Section>

          {/* LIFESTYLE */}
          <Section number={4} title="Lifestyle">
            <SliderField label="How well do you sleep on average?" value={form.sleep_quality} min={1} max={10} onChange={(v) => setForm({ ...form, sleep_quality: v })} legend="1 = poorly · 10 = excellent" />
            <SliderField label="How stressed do you feel day-to-day?" value={form.stress_level} min={1} max={10} onChange={(v) => setForm({ ...form, stress_level: v })} legend="1 = calm · 10 = overwhelmed" />
            <Field label="How many hours do you sit per day?">
              <Input inputMode="numeric" value={form.ext_hours_seated} onChange={(e) => setForm({ ...form, ext_hours_seated: e.target.value })} />
            </Field>
            <Field label="Roughly how many steps do you do per day?" optional>
              <Input inputMode="numeric" value={form.ext_daily_steps} onChange={(e) => setForm({ ...form, ext_daily_steps: e.target.value })} />
            </Field>
            <Field label="What's your job like?">
              <Pills options={["Desk","Manual","Mixed","Other"]} value={form.ext_job_type} onChange={(v) => setForm({ ...form, ext_job_type: v })} />
            </Field>
            <Field label="How is your energy through the day?" optional>
              <Textarea rows={2} value={form.energy_levels} onChange={(e) => setForm({ ...form, energy_levels: e.target.value })} />
            </Field>
            <Field label="How well do you recover from physical effort?" optional>
              <Textarea rows={2} value={form.recovery_capacity} onChange={(e) => setForm({ ...form, recovery_capacity: e.target.value })} />
            </Field>
          </Section>

          {/* NUTRITION */}
          <Section number={5} title="Nutrition">
            <Field label="How many meals do you eat per day?">
              <Input inputMode="numeric" value={form.ext_meals_per_day} onChange={(e) => setForm({ ...form, ext_meals_per_day: e.target.value })} />
            </Field>
            <Field label="How much water do you drink per day? (litres)">
              <Input inputMode="decimal" value={form.ext_water_l_per_day} onChange={(e) => setForm({ ...form, ext_water_l_per_day: e.target.value })} />
            </Field>
            <SliderField label="Roughly, how often do you eat processed/fast food?" value={form.ext_processed_food} min={1} max={5} onChange={(v) => setForm({ ...form, ext_processed_food: v })} legend="1 = never · 5 = daily" />
            <Field label="How many alcoholic drinks per week?">
              <Input inputMode="numeric" value={form.ext_alcohol_units_week} onChange={(e) => setForm({ ...form, ext_alcohol_units_week: e.target.value })} />
            </Field>
            <Field label="Anything else about how you eat — allergies, patterns, what works for you?" optional>
              <Textarea rows={3} value={form.nutrition_habits} onChange={(e) => setForm({ ...form, nutrition_habits: e.target.value })} />
            </Field>
          </Section>
        </div>

        <div className="mt-12 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={saveDraft} disabled={submitting}>Save and finish later</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</> : "Submit to my trainer"}
          </Button>
        </div>

        <PoweredBy />
      </main>
    </div>
  );
}

function ThankYou({ ctx }: { ctx: IntakeContext }) {
  const trainerName = ctx.trainer?.business_name || ctx.trainer?.full_name || "Your trainer";
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Check className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-light tracking-tight">Thanks {ctx.client?.first_name}.</h1>
        <p className="mt-3 text-sm text-muted-foreground">{trainerName} will review this before your first session.</p>
        <PoweredBy />
      </div>
    </div>
  );
}

function PoweredBy() {
  return (
    <p className="mt-16 text-center text-[10px] uppercase tracking-widest text-muted-foreground/50">
      Powered by <a href="https://forge.app" className="hover:underline">Forge</a>
    </p>
  );
}

function Section({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-xs font-semibold text-accent">{number}</span>
        <h2 className="text-base font-medium">{title}</h2>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label} {optional && <span className="text-[11px] text-muted-foreground/70">(optional)</span>}</Label>
      {children}
    </div>
  );
}

function Pills({ options, value, onChange, suffix }: { options: string[]; value: string; onChange: (v: string) => void; suffix?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${on ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
          >{o}{suffix ? ` ${suffix}` : ""}</button>
        );
      })}
    </div>
  );
}

function SliderField({ label, value, min, max, onChange, legend }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; legend: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <span className="font-mono text-sm text-accent">{value}</span>
      </div>
      <Slider min={min} max={max} step={1} value={[value]} onValueChange={(v) => onChange(v[0])} />
      <p className="text-[11px] text-muted-foreground/70">{legend}</p>
    </div>
  );
}

function SaveIndicator({ status, lastSavedAt }: { status: "idle" | "saving" | "saved"; lastSavedAt: number | null }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  let text = "";
  let dot = "";
  if (status === "saving") { text = "Saving…"; dot = "bg-accent animate-pulse"; }
  else if (status === "saved") {
    const ago = lastSavedAt ? Math.floor((Date.now() - lastSavedAt) / 60000) : 0;
    text = ago < 1 ? "Saved · just now" : `Saved · ${ago}m ago`;
    dot = "bg-muted-foreground/40";
  }
  if (!text) return <div className="ml-auto" />;
  return (
    <div className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground/80">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {text}
    </div>
  );
}