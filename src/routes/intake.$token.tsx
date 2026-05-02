import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { loadIntake, saveIntake, type IntakeContext } from "@/server/intake.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Loader2, Check, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/intake/$token")({
  component: IntakePage,
  validateSearch: (s: Record<string, unknown>): { legacy?: "1" } => ({
    legacy: s.legacy === "1" ? "1" : undefined,
  }),
});

// Stable IDs persisted in DB; labels resolved via i18n at render time.
const EQUIPMENT_IDS = ["barbell", "dumbbells", "kettlebells", "cable_machine", "bench", "pull_up_bar", "bands", "bodyweight"] as const;
const READINESS_IDS = ["precontemplation", "contemplation", "preparation", "action", "maintenance"] as const;
const PARQ_KEYS = ["q1","q2","q3","q4","q5","q6","q7"] as const;
const MED_FLAG_IDS = ["beta_blockers", "bp_meds", "diabetes", "anticoagulants", "anti_inflammatories", "other"] as const;

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
  // Safety
  parq: Record<"q1"|"q2"|"q3"|"q4"|"q5"|"q6"|"q7", boolean | null>;
  medications: string;
  med_flags: string[];
};

const EMPTY: FormState = {
  smart_specific: "", smart_measurable: "", smart_deadline: "", smart_extra: "",
  readiness_stage: "",
  experience_level: "", training_days_per_week: "", session_duration_minutes: "",
  training_location: "", available_equipment: [], injuries: "", medical_conditions: "", preferences: "",
  sleep_quality: 7, stress_level: 5,
  ext_hours_seated: "", ext_daily_steps: "", ext_job_type: "", energy_levels: "", recovery_capacity: "",
  ext_meals_per_day: "", ext_water_l_per_day: "", ext_processed_food: 2, ext_alcohol_units_week: "", nutrition_habits: "",
  parq: { q1: null, q2: null, q3: null, q4: null, q5: null, q6: null, q7: null },
  medications: "",
  med_flags: [],
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
    parq: ext.parq ?? EMPTY.parq,
    medications: a.medications ?? "",
    med_flags: a.med_flags ?? [],
  };
}

function toPayload(f: FormState): { fields: Record<string, any>; sections: string[] } {
  const parqAnswered = Object.values(f.parq).every((v) => v === true || v === false);
  const parqHasYes = Object.values(f.parq).some((v) => v === true);
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
      // Clinical safety
      parq_passed: parqAnswered ? !parqHasYes : null,
      medications: f.medications || null,
      med_flags: f.med_flags,
      extended: {
        smart_extra: f.smart_extra || null,
        ext_hours_seated: f.ext_hours_seated ? Number(f.ext_hours_seated) : null,
        ext_daily_steps: f.ext_daily_steps ? Number(f.ext_daily_steps) : null,
        ext_job_type: f.ext_job_type || null,
        ext_meals_per_day: f.ext_meals_per_day ? Number(f.ext_meals_per_day) : null,
        ext_water_l_per_day: f.ext_water_l_per_day ? Number(f.ext_water_l_per_day) : null,
        ext_processed_food: f.ext_processed_food,
        ext_alcohol_units_week: f.ext_alcohol_units_week ? Number(f.ext_alcohol_units_week) : null,
        parq: f.parq,
      },
    },
    sections: ["safety", "smart_goal", "readiness", "training", "lifestyle", "nutrition"],
  };
}

function IntakePage() {
  const { token } = Route.useParams();
  const { t } = useTranslation("intake");
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
          <h1 className="text-2xl font-light tracking-tight">{t("expired_title")}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{t("expired_desc")}</p>
          <PoweredBy />
        </div>
      </div>
    );
  }

  if (ctx.status === "submitted") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-light tracking-tight">{ctx.submittedAt ? t("submitted_title_with_date", { date: new Date(ctx.submittedAt).toLocaleDateString() }) : t("submitted_title_no_date")}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{t("submitted_desc")}</p>
          <PoweredBy />
        </div>
      </div>
    );
  }

  if (submitted) {
    return <ThankYou ctx={ctx} />;
  }

  const trainerName = ctx.trainer?.business_name || ctx.trainer?.full_name || t("your_trainer");

  const submit = async () => {
    setSubmitting(true);
    try {
      await save({ data: { token, ...toPayload(form), submit: true } });
      try { localStorage.removeItem(`forge_intake_draft_${token}`); } catch {}
      setSubmitted(true);
    } catch (e: any) {
      toast.error(e?.message ?? t("submit_failed"));
    } finally { setSubmitting(false); }
  };

  const saveDraft = async () => {
    try {
      await save({ data: { token, ...toPayload(form), submit: false } });
      toast.success(t("saved_toast"));
    } catch (e: any) {
      toast.error(e?.message ?? t("save_failed"));
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
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{t("header_label")}</p>
          </div>
          <SaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-8">
        <h1 className="text-2xl font-light tracking-tight sm:text-3xl">{t("hi", { name: ctx.client?.first_name ?? "" })}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t("intro")}</p>

        <div className="mt-10 space-y-10">
          {/* SAFETY — PAR-Q+ */}
          <Section number={1} title={t("sections.parq_title")}>
            <p className="-mt-2 text-xs text-muted-foreground">{t("sections.parq_intro")}</p>
            <div className="space-y-3">
              {PARQ_KEYS.map((qk) => (
                <div key={qk} className="rounded-lg border border-border bg-background/40 p-3">
                  <p className="text-sm">{t(`parq.${qk}`)}</p>
                  <div className="mt-2 flex gap-2">
                    {([
                      { v: false, label: t("no") },
                      { v: true, label: t("yes") },
                    ] as const).map((opt) => {
                      const on = form.parq[qk] === opt.v;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => setForm({ ...form, parq: { ...form.parq, [qk]: opt.v } })}
                          className={`rounded-full border px-4 py-1.5 text-xs transition ${on ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
                        >{opt.label}</button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {Object.values(form.parq).some((v) => v === true) && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                {t("sections.parq_warning")}
              </div>
            )}
            <Field label={t("sections.medication_label")} optional optionalLabel={t("optional")}>
              <Textarea
                rows={2}
                value={form.medications}
                placeholder={t("sections.medication_placeholder")}
                onChange={(e) => setForm({ ...form, medications: e.target.value })}
              />
            </Field>
            <Field label={t("sections.med_flags_label")} optional optionalLabel={t("optional")}>
              <div className="flex flex-wrap gap-2">
                {MED_FLAG_IDS.map((mid) => {
                  const label = t(`med_flags.${mid}`);
                  const on = form.med_flags.includes(label);
                  return (
                    <button
                      key={mid}
                      type="button"
                      onClick={() => setForm({
                        ...form,
                        med_flags: on ? form.med_flags.filter((x) => x !== label) : [...form.med_flags, label],
                      })}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${on ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground"}`}
                    >{label}</button>
                  );
                })}
              </div>
            </Field>
          </Section>

          {/* SMART GOAL */}
          <Section number={2} title={t("sections.goal_title")}>
            <Field label={t("sections.goal_what")}>
              <Textarea value={form.smart_specific} onChange={(e) => setForm({ ...form, smart_specific: e.target.value })} placeholder={t("sections.goal_what_placeholder")} rows={3} />
            </Field>
            <Field label={t("sections.goal_measure")}>
              <Input value={form.smart_measurable} onChange={(e) => setForm({ ...form, smart_measurable: e.target.value })} />
            </Field>
            <Field label={t("sections.goal_when")}>
              <Input type="date" value={form.smart_deadline} onChange={(e) => setForm({ ...form, smart_deadline: e.target.value })} />
            </Field>
            <Field label={t("sections.goal_extra")} optional optionalLabel={t("optional")}>
              <Textarea value={form.smart_extra} onChange={(e) => setForm({ ...form, smart_extra: e.target.value })} rows={2} />
            </Field>
          </Section>

          {/* READINESS */}
          <Section number={3} title={t("sections.readiness_title")}>
            <div className="flex flex-wrap gap-2">
              {READINESS_IDS.map((rid) => (
                <button
                  key={rid}
                  type="button"
                  onClick={() => setForm({ ...form, readiness_stage: rid })}
                  className={`rounded-full border px-4 py-2 text-sm transition ${form.readiness_stage === rid ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
                >
                  {t(`readiness.${rid}`)}
                </button>
              ))}
            </div>
          </Section>

          {/* TRAINING SETUP */}
          <Section number={4} title={t("sections.training_title")}>
            <Field label={t("sections.training_experience")}>
              <Pills
                options={[
                  { id: "Beginner", label: t("experience.beginner") },
                  { id: "Intermediate", label: t("experience.intermediate") },
                  { id: "Advanced", label: t("experience.advanced") },
                ]}
                value={form.experience_level}
                onChange={(v) => setForm({ ...form, experience_level: v })}
              />
            </Field>
            <Field label={t("sections.training_days")}>
              <Pills
                options={["1","2","3","4","5","6","7"].map((n) => ({ id: n, label: n }))}
                value={form.training_days_per_week}
                onChange={(v) => setForm({ ...form, training_days_per_week: v })}
              />
            </Field>
            <Field label={t("sections.training_duration")}>
              <Pills
                options={["30","45","60","75","90"].map((n) => ({ id: n, label: `${n} min` }))}
                value={form.session_duration_minutes}
                onChange={(v) => setForm({ ...form, session_duration_minutes: v })}
              />
            </Field>
            <Field label={t("sections.training_location")}>
              <Pills
                options={[
                  { id: "Home", label: t("location.home") },
                  { id: "Gym", label: t("location.gym") },
                  { id: "Outdoor", label: t("location.outdoor") },
                  { id: "Mixed", label: t("location.mixed") },
                ]}
                value={form.training_location}
                onChange={(v) => setForm({ ...form, training_location: v })}
              />
            </Field>
            <Field label={t("sections.training_equipment")}>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT_IDS.map((eid) => {
                  // Persist the EN canonical label for backend compatibility.
                  const enLabels: Record<string, string> = {
                    barbell: "Barbell", dumbbells: "Dumbbells", kettlebells: "Kettlebells",
                    cable_machine: "Cable machine", bench: "Bench", pull_up_bar: "Pull-up bar",
                    bands: "Bands", bodyweight: "Bodyweight only",
                  };
                  const persisted = enLabels[eid];
                  const label = t(`equipment.${eid}`);
                  const on = form.available_equipment.includes(persisted);
                  return (
                    <button
                      key={eid}
                      type="button"
                      onClick={() => setForm({
                        ...form,
                        available_equipment: on ? form.available_equipment.filter((x) => x !== persisted) : [...form.available_equipment, persisted],
                      })}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${on ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground"}`}
                    >{label}</button>
                  );
                })}
              </div>
            </Field>
            <Field label={t("sections.training_injuries")} optional optionalLabel={t("optional")}>
              <Textarea rows={2} value={form.injuries} onChange={(e) => setForm({ ...form, injuries: e.target.value })} />
            </Field>
            <Field label={t("sections.training_conditions")} optional optionalLabel={t("optional")}>
              <Textarea rows={2} value={form.medical_conditions} onChange={(e) => setForm({ ...form, medical_conditions: e.target.value })} />
            </Field>
            <Field label={t("sections.training_preferences")} optional optionalLabel={t("optional")}>
              <Textarea rows={2} value={form.preferences} onChange={(e) => setForm({ ...form, preferences: e.target.value })} />
            </Field>
          </Section>

          {/* LIFESTYLE */}
          <Section number={5} title={t("sections.lifestyle_title")}>
            <SliderField label={t("sections.lifestyle_sleep")} value={form.sleep_quality} min={1} max={10} onChange={(v) => setForm({ ...form, sleep_quality: v })} legend={t("sections.lifestyle_sleep_legend")} />
            <SliderField label={t("sections.lifestyle_stress")} value={form.stress_level} min={1} max={10} onChange={(v) => setForm({ ...form, stress_level: v })} legend={t("sections.lifestyle_stress_legend")} />
            <Field label={t("sections.lifestyle_seated")}>
              <Input inputMode="numeric" value={form.ext_hours_seated} onChange={(e) => setForm({ ...form, ext_hours_seated: e.target.value })} />
            </Field>
            <Field label={t("sections.lifestyle_steps")} optional optionalLabel={t("optional")}>
              <Input inputMode="numeric" value={form.ext_daily_steps} onChange={(e) => setForm({ ...form, ext_daily_steps: e.target.value })} />
            </Field>
            <Field label={t("sections.lifestyle_job")}>
              <Pills
                options={[
                  { id: "Desk", label: t("job.desk") },
                  { id: "Manual", label: t("job.manual") },
                  { id: "Mixed", label: t("job.mixed") },
                  { id: "Other", label: t("job.other") },
                ]}
                value={form.ext_job_type}
                onChange={(v) => setForm({ ...form, ext_job_type: v })}
              />
            </Field>
            <Field label={t("sections.lifestyle_energy")} optional optionalLabel={t("optional")}>
              <Textarea rows={2} value={form.energy_levels} onChange={(e) => setForm({ ...form, energy_levels: e.target.value })} />
            </Field>
            <Field label={t("sections.lifestyle_recovery")} optional optionalLabel={t("optional")}>
              <Textarea rows={2} value={form.recovery_capacity} onChange={(e) => setForm({ ...form, recovery_capacity: e.target.value })} />
            </Field>
          </Section>

          {/* NUTRITION */}
          <Section number={6} title={t("sections.nutrition_title")}>
            <Field label={t("sections.nutrition_meals")}>
              <Input inputMode="numeric" value={form.ext_meals_per_day} onChange={(e) => setForm({ ...form, ext_meals_per_day: e.target.value })} />
            </Field>
            <Field label={t("sections.nutrition_water")}>
              <Input inputMode="decimal" value={form.ext_water_l_per_day} onChange={(e) => setForm({ ...form, ext_water_l_per_day: e.target.value })} />
            </Field>
            <SliderField label={t("sections.nutrition_processed")} value={form.ext_processed_food} min={1} max={5} onChange={(v) => setForm({ ...form, ext_processed_food: v })} legend={t("sections.nutrition_processed_legend")} />
            <Field label={t("sections.nutrition_alcohol")}>
              <Input inputMode="numeric" value={form.ext_alcohol_units_week} onChange={(e) => setForm({ ...form, ext_alcohol_units_week: e.target.value })} />
            </Field>
            <Field label={t("sections.nutrition_habits")} optional optionalLabel={t("optional")}>
              <Textarea rows={3} value={form.nutrition_habits} onChange={(e) => setForm({ ...form, nutrition_habits: e.target.value })} />
            </Field>
          </Section>
        </div>

        <div className="mt-12 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={saveDraft} disabled={submitting}>{t("save_draft")}</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("submitting")}</> : t("submit")}
          </Button>
        </div>

        <PoweredBy />
      </main>
    </div>
  );
}

function ThankYou({ ctx }: { ctx: IntakeContext }) {
  const { t } = useTranslation("intake");
  const trainerName = ctx.trainer?.business_name || ctx.trainer?.full_name || t("your_trainer");
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Check className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-light tracking-tight">{t("thanks_title", { name: ctx.client?.first_name ?? "" })}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t("thanks_desc", { trainer: trainerName })}</p>
        <PoweredBy />
      </div>
    </div>
  );
}

function PoweredBy() {
  const { t } = useTranslation("intake");
  return (
    <p className="mt-16 text-center text-[10px] uppercase tracking-widest text-muted-foreground/50">
      {t("powered_by")} <a href="https://forge.app" className="hover:underline">Forge</a>
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

function Field({ label, optional, optionalLabel, children }: { label: string; optional?: boolean; optionalLabel?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label} {optional && <span className="text-[11px] text-muted-foreground/70">{optionalLabel ?? "(optional)"}</span>}</Label>
      {children}
    </div>
  );
}

function Pills({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${on ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
          >{o.label}</button>
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
  const { t } = useTranslation("intake");
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  let text = "";
  let dot = "";
  if (status === "saving") { text = t("saving"); dot = "bg-accent animate-pulse"; }
  else if (status === "saved") {
    const ago = lastSavedAt ? Math.floor((Date.now() - lastSavedAt) / 60000) : 0;
    text = ago < 1 ? t("saved_just_now") : t("saved_minutes_ago", { minutes: ago });
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