import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Sparkles, FileText, Loader2, CheckCircle2, Circle, Info, AlertTriangle, Trash2, Eraser } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generatePlanDraft } from "@/server/plan.functions";
import { markOnboardingStep } from "@/components/OnboardingChecklist";

export const Route = createFileRoute("/clients_/$clientId")({
  component: () => (
    <AppShell back={{ to: "/clients", label: "All clients" }}>
      <ClientDetail />
    </AppShell>
  ),
});

const EQUIPMENT = ["Barbell", "Dumbbells", "Kettlebells", "Cable machine", "Bench", "Pull-up bar", "Bands", "Bodyweight only"];

function ClientDetail() {
  const { clientId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const generateFn = useServerFn(generatePlanDraft);

  const [client, setClient] = useState<any>(null);
  const [assessment, setAssessment] = useState<any>({
    // PAR-Q+ pre-screening
    parq: { q1: null, q2: null, q3: null, q4: null, q5: null, q6: null, q7: null },
    // Risk stratification
    risk: {
      family_cvd: false, smoking: "never", sedentary: false, bmi_category: "",
      dyslipidemia: false, prediabetes: false, hypertension: false,
    },
    // Anthropometry
    waist_cm: "",
    hip_cm: "",
    body_fat_pct: "",
    body_fat_method: "",
    // Meds
    medications: "",
    med_flags: [] as string[],
    // SMART
    smart_specific: "",
    smart_measurable: "",
    smart_deadline: "",
    // Readiness to change
    readiness_stage: "",
    // New lifestyle replacements
    ext_hours_seated: "",
    ext_daily_steps: "",
    ext_job_type: "",
    // Nutrition replacements
    ext_meals_per_day: "",
    ext_alcohol_units_week: "",
    ext_processed_food_freq: "",
    ext_water_l_per_day: "",
    // Anatomical mobility checklist (1-5 scores)
    ext_mob_shoulder: "",
    ext_mob_hip: "",
    ext_mob_ankle: "",
    ext_mob_thoracic: "",
    ext_mob_wrist: "",
    ext_mob_knee: "",
    // Cardio test
    ext_cardio_test: "untested",
    ext_cardio_value: "",
    // existing
    primary_goal: "",
    experience_level: "",
    training_days_per_week: 3,
    session_duration_minutes: 60,
    available_equipment: [] as string[],
    training_location: "",
    injuries: "",
    medical_conditions: "",
    preferences: "",
    sleep_quality: "",
    stress_level: "",
    nutrition_habits: "",
    hydration_glasses_per_day: "",
    mobility_limitations: "",
    energy_levels: "",
    recovery_capacity: "",
    lifestyle: "",
    // Posture & alignment
    standing_posture_notes: "",
    known_imbalances: "",
    dominant_side: "",
    // Movement screen (1-5 + note)
    squat_depth_score: "",
    squat_depth_note: "",
    overhead_reach_score: "",
    overhead_reach_note: "",
    hip_hinge_score: "",
    hip_hinge_note: "",
    single_leg_balance_score: "",
    single_leg_balance_note: "",
    // Training history
    years_training: "",
    previous_program_style: "",
    max_lifts: "",
    // Performance markers
    resting_heart_rate: "",
    cardio_capacity: "",
  });
  const [duration, setDuration] = useState(4);
  const [plans, setPlans] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [activeSection, setActiveSection] = useState("parq");

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: c } = await supabase.from("clients").select("*").eq("id", clientId).single();
      setClient(c);
      const { data: a } = await supabase.from("assessments").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (a) {
        const ext = (a.extended ?? {}) as Record<string, any>;
        setAssessment((prev: any) => ({
          ...prev,
          ...a,
          available_equipment: a.available_equipment ?? [],
          parq: ext.parq ?? prev.parq,
          risk: ext.risk ?? prev.risk,
          ext_hours_seated: ext.hours_seated ?? "",
          ext_daily_steps: ext.daily_steps ?? "",
          ext_job_type: ext.job_type ?? "",
          ext_meals_per_day: ext.meals_per_day ?? "",
          ext_alcohol_units_week: ext.alcohol_units_week ?? "",
          ext_processed_food_freq: ext.processed_food_freq ?? "",
          ext_water_l_per_day: ext.water_l_per_day ?? "",
          ext_mob_shoulder: ext.mob_shoulder ?? "",
          ext_mob_hip: ext.mob_hip ?? "",
          ext_mob_ankle: ext.mob_ankle ?? "",
          ext_mob_thoracic: ext.mob_thoracic ?? "",
          ext_mob_wrist: ext.mob_wrist ?? "",
          ext_mob_knee: ext.mob_knee ?? "",
          ext_cardio_test: ext.cardio_test ?? "untested",
          ext_cardio_value: ext.cardio_value ?? "",
          med_flags: a.med_flags ?? [],
        }));
      }
      const { data: p } = await supabase.from("workout_plans").select("id, title, status, updated_at").eq("client_id", clientId).order("updated_at", { ascending: false });
      setPlans(p ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, clientId]);

  const toggleEq = (e: string) => {
    const has = assessment.available_equipment.includes(e);
    setAssessment({ ...assessment, available_equipment: has ? assessment.available_equipment.filter((x: string) => x !== e) : [...assessment.available_equipment, e] });
  };

  const generate = async () => {
    if (!user || !client) return;
    if (parqHasYes(assessment.parq) && !confirm("PAR-Q+ flagged a potential risk. Recommend physician clearance before training. Continue anyway?")) return;
    setBusy(true);
    setProgressStep(1);
    try {
      // upsert assessment
      const payload = {
        trainer_id: user.id,
        client_id: clientId,
        primary_goal: assessment.primary_goal || null,
        experience_level: assessment.experience_level || null,
        training_days_per_week: assessment.training_days_per_week ? Number(assessment.training_days_per_week) : null,
        session_duration_minutes: assessment.session_duration_minutes ? Number(assessment.session_duration_minutes) : null,
        available_equipment: assessment.available_equipment,
        training_location: assessment.training_location || null,
        injuries: assessment.injuries || null,
        medical_conditions: assessment.medical_conditions || null,
        preferences: assessment.preferences || null,
        sleep_quality: assessment.sleep_quality ? Number(assessment.sleep_quality) : null,
        stress_level: assessment.stress_level ? Number(assessment.stress_level) : null,
        nutrition_habits: assessment.nutrition_habits || null,
        hydration_glasses_per_day: assessment.hydration_glasses_per_day ? Number(assessment.hydration_glasses_per_day) : null,
        mobility_limitations: assessment.mobility_limitations || null,
        energy_levels: assessment.energy_levels || null,
        recovery_capacity: assessment.recovery_capacity || null,
        lifestyle: assessment.lifestyle || null,
        standing_posture_notes: assessment.standing_posture_notes || null,
        known_imbalances: assessment.known_imbalances || null,
        dominant_side: assessment.dominant_side || null,
        squat_depth_score: assessment.squat_depth_score ? Number(assessment.squat_depth_score) : null,
        squat_depth_note: assessment.squat_depth_note || null,
        overhead_reach_score: assessment.overhead_reach_score ? Number(assessment.overhead_reach_score) : null,
        overhead_reach_note: assessment.overhead_reach_note || null,
        hip_hinge_score: assessment.hip_hinge_score ? Number(assessment.hip_hinge_score) : null,
        hip_hinge_note: assessment.hip_hinge_note || null,
        single_leg_balance_score: assessment.single_leg_balance_score ? Number(assessment.single_leg_balance_score) : null,
        single_leg_balance_note: assessment.single_leg_balance_note || null,
        years_training: assessment.years_training !== "" && assessment.years_training != null ? Number(assessment.years_training) : null,
        previous_program_style: assessment.previous_program_style || null,
        max_lifts: assessment.max_lifts || null,
        resting_heart_rate: assessment.resting_heart_rate ? Number(assessment.resting_heart_rate) : null,
        cardio_capacity: assessment.cardio_capacity || null,
        // ACSM additions (column-backed)
        parq_passed: !parqHasYes(assessment.parq),
        acsm_risk_category: computeRisk(assessment.risk),
        waist_cm: assessment.waist_cm ? Number(assessment.waist_cm) : null,
        hip_cm: assessment.hip_cm ? Number(assessment.hip_cm) : null,
        body_fat_pct: assessment.body_fat_pct ? Number(assessment.body_fat_pct) : null,
        body_fat_method: assessment.body_fat_method || null,
        smart_specific: assessment.smart_specific || null,
        smart_measurable: assessment.smart_measurable || null,
        smart_deadline: assessment.smart_deadline || null,
        readiness_stage: assessment.readiness_stage || null,
        medications: assessment.medications || null,
        med_flags: assessment.med_flags ?? [],
        // Everything else lives in JSONB
        extended: {
          parq: assessment.parq,
          risk: assessment.risk,
          hours_seated: assessment.ext_hours_seated,
          daily_steps: assessment.ext_daily_steps,
          job_type: assessment.ext_job_type,
          meals_per_day: assessment.ext_meals_per_day,
          alcohol_units_week: assessment.ext_alcohol_units_week,
          processed_food_freq: assessment.ext_processed_food_freq,
          water_l_per_day: assessment.ext_water_l_per_day,
          mob_shoulder: assessment.ext_mob_shoulder,
          mob_hip: assessment.ext_mob_hip,
          mob_ankle: assessment.ext_mob_ankle,
          mob_thoracic: assessment.ext_mob_thoracic,
          mob_wrist: assessment.ext_mob_wrist,
          mob_knee: assessment.ext_mob_knee,
          cardio_test: assessment.ext_cardio_test,
          cardio_value: assessment.ext_cardio_value,
        },
      };
      let assessmentId: string | null = assessment.id ?? null;
      if (assessmentId) {
        await supabase.from("assessments").update(payload).eq("id", assessmentId);
      } else {
        const { data, error } = await supabase.from("assessments").insert(payload).select("id").single();
        if (error) throw error;
        assessmentId = data!.id;
      }
      void markOnboardingStep(user.id, "run_assessment");
      setProgressStep(2);

      const result = await generateFn({
        data: {
          client: {
            full_name: client.full_name,
            age: client.age,
            sex: client.sex,
            height_cm: client.height_cm ? Number(client.height_cm) : null,
            weight_kg: client.weight_kg ? Number(client.weight_kg) : null,
          },
          assessment: {
            ...payload,
            secondary_goals: null,
          },
          duration_weeks: duration,
        },
      });

      if (!result.ok) throw new Error(result.error);
      setProgressStep(3);

      const { data: plan, error } = await supabase
        .from("workout_plans")
        .insert({
          trainer_id: user.id,
          client_id: clientId,
          assessment_id: assessmentId,
          title: result.plan.title || `${client.full_name} – ${duration}-Week Plan`,
          summary: result.plan.summary || null,
          duration_weeks: duration,
          status: "draft",
          plan_data: { weeks: result.plan.weeks ?? [] },
        })
        .select("id")
        .single();
      if (error) throw error;
      setProgressStep(4);

      toast.success("Draft generated");
      void markOnboardingStep(user.id, "generate_plan");
      navigate({ to: "/plans/$planId", params: { planId: plan!.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate plan");
    } finally {
      setBusy(false);
      setProgressStep(0);
    }
  };

  const discardDraft = () => {
    setAssessment((a: any) => ({
      ...a,
      parq: { q1: null, q2: null, q3: null, q4: null, q5: null, q6: null, q7: null },
      risk: { family_cvd: false, smoking: "never", sedentary: false, bmi_category: "", dyslipidemia: false, prediabetes: false, hypertension: false },
      waist_cm: "", hip_cm: "", body_fat_pct: "", body_fat_method: "",
      medications: "", med_flags: [],
      smart_specific: "", smart_measurable: "", smart_deadline: "", readiness_stage: "",
      ext_hours_seated: "", ext_daily_steps: "", ext_job_type: "",
      ext_meals_per_day: "", ext_alcohol_units_week: "", ext_processed_food_freq: "", ext_water_l_per_day: "",
      ext_mob_shoulder: "", ext_mob_hip: "", ext_mob_ankle: "", ext_mob_thoracic: "", ext_mob_wrist: "", ext_mob_knee: "",
      ext_cardio_test: "untested", ext_cardio_value: "",
      primary_goal: "", experience_level: "", training_location: "",
      available_equipment: [], injuries: "", medical_conditions: "", preferences: "",
      sleep_quality: "", stress_level: "", nutrition_habits: "", hydration_glasses_per_day: "",
      mobility_limitations: "", energy_levels: "", recovery_capacity: "", lifestyle: "",
      standing_posture_notes: "", known_imbalances: "", dominant_side: "",
      squat_depth_score: "", squat_depth_note: "", overhead_reach_score: "", overhead_reach_note: "",
      hip_hinge_score: "", hip_hinge_note: "", single_leg_balance_score: "", single_leg_balance_note: "",
      years_training: "", previous_program_style: "", max_lifts: "",
      resting_heart_rate: "", cardio_capacity: "",
    }));
    toast.success("Draft cleared");
  };

  if (!client) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-light tracking-tight">{client.full_name}</h1>
        <p className="text-muted-foreground">{client.email ?? "No email"}</p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-base font-bold">Assessment</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Primary goal" placeholder="e.g. Build muscle, lose fat" value={assessment.primary_goal} onChange={(v) => setAssessment({ ...assessment, primary_goal: v })} />
          <div className="space-y-1">
            <Label>Experience level</Label>
            <Select value={assessment.experience_level} onValueChange={(v) => setAssessment({ ...assessment, experience_level: v })}>
              <SelectTrigger className="h-8"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field label="Training days / week" type="number" value={String(assessment.training_days_per_week ?? "")} onChange={(v) => setAssessment({ ...assessment, training_days_per_week: v })} />
          <Field label="Session length (minutes)" type="number" value={String(assessment.session_duration_minutes ?? "")} onChange={(v) => setAssessment({ ...assessment, session_duration_minutes: v })} />
          <Field label="Training location" placeholder="Home, gym…" value={assessment.training_location} onChange={(v) => setAssessment({ ...assessment, training_location: v })} />
          <Field label="Plan length (weeks)" type="number" value={String(duration)} onChange={(v) => setDuration(Math.max(1, Math.min(16, Number(v) || 4)))} />
        </div>

        <div className="mt-3">
          <Label className="text-xs">Available equipment</Label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {EQUIPMENT.map((eq) => {
              const on = assessment.available_equipment.includes(eq);
              return (
                <button
                  key={eq}
                  type="button"
                  onClick={() => toggleEq(eq)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-secondary"
                  }`}
                >
                  {eq}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <TextField label="Injuries" value={assessment.injuries} onChange={(v) => setAssessment({ ...assessment, injuries: v })} />
          <TextField label="Medical conditions" value={assessment.medical_conditions} onChange={(v) => setAssessment({ ...assessment, medical_conditions: v })} />
          <TextField label="Preferences / dislikes" value={assessment.preferences} onChange={(v) => setAssessment({ ...assessment, preferences: v })} className="sm:col-span-2" />
        </div>

        {/* Holistic / lifestyle factors */}
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">Lifestyle &amp; recovery</h3>

          <div className="grid gap-2 sm:grid-cols-2">
            <Field
              label="Sleep (1–10)"
              type="number"
              value={String(assessment.sleep_quality ?? "")}
              onChange={(v) => setAssessment({ ...assessment, sleep_quality: v })}
            />
            <Field
              label="Stress (1–10)"
              type="number"
              value={String(assessment.stress_level ?? "")}
              onChange={(v) => setAssessment({ ...assessment, stress_level: v })}
            />
            <Field
              label="Hydration (glasses / day)"
              type="number"
              value={String(assessment.hydration_glasses_per_day ?? "")}
              onChange={(v) => setAssessment({ ...assessment, hydration_glasses_per_day: v })}
            />
            <div className="space-y-1">
              <Label>Lifestyle</Label>
              <Select value={assessment.lifestyle ?? ""} onValueChange={(v) => setAssessment({ ...assessment, lifestyle: v })}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedentary">Sedentary</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="very_active">Very active</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <TextField label="Nutrition habits" value={assessment.nutrition_habits} onChange={(v) => setAssessment({ ...assessment, nutrition_habits: v })} />
            <TextField label="Mobility limitations" value={assessment.mobility_limitations} onChange={(v) => setAssessment({ ...assessment, mobility_limitations: v })} />
            <TextField label="Energy through day" value={assessment.energy_levels} onChange={(v) => setAssessment({ ...assessment, energy_levels: v })} />
            <TextField label="Recovery capacity" value={assessment.recovery_capacity} onChange={(v) => setAssessment({ ...assessment, recovery_capacity: v })} />
          </div>
        </div>

        {/* Posture & alignment */}
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">Posture &amp; alignment</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <TextField label="Standing posture notes" value={assessment.standing_posture_notes} onChange={(v) => setAssessment({ ...assessment, standing_posture_notes: v })} />
            <TextField label="Known imbalances" value={assessment.known_imbalances} onChange={(v) => setAssessment({ ...assessment, known_imbalances: v })} />
            <div className="space-y-1">
              <Label>Dominant side</Label>
              <Select value={assessment.dominant_side ?? ""} onValueChange={(v) => setAssessment({ ...assessment, dominant_side: v })}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="right">Right</SelectItem>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="ambidextrous">Ambidextrous</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Movement screen */}
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">Movement screen <span className="font-normal text-muted-foreground normal-case tracking-normal">— 1 restricted → 5 full range</span></h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <ScreenItem label="Squat depth" score={assessment.squat_depth_score} note={assessment.squat_depth_note}
              onScore={(v) => setAssessment({ ...assessment, squat_depth_score: v })}
              onNote={(v) => setAssessment({ ...assessment, squat_depth_note: v })} />
            <ScreenItem label="Overhead reach" score={assessment.overhead_reach_score} note={assessment.overhead_reach_note}
              onScore={(v) => setAssessment({ ...assessment, overhead_reach_score: v })}
              onNote={(v) => setAssessment({ ...assessment, overhead_reach_note: v })} />
            <ScreenItem label="Hip hinge" score={assessment.hip_hinge_score} note={assessment.hip_hinge_note}
              onScore={(v) => setAssessment({ ...assessment, hip_hinge_score: v })}
              onNote={(v) => setAssessment({ ...assessment, hip_hinge_note: v })} />
            <ScreenItem label="Single-leg balance" score={assessment.single_leg_balance_score} note={assessment.single_leg_balance_note}
              onScore={(v) => setAssessment({ ...assessment, single_leg_balance_score: v })}
              onNote={(v) => setAssessment({ ...assessment, single_leg_balance_note: v })} />
          </div>
        </div>

        {/* Training history */}
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">Training history</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Years training" type="number" value={String(assessment.years_training ?? "")} onChange={(v) => setAssessment({ ...assessment, years_training: v })} />
            <Field label="Previous program style" placeholder="e.g. PPL, 5/3/1" value={assessment.previous_program_style} onChange={(v) => setAssessment({ ...assessment, previous_program_style: v })} />
            <TextField label="Max lifts (if known)" value={assessment.max_lifts} onChange={(v) => setAssessment({ ...assessment, max_lifts: v })} className="sm:col-span-2" />
          </div>
        </div>

        {/* Performance markers */}
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">Performance markers</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Resting HR (bpm)" type="number" value={String(assessment.resting_heart_rate ?? "")} onChange={(v) => setAssessment({ ...assessment, resting_heart_rate: v })} />
            <Field label="Cardio capacity" placeholder="e.g. 5km in 28min" value={assessment.cardio_capacity} onChange={(v) => setAssessment({ ...assessment, cardio_capacity: v })} />
          </div>
        </div>

        {busy && <GenerationProgress step={progressStep} />}

        <div className="mt-4 flex justify-end">
          <Button onClick={generate} disabled={busy} size="lg">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate plan draft
          </Button>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold">Plans</h2>
        {plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No plans yet.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {plans.map((p) => (
              <Link
                key={p.id}
                to="/plans/$planId"
                params={{ planId: p.id }}
                className="flex items-center justify-between border-b border-border px-5 py-4 last:border-b-0 hover:bg-secondary/50"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">{p.title}</p>
                    <p className="text-xs text-muted-foreground">Updated {new Date(p.updated_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium uppercase">{p.status}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input className="h-8 text-sm" type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
function TextField({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-xs">{label}</Label>
      <Textarea className="min-h-0 py-1.5 text-sm" value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={2} />
    </div>
  );
}

function ScreenItem({
  label, score, note, onScore, onNote,
}: {
  label: string;
  score: string | number | null;
  note: string | null;
  onScore: (v: string) => void;
  onNote: (v: string) => void;
}) {
  const current = score == null ? "" : String(score);
  return (
    <div className="rounded-md border border-border bg-background/40 p-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">{label}</Label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = current === String(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => onScore(active ? "" : String(n))}
                className={`h-6 w-6 rounded border text-[11px] font-medium transition ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
                aria-label={`${label} score ${n}`}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>
      <Input
        className="mt-1.5 h-7 text-xs"
        placeholder="Optional note"
        value={note ?? ""}
        onChange={(e) => onNote(e.target.value)}
      />
    </div>
  );
}

function GenerationProgress({ step }: { step: number }) {
  const steps = [
    { n: 1, label: "Saving assessment" },
    { n: 2, label: "AI is designing your plan" },
    { n: 3, label: "Storing the draft" },
    { n: 4, label: "Opening your plan" },
  ];
  return (
    <div className="mt-4 animate-fade-in rounded-xl border border-accent/30 bg-accent/5 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent">
        <Sparkles className="h-3.5 w-3.5 animate-pulse" /> Generating with Claude Sonnet
      </div>
      <ul className="space-y-1.5">
        {steps.map((s) => {
          const done = step > s.n;
          const active = step === s.n;
          return (
            <li key={s.n} className="flex items-center gap-2 text-sm">
              {done ? (
                <CheckCircle2 className="h-4 w-4 text-accent" />
              ) : active ? (
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/40" />
              )}
              <span className={done ? "text-muted-foreground line-through" : active ? "font-medium text-foreground" : "text-muted-foreground"}>
                {s.label}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-accent transition-all duration-500"
          style={{ width: `${Math.min(100, (step / 4) * 100)}%` }}
        />
      </div>
    </div>
  );
}