import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useRef, useState } from "react";
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
import { Sparkles, FileText, Loader2, CheckCircle2, Circle, Info, AlertTriangle, Trash2, Eraser, Check, ChevronDown, ChevronRight } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generatePlanDraft, generatePlanWeek, generatePlanDay, finalizePlanGeneration } from "@/server/plan.functions";
import { markOnboardingStep } from "@/components/OnboardingChecklist";
import { useClientPhases } from "@/hooks/use-client-phases";
import { ClientPhasePill } from "@/components/ClientPhasePill";
import { IntakeLinkPanel } from "@/components/IntakeLinkPanel";
import { ComplianceDashboard } from "@/components/ComplianceDashboard";

export const Route = createFileRoute("/clients_/$clientId")({
  component: () => (
    <AppShell back={{ to: "/clients", label: "All clients" }}>
      <ClientDetail />
    </AppShell>
  ),
});

const EQUIPMENT = ["Barbell", "Dumbbells", "Kettlebells", "Cable machine", "Bench", "Pull-up bar", "Bands", "Bodyweight only"];

const PARQ_QUESTIONS = [
  { key: "q1", text: "Has a doctor ever said you have a heart condition or that you should only do physical activity recommended by a doctor?" },
  { key: "q2", text: "Do you feel pain in your chest when you do physical activity?" },
  { key: "q3", text: "In the past month, have you had chest pain when you were not doing physical activity?" },
  { key: "q4", text: "Do you lose your balance because of dizziness or do you ever lose consciousness?" },
  { key: "q5", text: "Do you have a bone or joint problem that could be made worse by a change in your physical activity?" },
  { key: "q6", text: "Is your doctor currently prescribing drugs for blood pressure or a heart condition?" },
  { key: "q7", text: "Do you know of any other reason why you should not do physical activity?" },
];

const PARQ_RATIONALE: Record<string, string> = {
  q1: "Cardiovascular flag. Medical clearance recommended before moderate-vigorous intensity. Forge can still draft a low-intensity plan, flagged for physician review.",
  q2: "Cardiovascular flag. Medical clearance recommended before moderate-vigorous intensity. Forge can still draft a low-intensity plan, flagged for physician review.",
  q3: "Cardiovascular flag. Medical clearance recommended before moderate-vigorous intensity. Forge can still draft a low-intensity plan, flagged for physician review.",
  q4: "Balance flag. Plan will avoid free-weight overhead movements and unsupported standing exercises until cleared by a physician.",
  q5: "Musculoskeletal flag. Plan will exclude high-impact patterns and aggressive progressive loading. Mobility-first protocol available.",
  q6: "Cardiovascular flag. Medical clearance recommended before moderate-vigorous intensity. Forge can still draft a low-intensity plan, flagged for physician review.",
  q7: "Manual flag. Note specifics in client medical conditions. PDF export will include a physician-review disclaimer.",
};

function parqFlagCount(parq: Record<string, boolean | null>): number {
  return Object.values(parq ?? {}).filter((v) => v === true).length;
}

// Section -> assessment field keys used to compute a signature for edit detection.
const PROV_SECTION_FIELDS: Record<string, string[]> = {
  smart_goal: ["smart_specific", "smart_measurable", "smart_deadline", "primary_goal"],
  readiness: ["readiness_stage"],
  training: [
    "experience_level", "training_days_per_week", "session_duration_minutes",
    "training_location", "available_equipment", "injuries", "medical_conditions", "preferences",
  ],
  lifestyle: [
    "sleep_quality", "stress_level", "ext_hours_seated", "ext_daily_steps",
    "ext_job_type", "energy_levels", "recovery_capacity",
  ],
  nutrition: [
    "ext_meals_per_day", "ext_alcohol_units_week", "ext_processed_food_freq",
    "ext_water_l_per_day", "nutrition_habits",
  ],
};

function sectionSignature(assessment: any, section: string): string {
  const fields = PROV_SECTION_FIELDS[section] ?? [];
  return JSON.stringify(fields.map((f) => assessment?.[f] ?? null));
}

const SECTIONS = [
  { id: "parq", label: "PAR-Q+" },
  { id: "risk", label: "Risk strat." },
  { id: "anthro", label: "Anthropometry" },
  { id: "meds", label: "Medications" },
  { id: "goal", label: "SMART goal" },
  { id: "readiness", label: "Readiness" },
  { id: "training", label: "Training setup" },
  { id: "lifestyle", label: "Lifestyle" },
  { id: "nutrition", label: "Nutrition" },
  { id: "mobility", label: "Mobility" },
  { id: "posture", label: "Posture" },
  { id: "screen", label: "Movement screen" },
  { id: "history", label: "Training history" },
  { id: "performance", label: "Performance" },
];

// Optional sections render collapsed by default and count as complete
// the moment any of their fields is touched.
const OPTIONAL_SECTIONS = new Set([
  "anthro", "meds", "readiness", "lifestyle", "nutrition",
  "posture", "screen", "history", "performance",
]);

function hasVal(v: any): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function isSectionComplete(id: string, a: any): boolean {
  switch (id) {
    case "parq":
      return Object.values(a.parq ?? {}).every((v) => v === true || v === false);
    case "risk":
      return hasVal(a.risk?.bmi_category);
    case "anthro":
      return hasVal(a.waist_cm) || hasVal(a.hip_cm) || hasVal(a.body_fat_pct) || hasVal(a.body_fat_method);
    case "meds":
      return hasVal(a.medications) || (a.med_flags?.length ?? 0) > 0;
    case "goal":
      return hasVal(a.smart_specific) && hasVal(a.smart_measurable);
    case "readiness":
      return hasVal(a.readiness_stage);
    case "training":
      return hasVal(a.experience_level) && hasVal(a.training_days_per_week) &&
             hasVal(a.session_duration_minutes) && (a.available_equipment?.length ?? 0) > 0;
    case "lifestyle":
      return hasVal(a.sleep_quality) || hasVal(a.stress_level) || hasVal(a.ext_hours_seated) ||
             hasVal(a.ext_daily_steps) || hasVal(a.ext_job_type);
    case "nutrition":
      return hasVal(a.ext_meals_per_day) || hasVal(a.ext_water_l_per_day) ||
             hasVal(a.ext_alcohol_units_week) || hasVal(a.nutrition_habits);
    case "mobility":
      return ["ext_mob_shoulder","ext_mob_hip","ext_mob_ankle","ext_mob_thoracic","ext_mob_wrist","ext_mob_knee"]
        .every((k) => hasVal(a[k]));
    case "posture":
      return hasVal(a.standing_posture_notes) || hasVal(a.known_imbalances) || hasVal(a.dominant_side);
    case "screen":
      return hasVal(a.squat_depth_score) || hasVal(a.overhead_reach_score) ||
             hasVal(a.hip_hinge_score) || hasVal(a.single_leg_balance_score);
    case "history":
      return hasVal(a.years_training) || hasVal(a.previous_program_style) || hasVal(a.max_lifts);
    case "performance":
      return hasVal(a.resting_heart_rate) || a.ext_cardio_test !== "untested";
    default:
      return false;
  }
}

function parqHasYes(parq: Record<string, boolean | null>): boolean {
  return Object.values(parq ?? {}).some((v) => v === true);
}

function computeRisk(risk: any): string {
  if (!risk) return "low";
  let n = 0;
  if (risk.family_cvd) n++;
  if (risk.smoking === "current") n++;
  if (risk.sedentary) n++;
  // Muscular/athletic build is intentionally excluded: BMI overestimates adiposity
  // in resistance-trained individuals (Ode 2007; Provencher 2018, NFL Combine).
  if (risk.bmi_category === "obese" || risk.bmi_category === "overweight") n++;
  if (risk.dyslipidemia) n++;
  if (risk.prediabetes) n++;
  if (risk.hypertension) n++;
  if (n >= 2) return "moderate";
  if (n >= 4) return "high";
  return "low";
}

function buildAssessmentPayload(assessment: any, userId: string, clientId: string) {
  return {
    trainer_id: userId,
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
      provenance: assessment.provenance ?? {},
    },
  };
}

function formatRelative(ts: number | null): string {
  if (!ts) return "";
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

type SaveStatus = "idle" | "saving" | "saved" | "offline";

function ClientDetail() {
  const { clientId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const generateFn = useServerFn(generatePlanDraft);
  const generateWeekFn = useServerFn(generatePlanWeek);
  const generateDayFn = useServerFn(generatePlanDay);
  const finalizePlanFn = useServerFn(finalizePlanGeneration);

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
    // Per-section provenance: "client" (filled via intake) or "trainer-edited"
    provenance: {} as Record<string, "client" | "trainer-edited">,
  });
  const [duration, setDuration] = useState(4);
  const [plans, setPlans] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  // Per-day generation progress: map of "w-d" -> "pending" | "running" | "done" | "error"
  const [dayProgress, setDayProgress] = useState<Record<string, "pending" | "running" | "done" | "error">>({});
  const [progressTotals, setProgressTotals] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  // Resumable in-progress plan detected on mount.
  const [resumablePlan, setResumablePlan] = useState<{
    id: string;
    title: string | null;
    duration_weeks: number;
    days_per_week: number;
    completed: number;
    total: number;
  } | null>(null);
  const [activeSection, setActiveSection] = useState("parq");
  const [showAdvancedNutrition, setShowAdvancedNutrition] = useState(false);
  const [showAdvancedPerformance, setShowAdvancedPerformance] = useState(false);
  const [safetyDialogOpen, setSafetyDialogOpen] = useState(false);
  const [safetyOverride, setSafetyOverride] = useState(false);

  // Auto-save state
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [, setRelTick] = useState(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightSaveRef = useRef<Promise<void> | null>(null);
  const skipNextAutosaveRef = useRef(true);
  // Snapshot of section field signatures captured at hydration, used to detect trainer edits to client-submitted sections.
  const sectionSnapshotRef = useRef<Record<string, string>>({});
  const lsKey = `forge_assessment_draft_${clientId}`;

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: c } = await supabase.from("clients").select("*").eq("id", clientId).single();
      setClient(c);
      const { data: a } = await supabase.from("assessments").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      let dbState: any = null;
      let dbTs = 0;
      if (a) {
        const ext = (a.extended ?? {}) as Record<string, any>;
        dbTs = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
        dbState = (prev: any) => ({
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
          provenance: (ext.provenance as Record<string, "client" | "trainer-edited">) ?? {},
        });
      }
      // Check localStorage backup; prefer it if newer
      let lsState: any = null;
      let lsTs = 0;
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem(lsKey) : null;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.assessment && typeof parsed.savedAt === "number") {
            lsState = parsed.assessment;
            lsTs = parsed.savedAt;
          }
        }
      } catch {}

      if (lsState && lsTs >= dbTs) {
        setAssessment((prev: any) => ({ ...prev, ...lsState }));
        setLastSavedAt(lsTs);
      } else if (dbState) {
        setAssessment(dbState);
        setLastSavedAt(dbTs || Date.now());
      }

      const { data: p } = await supabase.from("workout_plans").select("id, title, status, updated_at").eq("client_id", clientId).order("updated_at", { ascending: false });
      setPlans(p ?? []);
      setHydrated(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, clientId]);

  // Capture per-section field signatures the first time we hydrate so we can
  // detect when the trainer edits a section that was filled by the client.
  useEffect(() => {
    if (!hydrated) return;
    if (Object.keys(sectionSnapshotRef.current).length > 0) return;
    const snap: Record<string, string> = {};
    for (const section of Object.keys(PROV_SECTION_FIELDS)) {
      snap[section] = sectionSignature(assessment, section);
    }
    sectionSnapshotRef.current = snap;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Detect trainer edits: when a client-submitted section's signature changes
  // after hydration, flip its provenance to "trainer-edited".
  useEffect(() => {
    if (!hydrated) return;
    const prov = (assessment.provenance ?? {}) as Record<string, "client" | "trainer-edited">;
    let next: Record<string, "client" | "trainer-edited"> | null = null;
    for (const section of Object.keys(PROV_SECTION_FIELDS)) {
      if (prov[section] !== "client") continue;
      const sig = sectionSignature(assessment, section);
      const baseline = sectionSnapshotRef.current[section];
      if (baseline !== undefined && sig !== baseline) {
        if (!next) next = { ...prov };
        next[section] = "trainer-edited";
      }
    }
    if (next) {
      setAssessment((a: any) => ({ ...a, provenance: next }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment, hydrated]);

  // Tick relative time display once a minute
  useEffect(() => {
    const id = setInterval(() => setRelTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Debounced auto-save on every assessment change
  useEffect(() => {
    if (!hydrated || !user) return;
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    // Persist to localStorage immediately as a backup
    const ts = Date.now();
    try {
      localStorage.setItem(lsKey, JSON.stringify({ savedAt: ts, assessment }));
    } catch {}

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const promise = (async () => {
        setSaveStatus("saving");
        try {
          const payload = buildAssessmentPayload(assessment, user.id, clientId);
          if (assessment.id) {
            const { error } = await supabase.from("assessments").update(payload).eq("id", assessment.id);
            if (error) throw error;
          } else {
            const { data, error } = await supabase.from("assessments").insert(payload).select("id").single();
            if (error) throw error;
            if (data?.id) {
              skipNextAutosaveRef.current = true;
              setAssessment((a: any) => ({ ...a, id: data.id }));
            }
          }
          setLastSavedAt(Date.now());
          setSaveStatus("saved");
        } catch (err) {
          console.warn("Auto-save to cloud failed, kept local backup", err);
          setSaveStatus("offline");
        } finally {
          inFlightSaveRef.current = null;
        }
      })();
      inFlightSaveRef.current = promise;
    }, 1500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment, hydrated, user, clientId]);

  const flushPendingSave = async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!user || !hydrated) return;
    setSaveStatus("saving");
    try {
      const payload = buildAssessmentPayload(assessment, user.id, clientId);
      if (assessment.id) {
        const { error } = await supabase.from("assessments").update(payload).eq("id", assessment.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("assessments").insert(payload).select("id").single();
        if (error) throw error;
        if (data?.id) {
          skipNextAutosaveRef.current = true;
          setAssessment((a: any) => ({ ...a, id: data.id }));
        }
      }
      setLastSavedAt(Date.now());
      setSaveStatus("saved");
    } catch (err) {
      console.warn("Flush save failed", err);
      setSaveStatus("offline");
    }
    if (inFlightSaveRef.current) {
      try { await inFlightSaveRef.current; } catch {}
    }
  };

  const toggleEq = (e: string) => {
    const has = assessment.available_equipment.includes(e);
    setAssessment({ ...assessment, available_equipment: has ? assessment.available_equipment.filter((x: string) => x !== e) : [...assessment.available_equipment, e] });
  };

  // =============================================================================
  // generate — RESUMABLE per-day plan generation.
  // 1) Save the assessment.
  // 2) Create (or reuse) an in-progress workout_plans row.
  // 3) Fan out one call per (week, day) in parallel; each call writes its day
  //    to workout_plan_days immediately. UI updates as days land.
  // 4) Finalize: assemble plan_data and mark plan complete.
  // If `resumePlanId` is provided, we skip already-generated days.
  // =============================================================================
  const generate = async (resumePlanId?: string | null) => {
    if (!user || !client) return;
    setBusy(true);
    setProgressStep(1);
    setDayProgress({});
    setResumablePlan(null);
    try {
      await flushPendingSave();
      const payload = buildAssessmentPayload(assessment, user.id, clientId);
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

      const clientPayload = {
        full_name: client.full_name,
        age: client.age,
        sex: client.sex,
        height_cm: client.height_cm ? Number(client.height_cm) : null,
        weight_kg: client.weight_kg ? Number(client.weight_kg) : null,
      };
      const assessmentPayload = { ...payload, secondary_goals: null };

      const daysPerWeek = Math.max(1, Math.min(7, Number(assessment.training_days_per_week) || 3));
      const totalDays = duration * daysPerWeek;

      // Resolve plan_id: either resume an existing in-progress plan, or create one.
      let planId: string;
      let planDuration = duration;
      let planDaysPerWeek = daysPerWeek;
      if (resumePlanId) {
        const { data: existing, error: exErr } = await supabase
          .from("workout_plans")
          .select("id, duration_weeks, generation_meta")
          .eq("id", resumePlanId)
          .maybeSingle();
        if (exErr || !existing) throw new Error("Could not load the in-progress plan.");
        planId = existing.id;
        planDuration = existing.duration_weeks ?? duration;
        planDaysPerWeek = (existing.generation_meta as any)?.days_per_week ?? daysPerWeek;
      } else {
        const { data: planRow, error: planErr } = await supabase
          .from("workout_plans")
          .insert({
            trainer_id: user.id,
            client_id: clientId,
            assessment_id: assessmentId,
            title: `${client.full_name} – ${duration}-Week Plan`,
            duration_weeks: duration,
            status: "draft",
            generation_status: "in_progress",
            generation_meta: { days_per_week: daysPerWeek, started_at: new Date().toISOString() },
            plan_data: { weeks: [] },
          })
          .select("id")
          .single();
        if (planErr) throw planErr;
        planId = planRow!.id;
      }

      // Build the full grid + mark already-done days.
      const grid: Array<{ w: number; d: number }> = [];
      for (let w = 1; w <= planDuration; w++) {
        for (let d = 1; d <= planDaysPerWeek; d++) grid.push({ w, d });
      }

      const { data: existingDays } = await supabase
        .from("workout_plan_days")
        .select("week_number, day_number")
        .eq("plan_id", planId);
      const doneSet = new Set((existingDays ?? []).map((r: any) => `${r.week_number}-${r.day_number}`));

      const initial: Record<string, "pending" | "running" | "done" | "error"> = {};
      for (const cell of grid) {
        const key = `${cell.w}-${cell.d}`;
        initial[key] = doneSet.has(key) ? "done" : "pending";
      }
      setDayProgress(initial);
      setProgressTotals({ done: doneSet.size, total: grid.length });

      const todo = grid.filter((c) => !doneSet.has(`${c.w}-${c.d}`));

      // Fire all remaining (week, day) calls in parallel and update UI as each lands.
      let billingHit: any = null;
      const errors: string[] = [];
      let completed = doneSet.size;

      await Promise.all(
        todo.map(async (cell) => {
          const key = `${cell.w}-${cell.d}`;
          setDayProgress((prev) => ({ ...prev, [key]: "running" }));
          try {
            const r: any = await generateDayFn({
              data: {
                plan_id: planId,
                client: clientPayload,
                assessment: assessmentPayload,
                duration_weeks: planDuration,
                week_number: cell.w,
                day_number: cell.d,
                days_per_week: planDaysPerWeek,
              },
            });
            if (!r?.ok) {
              if (r?.billingRequired) billingHit = r;
              errors.push(`W${cell.w}D${cell.d}: ${r?.error ?? "unknown"}`);
              setDayProgress((prev) => ({ ...prev, [key]: "error" }));
            } else {
              setDayProgress((prev) => ({ ...prev, [key]: "done" }));
              completed += 1;
              setProgressTotals({ done: completed, total: grid.length });
            }
          } catch (e: any) {
            errors.push(`W${cell.w}D${cell.d}: ${e?.message ?? "failed"}`);
            setDayProgress((prev) => ({ ...prev, [key]: "error" }));
          }
        })
      );

      if (billingHit) {
        toast.error(billingHit.error || "Subscription required");
        navigate({ to: "/billing" });
        return;
      }
      if (errors.length) {
        toast.error(`${errors.length} day(s) failed. Tap "Continue" to retry the missing ones.`);
        // Refresh resumable banner; leave plan in_progress.
        await detectResumablePlan();
        return;
      }

      setProgressStep(3);
      const fin: any = await finalizePlanFn({ data: { plan_id: planId } });
      if (!fin?.ok) throw new Error(fin?.error ?? "Failed to finalize plan");
      setProgressStep(4);

      toast.success("Draft generated");
      void markOnboardingStep(user.id, "generate_plan");
      try {
        const { count: priorPlans } = await supabase
          .from("workout_plans")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId);
        if ((priorPlans ?? 0) > 1) void markOnboardingStep(user.id, "reassess");
      } catch {}
      try { localStorage.removeItem(lsKey); } catch {}
      navigate({ to: "/plans/$planId", params: { planId } });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate plan");
      await detectResumablePlan();
    } finally {
      setBusy(false);
      setProgressStep(0);
    }
  };

  // Detect any in-progress plan for this client and surface a resume banner.
  const detectResumablePlan = async () => {
    if (!user) return;
    const { data: pl } = await supabase
      .from("workout_plans")
      .select("id, title, duration_weeks, generation_meta, generation_status")
      .eq("client_id", clientId)
      .eq("generation_status", "in_progress")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!pl) {
      setResumablePlan(null);
      return;
    }
    const dpw = (pl.generation_meta as any)?.days_per_week ?? 3;
    const total = (pl.duration_weeks ?? 0) * dpw;
    const { count } = await supabase
      .from("workout_plan_days")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", pl.id);
    setResumablePlan({
      id: pl.id,
      title: pl.title,
      duration_weeks: pl.duration_weeks ?? 0,
      days_per_week: dpw,
      completed: count ?? 0,
      total,
    });
  };

  // Discard an in-progress plan and start over.
  const discardResumable = async () => {
    if (!resumablePlan) return;
    await supabase.from("workout_plans").delete().eq("id", resumablePlan.id);
    setResumablePlan(null);
    toast.success("Previous draft discarded.");
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

  const parqYes = parqHasYes(assessment.parq);
  const riskCategory = computeRisk(assessment.risk);
  const whr = assessment.waist_cm && assessment.hip_cm
    ? (Number(assessment.waist_cm) / Number(assessment.hip_cm)).toFixed(2)
    : "—";

  // Section completion + progress
  const sectionStatus = SECTIONS.map((s) => ({ ...s, complete: isSectionComplete(s.id, assessment) }));
  const completedCount = sectionStatus.filter((s) => s.complete).length;
  const totalSections = SECTIONS.length;
  const pct = Math.round((completedCount / totalSections) * 100);
  const minutesLeft = Math.max(1, Math.round((totalSections - completedCount) * 0.6));
  const currentIdx = sectionStatus.findIndex((s) => s.id === activeSection);
  const sectionNumber = currentIdx >= 0 ? currentIdx + 1 : 1;

  const trainingSummary = [
    assessment.training_days_per_week ? `${assessment.training_days_per_week}×/week` : null,
    assessment.session_duration_minutes ? `${assessment.session_duration_minutes} min` : null,
    assessment.training_location || null,
    assessment.experience_level || null,
  ].filter(Boolean).join(", ");

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-light tracking-tight">{client.full_name}</h1>
          <ClientPhaseHeaderPill clientId={client.id} />
        </div>
        <p className="text-muted-foreground">{client.email ?? "No email"}</p>
      </div>

      <IntakeLinkPanel
        clientId={client.id}
        clientFirstName={(client.full_name ?? "there").split(" ")[0]}
        clientPhone={client.phone}
        intake={{
          intake_token: client.intake_token ?? null,
          intake_token_expires_at: client.intake_token_expires_at ?? null,
          intake_status: client.intake_status ?? "not_sent",
          intake_submitted_at: client.intake_submitted_at ?? null,
        }}
        onChange={(patch) => setClient((prev: any) => ({ ...prev, ...patch }))}
      />

      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-20 space-y-1 rounded-xl border border-border bg-card p-2 text-sm">
            <p className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sections</p>
            {sectionStatus.map((s) => (
              <a
                key={s.id}
                href={`#sec-${s.id}`}
                onClick={() => setActiveSection(s.id)}
                className={`flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition ${activeSection === s.id ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <span>{s.label}</span>
                {s.complete && <Check className="h-3 w-3 text-accent" />}
              </a>
            ))}
          </nav>
        </aside>

        <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-bold shrink-0">Assessment</h2>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="h-1.5 min-w-[80px] flex-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-accent/70 transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground whitespace-nowrap">
                Section {sectionNumber} of {totalSections} · {pct}% complete · ~{minutesLeft} min left
              </span>
            </div>
            <SaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
          </div>

          {/* PAR-Q+ */}
          <SectionBlock id="parq" title="PAR-Q+ pre-screening" hint="Standard pre-participation screening. Any 'Yes' suggests physician clearance." complete={isSectionComplete("parq", assessment)} footer={isSectionComplete("parq", assessment) ? <CompletionStrip text={parqFlagCount(assessment.parq) === 0 ? "✓ Pre-screening complete. 0 flags." : `✓ Pre-screening complete. ${parqFlagCount(assessment.parq)} flags — guidance below`} /> : null}>
            <ul className="space-y-1.5">
              {PARQ_QUESTIONS.map((q, idx) => {
                const value = (assessment.parq as any)[q.key];
                const flagged = value === true;
                return (
                  <li
                    key={q.key}
                    className={`rounded-md border bg-background/40 p-2 transition-colors ${flagged ? "border-accent/40 border-l-[3px] border-l-accent" : "border-border"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs"><span className="font-semibold">{idx + 1}.</span> {q.text}</p>
                      <YesNo value={value} onChange={(v) => setAssessment({ ...assessment, parq: { ...assessment.parq, [q.key]: v } })} />
                    </div>
                    {flagged && (
                      <div className="mt-2 flex animate-fade-in items-start gap-2 rounded-md border border-accent/30 bg-accent/5 p-2 text-[11px] text-muted-foreground">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                        <span>{PARQ_RATIONALE[q.key]}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </SectionBlock>

          {/* Risk stratification */}
          <SectionBlock id="risk" title="Risk stratification" hint="ACSM-style coronary risk factor count → low / moderate / high." complete={isSectionComplete("risk", assessment)} footer={isSectionComplete("risk", assessment) ? <CompletionStrip text={`✓ ACSM Risk: ${riskCategory.toUpperCase()}`} /> : null}>
            <ParqFlagSummary count={parqFlagCount(assessment.parq)} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Toggle label="Family history of CVD (1st-degree, <55 M / <65 F)" value={assessment.risk.family_cvd} onChange={(v) => setAssessment({ ...assessment, risk: { ...assessment.risk, family_cvd: v } })} />
              <div className="space-y-1">
                <LabelWithHelp label="Smoking" hint="Current smokers carry highest CVD risk." />
                <Select value={assessment.risk.smoking} onValueChange={(v) => setAssessment({ ...assessment, risk: { ...assessment.risk, smoking: v } })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never</SelectItem>
                    <SelectItem value="former">Former</SelectItem>
                    <SelectItem value="current">Current</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Toggle label="Sedentary (<150 min/week MVPA)" value={assessment.risk.sedentary} onChange={(v) => setAssessment({ ...assessment, risk: { ...assessment.risk, sedentary: v } })} />
              <div className="space-y-1">
                <LabelWithHelp label="BMI category" hint="Underweight <18.5 · Normal 18.5–24.9 · Overweight 25–29.9 · Obese ≥30. Use 'Muscular' when BMI ≥25 but body-fat % is within athletic range (♂ ≤17%, ♀ ≤24%) — BMI overestimates adiposity in resistance-trained individuals." />
                <Select value={assessment.risk.bmi_category} onValueChange={(v) => setAssessment({ ...assessment, risk: { ...assessment.risk, bmi_category: v } })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="underweight">Underweight</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="overweight">Overweight</SelectItem>
                    <SelectItem value="obese">Obese</SelectItem>
                    <SelectItem value="muscular">Muscular (athletic build)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Toggle label="Dyslipidemia" value={assessment.risk.dyslipidemia} onChange={(v) => setAssessment({ ...assessment, risk: { ...assessment.risk, dyslipidemia: v } })} />
              <Toggle label="Pre-diabetes" value={assessment.risk.prediabetes} onChange={(v) => setAssessment({ ...assessment, risk: { ...assessment.risk, prediabetes: v } })} />
              <Toggle label="Hypertension" value={assessment.risk.hypertension} onChange={(v) => setAssessment({ ...assessment, risk: { ...assessment.risk, hypertension: v } })} />
            </div>
            <div className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${riskCategory === "high" ? "bg-destructive/15 text-destructive" : riskCategory === "moderate" ? "bg-accent/15 text-accent" : "bg-secondary text-secondary-foreground"}`}>
              ACSM risk: {riskCategory}
            </div>
          </SectionBlock>

          {/* Anthropometry */}
          <SectionBlock id="anthro" title="Anthropometry" hint="Body composition baseline. Waist-to-hip ratio is computed automatically." defaultCollapsed complete={isSectionComplete("anthro", assessment)}>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Waist (cm)" type="number" value={assessment.waist_cm} onChange={(v) => setAssessment({ ...assessment, waist_cm: v })} hint="Measure at narrowest point above the hip bone, exhale." />
              <Field label="Hip (cm)" type="number" value={assessment.hip_cm} onChange={(v) => setAssessment({ ...assessment, hip_cm: v })} hint="Measure at the widest part of the buttocks." />
              <div className="space-y-1">
                <Label className="text-xs">Waist-to-hip ratio</Label>
                <div className="flex h-8 items-center rounded-md border border-border bg-background/50 px-3 text-sm font-medium">{whr}</div>
              </div>
              <Field label="Body fat %" type="number" value={assessment.body_fat_pct} onChange={(v) => setAssessment({ ...assessment, body_fat_pct: v })} hint="Optional. Use the same method over time for trend." />
              <div className="space-y-1 sm:col-span-2">
                <LabelWithHelp label="Body fat method" hint="Calipers, bioimpedance, DEXA, etc." />
                <Select value={assessment.body_fat_method} onValueChange={(v) => setAssessment({ ...assessment, body_fat_method: v })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="calipers">Skinfold calipers</SelectItem>
                    <SelectItem value="bia">Bioimpedance (BIA)</SelectItem>
                    <SelectItem value="dexa">DEXA</SelectItem>
                    <SelectItem value="bodpod">BodPod</SelectItem>
                    <SelectItem value="visual">Visual estimate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SectionBlock>

          {/* Medications */}
          <SectionBlock id="meds" title="Medication & supplements" hint="Beta-blockers blunt HR; statins risk myalgia; anticoagulants require contact-sport caution." defaultCollapsed complete={isSectionComplete("meds", assessment)}>
            <TextField label="Free text (medications, supplements, dosage)" value={assessment.medications} onChange={(v) => setAssessment({ ...assessment, medications: v })} className="sm:col-span-2" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["Beta-blocker", "Statin", "Anticoagulant"].map((flag) => {
                const on = assessment.med_flags.includes(flag);
                return (
                  <button
                    key={flag}
                    type="button"
                    onClick={() => setAssessment({ ...assessment, med_flags: on ? assessment.med_flags.filter((f: string) => f !== flag) : [...assessment.med_flags, flag] })}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${on ? "border-destructive bg-destructive/10 text-destructive" : "border-border bg-background hover:bg-secondary"}`}
                  >
                    {on && "⚑ "}{flag}
                  </button>
                );
              })}
            </div>
          </SectionBlock>

          {/* SMART goal */}
          <SectionBlock id="goal" title="Primary goal (SMART)" hint="Specific · Measurable · Achievable · Relevant · Time-bound." complete={isSectionComplete("goal", assessment)} provenance={assessment.provenance?.smart_goal} reviewed={client.intake_status === "reviewed"} footer={isSectionComplete("goal", assessment) ? <CompletionStrip text={`✓ Goal logged: ${String(assessment.smart_specific ?? "").slice(0, 40)}`} /> : null}>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Specific outcome" value={assessment.smart_specific} onChange={(v) => setAssessment({ ...assessment, smart_specific: v })} placeholder="e.g. Squat 1.5×BW for 5 reps" hint="What concrete result?" className="sm:col-span-2" />
              <Field label="Measurable target" value={assessment.smart_measurable} onChange={(v) => setAssessment({ ...assessment, smart_measurable: v })} placeholder="e.g. 120kg @ BW80kg" hint="Number you'll measure." />
              <Field label="Deadline" type="date" value={assessment.smart_deadline} onChange={(v) => setAssessment({ ...assessment, smart_deadline: v })} hint="Realistic completion date." />
              <TextField label="Goal context (optional)" value={assessment.primary_goal} onChange={(v) => setAssessment({ ...assessment, primary_goal: v })} className="sm:col-span-2" />
            </div>
          </SectionBlock>

          {/* Readiness */}
          <SectionBlock id="readiness" title="Readiness to change (Prochaska)" hint="Stage of behavioral change — calibrates coaching approach." defaultCollapsed complete={isSectionComplete("readiness", assessment)} provenance={assessment.provenance?.readiness} reviewed={client.intake_status === "reviewed"}>
            <div className="flex flex-wrap gap-1.5">
              {[
                ["precontemplation", "Pre-contemplation"],
                ["contemplation", "Contemplation"],
                ["preparation", "Preparation"],
                ["action", "Action"],
                ["maintenance", "Maintenance"],
              ].map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAssessment({ ...assessment, readiness_stage: v })}
                  className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${assessment.readiness_stage === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </SectionBlock>

          {/* Training setup (existing) */}
          <SectionBlock id="training" title="Training setup" hint="Frequency, location, available equipment, and constraints." complete={isSectionComplete("training", assessment)} provenance={assessment.provenance?.training} reviewed={client.intake_status === "reviewed"} footer={isSectionComplete("training", assessment) ? <CompletionStrip text={`✓ Setup: ${trainingSummary}`} /> : null}>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <LabelWithHelp label="Experience level" hint="Beginner = <1y consistent · Intermediate = 1–3y · Advanced = 3y+." />
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
              <Field label="Session length (min)" type="number" value={String(assessment.session_duration_minutes ?? "")} onChange={(v) => setAssessment({ ...assessment, session_duration_minutes: v })} />
              <Field label="Training location" value={assessment.training_location} onChange={(v) => setAssessment({ ...assessment, training_location: v })} />
              <Field label="Plan length (weeks)" type="number" value={String(duration)} onChange={(v) => setDuration(Math.max(1, Math.min(16, Number(v) || 4)))} />
            </div>
            <div className="mt-3">
              <Label className="text-xs">Available equipment</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {EQUIPMENT.map((eq) => {
                  const on = assessment.available_equipment.includes(eq);
                  return (
                    <button key={eq} type="button" onClick={() => toggleEq(eq)} className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary"}`}>{eq}</button>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <TextField label="Injuries" value={assessment.injuries} onChange={(v) => setAssessment({ ...assessment, injuries: v })} />
              <TextField label="Medical conditions" value={assessment.medical_conditions} onChange={(v) => setAssessment({ ...assessment, medical_conditions: v })} />
              <TextField label="Preferences / dislikes" value={assessment.preferences} onChange={(v) => setAssessment({ ...assessment, preferences: v })} className="sm:col-span-2" />
            </div>
          </SectionBlock>

          {/* Lifestyle (rebuilt) */}
          <SectionBlock id="lifestyle" title="Lifestyle & recovery" hint="Daily activity, recovery markers, and sleep/stress modulators." defaultCollapsed complete={isSectionComplete("lifestyle", assessment)} provenance={assessment.provenance?.lifestyle} reviewed={client.intake_status === "reviewed"}>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Sleep (1–10)" type="number" value={String(assessment.sleep_quality ?? "")} onChange={(v) => setAssessment({ ...assessment, sleep_quality: v })} hint="Subjective average sleep quality this past month." />
              <Field label="Stress (1–10)" type="number" value={String(assessment.stress_level ?? "")} onChange={(v) => setAssessment({ ...assessment, stress_level: v })} hint="Perceived overall stress." />
              <Field label="Hours seated / day" type="number" value={assessment.ext_hours_seated} onChange={(v) => setAssessment({ ...assessment, ext_hours_seated: v })} hint="Total sitting time including work + commute." />
              <Field label="Daily steps (if known)" type="number" value={assessment.ext_daily_steps} onChange={(v) => setAssessment({ ...assessment, ext_daily_steps: v })} hint="From wearable if available." />
              <Field label="Job type" value={assessment.ext_job_type} onChange={(v) => setAssessment({ ...assessment, ext_job_type: v })} placeholder="desk, manual, mixed…" />
              <TextField label="Energy through day" value={assessment.energy_levels} onChange={(v) => setAssessment({ ...assessment, energy_levels: v })} />
              <TextField label="Recovery capacity" value={assessment.recovery_capacity} onChange={(v) => setAssessment({ ...assessment, recovery_capacity: v })} />
            </div>
          </SectionBlock>

          {/* Nutrition (rebuilt) */}
          <SectionBlock id="nutrition" title="Nutrition & hydration" hint="Quantitative habits beat free-text descriptions." defaultCollapsed complete={isSectionComplete("nutrition", assessment)} provenance={assessment.provenance?.nutrition} reviewed={client.intake_status === "reviewed"}>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Meals / day" type="number" value={assessment.ext_meals_per_day} onChange={(v) => setAssessment({ ...assessment, ext_meals_per_day: v })} />
              <Field label="Alcohol units / week" type="number" value={assessment.ext_alcohol_units_week} onChange={(v) => setAssessment({ ...assessment, ext_alcohol_units_week: v })} hint="UK unit ≈ 10 ml ethanol." />
              <Field label="Processed food frequency (1–5)" type="number" value={assessment.ext_processed_food_freq} onChange={(v) => setAssessment({ ...assessment, ext_processed_food_freq: v })} hint="1 = rare · 5 = most meals." />
              <Field label="Water (L / day)" type="number" value={assessment.ext_water_l_per_day} onChange={(v) => setAssessment({ ...assessment, ext_water_l_per_day: v })} />
              {showAdvancedNutrition && (
                <Field label="Hydration (glasses, legacy)" type="number" value={String(assessment.hydration_glasses_per_day ?? "")} onChange={(v) => setAssessment({ ...assessment, hydration_glasses_per_day: v })} />
              )}
              <TextField label="Notes (allergies, dietary pattern)" value={assessment.nutrition_habits} onChange={(v) => setAssessment({ ...assessment, nutrition_habits: v })} className="sm:col-span-2" />
            </div>
            <button type="button" onClick={() => setShowAdvancedNutrition((s) => !s)} className="mt-2 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
              {showAdvancedNutrition ? "Hide advanced fields" : "Show advanced fields"}
            </button>
          </SectionBlock>

          {/* Mobility checklist */}
          <SectionBlock id="mobility" title="Mobility — anatomical (1–5)" hint="Score each region: 1 = severely restricted, 5 = full pain-free range.">
            <p className="mb-1.5 text-[10px] text-muted-foreground">1 = limited · 5 = excellent</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ["ext_mob_shoulder", "Shoulder"],
                ["ext_mob_hip", "Hip"],
                ["ext_mob_ankle", "Ankle"],
                ["ext_mob_thoracic", "Thoracic spine"],
                ["ext_mob_wrist", "Wrist"],
                ["ext_mob_knee", "Knee"],
              ].map(([key, label]) => (
                <ScoreRow key={key} label={label} value={assessment[key]} onChange={(v) => setAssessment({ ...assessment, [key]: v })} />
              ))}
            </div>
            <TextField label="Notes (specific limitations, pain triggers)" value={assessment.mobility_limitations} onChange={(v) => setAssessment({ ...assessment, mobility_limitations: v })} className="mt-2" />
          </SectionBlock>

          {/* Posture */}
          <SectionBlock id="posture" title="Posture & alignment" hint="Standing posture and known asymmetries." defaultCollapsed complete={isSectionComplete("posture", assessment)}>
            <div className="grid gap-2 sm:grid-cols-2">
              <TextField label="Standing posture notes" value={assessment.standing_posture_notes} onChange={(v) => setAssessment({ ...assessment, standing_posture_notes: v })} />
              <TextField label="Known imbalances" value={assessment.known_imbalances} onChange={(v) => setAssessment({ ...assessment, known_imbalances: v })} />
              <div className="space-y-1">
                <Label className="text-xs">Dominant side</Label>
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
          </SectionBlock>

          {/* Movement screen */}
          <SectionBlock id="screen" title="Movement screen" hint="Functional pattern quality. 1 = restricted → 5 = controlled full range." defaultCollapsed complete={isSectionComplete("screen", assessment)}>
            <p className="mb-1.5 text-[10px] text-muted-foreground">1 = limited · 5 = excellent</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <ScreenItem label="Squat depth" score={assessment.squat_depth_score} note={assessment.squat_depth_note} onScore={(v) => setAssessment({ ...assessment, squat_depth_score: v })} onNote={(v) => setAssessment({ ...assessment, squat_depth_note: v })} />
              <ScreenItem label="Overhead reach" score={assessment.overhead_reach_score} note={assessment.overhead_reach_note} onScore={(v) => setAssessment({ ...assessment, overhead_reach_score: v })} onNote={(v) => setAssessment({ ...assessment, overhead_reach_note: v })} />
              <ScreenItem label="Hip hinge" score={assessment.hip_hinge_score} note={assessment.hip_hinge_note} onScore={(v) => setAssessment({ ...assessment, hip_hinge_score: v })} onNote={(v) => setAssessment({ ...assessment, hip_hinge_note: v })} />
              <ScreenItem label="Single-leg balance" score={assessment.single_leg_balance_score} note={assessment.single_leg_balance_note} onScore={(v) => setAssessment({ ...assessment, single_leg_balance_score: v })} onNote={(v) => setAssessment({ ...assessment, single_leg_balance_note: v })} />
            </div>
          </SectionBlock>

          {/* Training history */}
          <SectionBlock id="history" title="Training history" hint="Prior exposure shapes starting loads and progression rates." defaultCollapsed complete={isSectionComplete("history", assessment)}>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Years training" type="number" value={String(assessment.years_training ?? "")} onChange={(v) => setAssessment({ ...assessment, years_training: v })} />
              <Field label="Previous program style" placeholder="PPL, 5/3/1…" value={assessment.previous_program_style} onChange={(v) => setAssessment({ ...assessment, previous_program_style: v })} />
              <TextField label="Max lifts (if known)" value={assessment.max_lifts} onChange={(v) => setAssessment({ ...assessment, max_lifts: v })} className="sm:col-span-2" />
            </div>
          </SectionBlock>

          {/* Performance */}
          <SectionBlock id="performance" title="Performance markers" hint="Cardiovascular and conditioning baseline." defaultCollapsed complete={isSectionComplete("performance", assessment)}>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Resting HR (bpm)" type="number" value={String(assessment.resting_heart_rate ?? "")} onChange={(v) => setAssessment({ ...assessment, resting_heart_rate: v })} hint="Measured first thing AM, supine." />
              <div className="space-y-1">
                <LabelWithHelp label="Cardio test" hint="Pick a standard test or 'untested'." />
                <Select value={assessment.ext_cardio_test} onValueChange={(v) => setAssessment({ ...assessment, ext_cardio_test: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="untested">Untested</SelectItem>
                    <SelectItem value="cooper">Cooper 12-min run (m)</SelectItem>
                    <SelectItem value="rockport">Rockport 1-mile walk (min:sec)</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {assessment.ext_cardio_test !== "untested" && (
                <Field label="Test result" value={assessment.ext_cardio_value} onChange={(v) => setAssessment({ ...assessment, ext_cardio_value: v })} className="sm:col-span-2" hint="Distance, time, or VO₂ estimate." />
              )}
              {showAdvancedPerformance && (
                <TextField label="Cardio context (legacy free text)" value={assessment.cardio_capacity} onChange={(v) => setAssessment({ ...assessment, cardio_capacity: v })} className="sm:col-span-2" />
              )}
            </div>
            <button type="button" onClick={() => setShowAdvancedPerformance((s) => !s)} className="mt-2 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
              {showAdvancedPerformance ? "Hide advanced fields" : "Show advanced fields"}
            </button>
          </SectionBlock>

          {busy && <GenerationProgress step={progressStep} />}

          <div className="flex justify-end gap-2 pt-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="lg" disabled={busy}>
                  <Eraser className="mr-2 h-4 w-4" /> Discard draft
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Discard assessment draft?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Clears all fields above. Saved assessments stay in the database until next save.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={discardDraft}>Discard</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {(() => {
              const isHigh = riskCategory === "high";
              const blocked = parqYes || isHigh;
              if (blocked) {
                return (
                  <AlertDialog open={safetyDialogOpen} onOpenChange={(o) => { setSafetyDialogOpen(o); if (!o) setSafetyOverride(false); }}>
                    <AlertDialogTrigger asChild>
                      <Button disabled={busy} size="lg" variant="destructive">
                        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
                        Safety review required
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clinical safety check</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                          <div className="space-y-3 text-sm">
                            <p>This client triggered the safety gate:</p>
                            <ul className="list-disc space-y-1 pl-5 text-xs">
                              {parqYes && <li>PAR-Q+ flagged one or more risk markers.</li>}
                              {isHigh && <li>ACSM risk stratification is <span className="font-semibold text-destructive">High</span>.</li>}
                              {(assessment.med_flags?.length ?? 0) > 0 && (
                                <li>Medication flags: {assessment.med_flags.join(", ")}.</li>
                              )}
                            </ul>
                            <p>
                              The generated plan will be capped at conservative intensities and avoid contraindicated patterns. You remain the responsible professional — confirm to proceed.
                            </p>
                            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-background/40 p-3">
                              <input
                                type="checkbox"
                                checked={safetyOverride}
                                onChange={(e) => setSafetyOverride(e.target.checked)}
                                className="mt-0.5 h-4 w-4 accent-accent"
                              />
                              <span className="text-xs">
                                I confirm the client has medical clearance (or accepts the risk in writing) and I take professional responsibility for this prescription.
                              </span>
                            </label>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          disabled={!safetyOverride}
                          onClick={() => { setSafetyDialogOpen(false); void generate(); }}
                        >
                          Generate conservative draft
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                );
              }
              return (
                <Button onClick={() => void generate()} disabled={busy} size="lg">
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Generate plan draft
                </Button>
              );
            })()}
          </div>
        </section>
      </div>

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

      {plans.length > 0 && (
        <section>
          <ComplianceDashboard clientId={clientId} />
        </section>
      )}
    </div>
    </TooltipProvider>
  );
}

function SectionBlock({
  id,
  title,
  hint,
  children,
  defaultCollapsed = false,
  complete = false,
  footer,
  provenance,
  reviewed = false,
}: {
  id: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  complete?: boolean;
  footer?: React.ReactNode;
  provenance?: "client" | "trainer-edited";
  reviewed?: boolean;
}) {
  const [open, setOpen] = useState(!defaultCollapsed);
  // Provenance border + tag styling
  const hasProv = provenance === "client" || provenance === "trainer-edited";
  const borderClass = hasProv
    ? reviewed
      ? "border-l-[3px] border-l-accent/30"
      : "border-l-[3px] border-l-accent"
    : "";
  let tagText = "";
  let tagClass = "";
  if (provenance === "client") {
    tagText = "Client-submitted";
    tagClass = reviewed ? "text-muted-foreground/70" : "text-accent/90";
  } else if (provenance === "trainer-edited") {
    tagText = "Edited by you";
    tagClass = "text-muted-foreground/70";
  }
  return (
    <div id={`sec-${id}`} className={`scroll-mt-20 rounded-xl border border-border bg-background/40 p-3 ${borderClass}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mb-2 flex w-full items-center gap-1.5 text-left"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        <h3 className="text-xs font-bold uppercase tracking-widest text-accent">{title}</h3>
        {complete && <Check className="h-3 w-3 text-accent" />}
        {hint && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Why we ask"
              >
                <Info className="h-3 w-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs"><p><span className="font-semibold">Why we ask:</span> {hint}</p></TooltipContent>
          </Tooltip>
        )}
        {tagText && (
          <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${tagClass}`}>
            {tagText}
          </span>
        )}
      </button>
      {open && (
        <>
          {children}
          {footer}
        </>
      )}
    </div>
  );
}

function LabelWithHelp({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-center gap-1">
      <Label className="text-xs">{label}</Label>
      {hint && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Why we ask"><Info className="h-3 w-3" /></button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs"><p>{hint}</p></TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, hint, className = "",
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; hint?: string; className?: string }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <LabelWithHelp label={label} hint={hint} />
      <Input className="h-8 text-sm" type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
function TextField({ label, value, onChange, className = "", hint }: { label: string; value: string; onChange: (v: string) => void; className?: string; hint?: string }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <LabelWithHelp label={label} hint={hint} />
      <Textarea className="min-h-0 py-1.5 text-sm" value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={2} />
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-xs transition ${value ? "border-accent bg-accent/10 text-foreground" : "border-border bg-background hover:bg-secondary"}`}
    >
      <span>{label}</span>
      <span className={`ml-2 inline-flex h-4 w-7 items-center rounded-full transition ${value ? "bg-accent" : "bg-secondary"}`}>
        <span className={`block h-3 w-3 rounded-full bg-background shadow transition ${value ? "translate-x-3.5" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}

function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex shrink-0 gap-1">
      {[
        [true, "Yes"],
        [false, "No"],
      ].map(([v, l]) => {
        const active = value === v;
        return (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v as boolean)}
            className={`h-6 rounded border px-2 text-[11px] font-medium transition ${active ? (v ? "border-destructive bg-destructive text-destructive-foreground" : "border-primary bg-primary text-primary-foreground") : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
          >
            {l as string}
          </button>
        );
      })}
    </div>
  );
}

function ScoreRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const current = value ?? "";
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background/40 p-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = current === String(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(active ? "" : String(n))}
              className={`h-6 w-6 rounded border text-[11px] font-medium transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
            >{n}</button>
          );
        })}
      </div>
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
        <Sparkles className="h-3.5 w-3.5 animate-pulse" /> Generating with GPT-5
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
function SaveIndicator({ status, lastSavedAt }: { status: SaveStatus; lastSavedAt: number | null }) {
  const base = "inline-flex items-center gap-1.5 font-mono text-[10px] tabular-nums";
  if (status === "saving") {
    return (
      <span className={`${base} text-accent`}>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        Saving…
      </span>
    );
  }
  if (status === "offline") {
    return (
      <span className={`${base} text-accent`}>
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        Offline — saved locally
      </span>
    );
  }
  if (status === "saved" || lastSavedAt) {
    return (
      <span className={`${base} text-muted-foreground/70`}>
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
        Saved · {formatRelative(lastSavedAt)}
      </span>
    );
  }
  return null;
}

function ParqFlagSummary({ count }: { count: number }) {
  const clear = count === 0;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest ${clear ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${clear ? "bg-primary" : "bg-accent"}`} />
        PAR-Q+ flags: {count}
      </span>
      {!clear && (
        <span className="text-[11px] text-muted-foreground">
          Plan generation will default to low-intensity. Override available.
        </span>
      )}
    </div>
  );
}

function CompletionStrip({ text }: { text: string }) {
  return (
    <div className="mt-3 animate-fade-in border-l-2 border-accent/40 bg-accent/5 px-2 py-1 text-[12px] opacity-80">
      {text}
    </div>
  );
}

function ClientPhaseHeaderPill({ clientId }: { clientId: string }) {
  const phases = useClientPhases([clientId]);
  const phase = phases[clientId];
  if (!phase) return null;
  return <ClientPhasePill phase={phase} size="md" />;
}
