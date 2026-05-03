import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { loadIntake, saveIntake, type IntakeContext } from "@/server/intake.functions";
import { interpretGoal } from "@/server/intake-ai.functions";
import { uploadIntakePhoto, getIntakePhotoUrls } from "@/server/intake-photos.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Loader2, Check, ChevronLeft, ChevronRight, SkipForward } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

function TrainerLogo({ url }: { url?: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <BrandMark size="sm" />;
  return (
    <img
      src={url}
      alt=""
      className="h-9 w-9 rounded-md object-cover"
      onError={() => setFailed(true)}
    />
  );
}

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
  // Identity (cliente preenche aqui — substitui o placeholder do PT)
  client_full_name: string;
  client_email: string;
  client_phone: string;
  client_dob: string;
  // Path: who is filling this in
  intake_path: "" | "coached" | "self";
  // Scheduling (PT-guided path)
  sched_days: string[];
  sched_window: string;
  // Lifestyle gate decision
  lifestyle_gate: "" | "yes" | "skip";
  // AI goal interpretation (cached client-side; source of truth lives in extended)
  ai_goal_label: string;
  ai_goal_confirmed: "" | "yes" | "no";
  // Skipped flags (field key -> true)
  skipped: Record<string, boolean>;
  smart_specific: string;
  smart_measurable: string;
  smart_deadline: string;
  smart_extra: string;
  readiness_stage: string;
  experience_level: string;
  training_days_per_week: string;
  session_duration_minutes: string;
  training_location: string[];
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
  client_full_name: "", client_email: "", client_phone: "", client_dob: "",
  intake_path: "",
  sched_days: [], sched_window: "",
  lifestyle_gate: "",
  ai_goal_label: "", ai_goal_confirmed: "",
  skipped: {},
  smart_specific: "", smart_measurable: "", smart_deadline: "", smart_extra: "",
  readiness_stage: "",
  experience_level: "", training_days_per_week: "", session_duration_minutes: "",
  training_location: [], available_equipment: [], injuries: "", medical_conditions: "", preferences: "",
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
    intake_path: ext.intake_path ?? "",
    sched_days: ext.sched_days ?? [],
    sched_window: ext.sched_window ?? "",
    lifestyle_gate: ext.lifestyle_gate ?? "",
    ai_goal_label: ext.ai_goal_interpretation?.human_label ?? "",
    ai_goal_confirmed: ext.ai_goal_confirmed ?? "",
    skipped: ext.skipped ?? {},
    smart_specific: a.smart_specific ?? "",
    smart_measurable: a.smart_measurable ?? "",
    smart_deadline: a.smart_deadline ?? "",
    smart_extra: ext.smart_extra ?? "",
    readiness_stage: a.readiness_stage ?? "",
    experience_level: a.experience_level ?? "",
    training_days_per_week: a.training_days_per_week?.toString() ?? "",
    session_duration_minutes: a.session_duration_minutes?.toString() ?? "",
    training_location: Array.isArray(a.training_location)
      ? a.training_location
      : (typeof a.training_location === "string" && a.training_location.length > 0 ? [a.training_location] : []),
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

function toPayload(f: FormState): { fields: Record<string, any>; sections: string[]; identity: { full_name?: string; email?: string; phone?: string; date_of_birth?: string } } {
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
      training_location: f.training_location.length > 0 ? f.training_location : null,
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
        intake_path: f.intake_path || null,
        sched_days: f.sched_days,
        sched_window: f.sched_window || null,
        lifestyle_gate: f.lifestyle_gate || null,
        ai_goal_confirmed: f.ai_goal_confirmed || null,
        skipped: f.skipped,
      },
    },
    sections: ["safety", "smart_goal", "readiness", "training", "lifestyle", "nutrition"],
    identity: {
      full_name: f.client_full_name?.trim() || undefined,
      email: f.client_email?.trim() || undefined,
      phone: f.client_phone?.trim() || undefined,
      date_of_birth: f.client_dob || undefined,
    },
  };
}

function IntakePage() {
  const { token } = Route.useParams();
  const { legacy } = Route.useSearch();
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
          const base = fromAssessment(c.assessment);
          // Pre-hydrate identity from server (if PT pre-filled) so the
          // questions only show if missing.
          base.client_full_name = c.client?.full_name ?? "";
          base.client_email = c.client?.email ?? "";
          base.client_phone = c.client?.phone ?? "";
          base.client_dob = c.client?.date_of_birth ?? "";
          setForm(base);
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

  if (legacy !== "1") {
    return (
      <SlideshowIntake
        ctx={ctx}
        form={form}
        setForm={setForm}
        trainerName={trainerName}
        submitting={submitting}
        onSubmit={submit}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
      />
    );
  }

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

/* ─────────────── Slideshow layout ─────────────── */

type SlideshowProps = {
  ctx: IntakeContext;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  trainerName: string;
  submitting: boolean;
  onSubmit: () => void;
  saveStatus: "idle" | "saving" | "saved";
  lastSavedAt: number | null;
};

function SlideshowIntake({ ctx, form, setForm, trainerName, submitting, onSubmit, saveStatus, lastSavedAt }: SlideshowProps & { token?: string }) {
  const { t } = useTranslation("intake");
  const [step, setStep] = useState(0);
  const { token } = Route.useParams();
  const steps = useMemo(() => buildSlides(t, form, setForm, token), [t, form, setForm, token]);
  const total = steps.length;
  const current = steps[step];
  const isLast = step === total - 1;

  const canAdvance = current?.isValid?.() ?? true;

  const next = useCallback(() => {
    if (!canAdvance) return;
    if (isLast) { onSubmit(); return; }
    setStep((s) => Math.min(total - 1, s + 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [canAdvance, isLast, onSubmit, total]);

  const prev = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Keyboard: Enter to advance (when not in textarea), Escape to go back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inTextarea = target?.tagName === "TEXTAREA";
      if (e.key === "Enter" && !inTextarea && !e.shiftKey) { e.preventDefault(); next(); }
      if (e.key === "Escape") { e.preventDefault(); prev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const progress = Math.round(((step + 1) / total) * 100);

  return (
    <div className="min-h-screen bg-background">
      {/* Progress bar */}
      <div className="fixed inset-x-0 top-0 z-20 h-1 bg-border/40">
        <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <header className="border-b border-border/60 bg-card/40">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <TrainerLogo url={ctx.trainer?.logo_url} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{trainerName}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("step_of", { current: step + 1, total })}
            </p>
          </div>
          <SaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-120px)] max-w-2xl flex-col px-4 pb-32 pt-10 sm:pt-16">
        <div key={step} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {current.title && (
            <h1 className="text-2xl font-light tracking-tight sm:text-3xl">{current.title}</h1>
          )}
          {current.subtitle && (
            <p className="mt-3 text-sm text-muted-foreground">{current.subtitle}</p>
          )}
          <div className="mt-8 space-y-5">{current.body}</div>
        </div>
      </main>

      {/* Sticky footer */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <Button variant="ghost" size="sm" onClick={prev} disabled={step === 0 || submitting}>
            <ChevronLeft className="mr-1 h-4 w-4" /> {t("back")}
          </Button>
          <p className="hidden flex-1 text-center text-[10px] uppercase tracking-widest text-muted-foreground/60 sm:block">
            ↵ {t("next")} · Esc {t("back")}
          </p>
          {current?.canSkip && !canAdvance && (
            <Button variant="ghost" size="sm" onClick={() => {
              // Mark all skip-keys, then advance regardless of validity.
              const keys = current.skipKeys ?? [];
              if (keys.length) {
                setForm((f) => ({ ...f, skipped: { ...f.skipped, ...Object.fromEntries(keys.map((k: string) => [k, true])) } }));
              }
              if (isLast) onSubmit(); else setStep((s) => Math.min(total - 1, s + 1));
            }} disabled={submitting}>
              <SkipForward className="mr-1 h-4 w-4" /> {t("skip")}
            </Button>
          )}
          <Button onClick={next} disabled={!canAdvance || submitting} size="sm">
            {submitting && isLast ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("submitting")}</>
            ) : isLast ? (
              <>{t("submit")} <Check className="ml-1 h-4 w-4" /></>
            ) : (
              <>{t("next")} <ChevronRight className="ml-1 h-4 w-4" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Slide definitions ─────────────── */

type Slide = {
  title?: string;
  subtitle?: string;
  body: React.ReactNode;
  isValid?: () => boolean;
  canSkip?: boolean;
  skipKeys?: string[];
};

function buildSlides(
  t: (k: string, opts?: any) => string,
  form: FormState,
  setForm: React.Dispatch<React.SetStateAction<FormState>>,
  token?: string,
): Slide[] {
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const enLabels: Record<string, string> = {
    barbell: "Barbell", dumbbells: "Dumbbells", kettlebells: "Kettlebells",
    cable_machine: "Cable machine", bench: "Bench", pull_up_bar: "Pull-up bar",
    bands: "Bands", bodyweight: "Bodyweight only",
  };
  const equipmentIds = ["barbell", "dumbbells", "kettlebells", "cable_machine", "bench", "pull_up_bar", "bands", "bodyweight"];
  const parqKeys = ["q1","q2","q3","q4","q5","q6","q7"] as const;
  const medFlagIds = ["beta_blockers", "bp_meds", "diabetes", "anticoagulants", "anti_inflammatories", "other"];
  const readinessIds = ["precontemplation", "contemplation", "preparation", "action", "maintenance"];

  return [
    // 1. Welcome
    {
      title: t("welcome_title", { name: "" }).replace(", ", ""),
      subtitle: t("intro"),
      body: <p className="text-xs uppercase tracking-widest text-muted-foreground/70">↵ {t("welcome_start")}</p>,
    },
    // 1a. Path selector — coached vs self
    {
      title: t("path_title"),
      subtitle: t("path_subtitle"),
      body: (
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            { id: "coached", label: t("path_coached"), desc: t("path_coached_desc") },
            { id: "self", label: t("path_self"), desc: t("path_self_desc") },
          ] as const).map((opt) => {
            const on = form.intake_path === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => set("intake_path", opt.id)}
                className={`rounded-xl border p-4 text-left transition ${on ? "border-accent bg-accent/10" : "border-border bg-card hover:border-accent/40"}`}
              >
                <p className="text-sm font-semibold">{opt.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{opt.desc}</p>
              </button>
            );
          })}
        </div>
      ),
      isValid: () => !!form.intake_path,
    },
    // 1b. Identity — quem és tu
    {
      title: t("identity_title", { defaultValue: "Quem és tu?" }),
      subtitle: t("identity_subtitle", { defaultValue: "O teu treinador precisa do teu nome e contacto. O resto é a avaliação." }),
      body: (
        <div className="space-y-3">
          <Input
            autoFocus
            placeholder={t("identity_full_name", { defaultValue: "Nome completo" })}
            value={form.client_full_name}
            onChange={(e) => set("client_full_name", e.target.value)}
          />
          <Input
            type="email"
            placeholder={t("identity_email", { defaultValue: "Email" })}
            value={form.client_email}
            onChange={(e) => set("client_email", e.target.value)}
          />
          <Input
            type="tel"
            placeholder={t("identity_phone", { defaultValue: "Telemóvel (opcional)" })}
            value={form.client_phone}
            onChange={(e) => set("client_phone", e.target.value)}
          />
          <Input
            type="date"
            placeholder={t("identity_dob", { defaultValue: "Data de nascimento (opcional)" })}
            value={form.client_dob}
            onChange={(e) => set("client_dob", e.target.value)}
          />
        </div>
      ),
      isValid: () => form.client_full_name.trim().length > 1 && /\S+@\S+\.\S+/.test(form.client_email.trim()),
    },
    // 2. SMART goal — what
    {
      title: t("sections.goal_what"),
      body: (
        <Textarea
          autoFocus
          rows={3}
          value={form.smart_specific}
          placeholder={t("sections.goal_what_placeholder")}
          onChange={(e) => set("smart_specific", e.target.value)}
          className="text-base"
        />
      ),
      isValid: () => form.smart_specific.trim().length > 2,
    },
    // 3. SMART measure + deadline
    {
      title: t("sections.goal_measure"),
      subtitle: t("sections.goal_when"),
      body: (
        <div className="space-y-4">
          <Input autoFocus value={form.smart_measurable} onChange={(e) => set("smart_measurable", e.target.value)} />
          <Input type="date" value={form.smart_deadline} onChange={(e) => set("smart_deadline", e.target.value)} />
        </div>
      ),
    },
    // 4. Readiness
    {
      title: t("sections.readiness_title"),
      body: (
        <Pills
          options={readinessIds.map((rid) => ({ id: rid, label: t(`readiness.${rid}`) }))}
          value={form.readiness_stage}
          onChange={(v) => set("readiness_stage", v)}
        />
      ),
      isValid: () => !!form.readiness_stage,
    },
    // 5. Experience
    {
      title: t("sections.training_experience"),
      body: (
        <Pills
          options={[
            { id: "Beginner", label: t("experience.beginner") },
            { id: "Intermediate", label: t("experience.intermediate") },
            { id: "Advanced", label: t("experience.advanced") },
          ]}
          value={form.experience_level}
          onChange={(v) => set("experience_level", v)}
        />
      ),
      isValid: () => !!form.experience_level,
    },
    // 6. Days + duration
    {
      title: t("sections.training_days"),
      subtitle: t("sections.training_duration"),
      body: (
        <div className="space-y-5">
          <Pills
            options={["1","2","3","4","5","6","7"].map((n) => ({ id: n, label: n }))}
            value={form.training_days_per_week}
            onChange={(v) => set("training_days_per_week", v)}
          />
          <Pills
            options={["30","45","60","75","90"].map((n) => ({ id: n, label: `${n} min` }))}
            value={form.session_duration_minutes}
            onChange={(v) => set("session_duration_minutes", v)}
          />
        </div>
      ),
      isValid: () => !!form.training_days_per_week && !!form.session_duration_minutes,
    },
    // 7. Location
    {
      title: t("sections.training_location"),
      body: (
        <Pills
          options={[
            { id: "Home", label: t("location.home") },
            { id: "Gym", label: t("location.gym") },
            { id: "Outdoor", label: t("location.outdoor") },
            { id: "Mixed", label: t("location.mixed") },
          ]}
          value={form.training_location}
          onChange={(v) => set("training_location", v)}
        />
      ),
      isValid: () => !!form.training_location,
    },
    // 8. Equipment
    {
      title: t("sections.training_equipment"),
      body: (
        <div className="flex flex-wrap gap-2">
          {equipmentIds.map((eid) => {
            const persisted = enLabels[eid];
            const on = form.available_equipment.includes(persisted);
            return (
              <button
                key={eid}
                type="button"
                onClick={() => set("available_equipment", on
                  ? form.available_equipment.filter((x) => x !== persisted)
                  : [...form.available_equipment, persisted])}
                className={`rounded-full border px-3 py-2 text-sm transition ${on ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
              >{t(`equipment.${eid}`)}</button>
            );
          })}
        </div>
      ),
    },
    // 9. Injuries (optional)
    {
      title: t("sections.training_injuries"),
      subtitle: t("optional"),
      body: (
        <Textarea autoFocus rows={3} value={form.injuries} onChange={(e) => set("injuries", e.target.value)} />
      ),
    },
    // 10. PAR-Q
    {
      title: t("sections.parq_title"),
      subtitle: t("sections.parq_intro"),
      body: (
        <div className="space-y-3">
          {parqKeys.map((qk) => (
            <div key={qk} className="rounded-lg border border-border bg-card p-3">
              <p className="text-sm">{t(`parq.${qk}`)}</p>
              <div className="mt-2 flex gap-2">
                {[{ v: false, label: t("no") }, { v: true, label: t("yes") }].map((opt) => {
                  const on = form.parq[qk] === opt.v;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, parq: { ...f.parq, [qk]: opt.v } }))}
                      className={`rounded-full border px-4 py-1.5 text-xs transition ${on ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
                    >{opt.label}</button>
                  );
                })}
              </div>
            </div>
          ))}
          {Object.values(form.parq).some((v) => v === true) && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              {t("sections.parq_warning")}
            </div>
          )}
        </div>
      ),
      isValid: () => Object.values(form.parq).every((v) => v === true || v === false),
    },
    // 11. Medications + flags (optional)
    {
      title: t("sections.medication_label"),
      subtitle: t("optional"),
      body: (
        <div className="space-y-4">
          <Textarea rows={2} value={form.medications} placeholder={t("sections.medication_placeholder")} onChange={(e) => set("medications", e.target.value)} />
          <div>
            <Label className="text-sm">{t("sections.med_flags_label")}</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {medFlagIds.map((mid) => {
                const label = t(`med_flags.${mid}`);
                const on = form.med_flags.includes(label);
                return (
                  <button
                    key={mid}
                    type="button"
                    onClick={() => set("med_flags", on ? form.med_flags.filter((x) => x !== label) : [...form.med_flags, label])}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${on ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground"}`}
                  >{label}</button>
                );
              })}
            </div>
          </div>
        </div>
      ),
    },
    // 12. Sleep
    {
      title: t("sections.lifestyle_sleep"),
      body: <SliderField label="" value={form.sleep_quality} min={1} max={10} onChange={(v) => set("sleep_quality", v)} legend={t("sections.lifestyle_sleep_legend")} />,
    },
    // 13. Stress
    {
      title: t("sections.lifestyle_stress"),
      body: <SliderField label="" value={form.stress_level} min={1} max={10} onChange={(v) => set("stress_level", v)} legend={t("sections.lifestyle_stress_legend")} />,
    },
    // 14. Lifestyle: seated + steps + job
    {
      title: t("sections.lifestyle_title"),
      body: (
        <div className="space-y-4">
          <Field label={t("sections.lifestyle_seated")}>
            <Input inputMode="numeric" value={form.ext_hours_seated} onChange={(e) => set("ext_hours_seated", e.target.value)} />
          </Field>
          <Field label={t("sections.lifestyle_steps")} optional optionalLabel={t("optional")}>
            <Input inputMode="numeric" value={form.ext_daily_steps} onChange={(e) => set("ext_daily_steps", e.target.value)} />
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
              onChange={(v) => set("ext_job_type", v)}
            />
          </Field>
        </div>
      ),
    },
    // 15. Nutrition
    {
      title: t("sections.nutrition_title"),
      body: (
        <div className="space-y-4">
          <Field label={t("sections.nutrition_meals")}>
            <Input inputMode="numeric" value={form.ext_meals_per_day} onChange={(e) => set("ext_meals_per_day", e.target.value)} />
          </Field>
          <Field label={t("sections.nutrition_water")}>
            <Input inputMode="decimal" value={form.ext_water_l_per_day} onChange={(e) => set("ext_water_l_per_day", e.target.value)} />
          </Field>
          <SliderField label={t("sections.nutrition_processed")} value={form.ext_processed_food} min={1} max={5} onChange={(v) => set("ext_processed_food", v)} legend={t("sections.nutrition_processed_legend")} />
          <Field label={t("sections.nutrition_alcohol")} optional optionalLabel={t("optional")}>
            <Input inputMode="numeric" value={form.ext_alcohol_units_week} onChange={(e) => set("ext_alcohol_units_week", e.target.value)} />
          </Field>
          <Field label={t("sections.nutrition_habits")} optional optionalLabel={t("optional")}>
            <Textarea rows={3} value={form.nutrition_habits} onChange={(e) => set("nutrition_habits", e.target.value)} />
          </Field>
        </div>
      ),
    },
    // 15a. Reference photos (optional)
    {
      title: t("photos_title", { defaultValue: "Fotografias de referência" }),
      subtitle: t("photos_subtitle", { defaultValue: "Não usamos para diagnosticar postura. Servem para acompanhar a tua evolução visualmente. Podes saltar." }),
      body: (
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            { slot: "front", label: t("photos_front", { defaultValue: "Frente" }), hint: t("photos_front_hint", { defaultValue: "Braços ao lado do corpo, pés à largura dos ombros." }) },
            { slot: "side", label: t("photos_side", { defaultValue: "Lateral" }), hint: t("photos_side_hint", { defaultValue: "Olhar em frente, postura natural." }) },
            { slot: "back", label: t("photos_back", { defaultValue: "Costas" }), hint: t("photos_back_hint", { defaultValue: "Mesma posição, de costas para a câmara." }) },
            { slot: "face", label: t("photos_face", { defaultValue: "Rosto" }), hint: t("photos_face_hint", { defaultValue: "Foto de perfil simpática :)" }) },
          ] as const).map((opt) => (
            <PhotoSlot
              key={opt.slot}
              token={token}
              slot={opt.slot}
              label={opt.label}
              hint={opt.hint}
              tutorial={t("photos_tutorial", { defaultValue: "Distância 2m, parede neutra, roupa justa, telemóvel à altura do peito." })}
            />
          ))}
        </div>
      ),
      canSkip: true,
      skipKeys: ["photos"],
    },
    // 16. Review
    {
      title: t("review_title"),
      subtitle: t("review_desc"),
      body: (
        <div className="space-y-2 rounded-lg border border-border bg-card/60 p-4 text-sm">
          <ReviewRow label={t("sections.goal_what")} value={form.smart_specific} />
          <ReviewRow label={t("sections.goal_measure")} value={form.smart_measurable} />
          <ReviewRow label={t("sections.goal_when")} value={form.smart_deadline} />
          <ReviewRow label={t("sections.training_experience")} value={form.experience_level} />
          <ReviewRow label={t("sections.training_days")} value={form.training_days_per_week} />
          <ReviewRow label={t("sections.training_duration")} value={form.session_duration_minutes ? `${form.session_duration_minutes} min` : ""} />
          <ReviewRow label={t("sections.training_location")} value={form.training_location} />
          <ReviewRow label={t("sections.training_equipment")} value={form.available_equipment.join(", ")} />
        </div>
      ),
    },
  ];
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/40 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{value || "—"}</span>
    </div>
  );
}

/* ─────────────── Photo slot (reference photos) ─────────────── */

function PhotoSlot({ token, slot, label, hint, tutorial }: {
  token?: string;
  slot: "front" | "side" | "back" | "face";
  label: string;
  hint: string;
  tutorial: string;
}) {
  const upload = useServerFn(uploadIntakePhoto);
  const fetchUrls = useServerFn(getIntakePhotoUrls);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Hydrate: if a photo for this slot was already uploaded, mark done and
  // show the signed URL preview so the user knows it's saved.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const urls = await fetchUrls({ data: { token } });
        if (cancelled) return;
        const url = (urls as Record<string, string>)[slot];
        if (url) {
          setPreview(url);
          setDone(true);
        } else {
          // Pending IDB upload? Try to flush.
          const pending = await idbGet(`forge_intake_photo_${token}_${slot}`);
          if (pending && typeof pending === "string") {
            setPreview(pending);
            void retryUpload(pending);
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, slot]);

  const retryUpload = async (dataUrl: string, attempt = 0): Promise<void> => {
    try {
      await upload({ data: { token: token!, slot, dataUrl } });
      await idbDel(`forge_intake_photo_${token}_${slot}`);
      setDone(true);
    } catch (e) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 800 * Math.pow(2, attempt)));
        return retryUpload(dataUrl, attempt + 1);
      }
      throw e;
    }
  };

  const onFile = async (file: File) => {
    if (!token) {
      toast.error("Sem ligação. Tenta novamente.");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await resizeToJpegDataUrl(file, 1600, 0.82);
      setPreview(dataUrl);
      // Stash locally BEFORE upload so a crash doesn't lose the capture.
      await idbSet(`forge_intake_photo_${token}_${slot}`, dataUrl);
      await retryUpload(dataUrl);
      toast.success(`${label} guardada`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falhou — guardada localmente, tenta enviar de novo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{label}</p>
        {done && <span className="text-[10px] uppercase tracking-widest text-accent">✓</span>}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      <div className="mt-3 aspect-[3/4] overflow-hidden rounded-lg bg-background/50">
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground/60">
            {tutorial}
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <Button
        type="button"
        size="sm"
        variant={done ? "outline" : "default"}
        className="mt-3 w-full"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> A enviar…</> : done ? "Tirar outra" : "Tirar foto"}
      </Button>
    </div>
  );
}

async function resizeToJpegDataUrl(file: File, maxSide: number, quality: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const cx = c.getContext("2d");
    if (!cx) throw new Error("Canvas não suportado.");
    cx.drawImage(img, 0, 0, w, h);
    return c.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ─────────────── Tiny IndexedDB key/value (for crash-resistant photo stash) ─────────────── */

const IDB_NAME = "forge-intake";
const IDB_STORE = "kv";
function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function idbSet(key: string, value: string): Promise<void> {
  try {
    const db = await idbOpen();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch {}
}
async function idbGet(key: string): Promise<string | null> {
  try {
    const db = await idbOpen();
    return await new Promise<string | null>((res) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const r = tx.objectStore(IDB_STORE).get(key);
      r.onsuccess = () => res((r.result as string) ?? null);
      r.onerror = () => res(null);
    });
  } catch { return null; }
}
async function idbDel(key: string): Promise<void> {
  try {
    const db = await idbOpen();
    await new Promise<void>((res) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  } catch {}
}