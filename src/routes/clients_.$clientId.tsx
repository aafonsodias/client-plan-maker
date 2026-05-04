import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ClientAvatarUpload } from "@/components/ClientAvatarUpload";
import { ClientDocuments } from "@/components/ClientDocuments";
import { MicrocyclePanel } from "@/components/MicrocyclePanel";
import { ProgressionsPanel } from "@/components/ProgressionsPanel";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Children, createContext, isValidElement, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
const DemoOrchestrator = lazy(() =>
  import("@/components/DemoOrchestrator").then((m) => ({ default: m.DemoOrchestrator }))
);
import { useTranslation } from "react-i18next";
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
import { Sparkles, FileText, Loader2, CheckCircle2, Circle, Info, AlertTriangle, Trash2, Eraser, Check, ChevronDown, ChevronRight, StopCircle, ChevronsDownUp, ChevronsUpDown, ArrowLeft, ArrowRight, Calendar as CalendarIcon, Download, Plus, Focus, List, Eye, Send } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { SMART_GOAL_TEMPLATES, deadlineFromWeeks } from "@/lib/smart-goal-templates";
import { useServerFn } from "@tanstack/react-start";
import { generatePlanDraft, generatePlanWeek, generatePlanDay, finalizePlanGeneration } from "@/server/plan.functions";
import { analyzeAssessmentSection, getSectionAnalysisCoverage } from "@/server/phased/pre-stage.functions";
import { createManualPlan, updateTrainerSummary } from "@/server/measurements.functions";
import { archivePlanAndStartNextBlock } from "@/server/blocks.functions";
import { startPhasedPlanDraft, synthesizeBrief, approveBrief } from "@/server/phased/stage1-brief.functions";
import { generateBlueprint } from "@/server/phased/stage2-blueprint.functions";
import { generateMicrocycleDays } from "@/server/phased/stage3-microcycle.functions";
import { proposeProgressions } from "@/server/phased/stage4-progressions.functions";
import {
  BriefSchema,
  ProgrammingVariablesSchema,
  RedFlagAccommodationsSchema,
  type Brief,
  type ProgrammingVariables,
  type RedFlagAccommodation,
  type SectionAnalysis,
} from "@/server/phased/schemas";
import {
  defaultProgrammingVariables,
  reconcileAccommodations,
} from "@/server/phased/programming-defaults";
import BriefEditor from "@/components/BriefEditor";
import StageCard from "@/components/StageCard";
import { FounderAiTelemetryPanel } from "@/components/FounderAiTelemetryPanel";
import { BlueprintEditorPanel } from "@/components/BlueprintEditorPanel";
import { markOnboardingStep } from "@/components/OnboardingChecklist";
import { PaywallDialog } from "@/components/PaywallDialog";
import { useClientPhases } from "@/hooks/use-client-phases";
import { ClientPhasePill } from "@/components/ClientPhasePill";
import { IntakeLinkPanel } from "@/components/IntakeLinkPanel";
import { ComplianceDashboard } from "@/components/ComplianceDashboard";
import MovementPatternCard from "@/components/MovementPatternCard";
import { PATTERN_IDS, formScore, derivePatternScore, type PatternId } from "@/lib/movement-criteria";
import { Slider } from "@/components/ui/slider";
import { planStatusInfo } from "@/lib/plan-status";
import { downloadPlanById } from "@/lib/download-plan";

export const Route = createFileRoute("/clients_/$clientId")({
  component: ClientDetailRoute,
  validateSearch: zodValidator(
    z.object({
      demo: fallback(z.enum(["play"]).optional(), undefined),
    })
  ),
});

function ClientDetailRoute() {
  const { t } = useTranslation("assessment");
  const { clientId } = Route.useParams();
  const { demo } = Route.useSearch();
  return (
    <AppShell back={{ to: "/dashboard", label: t("all_clients") }}>
      <ClientDetail />
      {demo === "play" && (
        <Suspense fallback={null}>
          <DemoOrchestrator clientId={clientId} enabled />
        </Suspense>
      )}
    </AppShell>
  );
}

// Stable IDs — labels resolved via i18n at render time. The DB stores
// the canonical EN label for `available_equipment` for backward compatibility.
const EQUIPMENT_OPTIONS: Array<{ id: string; canonical: string }> = [
  { id: "barbell", canonical: "Barbell" },
  { id: "dumbbells", canonical: "Dumbbells" },
  { id: "kettlebells", canonical: "Kettlebells" },
  { id: "cable_machine", canonical: "Cable machine" },
  { id: "bench", canonical: "Bench" },
  { id: "pull_up_bar", canonical: "Pull-up bar" },
  { id: "bands", canonical: "Bands" },
  { id: "bodyweight", canonical: "Bodyweight only" },
];

const PARQ_KEYS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7"] as const;

// Map each PAR-Q+ question to a rationale key for translation.
const PARQ_RATIONALE_KEY: Record<string, string> = {
  q1: "cardio",
  q2: "cardio",
  q3: "cardio",
  q4: "balance",
  q5: "msk",
  q6: "cardio",
  q7: "manual",
};

function parqFlagCount(parq: Record<string, boolean | null>): number {
  return Object.values(parq ?? {}).filter((v) => v === true).length;
}

// Section -> assessment field keys used to compute a signature for edit detection.
const PROV_SECTION_FIELDS: Record<string, string[]> = {
  parq: ["parq"],
  risk: ["risk"],
  anthro: ["waist_cm", "hip_cm", "body_fat_pct", "body_fat_method"],
  meds: ["medications", "med_flags"],
  goal: ["smart_specific", "smart_measurable", "smart_deadline", "primary_goal", "secondary_goals"],
  smart_goal: ["smart_specific", "smart_measurable", "smart_deadline", "primary_goal"],
  readiness: ["readiness_stage"],
  training: [
    "experience_level", "training_days_per_week", "session_duration_minutes",
    "training_location", "available_equipment", "injuries", "medical_conditions", "preferences",
    "current_capacity_vs_pb",
  ],
  lifestyle: [
    "sleep_quality", "stress_level", "ext_hours_seated", "ext_daily_steps",
    "ext_job_type", "energy_levels", "recovery_capacity",
  ],
  nutrition: [
    "ext_meals_per_day", "ext_alcohol_units_week", "ext_processed_food_freq",
    "ext_water_l_per_day", "nutrition_habits",
  ],
  mobility: [
    "mobility_limitations", "ext_mob_shoulder", "ext_mob_hip", "ext_mob_ankle",
    "ext_mob_thoracic", "ext_mob_wrist", "ext_mob_knee",
  ],
  posture: ["standing_posture_notes", "known_imbalances", "dominant_side"],
  screen: [
    "squat_form_criteria", "squat_capacity",
    "hinge_form_criteria", "hinge_capacity",
    "push_form_criteria", "push_capacity",
    "pull_form_criteria", "pull_capacity",
    "carry_form_criteria", "carry_capacity",
    "lunge_form_criteria", "lunge_capacity",
    "screen_not_assessed",
  ],
  history: ["years_training", "previous_program_style", "max_lifts"],
  performance: ["resting_heart_rate", "cardio_capacity", "ext_cardio_test"],
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
      return PATTERN_IDS.every((p) => {
        if (a.screen_not_assessed?.[p] === true) return true;
        const fc = a[`${p}_form_criteria`];
        return fc && formScore(fc) >= 3;
      });
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
    squat_form_criteria: assessment.squat_form_criteria ?? {},
    squat_capacity: assessment.squat_capacity ?? {},
    hinge_form_criteria: assessment.hinge_form_criteria ?? {},
    hinge_capacity: assessment.hinge_capacity ?? {},
    push_form_criteria: assessment.push_form_criteria ?? {},
    push_capacity: assessment.push_capacity ?? {},
    pull_form_criteria: assessment.pull_form_criteria ?? {},
    pull_capacity: assessment.pull_capacity ?? {},
    carry_form_criteria: assessment.carry_form_criteria ?? {},
    carry_capacity: assessment.carry_capacity ?? {},
    lunge_form_criteria: assessment.lunge_form_criteria ?? {},
    lunge_capacity: assessment.lunge_capacity ?? {},
    screen_not_assessed: assessment.screen_not_assessed ?? {},
    current_capacity_vs_pb:
      typeof assessment.current_capacity_vs_pb === "number"
        ? assessment.current_capacity_vs_pb
        : null,
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
    performed_on: assessment.performed_on || null,
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
  const { t, i18n } = useTranslation("assessment");
  const { t: tCommon } = useTranslation("common");
  const dateLocale = i18n.language === "pt" ? "pt-PT" : "en-US";
  const { user } = useAuth();
  const navigate = useNavigate();
  const generateFn = useServerFn(generatePlanDraft);
  const generateWeekFn = useServerFn(generatePlanWeek);
  const generateDayFn = useServerFn(generatePlanDay);
  const finalizePlanFn = useServerFn(finalizePlanGeneration);
  const startPhasedPlanFn = useServerFn(startPhasedPlanDraft);
  const synthesizeBriefFn = useServerFn(synthesizeBrief);
  const approveBriefFn = useServerFn(approveBrief);
  const generateBlueprintFn = useServerFn(generateBlueprint);
  const generateMicrocycleDaysFn = useServerFn(generateMicrocycleDays);
  const proposeProgressionsFn = useServerFn(proposeProgressions);
  const [stageBusy, setStageBusy] = useState<null | "blueprint" | "microcycle" | "progressions">(null);
  const [phasedBusy, setPhasedBusy] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  // Inline brief panel: rendered below the action row. Replaces the toast-link banner.
  const [inlineBrief, setInlineBrief] = useState<{
    planId: string;
    brief: Brief;
    approved: boolean;
    programmingVariables: ProgrammingVariables;
    accommodations: RedFlagAccommodation[];
    approvedStages?: string[];
    hasBlueprintDraft?: boolean;
    hasMicrocycleDraft?: boolean;
    hasProgressionsDraft?: boolean;
  } | null>(null);
  const [briefStageBusy, setBriefStageBusy] = useState(false);
  const [expandedStage, setExpandedStage] = useState<null | "blueprint" | "microcycle" | "progressions">(null);
  // Synthesis dashboard expansion (independent of AssessmentSection collapse).
  // When the trainer clicks the green "Avaliação completa" pill, the synthesis
  // expands; when collapsed, only the chip remains and stages stay below.
  const [synthesisOpen, setSynthesisOpen] = useState(false);
  // Assessment collapse — controlled so sidebar can mirror it. Once brief is
  // approved, default to collapsed (the trainer is now working in the stages
  // below). User toggle is persisted per-client.
  const assessmentCollapseKey = `forge_assessment_top_collapsed_${clientId}`;
  const [assessmentCollapsed, setAssessmentCollapsed] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(assessmentCollapseKey);
      if (v === "1") setAssessmentCollapsed(true);
      else if (v === "0") setAssessmentCollapsed(false);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);
  const setAssessmentCollapsedPersist = (v: boolean) => {
    setAssessmentCollapsed(v);
    try { window.localStorage.setItem(assessmentCollapseKey, v ? "1" : "0"); } catch { /* ignore */ }
  };
  // Per-section AI post-processing analyses (Pre-Stage 0).
  const [sectionAnalyses, setSectionAnalyses] = useState<Record<string, SectionAnalysis | null>>({});
  const [analysingSections, setAnalysingSections] = useState<Record<string, boolean>>({});

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
    // Movement screen v2 (form-criterion checklists + capacity)
    squat_form_criteria: {} as Record<string, boolean>,
    squat_capacity: {} as Record<string, number | null>,
    hinge_form_criteria: {} as Record<string, boolean>,
    hinge_capacity: {} as Record<string, number | null>,
    push_form_criteria: {} as Record<string, boolean>,
    push_capacity: {} as Record<string, number | null>,
    pull_form_criteria: {} as Record<string, boolean>,
    pull_capacity: {} as Record<string, number | null>,
    carry_form_criteria: {} as Record<string, boolean>,
    carry_capacity: {} as Record<string, number | null>,
    lunge_form_criteria: {} as Record<string, boolean>,
    lunge_capacity: {} as Record<string, number | null>,
    screen_not_assessed: {} as Record<string, boolean>,
    // Setup: current capacity vs personal best (1-10) — drives rebuild/maintain/progress mode
    current_capacity_vs_pb: null as number | null,
    // Training history
    years_training: "",
    previous_program_style: "",
    max_lifts: "",
    // Performance markers
    resting_heart_rate: "",
    cardio_capacity: "",
    // Per-section provenance: "client" (filled via intake) or "trainer-edited"
    provenance: {} as Record<string, "client" | "trainer-edited">,
    // When the assessment was actually performed (separate from row created_at).
    performed_on: "" as string,
  });
  const [duration, setDuration] = useState(4);
  const [plans, setPlans] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  // Per-day generation progress: map of "w-d" -> "pending" | "running" | "done" | "error"
  const [dayProgress, setDayProgress] = useState<Record<string, "pending" | "running" | "done" | "error">>({});
  const [progressTotals, setProgressTotals] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const stopRequestedRef = useRef(false);
  const [stopping, setStopping] = useState(false);
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

  // Phased generation feature-flag + brief preview coverage.
  const [phasedEnabled, setPhasedEnabled] = useState(false);
  const [briefCoverage, setBriefCoverage] = useState<{ done: number; total: number } | null>(null);
  const analyzeSectionFn = useServerFn(analyzeAssessmentSection);
  const getCoverageFn = useServerFn(getSectionAnalysisCoverage);
  const createManualPlanFn = useServerFn(createManualPlan);
  const updateTrainerSummaryFn = useServerFn(updateTrainerSummary);
  const evolvePlanFn = useServerFn(archivePlanAndStartNextBlock);
  const [creatingPlan, setCreatingPlan] = useState<"manual" | "evolve" | null>(null);
  const [trainerSummaryDraft, setTrainerSummaryDraft] = useState<string>("");
  const [trainerSummarySaving, setTrainerSummarySaving] = useState(false);

  /**
   * Latest plan that was already finalized for the *current* assessment.
   * Heuristic: matching `assessment_id` OR (no link) created_at ≥ assessment.performed_on.
   * Used to hide the "Descartar rascunho" / "Revisão de segurança" buttons —
   * once there's a ready plan, those CTAs are noise. Also used to default the
   * assessment block to collapsed.
   */
  const readyPlanForAssessment = useMemo(() => {
    const aId = (assessment as any)?.id as string | undefined;
    const performedOn = (assessment as any)?.performed_on as string | undefined;
    return plans.find((p) => {
      if (p.generation_status !== "complete") return false;
      if (aId && p.assessment_id === aId) return true;
      if (!performedOn) return false;
      try {
        return new Date(p.created_at).getTime() >= new Date(performedOn).getTime();
      } catch { return false; }
    }) ?? null;
  }, [plans, assessment]);

  /** Most recent plan eligible for "evolve into next block" — must be marked
   *  finished_logging or already archived, with at least one logged session
   *  (we trust the marker; the server fn sanity-checks adherence). */
  const evolvableSourcePlan = useMemo(() => {
    return plans.find(
      (p) =>
        p.generation_status === "complete" &&
        (p.completion_state === "finished_logging" || p.status === "archived"),
    ) ?? null;
  }, [plans]);
  // Track signature of last-analysed payload per section to avoid duplicate fires.
  const lastAnalysedSigRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: c } = await supabase.from("clients").select("*").eq("id", clientId).single();
      setClient(c);
      setTrainerSummaryDraft((c as any)?.trainer_summary ?? "");
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
          squat_form_criteria: (a as any).squat_form_criteria ?? {},
          squat_capacity: (a as any).squat_capacity ?? {},
          hinge_form_criteria: (a as any).hinge_form_criteria ?? {},
          hinge_capacity: (a as any).hinge_capacity ?? {},
          push_form_criteria: (a as any).push_form_criteria ?? {},
          push_capacity: (a as any).push_capacity ?? {},
          pull_form_criteria: (a as any).pull_form_criteria ?? {},
          pull_capacity: (a as any).pull_capacity ?? {},
          carry_form_criteria: (a as any).carry_form_criteria ?? {},
          carry_capacity: (a as any).carry_capacity ?? {},
          lunge_form_criteria: (a as any).lunge_form_criteria ?? {},
          lunge_capacity: (a as any).lunge_capacity ?? {},
          screen_not_assessed: (a as any).screen_not_assessed ?? {},
          current_capacity_vs_pb: (a as any).current_capacity_vs_pb ?? null,
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

      const { data: p } = await supabase
        .from("workout_plans")
        .select("id, title, status, updated_at, created_at, brief, generation_state, generation_status, assessment_id, completion_state, block_number, assessment_completion_pct")
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false });
      setPlans(p ?? []);
      // Load phased-generation feature flag for this trainer.
      const { data: prof } = await supabase
        .from("profiles")
        .select("phased_generation_enabled")
        .eq("user_id", user.id)
        .maybeSingle();
      setPhasedEnabled(!!(prof as any)?.phased_generation_enabled);
      setHydrated(true);
      void detectResumablePlan();
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
          // Fire-and-forget Pre-Stage 0 micro-analyses for sections whose
          // signature changed since the last analysis. Gated server-side on
          // profiles.phased_generation_enabled.
          if (phasedEnabled && assessment.id) {
            void triggerSectionAnalyses();
          }
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

  // Eager Pre-Stage 0: for each phased section whose payload signature changed,
  // fire-and-forget a server-side micro-analysis. Server is idempotent + cached,
  // and gated on the trainer's phased_generation_enabled flag.
  const triggerSectionAnalyses = async () => {
    if (!assessment.id) return;
    const sections = Object.keys(PROV_SECTION_FIELDS).filter((s) => s !== "smart_goal");
    // Run sequentially with a small inter-call delay so we don't trip Anthropic
    // concurrent-connection rate limits (HTTP 429).
    const queue: string[] = [];
    for (const section of sections) {
      const sig = sectionSignature(assessment, section);
      if (lastAnalysedSigRef.current[section] === sig) continue;
      if (sig === JSON.stringify([]) || /^\[(null,?)+\]$/.test(sig.replace(/\s/g, ""))) continue;
      lastAnalysedSigRef.current[section] = sig;
      queue.push(section);
    }
    if (queue.length === 0) return;
    setAnalysingSections((prev) => {
      const next = { ...prev };
      for (const s of queue) next[s] = true;
      return next;
    });
    void (async () => {
      for (const section of queue) {
        try {
          await analyzeSectionFn({ data: { assessmentId: assessment.id, section: section as any } });
        } catch (e) {
          console.warn("pre-stage analyze failed", section, e);
        }
        setAnalysingSections((prev) => {
          const next = { ...prev };
          delete next[section];
          return next;
        });
        await new Promise((r) => setTimeout(r, 600));
      }
      if (!assessment.id) return;
      try {
        const r: any = await getCoverageFn({ data: { assessmentId: assessment.id } });
        if (r?.ok) {
          setBriefCoverage({ done: r.done, total: r.total });
          setSectionAnalyses((r.analyses ?? {}) as Record<string, SectionAnalysis | null>);
        }
      } catch {}
    })();
  };

  // Initial coverage fetch when phased flag is on and assessment exists.
  useEffect(() => {
    if (!phasedEnabled || !assessment.id) return;
    void (async () => {
      try {
        const r: any = await getCoverageFn({ data: { assessmentId: assessment.id } });
        if (r?.ok) {
          setBriefCoverage({ done: r.done, total: r.total });
          setSectionAnalyses((r.analyses ?? {}) as Record<string, SectionAnalysis | null>);
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phasedEnabled, assessment.id]);

  // Hydrate inline brief panel on mount: if there's an in-progress phased plan
  // for this client with a brief already, surface it directly so refresh restores state.
  useEffect(() => {
    if (!phasedEnabled || !user || !hydrated) return;
    void (async () => {
      const { data: row } = await supabase
        .from("workout_plans")
        .select("id, brief, blueprint, progression_plan, generation_state, generation_status, programming_variables, red_flag_accommodations")
        .eq("trainer_id", user.id)
        .eq("client_id", clientId)
        .neq("generation_status", "complete")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!row || !(row as any).brief) return;
      const parsed = BriefSchema.safeParse((row as any).brief);
      if (!parsed.success) return;
      const stage = (row as any).generation_state?.stage as string | undefined;
      const approvedList: string[] = (row as any).generation_state?.approved_stages ?? [];
      const storedPv = ProgrammingVariablesSchema.safeParse(
        (row as any).programming_variables
      );
      const storedAcc = RedFlagAccommodationsSchema.safeParse(
        (row as any).red_flag_accommodations
      );
      const hasBlueprintDraft = !!(row as any).blueprint;
      const hasProgressionsDraft = !!(row as any).progression_plan;
      // Count microcycle days for this plan (week 1) — drafts mean ≥1 row.
      let hasMicrocycleDraft = false;
      try {
        const { count } = await supabase
          .from("workout_plan_days")
          .select("id", { count: "exact", head: true })
          .eq("plan_id", (row as any).id)
          .eq("week_number", 1);
        hasMicrocycleDraft = (count ?? 0) > 0;
      } catch {
        /* ignore */
      }
      setInlineBrief({
        planId: (row as any).id,
        brief: parsed.data,
        approved: approvedList.includes("brief") || (!!stage && stage !== "brief"),
        programmingVariables: storedPv.success
          ? storedPv.data
          : defaultProgrammingVariables(parsed.data),
        accommodations: storedAcc.success
          ? reconcileAccommodations(parsed.data, storedAcc.data)
          : reconcileAccommodations(parsed.data, null),
        approvedStages: approvedList,
        hasBlueprintDraft,
        hasMicrocycleDraft,
        hasProgressionsDraft,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phasedEnabled, user, hydrated, clientId]);

  // Load a specific phased-draft plan into the inline panel and scroll the
  // stage cards into view. Used when the trainer clicks a row in the Plans
  // list — we never navigate away to /plans/$planId/<stage>.
  const openPhasedDraft = useCallback(async (planId: string, stage?: string) => {
    const { data: row } = await supabase
      .from("workout_plans")
      .select("id, brief, blueprint, progression_plan, generation_state, programming_variables, red_flag_accommodations")
      .eq("id", planId)
      .maybeSingle();
    if (!row || !(row as any).brief) {
      toast.error("Brief não disponível para este plano.");
      return;
    }
    const parsed = BriefSchema.safeParse((row as any).brief);
    if (!parsed.success) {
      toast.error("Brief com formato inválido.");
      return;
    }
    const approvedList: string[] = (row as any).generation_state?.approved_stages ?? [];
    const stageNow = (row as any).generation_state?.stage as string | undefined;
    const storedPv = ProgrammingVariablesSchema.safeParse((row as any).programming_variables);
    const storedAcc = RedFlagAccommodationsSchema.safeParse((row as any).red_flag_accommodations);
    const hasBlueprintDraft = !!(row as any).blueprint;
    const hasProgressionsDraft = !!(row as any).progression_plan;
    let hasMicrocycleDraft = false;
    try {
      const { count } = await supabase
        .from("workout_plan_days")
        .select("id", { count: "exact", head: true })
        .eq("plan_id", planId)
        .eq("week_number", 1);
      hasMicrocycleDraft = (count ?? 0) > 0;
    } catch {}
    setInlineBrief({
      planId,
      brief: parsed.data,
      approved: approvedList.includes("brief") || (!!stageNow && stageNow !== "brief"),
      programmingVariables: storedPv.success ? storedPv.data : defaultProgrammingVariables(parsed.data),
      accommodations: storedAcc.success
        ? reconcileAccommodations(parsed.data, storedAcc.data)
        : reconcileAccommodations(parsed.data, null),
      approvedStages: approvedList,
      hasBlueprintDraft,
      hasMicrocycleDraft,
      hasProgressionsDraft,
    });
    const target = (stage && (stage === "blueprint" || stage === "microcycle" || stage === "progressions"))
      ? stage
      : (hasMicrocycleDraft ? "microcycle" : hasBlueprintDraft ? "blueprint" : null);
    if (target) setExpandedStage(target as any);
    // Scroll the stages lane into view so the user sees the chip + stages.
    requestAnimationFrame(() => {
      document.getElementById("forge-stages-lane")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [clientId]);

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
    stopRequestedRef.current = false;
    setStopping(false);
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
        full_name: client?.full_name ?? "Client",
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
            title: `${client?.full_name ?? "Client"} – ${duration}-Week Plan`,
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

      for (const cell of todo) {
        if (stopRequestedRef.current) break;
        const key = `${cell.w}-${cell.d}`;
        setDayProgress((prev) => ({ ...prev, [key]: "running" }));
        let lastErr = "unknown";
        let success = false;
        for (let attempt = 1; attempt <= 2 && !success; attempt++) {
          if (stopRequestedRef.current) break;
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
            if (r?.ok) {
              success = true;
              setDayProgress((prev) => ({ ...prev, [key]: "done" }));
              completed += 1;
              setProgressTotals({ done: completed, total: grid.length });
            } else if (r?.billingRequired) {
              billingHit = r;
              lastErr = r?.error ?? "billing required";
              break;
            } else {
              lastErr = r?.error ?? "unknown";
            }
          } catch (e: any) {
            lastErr = e?.message ?? "failed";
          }
          if (!success && attempt < 2) {
            await new Promise((res) => setTimeout(res, 2000));
          }
        }
        if (!success && !billingHit) {
          errors.push(`W${cell.w}D${cell.d}: ${lastErr}`);
          setDayProgress((prev) => ({ ...prev, [key]: "error" }));
        }
        if (billingHit) break;
        // 1.5s pause between days to avoid Anthropic rate limits
        await new Promise((res) => setTimeout(res, 1500));
      }

      if (billingHit) {
        toast.error(billingHit.error || "Subscription required");
        navigate({ to: "/billing" });
        return;
      }
      if (stopRequestedRef.current) {
        toast.success("Generation stopped. Progress saved as draft — tap Continue to resume.");
        await detectResumablePlan();
        return;
      }
      if (errors.length) {
        toast.error(`${errors.length} day(s) failed. Tap "Continue" to retry the missing ones.`);
        // Refresh resumable banner; leave plan in_progress.
        await detectResumablePlan();
        return;
      }

      setProgressStep(3);

      // Generate title + summary from the full assessment before finalizing.
      let draftTitle: string | undefined;
      let draftSummary: string | undefined;
      try {
        const draft: any = await generateFn({
          data: {
            client: clientPayload,
            assessment: assessmentPayload,
            duration_weeks: planDuration,
          },
        });
        if (draft?.ok && draft.plan) {
          draftTitle = draft.plan.title || undefined;
          draftSummary = draft.plan.summary || undefined;
        }
      } catch (e) {
        console.warn("Draft title/summary generation failed; falling back to defaults.", e);
      }

      const fin: any = await finalizePlanFn({
        data: { plan_id: planId, title: draftTitle, summary: draftSummary },
      });
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
      stopRequestedRef.current = false;
      setStopping(false);
    }
  };

  // Detect any in-progress plan for this client and surface a resume banner.
  const detectResumablePlan = async () => {
    if (!user) return;
    const { data: pl } = await supabase
      .from("workout_plans")
      .select("id, title, duration_weeks, generation_meta, generation_state, generation_status")
      .eq("client_id", clientId)
      .eq("generation_status", "in_progress")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!pl) {
      setResumablePlan(null);
      return;
    }
    // Ignore phased-flow plans — they don't use the legacy per-day resume banner.
    const stage = (pl.generation_state as any)?.stage as string | undefined;
    if (stage && ["brief", "blueprint", "microcycle", "progressions"].includes(stage)) {
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

  // Refresh the Plans list (used after creating a phased draft or deleting a plan).
  const refreshPlans = async () => {
    const { data: p } = await supabase
      .from("workout_plans")
      .select("id, title, status, updated_at, brief, generation_state, generation_status, assessment_completion_pct")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false });
    setPlans(p ?? []);
  };

  // Kick off the new 5-stage phased flow. Used both by the normal generate
  // button and by the safety-gate confirmation, so the safety override stays
  // on the new pipeline instead of falling back to the legacy day-by-day
  // generator.
  const runPhasedStart = useCallback(async () => {
    if (phasedBusy) return;
    setPhasedBusy(true);
    const tId = toast.loading("Synthesizing brief…");
    try {
      const res = await startPhasedPlanFn({ data: { clientId, durationWeeks: duration } });
      if (!res.ok) {
        if (res.error === "quota_exceeded") {
          toast.dismiss(tId);
          setPaywallOpen(true);
        } else {
          toast.error(res.error || "Brief synthesis failed.", { id: tId });
        }
        return;
      }
      const { data: row } = await supabase
        .from("workout_plans")
        .select("brief, generation_state, programming_variables, red_flag_accommodations")
        .eq("id", res.planId)
        .maybeSingle();
      const parsed = BriefSchema.safeParse((row as any)?.brief);
      if (!parsed.success) {
        toast.error("Brief returned but failed to parse.", { id: tId });
        return;
      }
      const stage = (row as any)?.generation_state?.stage as string | undefined;
      const approvedList: string[] = (row as any)?.generation_state?.approved_stages ?? [];
      const storedPv = ProgrammingVariablesSchema.safeParse(
        (row as any)?.programming_variables
      );
      const storedAcc = RedFlagAccommodationsSchema.safeParse(
        (row as any)?.red_flag_accommodations
      );
      setInlineBrief({
        planId: res.planId,
        brief: parsed.data,
        approved: approvedList.includes("brief") || (stage && stage !== "brief") ? true : false,
        programmingVariables: storedPv.success
          ? storedPv.data
          : defaultProgrammingVariables(parsed.data),
        accommodations: storedAcc.success
          ? reconcileAccommodations(parsed.data, storedAcc.data)
          : reconcileAccommodations(parsed.data, null),
        approvedStages: approvedList,
      });
      void refreshPlans();
      toast.success(
        res.reused ? "Brief already ready" : "Brief ready",
        { id: tId, duration: 4000 }
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Brief synthesis failed.", { id: tId });
    } finally {
      setPhasedBusy(false);
    }
  }, [clientId, phasedBusy, startPhasedPlanFn]);

  // Delete a single plan (with confirm) from the Plans list.
  const deletePlan = async (planId: string) => {
    const { error } = await supabase.from("workout_plans").delete().eq("id", planId);
    if (error) {
      toast.error("Delete failed: " + error.message);
      return;
    }
    setPlans((prev) => prev.filter((p) => p.id !== planId));
    if (inlineBrief?.planId === planId) setInlineBrief(null);
    toast.success("Plan deleted");
  };

  const discardDraft = () => {
    // no-op marker
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

  if (!client) return <p className="text-muted-foreground">{t("loading")}</p>;

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

  const expLabelById: Record<string, string> = {
    beginner: t("training_block.beginner"),
    intermediate: t("training_block.intermediate"),
    advanced: t("training_block.advanced"),
  };
  const trainingSummary = [
    assessment.training_days_per_week
      ? t("training_block.summary.x_per_week", { n: assessment.training_days_per_week })
      : null,
    assessment.session_duration_minutes
      ? t("training_block.summary.min", { n: assessment.session_duration_minutes })
      : null,
    assessment.training_location || null,
    assessment.experience_level ? (expLabelById[assessment.experience_level] ?? assessment.experience_level) : null,
  ].filter(Boolean).join(", ");

  return (
    <TooltipProvider delayDuration={200}>
    <div data-tour="client-overview" className="w-full max-w-full space-y-6 overflow-x-hidden">
      <div>
        <div className="flex flex-wrap items-center gap-4 min-w-0">
          {user?.id && (
            <ClientAvatarUpload
              clientId={client.id}
              trainerId={user.id}
              name={client.full_name}
              photoUrl={client.photo_url ?? null}
              onChange={(url) => setClient((prev: any) => ({ ...prev, photo_url: url }))}
              size={56}
            />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-light tracking-tight break-words min-w-0">{client?.full_name}</h1>
              <ClientPhaseHeaderPill clientId={client.id} />
            </div>
            <p className="text-muted-foreground break-words min-w-0">{client.email ?? t("no_email")}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <AssessmentDatePicker
            value={assessment.performed_on || ""}
            onChange={(iso) => setAssessment({ ...assessment, performed_on: iso })}
            label={t("performed_on_label")}
            placeholder={t("performed_on_placeholder")}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={async () => {
              try {
                const { renderAssessmentPdf } = await import("@/lib/pdf");
                renderAssessmentPdf({
                  assessment,
                  client,
                  t: t as any,
                });
              } catch (e: any) {
                toast.error(e?.message ?? "PDF error");
              }
            }}
          >
            <Download className="h-3.5 w-3.5" />
            {t("download_pdf")}
          </Button>
          <Button asChild type="button" variant="ghost" size="sm" className="h-8 gap-1.5">
            <Link to="/me" search={{ as: client.id }} title="Pré-visualizar como cliente">
              <Eye className="h-3.5 w-3.5" /> Ver como cliente
            </Link>
          </Button>
          <ClientDocuments clientId={client.id} />
          {(client.intake_status === "submitted" ||
            client.intake_status === "reviewed" ||
            lastSavedAt) && (
            <Sheet>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Pedir nova avaliação"
                  title="Pedir nova avaliação ao cliente"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground hover:border-accent hover:text-foreground"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Avaliação</span>
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Pedir nova avaliação</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
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
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>

      {!(client.intake_status === "submitted" ||
        client.intake_status === "reviewed" ||
        lastSavedAt) && (
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
      )}

      {/* Compact client snapshot — always visible, summarizes latest assessment */}
      {lastSavedAt && (
        <a
          href="#sintese-da-avaliacao"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById("sintese-da-avaliacao")?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }}
          className="inline-flex items-center gap-1 self-start text-xs text-muted-foreground transition hover:text-foreground"
        >
          Última avaliação ·{" "}
          {new Date(lastSavedAt).toLocaleDateString(dateLocale, {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}{" "}
          <ArrowRight className="h-3 w-3" />
        </a>
      )}

      {/* Readiness strip — at-a-glance ACSM risk + recovery score from latest data.
          Hidden until at least one signal exists so it doesn't render as "Baixo / —". */}
      {(() => {
        const sleep = Number(assessment.sleep_quality);
        const stress = Number(assessment.stress_level);
        const sore = Number((assessment as any).soreness ?? 0);
        const haveSignals = Number.isFinite(sleep) && sleep > 0;
        const haveRisk = !!assessment.acsm_risk_category || riskCategory !== "low" || parqYes;
        if (!haveSignals && !haveRisk) return null;
        // Readiness 0-100: sleep (1-10) drives 50%, low stress 30%, low soreness 20%.
        const sleepPart = Number.isFinite(sleep) && sleep > 0 ? (sleep / 10) * 50 : 25;
        const stressPart = Number.isFinite(stress) && stress > 0 ? ((11 - stress) / 10) * 30 : 15;
        const sorePart = Number.isFinite(sore) && sore > 0 ? ((11 - sore) / 10) * 20 : 10;
        const readiness = Math.round(sleepPart + stressPart + sorePart);
        const readyTone =
          readiness >= 75
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : readiness >= 50
              ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              : "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400";
        const riskTone =
          riskCategory === "high"
            ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
            : riskCategory === "moderate"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
        const riskLabel =
          riskCategory === "high" ? "Alto" : riskCategory === "moderate" ? "Moderado" : "Baixo";
        return (
          <div className="flex flex-wrap items-center gap-2 self-start">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${riskTone}`}
              title={t("detail.acsm_chip_title")}
            >
              <span className="text-[9px] uppercase tracking-widest opacity-70">{t("detail.acsm_label")}</span>
              {riskLabel}
              {parqYes && <span className="opacity-70">· PAR-Q+</span>}
            </span>
            {haveSignals && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium tabular-nums ${readyTone}`}
                title={t("detail.recovery_chip_tooltip", { sleep: sleep || "—", stress: stress || "—", sore: sore || "—" })}
              >
                <span className="text-[9px] uppercase tracking-widest opacity-70">{t("detail.recovery_label")}</span>
                {readiness}/100
              </span>
            )}
          </div>
        );
      })()}

      {(() => {
        const briefApproved = !!inlineBrief?.approved;
        const effectiveCollapsed =
          assessmentCollapsed ?? (briefApproved || !!readyPlanForAssessment);
        const showSidebar = !effectiveCollapsed;
        return (
      <div className={`grid items-start gap-6 [&>*]:min-w-0 ${showSidebar ? "lg:grid-cols-[200px_1fr]" : "lg:grid-cols-1"}`}>
        {showSidebar && (
        <aside className="hidden lg:block">
          <nav className="sticky top-20 space-y-1 rounded-xl border border-border bg-card p-2 text-sm">
            <p className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("sections_label")}</p>
            {sectionStatus.map((s) => (
              <a
                key={s.id}
                href={`#sec-${s.id}`}
                onClick={() => setActiveSection(s.id)}
                className={`flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition ${activeSection === s.id ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <span>{t(`sections.${s.id}` as const)}</span>
                {s.complete && <Check className="h-3 w-3 text-accent" />}
              </a>
            ))}
          </nav>
        </aside>
        )}

        <AssessmentSection
          clientId={clientId}
          collapsed={effectiveCollapsed}
          onCollapsedChange={setAssessmentCollapsedPersist}
          completionPct={
            briefCoverage && briefCoverage.total > 0
              ? Math.round((briefCoverage.done / briefCoverage.total) * 100)
              : null
          }
          onShowSynthesis={() => setSynthesisOpen((o) => !o)}
          summaryLine={
            (assessment as any)?.performed_on
              ? `Última avaliação · ${new Date((assessment as any).performed_on).toLocaleDateString(dateLocale, { day: "2-digit", month: "2-digit", year: "numeric" })} · ${totalSections} secções · ${pct}%`
              : `${totalSections} secções · ${pct}%`
          }
          headerProgress={
            <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <h2 className="shrink-0 text-base font-bold">{t("title")}</h2>
                <div className="h-1.5 min-w-[60px] flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-accent/70 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tabular-nums text-muted-foreground">
                <span>
                  {t("progress_short", {
                    current: sectionNumber,
                    total: totalSections,
                    pct,
                  })}
                </span>
                <span className="hidden sm:inline">
                  {t("progress_minutes", { minutes: minutesLeft })}
                </span>
                <SaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
              </div>
            </div>
          }
        >

          {/* PAR-Q+ */}
          <SectionBlock id="parq" analysing={analysingSections["parq"]} analysis={sectionAnalyses["parq"]} title={t("parq_block.title")} hint={t("parq_block.hint")} complete={isSectionComplete("parq", assessment)} footer={isSectionComplete("parq", assessment) ? <CompletionStrip text={parqFlagCount(assessment.parq) === 0 ? t("parq_block.complete_clear") : t("parq_block.complete_flagged", { count: parqFlagCount(assessment.parq) })} /> : null}>
            <ul className="space-y-1.5">
              {PARQ_KEYS.map((key, idx) => {
                const value = (assessment.parq as any)[key];
                const flagged = value === true;
                return (
                  <li
                    key={key}
                    className={`min-w-0 overflow-hidden rounded-md border bg-background/40 p-2 transition-colors ${flagged ? "border-accent/40 border-l-[3px] border-l-accent" : "border-border"}`}
                  >
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <p className="min-w-0 flex-1 break-words text-xs"><span className="font-semibold">{idx + 1}.</span> {t(`parq_block.questions.${key}` as const)}</p>
                      <div className="shrink-0 self-start">
                        <YesNo value={value} onChange={(v) => setAssessment({ ...assessment, parq: { ...assessment.parq, [key]: v } })} />
                      </div>
                    </div>
                    {flagged && (
                      <div className="mt-2 flex animate-fade-in items-start gap-2 rounded-md border border-accent/30 bg-accent/5 p-2 text-[11px] text-muted-foreground">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                        <span>{t(`parq_block.rationale.${PARQ_RATIONALE_KEY[key]}` as const)}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </SectionBlock>

          {/* Risk stratification */}
          <SectionBlock id="risk" analysing={analysingSections["risk"]} analysis={sectionAnalyses["risk"]} title={t("risk_block.title")} hint={t("risk_block.hint")} complete={isSectionComplete("risk", assessment)} footer={isSectionComplete("risk", assessment) ? <CompletionStrip text={t("risk_block.complete", { level: t(`risk_block.level_${riskCategory}` as const).toUpperCase() })} /> : null}>
            <ParqFlagSummary count={parqFlagCount(assessment.parq)} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Toggle label={t("risk_block.family_cvd")} value={assessment.risk.family_cvd} onChange={(v) => setAssessment({ ...assessment, risk: { ...assessment.risk, family_cvd: v } })} />
              <div className="space-y-1">
                <LabelWithHelp label={t("risk_block.smoking")} hint={t("risk_block.smoking_hint")} />
                <Select value={assessment.risk.smoking} onValueChange={(v) => setAssessment({ ...assessment, risk: { ...assessment.risk, smoking: v } })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">{t("risk_block.smoking_never")}</SelectItem>
                    <SelectItem value="former">{t("risk_block.smoking_former")}</SelectItem>
                    <SelectItem value="current">{t("risk_block.smoking_current")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Toggle label={t("risk_block.sedentary")} value={assessment.risk.sedentary} onChange={(v) => setAssessment({ ...assessment, risk: { ...assessment.risk, sedentary: v } })} />
              <div className="space-y-1">
                <LabelWithHelp label={t("risk_block.bmi_label")} hint={t("risk_block.bmi_hint")} />
                <Select value={assessment.risk.bmi_category} onValueChange={(v) => setAssessment({ ...assessment, risk: { ...assessment.risk, bmi_category: v } })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder={t("select_placeholder")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="underweight">{t("risk_block.bmi_underweight")}</SelectItem>
                    <SelectItem value="normal">{t("risk_block.bmi_normal")}</SelectItem>
                    <SelectItem value="overweight">{t("risk_block.bmi_overweight")}</SelectItem>
                    <SelectItem value="obese">{t("risk_block.bmi_obese")}</SelectItem>
                    <SelectItem value="muscular">{t("risk_block.bmi_muscular")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Toggle label={t("risk_block.dyslipidemia")} value={assessment.risk.dyslipidemia} onChange={(v) => setAssessment({ ...assessment, risk: { ...assessment.risk, dyslipidemia: v } })} />
              <Toggle label={t("risk_block.prediabetes")} value={assessment.risk.prediabetes} onChange={(v) => setAssessment({ ...assessment, risk: { ...assessment.risk, prediabetes: v } })} />
              <Toggle label={t("risk_block.hypertension")} value={assessment.risk.hypertension} onChange={(v) => setAssessment({ ...assessment, risk: { ...assessment.risk, hypertension: v } })} />
            </div>
          </SectionBlock>

          {/* Anthropometry */}
          <SectionBlock id="anthro" analysing={analysingSections["anthro"]} analysis={sectionAnalyses["anthro"]} title={t("anthro_block.title")} hint={t("anthro_block.hint")} defaultCollapsed complete={isSectionComplete("anthro", assessment)}>
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label={t("anthro_block.waist")} type="number" value={assessment.waist_cm} onChange={(v) => setAssessment({ ...assessment, waist_cm: v })} hint={t("anthro_block.waist_hint")} />
              <Field label={t("anthro_block.hip")} type="number" value={assessment.hip_cm} onChange={(v) => setAssessment({ ...assessment, hip_cm: v })} hint={t("anthro_block.hip_hint")} />
              <Field label={t("anthro_block.bf_pct")} type="number" value={assessment.body_fat_pct} onChange={(v) => setAssessment({ ...assessment, body_fat_pct: v })} hint={t("anthro_block.bf_pct_hint")} />
              <div className="space-y-1">
                <Label className="text-xs">{t("anthro_block.whr")}</Label>
                <div className="flex h-8 items-center rounded-md border border-border bg-background/50 px-3 text-sm font-medium">{whr}</div>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <LabelWithHelp label={t("anthro_block.bf_method")} hint={t("anthro_block.bf_method_hint")} />
                <Select value={assessment.body_fat_method} onValueChange={(v) => setAssessment({ ...assessment, body_fat_method: v })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder={t("select_placeholder")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="calipers">{t("anthro_block.bf_calipers")}</SelectItem>
                    <SelectItem value="bia">{t("anthro_block.bf_bia")}</SelectItem>
                    <SelectItem value="dexa">{t("anthro_block.bf_dexa")}</SelectItem>
                    <SelectItem value="bodpod">{t("anthro_block.bf_bodpod")}</SelectItem>
                    <SelectItem value="visual">{t("anthro_block.bf_visual")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SectionBlock>

          {/* Medications */}
          <SectionBlock id="meds" analysing={analysingSections["meds"]} analysis={sectionAnalyses["meds"]} title={t("meds_block.title")} hint={t("meds_block.hint")} defaultCollapsed complete={isSectionComplete("meds", assessment)}>
            <TextField label={t("meds_block.free_text")} value={assessment.medications} onChange={(v) => setAssessment({ ...assessment, medications: v })} className="sm:col-span-2" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                { id: "beta", canonical: "Beta-blocker", label: t("meds_block.flag_beta") },
                { id: "statin", canonical: "Statin", label: t("meds_block.flag_statin") },
                { id: "anticoag", canonical: "Anticoagulant", label: t("meds_block.flag_anticoag") },
              ].map(({ id, canonical: flag, label }) => {
                const on = assessment.med_flags.includes(flag);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAssessment({ ...assessment, med_flags: on ? assessment.med_flags.filter((f: string) => f !== flag) : [...assessment.med_flags, flag] })}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${on ? "border-destructive bg-destructive/10 text-destructive" : "border-border bg-background hover:bg-secondary"}`}
                  >
                    {on && "⚑ "}{label}
                  </button>
                );
              })}
            </div>
          </SectionBlock>

          {/* SMART goal */}
          <SectionBlock id="goal" analysing={analysingSections["goal"]} analysis={sectionAnalyses["goal"]} title={t("goal_block.title")} hint={t("goal_block.hint")} complete={isSectionComplete("goal", assessment)} provenance={assessment.provenance?.smart_goal} reviewed={client.intake_status === "reviewed"} footer={isSectionComplete("goal", assessment) ? <CompletionStrip text={t("goal_block.complete", { text: String(assessment.smart_specific ?? "").slice(0, 40) })} /> : null}>
            <div className="mb-3 space-y-1">
              <Label className="text-xs">{t("goal_block.templates_label")}</Label>
              <Select
                value=""
                onValueChange={(id) => {
                  const tpl = SMART_GOAL_TEMPLATES.find((x) => x.id === id);
                  if (!tpl) return;
                  setAssessment({
                    ...assessment,
                    smart_specific: t(`goal_block.templates.${tpl.id}.specific` as const),
                    smart_measurable: t(`goal_block.templates.${tpl.id}.measurable` as const),
                    smart_deadline: deadlineFromWeeks(tpl.default_weeks),
                  });
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={t("goal_block.templates_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {(["strength","hypertrophy","body_comp","endurance","mobility","skill","health"] as const).map((cat) => {
                    const items = SMART_GOAL_TEMPLATES.filter((x) => x.category === cat);
                    if (items.length === 0) return null;
                    return (
                      <div key={cat}>
                        <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t(`goal_block.categories.${cat}` as const)}
                        </div>
                        {items.map((tpl) => (
                          <SelectItem key={tpl.id} value={tpl.id} className="text-xs">
                            {t(`goal_block.templates.${tpl.id}.label` as const)}
                            <span className="ml-2 text-[10px] text-muted-foreground">· {tpl.default_weeks}w</span>
                          </SelectItem>
                        ))}
                      </div>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">{t("goal_block.templates_hint")}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label={t("goal_block.specific")} value={assessment.smart_specific} onChange={(v) => setAssessment({ ...assessment, smart_specific: v })} placeholder={t("goal_block.specific_placeholder")} hint={t("goal_block.specific_hint")} className="sm:col-span-2" />
              <Field label={t("goal_block.measurable")} value={assessment.smart_measurable} onChange={(v) => setAssessment({ ...assessment, smart_measurable: v })} placeholder={t("goal_block.measurable_placeholder")} hint={t("goal_block.measurable_hint")} />
              <Field label={t("goal_block.deadline")} type="date" value={assessment.smart_deadline} onChange={(v) => setAssessment({ ...assessment, smart_deadline: v })} hint={t("goal_block.deadline_hint")} />
              <TextField label={t("goal_block.context")} value={assessment.primary_goal} onChange={(v) => setAssessment({ ...assessment, primary_goal: v })} className="sm:col-span-2" />
            </div>
          </SectionBlock>

          {/* Readiness */}
          <SectionBlock id="readiness" analysing={analysingSections["readiness"]} analysis={sectionAnalyses["readiness"]} title={t("readiness_block.title")} hint={t("readiness_block.hint")} defaultCollapsed complete={isSectionComplete("readiness", assessment)} provenance={assessment.provenance?.readiness} reviewed={client.intake_status === "reviewed"}>
            <div className="flex flex-wrap gap-1.5">
              {(["precontemplation", "contemplation", "preparation", "action", "maintenance"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAssessment({ ...assessment, readiness_stage: v })}
                  className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${assessment.readiness_stage === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary"}`}
                >
                  {t(`readiness_block.${v}` as const)}
                </button>
              ))}
            </div>
          </SectionBlock>

          {/* Training setup (existing) */}
          <SectionBlock id="training" analysing={analysingSections["training"]} analysis={sectionAnalyses["training"]} title={t("training_block.title")} hint={t("training_block.hint")} complete={isSectionComplete("training", assessment)} provenance={assessment.provenance?.training} reviewed={client.intake_status === "reviewed"} footer={isSectionComplete("training", assessment) ? <CompletionStrip text={t("training_block.complete", { summary: trainingSummary })} /> : null}>
            <div className="mb-3 rounded-md border border-border bg-background/40 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <Label className="text-xs">Capacidade actual vs pico anterior</Label>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {assessment.current_capacity_vs_pb ?? 5}/10
                </span>
              </div>
              <Slider
                min={1}
                max={10}
                step={1}
                value={[assessment.current_capacity_vs_pb ?? 5]}
                onValueChange={([v]) =>
                  setAssessment({ ...assessment, current_capacity_vs_pb: v })
                }
              />
              <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                1 = muito longe do pico anterior (modo reconstrução) · 5 = a meio · 10 = no pico anterior ou acima (modo progressão).
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <LabelWithHelp label={t("training_block.experience")} hint={t("training_block.experience_hint")} />
                <Select value={assessment.experience_level} onValueChange={(v) => setAssessment({ ...assessment, experience_level: v })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder={t("select_placeholder")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">{t("training_block.beginner")}</SelectItem>
                    <SelectItem value="intermediate">{t("training_block.intermediate")}</SelectItem>
                    <SelectItem value="advanced">{t("training_block.advanced")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field label={t("training_block.days_per_week")} type="number" value={String(assessment.training_days_per_week ?? "")} onChange={(v) => setAssessment({ ...assessment, training_days_per_week: v })} />
              <Field label={t("training_block.session_length")} type="number" value={String(assessment.session_duration_minutes ?? "")} onChange={(v) => setAssessment({ ...assessment, session_duration_minutes: v })} />
              <Field label={t("training_block.training_location")} value={assessment.training_location} onChange={(v) => setAssessment({ ...assessment, training_location: v })} />
              <Field label={t("training_block.plan_length")} type="number" value={String(duration)} onChange={(v) => setDuration(Math.max(1, Math.min(16, Number(v) || 4)))} />
            </div>
            <div className="mt-3">
              <Label className="text-xs">{t("training_block.available_equipment")}</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {EQUIPMENT_OPTIONS.map(({ id, canonical }) => {
                  const on = assessment.available_equipment.includes(canonical);
                  return (
                    <button key={id} type="button" onClick={() => toggleEq(canonical)} className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary"}`}>{t(`equipment.${id}` as const)}</button>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <TextField label={t("training_block.injuries")} value={assessment.injuries} onChange={(v) => setAssessment({ ...assessment, injuries: v })} />
              <TextField label={t("training_block.medical_conditions")} value={assessment.medical_conditions} onChange={(v) => setAssessment({ ...assessment, medical_conditions: v })} />
              <TextField label={t("training_block.preferences")} value={assessment.preferences} onChange={(v) => setAssessment({ ...assessment, preferences: v })} className="sm:col-span-2" />
            </div>
          </SectionBlock>

          {/* Lifestyle (rebuilt) */}
          <SectionBlock id="lifestyle" analysing={analysingSections["lifestyle"]} analysis={sectionAnalyses["lifestyle"]} title={t("lifestyle_block.title")} hint={t("lifestyle_block.hint")} defaultCollapsed complete={isSectionComplete("lifestyle", assessment)} provenance={assessment.provenance?.lifestyle} reviewed={client.intake_status === "reviewed"}>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label={t("lifestyle_block.sleep")} type="number" value={String(assessment.sleep_quality ?? "")} onChange={(v) => setAssessment({ ...assessment, sleep_quality: v })} hint={t("lifestyle_block.sleep_hint")} />
              <Field label={t("lifestyle_block.stress")} type="number" value={String(assessment.stress_level ?? "")} onChange={(v) => setAssessment({ ...assessment, stress_level: v })} hint={t("lifestyle_block.stress_hint")} />
              <Field label={t("lifestyle_block.hours_seated")} type="number" value={assessment.ext_hours_seated} onChange={(v) => setAssessment({ ...assessment, ext_hours_seated: v })} hint={t("lifestyle_block.hours_seated_hint")} />
              <Field label={t("lifestyle_block.daily_steps")} type="number" value={assessment.ext_daily_steps} onChange={(v) => setAssessment({ ...assessment, ext_daily_steps: v })} hint={t("lifestyle_block.daily_steps_hint")} />
              <Field label={t("lifestyle_block.job_type")} value={assessment.ext_job_type} onChange={(v) => setAssessment({ ...assessment, ext_job_type: v })} placeholder={t("lifestyle_block.job_placeholder")} />
              <TextField label={t("lifestyle_block.energy")} value={assessment.energy_levels} onChange={(v) => setAssessment({ ...assessment, energy_levels: v })} />
              <TextField label={t("lifestyle_block.recovery")} value={assessment.recovery_capacity} onChange={(v) => setAssessment({ ...assessment, recovery_capacity: v })} />
            </div>
          </SectionBlock>

          {/* Nutrition (rebuilt) */}
          <SectionBlock id="nutrition" analysing={analysingSections["nutrition"]} analysis={sectionAnalyses["nutrition"]} title={t("nutrition_block.title")} hint={t("nutrition_block.hint")} defaultCollapsed complete={isSectionComplete("nutrition", assessment)} provenance={assessment.provenance?.nutrition} reviewed={client.intake_status === "reviewed"}>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label={t("nutrition_block.meals")} type="number" value={assessment.ext_meals_per_day} onChange={(v) => setAssessment({ ...assessment, ext_meals_per_day: v })} />
              <Field label={t("nutrition_block.alcohol")} type="number" value={assessment.ext_alcohol_units_week} onChange={(v) => setAssessment({ ...assessment, ext_alcohol_units_week: v })} hint={t("nutrition_block.alcohol_hint")} />
              <Field label={t("nutrition_block.processed")} type="number" value={assessment.ext_processed_food_freq} onChange={(v) => setAssessment({ ...assessment, ext_processed_food_freq: v })} hint={t("nutrition_block.processed_hint")} />
              <Field label={t("nutrition_block.water")} type="number" value={assessment.ext_water_l_per_day} onChange={(v) => setAssessment({ ...assessment, ext_water_l_per_day: v })} />
              {showAdvancedNutrition && (
                <Field label={t("nutrition_block.hydration_legacy")} type="number" value={String(assessment.hydration_glasses_per_day ?? "")} onChange={(v) => setAssessment({ ...assessment, hydration_glasses_per_day: v })} />
              )}
              <TextField label={t("nutrition_block.notes")} value={assessment.nutrition_habits} onChange={(v) => setAssessment({ ...assessment, nutrition_habits: v })} className="sm:col-span-2" />
            </div>
            <button type="button" onClick={() => setShowAdvancedNutrition((s) => !s)} className="mt-2 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
              {showAdvancedNutrition ? t("hide_advanced") : t("show_advanced")}
            </button>
          </SectionBlock>

          {/* Mobility checklist */}
          <SectionBlock id="mobility" analysing={analysingSections["mobility"]} analysis={sectionAnalyses["mobility"]} title={t("mobility_block.title")} hint={t("mobility_block.hint")}>
            <p className="mb-1.5 text-[10px] text-muted-foreground">{t("score_legend")}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ["ext_mob_shoulder", "shoulder"],
                ["ext_mob_hip", "hip"],
                ["ext_mob_ankle", "ankle"],
                ["ext_mob_thoracic", "thoracic"],
                ["ext_mob_wrist", "wrist"],
                ["ext_mob_knee", "knee"],
              ] as const).map(([key, labelKey]) => (
                <ScoreRow key={key} label={t(`mobility_block.${labelKey}` as const)} value={assessment[key]} onChange={(v) => setAssessment({ ...assessment, [key]: v })} />
              ))}
            </div>
            <TextField label={t("mobility_block.notes")} value={assessment.mobility_limitations} onChange={(v) => setAssessment({ ...assessment, mobility_limitations: v })} className="mt-2" />
          </SectionBlock>

          {/* Posture */}
          <SectionBlock id="posture" analysing={analysingSections["posture"]} analysis={sectionAnalyses["posture"]} title={t("posture_block.title")} hint={t("posture_block.hint")} defaultCollapsed complete={isSectionComplete("posture", assessment)}>
            <div className="grid gap-2 sm:grid-cols-2">
              <TextField label={t("posture_block.standing")} value={assessment.standing_posture_notes} onChange={(v) => setAssessment({ ...assessment, standing_posture_notes: v })} />
              <TextField label={t("posture_block.imbalances")} value={assessment.known_imbalances} onChange={(v) => setAssessment({ ...assessment, known_imbalances: v })} />
              <div className="space-y-1">
                <Label className="text-xs">{t("posture_block.dominant")}</Label>
                <Select value={assessment.dominant_side ?? ""} onValueChange={(v) => setAssessment({ ...assessment, dominant_side: v })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder={t("select_placeholder")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="right">{t("posture_block.right")}</SelectItem>
                    <SelectItem value="left">{t("posture_block.left")}</SelectItem>
                    <SelectItem value="ambidextrous">{t("posture_block.ambi")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SectionBlock>

          {/* Movement screen */}
          <SectionBlock id="screen" analysing={analysingSections["screen"]} analysis={sectionAnalyses["screen"]} title={t("screen_block.title")} hint={t("screen_block.hint")} defaultCollapsed complete={isSectionComplete("screen", assessment)}>
            <p className="mb-1.5 text-[10px] text-muted-foreground">
              Marca cada critério observado · adiciona dados de capacidade quando disponíveis.
            </p>
            <div className="grid gap-3 lg:grid-cols-2">
              {PATTERN_IDS.map((p: PatternId) => (
                <MovementPatternCard
                  key={p}
                  pattern={p}
                  formCriteria={assessment[`${p}_form_criteria`] ?? {}}
                  capacity={assessment[`${p}_capacity`] ?? {}}
                  notAssessed={!!assessment.screen_not_assessed?.[p]}
                  onFormCriteria={(next) =>
                    setAssessment({ ...assessment, [`${p}_form_criteria`]: next })
                  }
                  onCapacity={(next) =>
                    setAssessment({ ...assessment, [`${p}_capacity`]: next })
                  }
                  onNotAssessed={(v) =>
                    setAssessment({
                      ...assessment,
                      screen_not_assessed: {
                        ...(assessment.screen_not_assessed ?? {}),
                        [p]: v,
                      },
                    })
                  }
                />
              ))}
            </div>
          </SectionBlock>

          {/* Training history */}
          <SectionBlock id="history" analysing={analysingSections["history"]} analysis={sectionAnalyses["history"]} title={t("history_block.title")} hint={t("history_block.hint")} defaultCollapsed complete={isSectionComplete("history", assessment)}>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label={t("history_block.years")} type="number" value={String(assessment.years_training ?? "")} onChange={(v) => setAssessment({ ...assessment, years_training: v })} />
              <Field label={t("history_block.previous")} placeholder={t("history_block.previous_placeholder")} value={assessment.previous_program_style} onChange={(v) => setAssessment({ ...assessment, previous_program_style: v })} />
              <TextField label={t("history_block.max_lifts")} value={assessment.max_lifts} onChange={(v) => setAssessment({ ...assessment, max_lifts: v })} className="sm:col-span-2" />
            </div>
          </SectionBlock>

          {/* Performance */}
          <SectionBlock id="performance" analysing={analysingSections["performance"]} analysis={sectionAnalyses["performance"]} title={t("performance_block.title")} hint={t("performance_block.hint")} defaultCollapsed complete={isSectionComplete("performance", assessment)}>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label={t("performance_block.rhr")} type="number" value={String(assessment.resting_heart_rate ?? "")} onChange={(v) => setAssessment({ ...assessment, resting_heart_rate: v })} hint={t("performance_block.rhr_hint")} />
              <div className="space-y-1">
                <LabelWithHelp label={t("performance_block.cardio_test")} hint={t("performance_block.cardio_test_hint")} />
                <Select value={assessment.ext_cardio_test} onValueChange={(v) => setAssessment({ ...assessment, ext_cardio_test: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="untested">{t("performance_block.untested")}</SelectItem>
                    <SelectItem value="cooper">{t("performance_block.cooper")}</SelectItem>
                    <SelectItem value="rockport">{t("performance_block.rockport")}</SelectItem>
                    <SelectItem value="other">{t("performance_block.other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {assessment.ext_cardio_test !== "untested" && (
                <Field label={t("performance_block.test_result")} value={assessment.ext_cardio_value} onChange={(v) => setAssessment({ ...assessment, ext_cardio_value: v })} className="sm:col-span-2" hint={t("performance_block.test_result_hint")} />
              )}
              {showAdvancedPerformance && (
                <TextField label={t("performance_block.cardio_legacy")} value={assessment.cardio_capacity} onChange={(v) => setAssessment({ ...assessment, cardio_capacity: v })} className="sm:col-span-2" />
              )}
            </div>
            <button type="button" onClick={() => setShowAdvancedPerformance((s) => !s)} className="mt-2 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
              {showAdvancedPerformance ? t("hide_advanced") : t("show_advanced")}
            </button>
          </SectionBlock>

          {!busy && resumablePlan && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-accent/40 bg-accent/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <div className="font-semibold">{t("resume.title")}</div>
                <div className="text-muted-foreground text-xs">
                  {t("resume.progress", { title: resumablePlan.title || t("resume.untitled"), done: resumablePlan.completed, total: resumablePlan.total })}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void generate(resumablePlan.id)}>{t("resume.continue")}</Button>
                <Button size="sm" variant="outline" onClick={() => void discardResumable()}>{t("resume.start_over")}</Button>
              </div>
            </div>
          )}
          {busy && (
            <GenerationProgress
              step={progressStep}
              dayProgress={dayProgress}
              totals={progressTotals}
              stopping={stopping}
              onStop={() => {
                stopRequestedRef.current = true;
                setStopping(true);
              }}
            />
          )}

          {readyPlanForAssessment ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs">
              <span className="text-muted-foreground">
                Plano pronto para esta avaliação. Edita a avaliação para mostrar de novo as ações de geração.
              </span>
              <div className="flex items-center gap-2">
                <Link
                  to="/clients/$clientId/year"
                  params={{ clientId }}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-amber-300 hover:bg-amber-500/20"
                  title={t("detail.year_view_title")}
                >
                  {t("detail.year_view_label")}
                </Link>
                <Link
                  to="/plans/$planId"
                  params={{ planId: readyPlanForAssessment.id }}
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-emerald-300 hover:bg-emerald-500/20"
                >
                  Plano pronto · ver
                </Link>
              </div>
            </div>
          ) : (
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={busy} className="w-full sm:w-auto">
                  <Eraser className="mr-2 h-4 w-4" /> {t("discard.button")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("discard.title")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("discard.desc")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("discard.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={discardDraft}>{t("discard.confirm")}</AlertDialogAction>
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
                      <Button disabled={busy} size="lg" variant="destructive" className="w-full sm:w-auto">
                        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
                        {t("generate.safety_button")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("generate.safety_title")}</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                          <div className="space-y-3 text-sm">
                            <p>{t("generate.safety_intro")}</p>
                            <ul className="list-disc space-y-1 pl-5 text-xs">
                              {parqYes && <li>{t("generate.safety_parq")}</li>}
                              {isHigh && (
                                <li>
                                  {t("risk_block.acsm_pill", { level: t("risk_block.level_high") })}
                                </li>
                              )}
                              {(assessment.med_flags?.length ?? 0) > 0 && (
                                <li>{t("generate.safety_meds", { flags: assessment.med_flags.join(", ") })}</li>
                              )}
                            </ul>
                            <p>{t("generate.safety_body")}</p>
                            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-background/40 p-3">
                              <input
                                type="checkbox"
                                checked={safetyOverride}
                                onChange={(e) => setSafetyOverride(e.target.checked)}
                                className="mt-0.5 h-4 w-4 accent-accent"
                              />
                              <span className="text-xs">{t("generate.safety_confirm")}</span>
                            </label>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("generate.safety_cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          disabled={!safetyOverride}
                          onClick={() => {
                            setSafetyDialogOpen(false);
                            if (phasedEnabled) {
                              void runPhasedStart();
                            } else {
                              void generate();
                            }
                          }}
                        >
                          {t("generate.safety_proceed")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                );
              }
              return (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 w-full sm:w-auto">
                  {phasedEnabled && briefCoverage && !inlineBrief?.approved && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground self-start sm:self-auto">
                      {t("generate.brief_coverage", {
                        done: briefCoverage.done,
                        total: briefCoverage.total,
                        defaultValue: `Pré-visualização do brief · ${briefCoverage.done}/${briefCoverage.total}`,
                      })}
                    </span>
                  )}
                  {phasedEnabled && inlineBrief?.approved ? (() => {
                    const stages = inlineBrief.approvedStages ?? ["brief"];
                    // Pick deepest approved stage to decide where to go next.
                    let next: "brief" | "blueprint" | "microcycle" | "progressions" | "complete" = "brief";
                    if (stages.includes("complete")) next = "complete";
                    else if (stages.includes("progressions")) next = "progressions";
                    else if (stages.includes("microcycle")) next = "microcycle";
                    else if (stages.includes("blueprint")) next = "blueprint";
                    const routeMap = {
                      brief: "/plans/$planId/blueprint",
                      blueprint: "/plans/$planId/microcycle",
                      microcycle: "/plans/$planId/progressions",
                      progressions: "/plans/$planId/progressions",
                      complete: "/plans/$planId",
                    } as const;
                    return (
                      <Button asChild size="lg" className="w-full sm:w-auto">
                        <Link
                          to={routeMap[next]}
                          params={{ planId: inlineBrief.planId }}
                        >
                          <ArrowRight className="mr-2 h-4 w-4" />
                          {t(`plan:continueCta.${next}`)}
                        </Link>
                      </Button>
                    );
                  })() : phasedEnabled ? (
                    <Button
                      onClick={() => void runPhasedStart()}
                      disabled={busy || phasedBusy}
                      size="lg"
                      className="w-full sm:w-auto"
                    >
                      {phasedBusy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      {t("generate.button")}
                    </Button>
                  ) : (
                    <Button onClick={() => void generate()} disabled={busy} size="lg" className="w-full sm:w-auto">
                      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      {t("generate.button")}
                    </Button>
                  )}
                </div>
              );
            })()}
          </div>
          )}

        </AssessmentSection>
      </div>
        );
      })()}

          {/* Post-assessment synthesis — collapses to a chip ONLY when the
              assessment is genuinely complete (≥80% of sections). Below
              that threshold we keep the dashboard expanded with an honest
              "Avaliação parcial · X%" chip so the trainer knows what they
              actually approved. */}
          {(() => {
            const coveragePct = briefCoverage && briefCoverage.total > 0
              ? Math.round((briefCoverage.done / briefCoverage.total) * 100)
              : null;
            // The "Assessment · X% completo" chip is now rendered by the
            // collapsed AssessmentSection itself (single merged button).
            // Here we only surface the partial-coverage warning + synthesis.
            return (
              <>
            {synthesisOpen && (
            <AssessmentSynthesisDashboard
              assessment={assessment}
              sectionAnalyses={sectionAnalyses}
              totalSections={totalSections}
              riskCategory={riskCategory}
              whr={whr}
              redFlagAccommodations={inlineBrief?.accommodations ?? null}
            />
            )}
              </>
            );
          })()}

          {/* Phased generation: stages stack vertically below the action row.
              Stage 1 (brief) is the only live stage; 2–4 are placeholders. */}
          {phasedEnabled && inlineBrief && (
            <div id="forge-stages-lane" className="space-y-3 scroll-mt-24">
              <FounderAiTelemetryPanel planId={inlineBrief.planId} variant="dock" />
              <StageCard
                stageNumber={2}
                title={t("plan:stage.label.2", "Briefing")}
                tone="brief"
                status={inlineBrief.approved ? "approved" : "ready"}
                busy={briefStageBusy}
                onApprove={
                  inlineBrief.approved
                    ? undefined
                    : async () => {
                        if (briefStageBusy) return;
                        setBriefStageBusy(true);
                        const tId = toast.loading("Approving brief…");
                        try {
                          const res: any = await approveBriefFn({
                            data: {
                              planId: inlineBrief.planId,
                              brief: inlineBrief.brief,
                              programmingVariables: inlineBrief.programmingVariables,
                              redFlagAccommodations: inlineBrief.accommodations,
                              assessmentCompletionPct:
                                briefCoverage && briefCoverage.total > 0
                                  ? Math.round(
                                      (briefCoverage.done / briefCoverage.total) * 100,
                                    )
                                  : undefined,
                            },
                          });
                          if (!res.ok) {
                            toast.error(res.error || "Approve failed", { id: tId });
                            return;
                          }
                          setInlineBrief({
                            ...inlineBrief,
                            approved: true,
                            approvedStages: Array.from(
                              new Set([...(inlineBrief.approvedStages ?? []), "brief"])
                            ),
                          });
                          void refreshPlans();
                          toast.success("Brief approved", { id: tId });
                          // Auto-flow: collapse Stage 1, expand Stage 2 (Blueprint).
                          setExpandedStage("blueprint");
                        } finally {
                          setBriefStageBusy(false);
                        }
                      }
                }
                onRegenerate={async () => {
                  if (briefStageBusy) return;
                  setBriefStageBusy(true);
                  const tId = toast.loading("Regenerating brief…");
                  try {
                    const res: any = await synthesizeBriefFn({
                      data: { planId: inlineBrief.planId },
                    });
                    if (!res.ok) {
                      toast.error(res.error || "Regenerate failed", { id: tId });
                      return;
                    }
                    const parsed = BriefSchema.safeParse(res.brief);
                    if (!parsed.success) {
                      toast.error("Brief returned but failed to parse.", { id: tId });
                      return;
                    }
                    setInlineBrief({
                      planId: inlineBrief.planId,
                      brief: parsed.data,
                      approved: false,
                      programmingVariables: inlineBrief.programmingVariables,
                      accommodations: reconcileAccommodations(
                        parsed.data,
                        inlineBrief.accommodations
                      ),
                    });
                    toast.success("Brief regenerated", { id: tId });
                  } finally {
                    setBriefStageBusy(false);
                  }
                }}
              >
                <BriefEditor
                  brief={inlineBrief.brief}
                  onChange={(b) => setInlineBrief({ ...inlineBrief, brief: b })}
                  disabled={inlineBrief.approved || briefStageBusy}
                  programmingVariables={inlineBrief.programmingVariables}
                  onProgrammingChange={(p) =>
                    setInlineBrief({ ...inlineBrief, programmingVariables: p })
                  }
                  accommodations={inlineBrief.accommodations}
                  onAccommodationsChange={(a) =>
                    setInlineBrief({ ...inlineBrief, accommodations: a })
                  }
                />
              </StageCard>
              {inlineBrief.approved && (
                <>
                  {(() => {
                    const approvedStages = inlineBrief.approvedStages ?? ["brief"];
                    const blueprintApproved = approvedStages.includes("blueprint");
                    const microcycleApproved = approvedStages.includes("microcycle");
                    const progressionsApproved = approvedStages.includes("progressions");
                    const hasBlueprintDraft = inlineBrief.hasBlueprintDraft ?? false;
                    const hasMicrocycleDraft = inlineBrief.hasMicrocycleDraft ?? false;
                    const hasProgressionsDraft = inlineBrief.hasProgressionsDraft ?? false;
                    const planId = inlineBrief.planId;
                    const navigateToStage = (stage: "blueprint" | "microcycle" | "progressions") =>
                      navigate({
                        to:
                          stage === "blueprint"
                            ? "/plans/$planId/blueprint"
                            : stage === "microcycle"
                            ? "/plans/$planId/microcycle"
                            : "/plans/$planId/progressions",
                        params: { planId },
                      });
                    const runStage = async (
                      stage: "blueprint" | "microcycle" | "progressions",
                      alreadyDone: boolean,
                      opts?: { skipNavigate?: boolean }
                    ) => {
                      // If already approved, just navigate.
                      if (alreadyDone) {
                        navigate({
                          to:
                            stage === "blueprint"
                              ? "/plans/$planId/blueprint"
                              : stage === "microcycle"
                              ? "/plans/$planId/microcycle"
                              : "/plans/$planId/progressions",
                          params: { planId },
                        });
                        return;
                      }
                      if (stageBusy) return;
                      setStageBusy(stage);
                      const labels: Record<string, string> = {
                        blueprint: "A gerar plano-mestre…",
                        microcycle: "A gerar semana-tipo (Semana 1)…",
                        progressions: "A gerar progressões (Semanas 2–4)…",
                      };
                      const tId = toast.loading(labels[stage]);
                      try {
                        const res: any =
                          stage === "blueprint"
                            ? await generateBlueprintFn({ data: { planId } })
                            : stage === "microcycle"
                            ? await generateMicrocycleDaysFn({ data: { planId } })
                            : await proposeProgressionsFn({ data: { planId } });
                        if (!res?.ok) {
                          const prefix = stage[0].toUpperCase() + stage.slice(1);
                          const msg = res?.error || `Falha ao gerar ${stage}`;
                          console.error(`[${prefix}] generate failed`, { planId, stage, error: msg });
                          toast.error(`${prefix}: ${msg}`, { id: tId });
                          return;
                        }
                        const prefix = stage[0].toUpperCase() + stage.slice(1);
                        if (res?.usedFallback) {
                          toast.success(
                            `${prefix} pronto (fallback determinístico — IA falhou, edite à vontade)`,
                            { id: tId, duration: 6000 },
                          );
                        } else {
                          toast.success(`${prefix} pronto`, { id: tId });
                        }
                        void refreshPlans();
                        if (opts?.skipNavigate) return;
                        navigate({
                          to:
                            stage === "blueprint"
                              ? "/plans/$planId/blueprint"
                              : stage === "microcycle"
                              ? "/plans/$planId/microcycle"
                              : "/plans/$planId/progressions",
                          params: { planId },
                        });
                      } catch (e: any) {
                        const prefix = stage[0].toUpperCase() + stage.slice(1);
                        const msg = e?.message ?? `Falha ao gerar ${stage}`;
                        console.error(`[${prefix}] generate threw`, { planId, stage, error: msg });
                        toast.error(`${prefix}: ${msg}`, { id: tId });
                      } finally {
                        setStageBusy(null);
                      }
                    };
                    return (
                      <>
                        <StageCard
                          stageNumber={3}
                          title={t("plan:stage.label.3", "Plano-mestre")}
                          status={blueprintApproved ? "approved" : "ready"}
                          busy={stageBusy === "blueprint"}
                          progressLabel={
                            stageBusy === "blueprint"
                              ? "A redigir Blueprint…"
                              : undefined
                          }
                          expanded={expandedStage === "blueprint"}
                          onToggleExpanded={(next) =>
                            setExpandedStage(next ? "blueprint" : null)
                          }
                          hideHeaderApprove={
                            (hasBlueprintDraft || blueprintApproved) &&
                            expandedStage === "blueprint"
                          }
                          approveLabel={
                            blueprintApproved
                              ? t("detail.stage.open")
                              : hasBlueprintDraft
                              ? t("detail.stage.view_draft")
                              : t("detail.stage.generate_blueprint")
                          }
                          onApprove={() =>
                            blueprintApproved || hasBlueprintDraft
                              ? setExpandedStage(expandedStage === "blueprint" ? null : "blueprint")
                              : runStage("blueprint", false, { skipNavigate: true }).then(() =>
                                  setExpandedStage("blueprint"),
                                )
                          }
                          expandedBody={
                            (hasBlueprintDraft || blueprintApproved) &&
                            expandedStage === "blueprint" ? (
                              <BlueprintEditorPanel
                                planId={planId}
                                compact
                                showOpenFullPage
                                onApproved={async () => {
                                  void refreshPlans();
                                  // Refetch so approvedStages includes
                                  // "blueprint" before we render Stage 3.
                                  await openPhasedDraft(planId, "microcycle");
                                  void runStage("microcycle", false, { skipNavigate: true });
                                }}
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                {hasBlueprintDraft && !blueprintApproved
                                  ? t("detail.stage.blueprint_draft_hint")
                                  : t("detail.stage.blueprint_help")}
                              </p>
                            )
                          }
                        />
                        <StageCard
                          stageNumber={4}
                          title={t("plan:stage.label.4", "Semana-tipo")}
                          status={
                            microcycleApproved
                              ? "approved"
                              : blueprintApproved
                              ? "ready"
                              : "placeholder"
                          }
                          busy={stageBusy === "microcycle"}
                          progressLabel={
                            stageBusy === "microcycle"
                              ? "A gerar microciclo…"
                              : undefined
                          }
                          expanded={expandedStage === "microcycle"}
                          onToggleExpanded={(next) =>
                            setExpandedStage(next ? "microcycle" : null)
                          }
                          hideHeaderApprove={
                            (hasMicrocycleDraft || microcycleApproved) &&
                            expandedStage === "microcycle"
                          }
                          approveLabel={
                            microcycleApproved
                              ? t("detail.stage.open")
                              : hasMicrocycleDraft
                              ? t("detail.stage.view_draft")
                              : t("detail.stage.generate_microcycle")
                          }
                          onApprove={
                            blueprintApproved
                              ? () =>
                                  microcycleApproved || hasMicrocycleDraft
                                    ? setExpandedStage(
                                        expandedStage === "microcycle" ? null : "microcycle",
                                      )
                                    : runStage("microcycle", false, { skipNavigate: true }).then(() =>
                                        setExpandedStage("microcycle"),
                                      )
                              : undefined
                          }
                          expandedBody={
                            (hasMicrocycleDraft || microcycleApproved) &&
                            expandedStage === "microcycle" ? (
                              <MicrocyclePanel
                                planId={planId}
                                showHeader={false}
                                onApproved={async () => {
                                  void refreshPlans();
                                  // Re-read approved_stages from DB so
                                  // microcycleApproved flips to true and
                                  // Stage 4 unlocks (was stuck because the
                                  // local snapshot was never refreshed).
                                  await openPhasedDraft(planId, "progressions");
                                  void runStage("progressions", false, { skipNavigate: true });
                                }}
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                {hasMicrocycleDraft && !microcycleApproved
                                  ? t("detail.stage.microcycle_draft_hint")
                                  : blueprintApproved
                                  ? t("detail.stage.microcycle_help")
                                  : t("detail.stage.microcycle_blocked")}
                              </p>
                            )
                          }
                        />
                        <StageCard
                          stageNumber={5}
                          title={t("plan:stage.label.5", "Progressão 12 sem.")}
                          status={
                            progressionsApproved
                              ? "approved"
                              : microcycleApproved
                              ? "ready"
                              : "placeholder"
                          }
                          busy={stageBusy === "progressions"}
                          progressLabel={
                            stageBusy === "progressions"
                              ? "A planear progressões (Semanas 2–4)…"
                              : undefined
                          }
                          expanded={expandedStage === "progressions"}
                          onToggleExpanded={(next) =>
                            setExpandedStage(next ? "progressions" : null)
                          }
                          hideHeaderApprove={
                            (hasProgressionsDraft || progressionsApproved) &&
                            expandedStage === "progressions"
                          }
                          approveLabel={
                            progressionsApproved
                              ? t("detail.stage.open")
                              : hasProgressionsDraft
                              ? t("detail.stage.view_draft")
                              : t("detail.stage.generate_progressions")
                          }
                          onApprove={
                            microcycleApproved
                              ? () =>
                                  progressionsApproved || hasProgressionsDraft
                                    ? setExpandedStage(
                                        expandedStage === "progressions" ? null : "progressions",
                                      )
                                    : runStage("progressions", false, { skipNavigate: true }).then(() =>
                                        setExpandedStage("progressions"),
                                      )
                              : undefined
                          }
                          expandedBody={
                            (hasProgressionsDraft || progressionsApproved) &&
                            expandedStage === "progressions" ? (
                              <ProgressionsPanel
                                planId={planId}
                                onApproved={async () => {
                                  void refreshPlans();
                                  await openPhasedDraft(planId, "complete" as any);
                                  setExpandedStage(null);
                                }}
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                {hasProgressionsDraft && !progressionsApproved
                                  ? t("detail.stage.progressions_draft_hint")
                                  : microcycleApproved
                                  ? t("detail.stage.progressions_help")
                                  : t("detail.stage.progressions_blocked")}
                              </p>
                            )
                          }
                        />
                        {/* The "ready" banner used to live here, but it duplicated
                            the Plano final section's emerald PDF button (R38). */}
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          )}

      {plans.length > 0 && (
      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Plano final</h2>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={creatingPlan !== null}
              onClick={async () => {
                setCreatingPlan("manual");
                try {
                  const r: any = await createManualPlanFn({ data: { clientId, durationWeeks: 4 } });
                  if (r?.ok && r?.planId) {
                    void navigate({ to: "/plans/$planId", params: { planId: r.planId } });
                  } else {
                    toast.error(r?.error ?? t("detail.plans.manual_failed"));
                  }
                } finally { setCreatingPlan(null); }
              }}
            >
              {creatingPlan === "manual"
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                : <Plus className="mr-1.5 h-3.5 w-3.5" />}
              {t("detail.plans.new_manual")}
            </Button>
            <Button
              size="sm"
              disabled={creatingPlan !== null || !evolvableSourcePlan}
              title={!evolvableSourcePlan
                ? t("detail.plans.evolve_disabled")
                : "Arquiva o plano atual e usa-o como base para gerar o próximo bloco com IA."}
              onClick={async () => {
                if (!evolvableSourcePlan) return;
                setCreatingPlan("evolve");
                try {
                  const r: any = await evolvePlanFn({ data: { priorPlanId: evolvableSourcePlan.id } });
                  if (r?.ok && r?.planId) {
                    toast.success(t("detail.plans.evolve_success"));
                    void navigate({ to: "/plans/$planId", params: { planId: r.planId } });
                  } else {
                    toast.error(r?.error ?? t("detail.plans.evolve_failed"));
                  }
                } finally { setCreatingPlan(null); }
              }}
            >
              {creatingPlan === "evolve"
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
              Gerar próximo bloco (IA)
            </Button>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {plans.map((p) => {
              const stage = (p.generation_state as any)?.stage as string | undefined;
              const phasedStages = ["brief", "blueprint", "microcycle", "progressions"];
              const isPhasedDraft = !!stage && phasedStages.includes(stage);
              const rowInner = (
                <>
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div className="text-left">
                      <p className="font-semibold">{p.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("plans.updated", { date: new Date(p.updated_at).toLocaleDateString() })}
                        {typeof (p as any).assessment_completion_pct === "number" && (
                          <span className="ml-1.5 opacity-80">· dados {(p as any).assessment_completion_pct}%</span>
                        )}
                      </p>
                    </div>
                  </div>
                  {(() => {
                    const isComplete = stage === "complete";
                    if (isComplete) {
                      const totalWeeks = Math.max(1, (p as any).duration_weeks ?? 1);
                      const tagFor = (wn: number, total: number) => {
                        if (total <= 1) return "base";
                        if (wn === total) return "deload";
                        if (wn === 1) return "base";
                        return wn % 2 === 0 ? "+load" : "+reps";
                      };
                      // default = current week (latest week marker if we have it; else W1)
                      const defaultWeek = 1;
                      return (
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                          <select
                            defaultValue={String(defaultWeek)}
                            id={`week-${p.id}`}
                            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                            aria-label="Semana"
                          >
                            {Array.from({ length: totalWeeks }).map((_, i) => {
                              const wn = i + 1;
                              return (
                                <option key={wn} value={wn}>
                                  W{wn} · {tagFor(wn, totalWeeks)}
                                </option>
                              );
                            })}
                          </select>
                          <button
                            type="button"
                            onClick={async () => {
                              const sel = document.getElementById(`week-${p.id}`) as HTMLSelectElement | null;
                              const wn = sel ? parseInt(sel.value, 10) : 1;
                              const tId = toast.loading(`A preparar PDF da Semana ${wn}…`);
                              try {
                                await downloadPlanById(p.id, wn);
                                toast.success("PDF descarregado.", { id: tId });
                              } catch (err: any) {
                                toast.error(err?.message ?? "Falha a gerar PDF.", { id: tId });
                              }
                            }}
                            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/20"
                          >
                            <Download className="h-3 w-3" /> Descarregar Semana
                          </button>
                        </div>
                      );
                    }
                    const s = planStatusInfo(p as any, tCommon as any);
                    return (
                      <span className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wider ${s.className}`}>
                        {isPhasedDraft ? `Etapa: ${s.label}` : s.label}
                      </span>
                    );
                  })()}
                </>
              );
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between border-b border-border last:border-b-0 hover:bg-secondary/50"
                >
                  {isPhasedDraft ? (
                    <button
                      type="button"
                      onClick={() => void openPhasedDraft(p.id, stage)}
                      className="flex flex-1 items-center justify-between px-5 py-4 text-left"
                    >
                      {rowInner}
                    </button>
                  ) : (
                    <Link
                      to="/plans/$planId"
                      params={{ planId: p.id }}
                      className="flex flex-1 items-center justify-between px-5 py-4"
                    >
                      {rowInner}
                    </Link>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        className="px-4 py-4 text-muted-foreground hover:text-destructive"
                        aria-label="Delete plan"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this plan?</AlertDialogTitle>
                        <AlertDialogDescription>
                          "{p.title}" will be permanently deleted, including all its sessions and generated content. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deletePlan(p.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              );
            })}
        </div>
      </section>
      )}

      {plans.length > 0 && (
        <section>
          <ComplianceDashboard clientId={clientId} />
        </section>
      )}
      <PaywallDialog open={paywallOpen} onOpenChange={setPaywallOpen} reason="quota" />
    </div>
    </TooltipProvider>
  );
}

type CollapseCtx = {
  isOpen: (id: string, defaultOpen: boolean) => boolean;
  setOpen: (id: string, open: boolean) => void;
  setAll: (open: boolean) => void;
};
const SectionCollapseContext = createContext<CollapseCtx | null>(null);

function deriveRecoveryProfile(a: any, t: (k: string, opts?: any) => string): { label: string; caption: string } | null {
  const sleep = a?.sleep_quality ? Number(a.sleep_quality) : null;
  const stress = a?.stress_level ? Number(a.stress_level) : null;
  const cap = (a?.recovery_capacity ?? "").toString().toLowerCase();
  if (sleep == null && stress == null && !cap) return null;
  let score = 0;
  let n = 0;
  if (sleep != null) { score += sleep; n++; }
  if (stress != null) { score += (10 - stress); n++; }
  if (cap.includes("high") || cap.includes("alta")) { score += 8; n++; }
  else if (cap.includes("low") || cap.includes("baixa")) { score += 3; n++; }
  else if (cap) { score += 5; n++; }
  const avg = n ? score / n : 0;
  const label = avg >= 7 ? t("detail.recovery.high") : avg >= 5 ? t("detail.recovery.moderate") : t("detail.recovery.low");
  const parts: string[] = [];
  if (sleep != null) parts.push(t("detail.recovery.sleep_part", { n: sleep }));
  if (stress != null) parts.push(t("detail.recovery.stress_part", { n: stress }));
  return { label, caption: parts.join(" · ") || "—" };
}

function collectRedFlags(
  a: any,
  sectionAnalyses: Record<string, SectionAnalysis | null>,
): string[] {
  const out = new Set<string>();
  // PAR-Q+ flags
  PARQ_KEYS.forEach((k, idx) => {
    if ((a?.parq ?? {})[k] === true) out.add(`PAR-Q+ Q${idx + 1}`);
  });
  // From per-section analyses
  for (const a2 of Object.values(sectionAnalyses)) {
    if (!a2) continue;
    for (const f of a2.red_flags ?? []) out.add(f);
  }
  return Array.from(out);
}

function StatCard({
  label,
  value,
  caption,
  tone = "neutral",
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: "neutral" | "success" | "warning" | "destructive";
}) {
  const toneClass =
    tone === "destructive" ? "text-destructive"
    : tone === "warning" ? "text-amber-500"
    : tone === "success" ? "text-accent"
    : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-light tracking-tight ${toneClass}`}>{value}</p>
      {caption && <p className="mt-1 text-xs text-muted-foreground">{caption}</p>}
    </div>
  );
}

function AssessmentSynthesisDashboard({
  assessment,
  sectionAnalyses,
  totalSections,
  riskCategory,
  whr,
  redFlagAccommodations,
}: {
  assessment: any;
  sectionAnalyses: Record<string, SectionAnalysis | null>;
  totalSections: number;
  riskCategory: string;
  whr: string;
  redFlagAccommodations: RedFlagAccommodation[] | null;
}) {
  const analysedCount = Object.values(sectionAnalyses).filter(Boolean).length;
  if (analysedCount < Math.ceil(totalSections * 0.5)) return null;

  const { t } = useTranslation("assessment");
  const riskLabel = riskCategory === "high" ? t("detail.risk.high") : riskCategory === "moderate" ? t("detail.risk.moderate") : t("detail.risk.low");
  const riskCaption = riskCategory === "high"
    ? t("detail.risk.caption_high")
    : riskCategory === "moderate"
    ? t("detail.risk.caption_moderate")
    : t("detail.risk.caption_low");
  const riskTone: "destructive" | "warning" | "success" =
    riskCategory === "high" ? "destructive" : riskCategory === "moderate" ? "warning" : "success";

  const recovery = deriveRecoveryProfile(assessment, t);

  const bf = assessment?.body_fat_pct ? `${assessment.body_fat_pct}%` : "—";
  const bodyCompValue = `${bf} · WHR ${whr}`;
  const whrNum = whr === "—" ? null : Number(whr);
  const bodyCompCaption = whrNum == null
    ? t("detail.body_comp.no_data")
    : whrNum >= 0.95
    ? t("detail.body_comp.high_risk")
    : whrNum >= 0.85
    ? t("detail.body_comp.moderate_risk")
    : t("detail.body_comp.healthy");

  const flags = collectRedFlags(assessment, sectionAnalyses);
  const accMap = new Map<string, RedFlagAccommodation>();
  for (const acc of redFlagAccommodations ?? []) accMap.set(acc.flag, acc);

  // Sort flags by severity: AVOID → MODIFY → MONITOR → ACCOMMODATE → unmapped
  const SEVERITY: Record<string, number> = { AVOID: 0, MODIFY: 1, MONITOR: 2, ACCOMMODATE: 3 };
  const sortedFlags = [...flags].sort((a, b) => {
    const sa = SEVERITY[accMap.get(a)?.strategy ?? ""] ?? 4;
    const sb = SEVERITY[accMap.get(b)?.strategy ?? ""] ?? 4;
    if (sa !== sb) return sa - sb;
    return a.localeCompare(b);
  });

  return (
    <div id="sintese-da-avaliacao" className="scroll-mt-24 space-y-3 rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("detail.synthesis.title")}</p>
        <span className="text-[10px] text-muted-foreground">{t("detail.synthesis.analysed", { n: analysedCount, total: totalSections })}</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label={t("detail.synthesis.stat_risk")}
          value={riskLabel}
          caption={riskCaption}
          tone={riskTone}
        />
        <StatCard
          label={t("detail.synthesis.stat_recovery")}
          value={recovery?.label ?? "—"}
          caption={recovery?.caption ?? t("detail.recovery.no_data")}
        />
        <StatCard
          label={t("detail.synthesis.stat_body_comp")}
          value={bodyCompValue}
          caption={bodyCompCaption}
        />
      </div>

      <MovementCompetencyRadar assessment={assessment} sectionAnalyses={sectionAnalyses} />

      {flags.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <p className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              {t("detail.synthesis.alerts", { n: flags.length })}
            </p>
          </div>
          <ul className="space-y-1.5">
            {sortedFlags.map((f) => {
              const acc = accMap.get(f);
              return (
                <li key={f} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span className="flex-1 text-foreground">{f}</span>
                  {acc && (
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                      acc.strategy === "AVOID" ? "bg-destructive/15 text-destructive"
                      : acc.strategy === "MODIFY" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : acc.strategy === "MONITOR" ? "bg-accent/15 text-accent"
                      : "bg-secondary text-secondary-foreground"
                    }`}>{acc.strategy}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function AssessmentSection({
  clientId,
  headerProgress,
  children,
  defaultCollapsed = false,
  collapsed: collapsedProp,
  onCollapsedChange,
  summaryLine,
  completionPct,
  onShowSynthesis,
}: {
  clientId: string;
  headerProgress: React.ReactNode;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (v: boolean) => void;
  summaryLine?: string;
  /** When ≥80, the collapsed strip styles itself as a golden "complete" chip. */
  completionPct?: number | null;
  /** Optional inline action shown on the right of the collapsed strip. */
  onShowSynthesis?: () => void;
}) {
  const { t } = useTranslation("assessment");
  const sectionIds = useMemo(() => SECTIONS.map((s) => s.id), []);
  const ctx = useSectionCollapseProvider(clientId, sectionIds);
  const [collapsedInternal, setCollapsedInternal] = useState<boolean>(defaultCollapsed);
  const collapsed = collapsedProp ?? collapsedInternal;
  const setCollapsed = (v: boolean) => {
    if (onCollapsedChange) onCollapsedChange(v);
    else setCollapsedInternal(v);
  };
  // Keep in sync when the default flips from "no plan" → "plan ready" while
  // the user is on the page; trainer's local override (after first toggle)
  // wins, so we only auto-update on the initial transition.
  const lastDefaultRef = useRef(defaultCollapsed);
  useEffect(() => {
    if (lastDefaultRef.current !== defaultCollapsed && collapsedProp == null) {
      setCollapsedInternal(defaultCollapsed);
      lastDefaultRef.current = defaultCollapsed;
    }
  }, [defaultCollapsed, collapsedProp]);

  // Focused mode: render one section at a time with prev/next nav.
  // Persist toggle per client; default = on (the whole point of #9).
  const focusKey = `forge_assessment_focus_${clientId}`;
  const activeKey = `forge_assessment_focus_active_${clientId}`;
  const [focused, setFocused] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const v = window.localStorage.getItem(focusKey);
      return v == null ? true : v === "1";
    } catch { return true; }
  });
  useEffect(() => {
    try { window.localStorage.setItem(focusKey, focused ? "1" : "0"); } catch { /* ignore */ }
  }, [focused, focusKey]);

  const [activeId, setActiveId] = useState<string>(() => {
    if (typeof window === "undefined") return sectionIds[0];
    try {
      const v = window.localStorage.getItem(activeKey);
      if (v && sectionIds.includes(v)) return v;
    } catch { /* ignore */ }
    return sectionIds[0];
  });
  useEffect(() => {
    try { window.localStorage.setItem(activeKey, activeId); } catch { /* ignore */ }
  }, [activeId, activeKey]);

  // In focused mode, the active section is always open (never collapsed
  // inside its own card — the toggle exists for "see all" mode only).
  useEffect(() => {
    if (focused) ctx.setOpen(activeId, true);
    // Depend only on the stable setOpen callback, NOT the whole ctx object —
    // ctx is rebuilt every render, which would create an infinite loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, activeId, ctx.setOpen]);

  // Map child SectionBlocks by their `id` prop so we can pick the active one.
  const childArray = Children.toArray(children);
  const sectionChildren = new Map<string, React.ReactNode>();
  const extras: React.ReactNode[] = [];
  for (const child of childArray) {
    if (isValidElement(child) && typeof (child.props as any)?.id === "string" && sectionIds.includes((child.props as any).id)) {
      sectionChildren.set((child.props as any).id, child);
    } else {
      extras.push(child);
    }
  }
  const activeIdx = Math.max(0, sectionIds.indexOf(activeId));
  const goPrev = () => setActiveId(sectionIds[Math.max(0, activeIdx - 1)]);
  const goNext = () => setActiveId(sectionIds[Math.min(sectionIds.length - 1, activeIdx + 1)]);

  if (collapsed) {
    const isComplete = (completionPct ?? 0) >= 80;
    const stripClass = isComplete
      ? "rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-amber-500/5 p-3 hover:from-amber-500/15"
      : "rounded-2xl border border-border bg-card p-3";
    const labelClass = isComplete ? "text-amber-400" : "";
    return (
      <section className={stripClass}>
        <div className="flex w-full items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="flex flex-1 items-center gap-2 text-left"
            aria-expanded={false}
          >
            {isComplete ? (
              <Check className="h-4 w-4 text-amber-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <span className={`text-sm font-bold ${labelClass}`}>
              {t("detail.section.title")}
              {completionPct != null && (
                <span className="ml-1.5 font-semibold">· {completionPct}% completo</span>
              )}
            </span>
            {summaryLine && (
              <span className="text-[11px] text-muted-foreground">· {summaryLine}</span>
            )}
          </button>
          {onShowSynthesis && isComplete && (
            <button
              type="button"
              onClick={onShowSynthesis}
              className="rounded-md border border-amber-500/30 px-2 py-1 text-[10px] font-medium uppercase tracking-widest text-amber-400 hover:bg-amber-500/10"
            >
              Ver síntese
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        {headerProgress}
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <ChevronDown className="h-3 w-3" /> {t("detail.section.collapse")}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-2">
        <button
          type="button"
          onClick={() => setFocused((f) => !f)}
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-widest transition ${focused ? "border-accent/60 bg-accent/10 text-accent" : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
          title={focused ? t("detail.section.focus_tip_show_all") : t("detail.section.focus_tip_focus")}
        >
          {focused ? <List className="h-3 w-3" /> : <Focus className="h-3 w-3" />}
          {focused ? t("detail.section.view_all") : t("detail.section.focus_mode")}
        </button>
        {!focused && (
          <>
        <button
          type="button"
          onClick={() => ctx.setAll(true)}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <ChevronsUpDown className="h-3 w-3" /> {t("detail.section.expand_all")}
        </button>
        <button
          type="button"
          onClick={() => ctx.setAll(false)}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <ChevronsDownUp className="h-3 w-3" /> {t("detail.section.collapse_all")}
        </button>
          </>
        )}
      </div>
      {focused && (
        <div className="flex flex-wrap items-center gap-1.5 pb-1" role="tablist" aria-label={t("detail.section.tabs_aria")}>
          {SECTIONS.map((s, i) => {
            const isActive = s.id === activeId;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveId(s.id)}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${isActive ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
              >
                <span className="font-mono tabular-nums">{i + 1}</span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>
      )}
      <SectionCollapseContext.Provider value={ctx}>
        {focused ? (
          <>
            <div key={activeId} className="animate-in fade-in slide-in-from-right-2 duration-300">
              {sectionChildren.get(activeId) ?? (
                <div className="rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
                  {t("detail.section.unavailable")}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={goPrev}
                disabled={activeIdx === 0}
              >
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> {t("detail.section.prev")}
              </Button>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {activeIdx + 1} / {sectionIds.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={goNext}
                disabled={activeIdx === sectionIds.length - 1}
              >
                {t("detail.section.next")} <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
            {extras.length > 0 && <div className="space-y-3">{extras}</div>}
          </>
        ) : (
          children
        )}
      </SectionCollapseContext.Provider>
    </section>
  );
}

function useSectionCollapseProvider(clientId: string, sectionIds: string[]): CollapseCtx & { allOpen: boolean; allClosed: boolean } {
  const storageKey = useCallback((id: string) => `forge_assessment_collapse_${clientId}_${id}`, [clientId]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    const out: Record<string, boolean> = {};
    for (const id of sectionIds) {
      try {
        const v = window.localStorage.getItem(`forge_assessment_collapse_${clientId}_${id}`);
        if (v === "open") out[id] = true;
        else if (v === "closed") out[id] = false;
      } catch { /* ignore */ }
    }
    return out;
  });
  const isOpen = useCallback((id: string, defaultOpen: boolean) => {
    return id in overrides ? overrides[id] : defaultOpen;
  }, [overrides]);
  const setOpen = useCallback((id: string, open: boolean) => {
    setOverrides((prev) => ({ ...prev, [id]: open }));
    try { window.localStorage.setItem(storageKey(id), open ? "open" : "closed"); } catch { /* ignore */ }
  }, [storageKey]);
  const setAll = useCallback((open: boolean) => {
    const next: Record<string, boolean> = {};
    for (const id of sectionIds) {
      next[id] = open;
      try { window.localStorage.setItem(storageKey(id), open ? "open" : "closed"); } catch { /* ignore */ }
    }
    setOverrides(next);
  }, [sectionIds, storageKey]);
  const allOpen = sectionIds.every((id) => (id in overrides ? overrides[id] : true));
  const allClosed = sectionIds.every((id) => (id in overrides ? !overrides[id] : false));
  return { isOpen, setOpen, setAll, allOpen, allClosed };
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
  analysis,
  analysing = false,
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
  analysis?: SectionAnalysis | null;
  analysing?: boolean;
}) {
  const { t } = useTranslation("assessment");
  const ctx = useContext(SectionCollapseContext);
  const [localOpen, setLocalOpen] = useState(!defaultCollapsed);
  const open = ctx ? ctx.isOpen(id, !defaultCollapsed) : localOpen;
  const setOpen = (next: boolean | ((o: boolean) => boolean)) => {
    const value = typeof next === "function" ? (next as (o: boolean) => boolean)(open) : next;
    if (ctx) ctx.setOpen(id, value);
    else setLocalOpen(value);
  };
  const analysed = !!analysis;
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
    tagText = t("tag.client_submitted");
    tagClass = reviewed ? "text-muted-foreground/70" : "text-accent/90";
  } else if (provenance === "trainer-edited") {
    tagText = t("tag.trainer_edited");
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
        <h3 className={`text-xs font-bold uppercase tracking-widest ${analysed ? "text-accent/70" : "text-accent"}`}>{title}</h3>
        {analysed && <Check className="h-3 w-3 text-accent" aria-label="analysed" />}
        {!analysed && complete && <Check className="h-3 w-3 text-muted-foreground/60" />}
        {hint && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:text-foreground"
                aria-label={t("why_we_ask_aria")}
              >
                <Info className="h-3 w-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs"><p><span className="font-semibold">{t("why_we_ask")}</span> {hint}</p></TooltipContent>
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
          {(analysing || analysis) && (
            <SectionAnalysisCard analysing={analysing} analysis={analysis ?? null} />
          )}
        </>
      )}
    </div>
  );
}

function SectionAnalysisCard({ analysing, analysis }: { analysing: boolean; analysis: SectionAnalysis | null }) {
  const { t } = useTranslation("assessment");
  if (analysing) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>{t("detail.analysing_section")}</span>
      </div>
    );
  }
  if (!analysis) return null;
  // Section-level analyses no longer show red_flags — those live only in the
  // synthesis dashboard at the bottom. Sections only contribute their own
  // contextual insight (most useful contraindication note or next-stage note).
  const insight = (analysis.contraindication_notes ?? analysis.notes_for_next_stage ?? "").trim();
  if (!insight) return null;
  return (
    <div className="mt-3 rounded-md border border-accent/30 bg-accent/5 p-2.5 text-xs text-muted-foreground">
      {insight}
    </div>
  );
}

function LabelWithHelp({ label, hint }: { label: string; hint?: string }) {
  const { t } = useTranslation("assessment");
  return (
    <div className="flex items-center gap-1">
      <Label className="text-xs">{label}</Label>
      {hint && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={t("why_we_ask_aria")}><Info className="h-3 w-3" /></button>
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
  const { t } = useTranslation("assessment");
  return (
    <div className="flex shrink-0 gap-1">
      {([
        [true, t("yes")],
        [false, t("no")],
      ] as const).map(([v, l]) => {
        const active = value === v;
        return (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v as boolean)}
            className={`h-6 rounded border px-2 text-[11px] font-medium transition ${active ? (v ? "border-destructive bg-destructive text-destructive-foreground" : "border-primary bg-primary text-primary-foreground") : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
          >
            {l}
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
  const { t } = useTranslation("assessment");
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
                aria-label={t("score_aria", { label, n })}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>
      <Input
        className="mt-1.5 h-7 text-xs"
        placeholder={t("optional_note")}
        value={note ?? ""}
        onChange={(e) => onNote(e.target.value)}
      />
    </div>
  );
}

function GenerationProgress({
  step,
  dayProgress,
  totals,
  stopping,
  onStop,
}: {
  step: number;
  dayProgress?: Record<string, "pending" | "running" | "done" | "error">;
  totals?: { done: number; total: number };
  stopping?: boolean;
  onStop?: () => void;
}) {
  const { t } = useTranslation("assessment");
  const steps = [
    { n: 1, label: t("progress_panel.step_save") },
    { n: 2, label: t("progress_panel.step_generate") },
    { n: 3, label: t("progress_panel.step_assemble") },
    { n: 4, label: t("progress_panel.step_open") },
  ];
  // Build week → day grid for visualization.
  const cells: Array<{ key: string; w: number; d: number; status: string }> = [];
  if (dayProgress) {
    for (const key of Object.keys(dayProgress)) {
      const [w, d] = key.split("-").map(Number);
      cells.push({ key, w, d, status: dayProgress[key] });
    }
    cells.sort((a, b) => (a.w - b.w) || (a.d - b.d));
  }
  const weeks = Array.from(new Set(cells.map((c) => c.w))).sort((a, b) => a - b);
  const pct = totals && totals.total > 0
    ? Math.round((totals.done / totals.total) * 100)
    : Math.min(100, (step / 4) * 100);
  return (
    <div className="mt-4 animate-fade-in rounded-xl border border-accent/30 bg-accent/5 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent">
          <Sparkles className="h-3.5 w-3.5 animate-pulse" /> {t("progress_panel.header")}
        </div>
        {onStop && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onStop}
            disabled={stopping}
            className="h-7 text-xs"
          >
            <StopCircle className="mr-1 h-3.5 w-3.5" />
            {stopping ? t("progress_panel.stopping") : t("progress_panel.stop")}
          </Button>
        )}
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
      {weeks.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="text-[11px] font-mono text-muted-foreground">
            {totals ? t("progress_panel.days_progress", { done: totals.done, total: totals.total }) : ""}
          </div>
          {weeks.map((w) => {
            const wcells = cells.filter((c) => c.w === w);
            return (
              <div key={w} className="flex items-center gap-2">
                <span className="w-12 text-[11px] font-mono text-muted-foreground">{t("progress_panel.week_label", { n: w })}</span>
                <div className="flex flex-1 flex-wrap gap-1">
                  {wcells.map((c) => {
                    const cls =
                      c.status === "done"
                        ? "border-accent bg-accent text-accent-foreground"
                        : c.status === "running"
                        ? "border-accent/60 bg-accent/20 text-accent animate-pulse"
                        : c.status === "error"
                        ? "border-destructive bg-destructive/20 text-destructive"
                        : "border-border bg-background text-muted-foreground";
                    return (
                      <div
                        key={c.key}
                        className={`flex h-6 w-7 items-center justify-center rounded border text-[10px] font-mono ${cls}`}
                        title={t("progress_panel.cell_title", { w: c.w, d: c.d, status: c.status })}
                      >
                        {c.d}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-accent transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
function SaveIndicator({ status, lastSavedAt }: { status: SaveStatus; lastSavedAt: number | null }) {
  const { t } = useTranslation("assessment");
  const formatRel = (ts: number | null): string => {
    if (!ts) return "";
    const diff = Math.max(0, Date.now() - ts);
    const s = Math.floor(diff / 1000);
    if (s < 5) return t("rel_time.just_now");
    if (s < 60) return t("rel_time.seconds_ago", { s });
    const m = Math.floor(s / 60);
    if (m < 60) return t("rel_time.minutes_ago", { m });
    const h = Math.floor(m / 60);
    if (h < 24) return t("rel_time.hours_ago", { h });
    const d = Math.floor(h / 24);
    return t("rel_time.days_ago", { d });
  };
  const base = "inline-flex items-center gap-1.5 font-mono text-[10px] tabular-nums";
  if (status === "saving") {
    return (
      <span className={`${base} text-accent`}>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        {t("save.saving")}
      </span>
    );
  }
  if (status === "offline") {
    return (
      <span className={`${base} text-accent`}>
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        {t("save.offline")}
      </span>
    );
  }
  if (status === "saved" || lastSavedAt) {
    return (
      <span className={`${base} text-muted-foreground/70`}>
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
        {t("save.saved", { when: formatRel(lastSavedAt) })}
      </span>
    );
  }
  return null;
}

function ParqFlagSummary({ count }: { count: number }) {
  const { t } = useTranslation("assessment");
  const clear = count === 0;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest ${clear ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${clear ? "bg-primary" : "bg-accent"}`} />
        {t("parq_block.flag_summary_label", { count })}
      </span>
      {!clear && (
        <span className="text-[11px] text-muted-foreground">{t("parq_block.flag_summary_note")}</span>
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

// ----------------------------------------------------------------------------
// ClientSnapshotCard — compact "always visible" card at the top of the page.
// Reuses the same data sources as the synthesis dashboard but with no
// minimum-coverage gate: it should display whatever is known.
// ----------------------------------------------------------------------------
function ClientSnapshotCard({
  assessment,
  sectionAnalyses,
  riskCategory,
  whr,
  lastSavedAt,
}: {
  assessment: any;
  sectionAnalyses: Record<string, SectionAnalysis | null>;
  riskCategory: string;
  whr: string;
  lastSavedAt: number | null;
}) {
  const { t, i18n } = useTranslation("assessment");
  const riskLabel = riskCategory === "high" ? t("detail.risk.high") : riskCategory === "moderate" ? t("detail.risk.moderate") : t("detail.risk.low");
  const riskTone =
    riskCategory === "high" ? "text-destructive"
    : riskCategory === "moderate" ? "text-amber-500"
    : "text-accent";
  const recovery = deriveRecoveryProfile(assessment, t);
  const bf = assessment?.body_fat_pct ? `${assessment.body_fat_pct}%` : "—";
  const flags = collectRedFlags(assessment, sectionAnalyses).slice(0, 3);
  const dateLabel = lastSavedAt
    ? new Date(lastSavedAt).toLocaleDateString(i18n.language === "pt" ? "pt-PT" : "en-US", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {t("detail.snapshot.title")}
        </p>
        <p className="text-[10px] text-muted-foreground">{t("detail.snapshot.last", { when: dateLabel })}</p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("detail.snapshot.risk_acsm")}</p>
          <p className={`mt-0.5 text-lg font-light ${riskTone}`}>{riskLabel}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("detail.snapshot.recovery")}</p>
          <p className="mt-0.5 text-lg font-light">{recovery?.label ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("detail.snapshot.composition")}</p>
          <p className="mt-0.5 text-lg font-light">{bf} · WHR {whr}</p>
        </div>
      </div>
      {flags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {flags.map((f) => (
            <span key={f} className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// MovementCompetencyRadar — inline-SVG 6-axis radar chart.
// Axes: squat, hinge, push, pull, carry, lunge.  Score 1–5; un-assessed
// patterns render as a dashed grey axis with no data dot.
// ----------------------------------------------------------------------------
function MovementCompetencyRadar({
  assessment,
  sectionAnalyses,
}: {
  assessment: any;
  sectionAnalyses: Record<string, SectionAnalysis | null>;
}) {
  // Map raw 1–5 scores from the assessment.
  // push → overhead reach is the closest proxy until pull/carry land in item 11.
  const lungeNote = sectionAnalyses?.["screen"]?.movement_competency_summary?.lunge ?? "";
  const axes: Array<{ label: string; score: number | null }> = [
    { label: "Squat", score: numScore(assessment?.squat_depth_score) ?? derivePatternScore("squat", assessment?.squat_form_criteria, assessment?.squat_capacity) },
    { label: "Hinge", score: numScore(assessment?.hip_hinge_score) ?? derivePatternScore("hinge", assessment?.hinge_form_criteria, assessment?.hinge_capacity) },
    { label: "Push", score: numScore(assessment?.overhead_reach_score) ?? derivePatternScore("push", assessment?.push_form_criteria, assessment?.push_capacity) },
    { label: "Pull", score: numScore(assessment?.pull_pattern_score) ?? derivePatternScore("pull", assessment?.pull_form_criteria, assessment?.pull_capacity) },
    { label: "Carry", score: numScore(assessment?.carry_pattern_score) ?? derivePatternScore("carry", assessment?.carry_form_criteria, assessment?.carry_capacity) },
    { label: "Lunge", score: numScore(assessment?.single_leg_balance_score) ?? derivePatternScore("lunge", assessment?.lunge_form_criteria, assessment?.lunge_capacity) ?? (lungeNote ? 3 : null) },
  ];

  const SIZE = 220;
  const CENTER = SIZE / 2;
  const RADIUS = 80;
  const N = axes.length;
  const pointAt = (i: number, scale: number) => {
    const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / N;
    return {
      x: CENTER + Math.cos(angle) * RADIUS * scale,
      y: CENTER + Math.sin(angle) * RADIUS * scale,
    };
  };

  // Polygon path for current scores (un-assessed = 0 → collapsed at center on
  // that axis; visually we suppress the dot but keep the shape continuous).
  const polyPoints = axes
    .map((a, i) => {
      const v = a.score == null ? 0 : a.score / 5;
      const p = pointAt(i, v);
      return `${p.x},${p.y}`;
    })
    .join(" ");

  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Competência de movimento
      </p>
      <div className="flex justify-center">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-48 w-48">
          {/* Concentric rings */}
          {[0.2, 0.4, 0.6, 0.8, 1].map((s) => (
            <polygon
              key={s}
              points={axes.map((_, i) => {
                const p = pointAt(i, s);
                return `${p.x},${p.y}`;
              }).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeWidth={1}
            />
          ))}
          {/* Axes */}
          {axes.map((a, i) => {
            const p = pointAt(i, 1);
            return (
              <line
                key={a.label}
                x1={CENTER}
                y1={CENTER}
                x2={p.x}
                y2={p.y}
                stroke="currentColor"
                strokeOpacity={a.score == null ? 0.15 : 0.25}
                strokeDasharray={a.score == null ? "3 3" : undefined}
                strokeWidth={1}
              />
            );
          })}
          {/* Data shape */}
          <polygon
            points={polyPoints}
            fill="var(--accent)"
            fillOpacity={0.2}
            stroke="var(--accent)"
            strokeWidth={1.5}
          />
          {/* Data dots (only for assessed axes) */}
          {axes.map((a, i) => {
            if (a.score == null) return null;
            const p = pointAt(i, a.score / 5);
            return <circle key={a.label} cx={p.x} cy={p.y} r={3} fill="var(--accent)" />;
          })}
          {/* Labels */}
          {axes.map((a, i) => {
            const p = pointAt(i, 1.18);
            return (
              <text
                key={a.label}
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className={`text-[9px] uppercase tracking-widest ${a.score == null ? "fill-muted-foreground/50" : "fill-muted-foreground"}`}
              >
                {a.label}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function numScore(v: unknown): number | null {
  if (typeof v !== "number") return null;
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.max(1, Math.min(5, v));
}

/**
 * Date picker for `assessments.performed_on`.
 * Stores ISO YYYY-MM-DD strings (matches Postgres `date` column).
 */
function AssessmentDatePicker({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (iso: string) => void;
  label: string;
  placeholder: string;
}) {
  const date = value ? new Date(value + "T00:00:00") : undefined;
  const formatted = date
    ? date.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : placeholder;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
            {label}:
          </span>
          {formatted}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            if (!d) return;
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            onChange(`${y}-${m}-${day}`);
          }}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
