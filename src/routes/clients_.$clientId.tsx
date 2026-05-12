import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ClientAvatarUpload } from "@/components/ClientAvatarUpload";
import { MicrocyclePanel } from "@/components/MicrocyclePanel";
import { ProgressionsPanel } from "@/components/ProgressionsPanel";
import { CapacityMap } from "@/components/CapacityMap";
import { ReassessmentReminders } from "@/components/ReassessmentReminders";
import { CadenceSheet } from "@/components/CadenceSheet";
import { InjuriesBodyMapBlock } from "@/components/InjuriesBodyMapBlock";
import { ScrollCue } from "@/components/ScrollCue";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Children, cloneElement, createContext, isValidElement, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { parseMeds, serializeMeds, type OtherMed } from "@/lib/meds-format";
import { TRAINING_TIERS, getTierFromYears, tierToYears, type TrainingTier } from "@/lib/training-tier";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Sparkles, FileText, Loader2, CheckCircle2, Circle, Info, AlertTriangle, Trash2, Eraser, Check, ChevronDown, ChevronRight, StopCircle, ChevronsDownUp, ChevronsUpDown, ArrowLeft, ArrowRight, Calendar as CalendarIcon, Download, Plus, Focus, List, Eye, Send, MoreHorizontal, Lock, HeartPulse, Pill, Droplet, Droplets, Activity, Syringe, Wind, Brain, Tablets, Shield, X, Users, Gauge } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HelpPopover } from "@/components/assessment/HelpPopover";
import { AnchoredSlider } from "@/components/assessment/AnchoredSlider";
import { MeasureField } from "@/components/assessment/MeasureField";
import { ChipGroup } from "@/components/assessment/ChipGroup";
import { RockportWizard } from "@/components/assessment/RockportWizard";
import { VisualChipGroup } from "@/components/ui/visual-chip-group";
import {
  FemaleSilhouette, MaleSilhouette,
  IconCalipers, IconBIA, IconDEXA, IconBodPod, IconVisualEstimate,
  IconHome, IconGym, IconOutdoor, IconHybrid,
  IconJobSedentary, IconJobStanding, IconJobPhysical, IconJobMixed,
  IconSmokeNever, IconSmokeFormer, IconSmokeCurrent,
  GuideWaist, GuideHip,
} from "@/components/assessment/svg/icons";
import { DeviceCaptureSheet } from "@/components/assessment/DeviceCaptureSheet";
import { BriefMinimumSheet } from "@/components/assessment/BriefMinimumSheet";
import { PrePlanReviewSheet } from "@/components/plan/PrePlanReviewSheet";
import { downloadAssessmentSummary } from "@/lib/pdf-assessment-summary";
import { TANITA, JAMAR } from "@/lib/devices";
import { computeBmv, type BmvSnapshot } from "@/lib/brief-minimum";
import { listClientCapacitySnapshots } from "@/server/capacity.functions";
import {
  SELF_INTAKE_SECTION_IDS,
  ASSESSMENT_SESSION_SECTION_IDS,
  isSectionCompleteForPhase,
  isSelfIntakeComplete,
  isAssessmentSessionComplete,
  assessmentPhase,
  assessmentGroupCounts,
} from "@/lib/assessment-phase";
import { buildCompletionReport, type MissingItem } from "@/lib/assessment-completion";
import { MissingItemsPanel } from "@/components/assessment/MissingItemsPanel";
import { listInjuries } from "@/server/injuries.functions";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/friendly-error";
import { SmartGoalSection } from "@/components/assessment/SmartGoalSection";
import { useServerFn } from "@tanstack/react-start";
import { generatePlanDraft, generatePlanWeek, generatePlanDay, finalizePlanGeneration } from "@/server/plan.functions";
import { analyzeAssessmentSection, getSectionAnalysisCoverage } from "@/server/phased/pre-stage.functions";
import { updateTrainerSummary } from "@/server/clients.functions";
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
import { isRequiredComplete } from "@/lib/client-phase";
import { ClientPhasePill } from "@/components/ClientPhasePill";
import { IntakeLinkPanel } from "@/components/IntakeLinkPanel";
import { ClientStageOneHero } from "@/components/ClientStageOneHero";
import { ComplianceCard } from "@/components/ComplianceCard";
import MovementPatternCard from "@/components/MovementPatternCard";
import { PATTERN_IDS, formScore, derivePatternScore, type PatternId } from "@/lib/movement-criteria";
import { Slider } from "@/components/ui/slider";
import { planStatusInfo } from "@/lib/plan-status";
import { downloadPlanById } from "@/lib/download-plan";
import { PipelineStrip } from "@/components/PipelineStrip";
import { ProtocolRail } from "@/components/ProtocolRail";
import { ReassessmentSheet } from "@/components/ReassessmentSheet";
import { CapacityDeltasCard } from "@/components/CapacityDeltasCard";
import { ThisWeekHero } from "@/components/ThisWeekHero";
import PlanEditorSurface from "@/components/PlanEditorSurface";
import { PlanWithDeck } from "@/components/PlanWithDeck";
import { ensureShareToken } from "@/server/sessions.functions";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { Menu as MenuIcon } from "lucide-react";
import { EquipmentPicker, EQUIPMENT_CAT_TONE } from "@/components/EquipmentPicker";
import { EQUIPMENT_CATALOG } from "@/lib/equipment-catalog";

// R3.2 — Legacy ReassessmentSheet (chest/arm/thigh/calf girths) is hidden by
// default. Trainers who still need it can flip
// VITE_MEASUREMENT_LEGACY_REASSESSMENT_SHEET=true. Phase B will delete the
// component entirely. RealInsightsCard import removed; component file kept
// until Phase B for safe rollback.
const LEGACY_REASSESSMENT_SHEET =
  import.meta.env.VITE_MEASUREMENT_LEGACY_REASSESSMENT_SHEET === "true";

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

// Equipment selection now uses the shared catalogue + EquipmentPicker (same
// surface as the intake slides). DB still stores canonical EN labels.

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

// Lote 5 — feature flag to keep deprecated fields visible when explicitly enabled.
// Default OFF; set VITE_SHOW_DEPRECATED_ASSESSMENT_FIELDS=true in .env to re-show.
const SHOW_DEPRECATED_ASSESSMENT_FIELDS =
  import.meta.env.VITE_SHOW_DEPRECATED_ASSESSMENT_FIELDS === "true";

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

// Round 1 — reorder to match the new MVP grouping: Self Intake first
// (9 sections), then Assessment Session (5 sections). Drives the mobile
// focused flow + prev/next + tab order. Ids are unchanged.
const SECTIONS = [
  // Self Intake / Auto-Avaliação
  { id: "parq", label: "PAR-Q+", labelKey: "sections.parq", group: "self_intake" as const },
  { id: "risk", label: "Risk strat.", labelKey: "sections.risk", group: "self_intake" as const },
  { id: "training", label: "Training setup", labelKey: "sections.training", group: "self_intake" as const },
  { id: "injuries", label: "Lesões e dor", labelKey: "sections.injuries", group: "self_intake" as const },
  { id: "history", label: "Training history", labelKey: "sections.history", group: "self_intake" as const },
  { id: "goal", label: "SMART goal", labelKey: "sections.goal", group: "self_intake" as const },
  { id: "meds", label: "Medications", labelKey: "sections.meds", group: "self_intake" as const },
  { id: "readiness", label: "Readiness", labelKey: "sections.readiness", group: "self_intake" as const },
  { id: "lifestyle", label: "Lifestyle", labelKey: "sections.lifestyle", group: "self_intake" as const },
  { id: "nutrition", label: "Nutrition", labelKey: "sections.nutrition", group: "self_intake" as const },
  // Assessment Session / Sessão de Avaliação
  { id: "anthro", label: "Anthropometry", labelKey: "sections.anthro", group: "assessment_session" as const },
  { id: "mobility", label: "Mobility", labelKey: "sections.mobility", group: "assessment_session" as const },
  { id: "posture", label: "Posture", labelKey: "sections.posture", group: "assessment_session" as const },
  { id: "screen", label: "Movement screen", labelKey: "sections.screen", group: "assessment_session" as const },
  { id: "performance", label: "Cardio health", labelKey: "sections.performance", group: "assessment_session" as const },
];

// Optional sections render collapsed by default and count as complete
// the moment any of their fields is touched.
const OPTIONAL_SECTIONS = new Set([
  "meds", "readiness", "lifestyle", "nutrition",
  "posture", "screen", "history", "performance",
]);

function hasVal(v: any): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/**
 * Per-section completion check. Round 1 — delegates to the canonical
 * `isSectionCompleteForPhase` helper in `src/lib/assessment-phase.ts` so
 * cockpit badges, the phase pill (`client-phase.ts`) and the Generate
 * Plan gate never drift apart.
 */
function isSectionComplete(id: string, a: any): boolean {
  return isSectionCompleteForPhase(id, a);
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

// WHO adult BMI bands. Auto-derived from client height/weight so trainers
// don't have to categorise manually. "muscular" stays as a manual override
// elsewhere — it cannot be inferred from BMI alone.
function categorizeBmi(heightCm: any, weightKg: any): {
  value: number | null;
  category: "" | "underweight" | "normal" | "overweight" | "obese";
} {
  const h = Number(heightCm);
  const w = Number(weightKg);
  if (!Number.isFinite(h) || !Number.isFinite(w) || h <= 0 || w <= 0) {
    return { value: null, category: "" };
  }
  const bmi = w / Math.pow(h / 100, 2);
  if (!Number.isFinite(bmi)) return { value: null, category: "" };
  let category: "underweight" | "normal" | "overweight" | "obese";
  if (bmi < 18.5) category = "underweight";
  else if (bmi < 25) category = "normal";
  else if (bmi < 30) category = "overweight";
  else category = "obese";
  return { value: Math.round(bmi * 10) / 10, category };
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
      no_injuries: assessment.no_injuries === true,
      no_meds: assessment.no_meds === true,
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
  const ensureShareTokenFn = useServerFn(ensureShareToken);
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
  const [reassessOpen, setReassessOpen] = useState(false);
  const [cadenceOpen, setCadenceOpen] = useState(false);
  const [intakeLinkOpen, setIntakeLinkOpen] = useState(false);
  // BMV gate + device capture sheets.
  const [bmvOpen, setBmvOpen] = useState(false);
  const [tanitaOpen, setTanitaOpen] = useState(false);
  const [jamarOpen, setJamarOpen] = useState(false);
  const [bmvSnapshots, setBmvSnapshots] = useState<BmvSnapshot[]>([]);
  const [bmvReloadTick, setBmvReloadTick] = useState(0);
  const listSnapshotsFn = useServerFn(listClientCapacitySnapshots);
  useEffect(() => {
    if (!clientId) return;
    void (async () => {
      try {
        const r: any = await listSnapshotsFn({ data: { clientId, days: 365 } });
        const rows = (r?.snapshots ?? []) as any[];
        setBmvSnapshots(rows.map((s) => ({
          domain_slug: s.domain_slug,
          test_used: s.test_used ?? null,
          raw_value: s.raw_value ?? null,
        })));
      } catch {}
    })();
  }, [clientId, listSnapshotsFn, bmvReloadTick]);
  // Assessment collapse — controlled so sidebar can mirror it. Once brief is
  // approved, default to collapsed (the trainer is now working in the stages
  // below). User toggle is persisted per-client.
  const assessmentCollapseKey = `protocol_assessment_top_collapsed_${clientId}`;
  const [assessmentCollapsed, setAssessmentCollapsed] = useState<boolean | null>(null);
  // Protocol rail open/closed (default closed — frees attention for the
  // "This week" / capacity panels below). Persisted per-client.
  const protocolRailOpenKey = `protocol_rail_open_${clientId}`;
  const [protocolRailOpen, setProtocolRailOpen] = useState<boolean>(false);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(protocolRailOpenKey);
      if (v === "1") setProtocolRailOpen(true);
      else if (v === "0") setProtocolRailOpen(false);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);
  const setProtocolRailOpenPersist = (v: boolean) => {
    setProtocolRailOpen(v);
    try { window.localStorage.setItem(protocolRailOpenKey, v ? "1" : "0"); } catch { /* ignore */ }
  };
  // Map plan_id → latest week_number with any approved_at day. Used to default
  // the per-week PDF download to the most useful week (R40).
  const [planLatestWeek, setPlanLatestWeek] = useState<Record<string, number>>({});
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
    no_injuries: false,
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
  // Meds local UI state (doses keyed by canonical flag + free-form "Other"
  // entries). Source of truth visually; serialized into assessment.medications
  // on every change so PDFs / AI briefs see a single readable string.
  const [medsLocal, setMedsLocal] = useState<{ doses: Record<string, string>; others: OtherMed[] }>(
    () => parseMeds(""),
  );
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
  // On mobile we use the section-stepper UX: each assessment section is its
  // own screen. The "Gerar rascunho do plano" CTA must NOT appear on every
  // step — the plan is generated AFTER the protocol, so it only belongs on
  // the last step (Performance) or on desktop where every section is visible
  // at once.
  const isMobileStepper = useIsMobile(1024);
  // CTA only belongs at the end of the protocol (Performance section), regardless of viewport.
  const showGenerateCta = activeSection === "performance";
  const [showAdvancedNutrition, setShowAdvancedNutrition] = useState(false);
  const [showAdvancedPerformance, setShowAdvancedPerformance] = useState(false);
  // R-X · Lote 1: flash highlight on Antropometria "Dados base" when Risco BMI
  // card prompts the trainer to fill height/weight there. Single source of truth.
  const [flashAnthroBase, setFlashAnthroBase] = useState(false);
  const [safetyDialogOpen, setSafetyDialogOpen] = useState(false);
  const [safetyOverride, setSafetyOverride] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);

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
  const lsKey = `protocol_assessment_draft_${clientId}`;

  // Phased generation feature-flag + brief preview coverage.
  const [phasedEnabled, setPhasedEnabled] = useState(false);
  // Round 2 — Pre-Plan Review (zero-AI preflight). Opening this sheet must
  // never trigger a server call. The only AI/network call lives behind the
  // sheet's "Criar briefing inicial" primary action, which calls
  // `runPhasedStart()` with the duration the trainer picked inside the sheet.
  const [prePlanReviewOpen, setPrePlanReviewOpen] = useState(false);
  const [briefCoverage, setBriefCoverage] = useState<{ done: number; total: number } | null>(null);
  const analyzeSectionFn = useServerFn(analyzeAssessmentSection);
  const getCoverageFn = useServerFn(getSectionAnalysisCoverage);
  const updateTrainerSummaryFn = useServerFn(updateTrainerSummary);
  // Round B — lift `assessment_injuries` count so the body-map selector
  // reflects in completion state. Loaded once per assessment id; updated
  // optimistically by InjuriesBodyMapBlock via `onCountChange`.
  const listInjuriesFn = useServerFn(listInjuries);
  const [injuriesCount, setInjuriesCount] = useState(0);
  // Conclude-time missing items list (replaces the bare toast-only feedback).
  const [missingItems, setMissingItems] = useState<MissingItem[]>([]);
  const [trainerSummaryDraft, setTrainerSummaryDraft] = useState<string>("");
  const [trainerSummarySaving, setTrainerSummarySaving] = useState(false);

  // Load injury row count whenever the underlying assessment changes.
  useEffect(() => {
    const aid = (assessment as any)?.id as string | undefined;
    if (!aid) {
      setInjuriesCount(0);
      return;
    }
    let on = true;
    listInjuriesFn({ data: { assessmentId: aid } })
      .then((rows) => {
        if (on) setInjuriesCount(Array.isArray(rows) ? rows.length : 0);
      })
      .catch(() => { /* non-fatal; section can still be completed via no_injuries */ });
    return () => { on = false; };
  }, [listInjuriesFn, (assessment as any)?.id]);

  // Round 1 — Generate Plan is now hard-gated; no incomplete shortcut.
  // The previous `incompleteWarnOpen` AlertDialog has been removed.

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
          no_injuries: ext.no_injuries === true,
          no_meds: ext.no_meds === true,
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
        .select("id, title, status, updated_at, created_at, brief, generation_state, generation_status, assessment_id, completion_state, block_number, duration_weeks, share_token, share_token_expires_at, assessment_completion_pct")
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false });
      setPlans(p ?? []);
      // Compute latest approved week per complete plan (R40 default-week).
      const completeIds = (p ?? [])
        .filter((pp: any) => (pp?.generation_state as any)?.stage === "complete")
        .map((pp: any) => pp.id as string);
      if (completeIds.length > 0) {
        const { data: approvedDays } = await supabase
          .from("workout_plan_days")
          .select("plan_id, week_number, approved_at")
          .in("plan_id", completeIds)
          .not("approved_at", "is", null);
        const map: Record<string, number> = {};
        for (const r of (approvedDays ?? []) as any[]) {
          const wn = Number(r.week_number) || 1;
          if (!map[r.plan_id] || wn > map[r.plan_id]) map[r.plan_id] = wn;
        }
        setPlanLatestWeek(map);
      }
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

  // Re-hydrate meds local state when assessment.medications changes from
  // outside our writes (initial load, external sync). While the trainer is
  // editing, our writes serialize back into assessment.medications so this
  // effect sees the same string and no-ops.
  useEffect(() => {
    const otherLabel = t("meds_block.other_label", { defaultValue: "Outro" });
    const flags: string[] = assessment.med_flags ?? [];
    const ours = serializeMeds(flags, medsLocal.doses, medsLocal.others, otherLabel);
    const incoming = String(assessment.medications ?? "");
    if (incoming !== ours) {
      setMedsLocal(parseMeds(incoming));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment.medications]);

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
        // Live update: refresh THIS section's analysis immediately so the
        // user sees Implicações update per-section instead of waiting for
        // the whole queue to drain.
        if (assessment.id) {
          try {
            const r: any = await getCoverageFn({ data: { assessmentId: assessment.id } });
            if (r?.ok) {
              setBriefCoverage({ done: r.done, total: r.total });
              const fresh = (r.analyses ?? {}) as Record<string, SectionAnalysis | null>;
              setSectionAnalyses((prev) => ({ ...prev, [section]: fresh[section] ?? null }));
            }
          } catch {}
        }
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
      // Hydrate from the latest plan for this client — including complete
      // ones — so stages 2..5 stay visible as golden/approved strips after
      // the plan is shipped (R58). Without this, the entire stage lane
      // disappears the moment generation finishes and the trainer loses the
      // golden trail of "what was approved".
      const { data: row } = await supabase
        .from("workout_plans")
        .select("id, brief, blueprint, progression_plan, generation_state, generation_status, programming_variables, red_flag_accommodations")
        .eq("trainer_id", user.id)
        .eq("client_id", clientId)
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
      document.getElementById("protocol-stages-lane")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      .select("id, title, status, updated_at, created_at, brief, generation_state, generation_status, assessment_id, completion_state, block_number, duration_weeks, share_token, share_token_expires_at, assessment_completion_pct")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false });
    setPlans(p ?? []);
  };

  // Kick off the new 5-stage phased flow. Used both by the normal generate
  // button and by the safety-gate confirmation, so the safety override stays
  // on the new pipeline instead of falling back to the legacy day-by-day
  // generator.
  const runPhasedStart = useCallback(async (weeksOverride?: number) => {
    if (phasedBusy) return;
    setPhasedBusy(true);
    const tId = toast.loading("Synthesizing brief…");
    try {
      const weeks = typeof weeksOverride === "number" ? weeksOverride : duration;
      const res = await startPhasedPlanFn({ data: { clientId, durationWeeks: weeks } });
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
      // Round 2 — close the pre-plan review sheet (if open) and let the
      // existing BriefEditor / protocol stages lane handle review +
      // approval. We still surface the synthesis section as today.
      setPrePlanReviewOpen(false);
      setPhasedEnabled(true);
      setSynthesisOpen(true);
      if (typeof window !== "undefined") {
        requestAnimationFrame(() => {
          const el =
            document.getElementById("protocol-stages-lane") ??
            document.getElementById("sintese-da-avaliacao");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Brief synthesis failed.", { id: tId });
    } finally {
      setPhasedBusy(false);
    }
  }, [clientId, duration, phasedBusy, startPhasedPlanFn]);

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
      available_equipment: [], injuries: "", medical_conditions: "", preferences: "", no_injuries: false,
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

  // Auto-derive BMI category from client height + weight. Writes back into the
  // assessment so completion tracking and downstream risk math stay in sync.
  // "muscular" is preserved if previously chosen (BMI alone can't infer it).
  // MUST be declared above the `if (!client) return ...` early-return so the
  // hook order stays stable across renders.
  const bmiAuto = categorizeBmi(client?.height_cm, client?.weight_kg);
  useEffect(() => {
    if (!client) return;
    if (!bmiAuto.category) return;
    if (assessment?.risk?.bmi_category === "muscular") return;
    if (assessment?.risk?.bmi_category === bmiAuto.category) return;
    setAssessment((a: any) => ({
      ...a,
      risk: { ...(a?.risk ?? {}), bmi_category: bmiAuto.category },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bmiAuto.category, client?.id]);

  const headerPhases = useClientPhases(client ? [client.id] : []);
  const clientPhase = client ? headerPhases[client.id] : undefined;

  if (!client) return <p className="text-muted-foreground">{t("loading")}</p>;

  const parqYes = parqHasYes(assessment.parq);
  const riskCategory = computeRisk(assessment.risk);
  const whr = assessment.waist_cm && assessment.hip_cm
    ? (Number(assessment.waist_cm) / Number(assessment.hip_cm)).toFixed(2)
    : "—";

  // Round B — single completion context shared by sidebar + Concluir.
  const completionCtx = { injuriesCount };
  // Local shadow that funnels every section-completeness check through the
  // shared context (so injuries added via the body-map count, etc.).
  const isSectionComplete = (id: string, a: any) =>
    isSectionCompleteForPhase(id, a, completionCtx);

  // Section completion + progress
  const sectionStatus = SECTIONS.map((s) => ({ ...s, complete: isSectionComplete(s.id, assessment) }));
  const completedCount = sectionStatus.filter((s) => s.complete).length;
  const totalSections = SECTIONS.length;
  const pct = Math.round((completedCount / totalSections) * 100);
  const minutesLeft = Math.max(1, Math.round((totalSections - completedCount) * 0.6));
  const currentIdx = sectionStatus.findIndex((s) => s.id === activeSection);
  const sectionNumber = currentIdx >= 0 ? currentIdx + 1 : 1;

  // Round 1 — derived assessment phase + group counts. No schema changes;
  // everything is computed from the existing assessment payload.
  const phase = assessmentPhase(assessment, completionCtx);
  const groupCounts = assessmentGroupCounts(assessment, completionCtx);
  const selfIntakeDone = isSelfIntakeComplete(assessment, completionCtx);
  const sessionDone = isAssessmentSessionComplete(assessment, completionCtx);
  const safetyBlocked = parqYes || riskCategory === "high";
  /** Hard gate for any "Generate plan" path. */
  const canGeneratePlan = phase === "complete" && !safetyBlocked;

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
      <ScrollCue key={clientId} bottomOffset={72} />
      <div>
        <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3 min-w-0">
          {user?.id ? (
            <ClientAvatarUpload
              clientId={client.id}
              trainerId={user.id}
              name={client.full_name}
              photoUrl={client.photo_url ?? null}
              onChange={(url) => setClient((prev: any) => ({ ...prev, photo_url: url }))}
              size={44}
            />
          ) : <span />}
          <div className="min-w-0">
            <h1
              className="t-1 min-w-0 line-clamp-2 [overflow-wrap:anywhere] !text-[clamp(1.375rem,5.5vw,2.25rem)] !leading-[1.1]"
              title={client?.full_name}
            >
              {client?.full_name}
            </h1>
            {(() => {
              const heroPlanLocal = plans.find((p) => ((p as any).generation_state?.stage ?? null) === "complete") ?? null;
              const heroPlanCompleteLocal = !!heroPlanLocal && (heroPlanLocal as any).generation_status === "complete";
              const stage1 = heroPlanCompleteLocal || (briefCoverage && briefCoverage.total > 0 && Math.round((briefCoverage.done / briefCoverage.total) * 100) >= 80);
              const stage2 = !!inlineBrief?.approved || heroPlanCompleteLocal;
              const stage3 = (inlineBrief?.approvedStages ?? []).includes("blueprint") || heroPlanCompleteLocal;
              const stage4 = (inlineBrief?.approvedStages ?? []).includes("microcycle") || heroPlanCompleteLocal;
              const stage5 = (inlineBrief?.approvedStages ?? []).includes("progressions") || heroPlanCompleteLocal;
              const done = [stage1, stage2, stage3, stage4, stage5];
              const idx = done.findIndex((d) => !d);
              const stepN = idx === -1 ? 5 : idx + 1;
              const phase = clientPhase;
              const phaseToneCls =
                phase?.kind === "active" || phase?.kind === "ready" ? "bg-emerald-500" :
                phase?.kind === "idle" ? "bg-amber-500" :
                phase?.kind === "assessment" ? "bg-teal-500" :
                phase?.kind === "intake_sent" ? "bg-sky-500" :
                "bg-muted-foreground/50";
              return (
                <>
                <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-[var(--text-3)]">
                  {client.email && (
                    <>
                      <span className="hidden sm:inline min-w-0 flex-shrink truncate" title={client.email}>
                        {client.email}
                      </span>
                      <span className="hidden sm:inline text-muted-foreground/40" aria-hidden="true">·</span>
                    </>
                  )}
                  {phase && (() => {
                    // Hide redundant "Convite pendente" — same info shown coloured in the status strip below.
                    if ((phase.kind as string) === "intake_sent") return null;
                    const ptLabel =
                      phase.kind === "intake_sent"
                        ? "Convite pendente"
                        : phase.kind === "onboarding"
                          ? "Onboarding"
                          : phase.kind === "assessment"
                            ? "Avaliação a decorrer"
                            : phase.kind === "ready"
                              ? "Pronto para plano"
                              : phase.kind === "active"
                                ? `Ativo · Bloco ${(phase as any).block ?? 1}`
                                : phase.kind === "idle"
                                  ? `Inativo · ${(phase as any).daysSince ?? 0}d`
                                  : phase.kind === "ended"
                                    ? "Plano terminado"
                                    : (phase as any).label;
                    return (
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${phaseToneCls}`} aria-hidden="true" />
                        <span className="eyebrow text-[10px] text-muted-foreground truncate" title={ptLabel}>
                          {ptLabel}
                        </span>
                      </span>
                    );
                  })()}
                  {/* {stepN}/5 chip removed — duplicate of section progress */}
                </p>
                {(() => {
                  const exp = client.intake_token_expires_at ? new Date(client.intake_token_expires_at).getTime() : null;
                  const daysLeft = exp != null ? Math.max(0, Math.round((exp - Date.now()) / 86_400_000)) : null;
                  const expired = exp != null && exp < Date.now();
                  const st = client.intake_status ?? "not_sent";
                  const linkPart =
                    expired ? "caducado" :
                    st === "sent" ? "ainda não aberto" :
                    st === "opened" ? "aberto" :
                    null;
                  if (!linkPart) return null;
                  return (
                    <p className="mt-0.5 eyebrow text-[10px] text-muted-foreground">
                      {expired
                        ? "Link caducado"
                        : st === "opened"
                          ? `Aberto${daysLeft != null ? ` · ${daysLeft}d` : ""}`
                          : `Não aberto${daysLeft != null ? ` · ${daysLeft}d` : ""}`}
                    </p>
                  );
                })()}
                </>
              );
            })()}
          </div>
          {/* Single icon-only overflow menu for every secondary action.
              R68 — header trim for mobile. */}
          <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label="Gerar link de avaliação"
            title="Gerar link de avaliação"
            onClick={() => setIntakeLinkOpen(true)}
          >
            <Send className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Mais ações"
                title="Mais ações"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>Documentos</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={async (e) => {
                  e.preventDefault();
                  try {
                    const { renderAssessmentPdf } = await import("@/lib/pdf");
                    renderAssessmentPdf({
                      assessment,
                      client,
                      plan: inlineBrief
                        ? {
                            title: null,
                            programming_variables: inlineBrief.programmingVariables,
                            red_flag_accommodations: inlineBrief.accommodations,
                          }
                        : null,
                      sectionAnalyses,
                      t: t as any,
                    });
                  } catch (err: any) {
                    toast.error(err?.message ?? "PDF error");
                  }
                }}
              >
                <Download className="mr-2 h-3.5 w-3.5" />
                {t("download_pdf")}
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/me" search={{ as: client.id }} title="Pré-visualizar como cliente">
                  <Eye className="mr-2 h-3.5 w-3.5" /> Ver como cliente
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setCadenceOpen(true); }}>
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {t("cadence.menu_label")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => { e.preventDefault(); setDiscardDialogOpen(true); }}
                className="text-destructive focus:text-destructive"
              >
                <Eraser className="mr-2 h-3.5 w-3.5" />
                {t("discard.button")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setIntakeLinkOpen(true); }}>
                <Send className="mr-2 h-3.5 w-3.5" />
                Detalhes do envio
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
          <Sheet open={intakeLinkOpen} onOpenChange={setIntakeLinkOpen}>
            <SheetContent side="right" className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Detalhes do envio do questionário</SheetTitle>
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
          <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("discard.title")}</AlertDialogTitle>
                <AlertDialogDescription>{t("discard.desc")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("discard.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => { discardDraft(); setDiscardDialogOpen(false); }}>
                  {t("discard.confirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {/* Round 1 — IncompleteWarn dialog removed. Generation is now hard-gated
              by `canGeneratePlan` (Self Intake + Assessment Session both complete
              and no PAR-Q / high-risk block). No more "gerar mesmo assim". */}
        </div>
      </div>

      {/* R68 — Readiness strip removed: ACSM + Recovery already render inside
          ClientCockpit/ProtocolRail below. Single source of truth. */}

      {(() => {
        const briefApproved = !!inlineBrief?.approved;
        const heroPlanExists = plans.some(
          (p) => ((p as any).generation_state?.stage ?? null) === "complete",
        );
        // P0 fix: when no toggle exists elsewhere (no plan, no plans, rail
        // closed), force the assessment to be visible — otherwise the page
        // becomes a blank rectangle below the header.
        const noToggleAvailable =
          !heroPlanExists && plans.length === 0 && !protocolRailOpen;
        const persistedCollapsed =
          assessmentCollapsed ?? (briefApproved || !!readyPlanForAssessment);
        const effectiveCollapsed = noToggleAvailable ? false : persistedCollapsed;
        const stripHidden = !noToggleAvailable;
        // Section navigation sidebar removed — the assessment form on the right keeps all functionality.
        const showSidebar = false;
        return (
      <>
      {(() => {
        const heroPlan = plans.find(
          (p) => ((p as any).generation_state?.stage ?? null) === "complete",
        ) ?? null;
        const zeroState = !heroPlan;
        const heroDefaultWeek = heroPlan
          ? Math.min(
              Math.max(1, (heroPlan as any).duration_weeks ?? 1),
              planLatestWeek[heroPlan.id] ?? 1,
            )
          : 1;
        const intakeDone =
          client.intake_status === "submitted" || client.intake_status === "reviewed";
        const briefReadyLocal = !!inlineBrief && !inlineBrief.approved;
        // Finalized plan (PDF printed → generation_status === "complete") implies
        // every upstream stage cleared, even if approved_stages wasn't tracked
        // (legacy plans, manual builds, demo seeds). Treat plan completion as
        // ground truth so the protocol rail reflects what's actually shipped.
        const heroPlanComplete = !!heroPlan && (heroPlan as any).generation_status === "complete";
        const blueprintApprovedLocal = (inlineBrief?.approvedStages ?? []).includes("blueprint") || heroPlanComplete;
        const microcycleApprovedLocal = (inlineBrief?.approvedStages ?? []).includes("microcycle") || heroPlanComplete;
        const progressionsApprovedLocal = (inlineBrief?.approvedStages ?? []).includes("progressions") || heroPlanComplete;
        const allApprovedLocal = (briefApproved || heroPlanComplete) && blueprintApprovedLocal && microcycleApprovedLocal && progressionsApprovedLocal;
        const scrollToStages = () => {
          document.getElementById("protocol-stages-lane")?.scrollIntoView({ behavior: "smooth", block: "start" });
        };
        let primaryAction: import("@/components/ThisWeekHero").HeroPrimaryAction | null = null;
        let secondaryAction: import("@/components/ThisWeekHero").HeroPrimaryAction | null = null;
        if (!intakeDone && !lastSavedAt) {
          primaryAction = { label: "Pedir avaliação", icon: <Send className="h-4 w-4" />, onClick: () => { document.querySelector<HTMLElement>("[data-intake-link-panel]")?.scrollIntoView({ behavior: "smooth", block: "center" }); } };
        } else if (!phasedEnabled || (!inlineBrief && !heroPlan)) {
          const bmvNow = computeBmv({ client, assessment, snapshots: bmvSnapshots });
          // Round 1 — assessment phase is the canonical gate. We still keep
          // the BMV "missing data" CTA as the secondary nudge for partial
          // Self Intake; once Self Intake is done we then ask for the
          // Assessment Session before unlocking AI generation.
          if (!selfIntakeDone || !bmvNow.ready) {
            primaryAction = { label: `Faltam ${bmvNow.missingRequired} dados — ver`, icon: <AlertTriangle className="h-4 w-4" />, onClick: () => setBmvOpen(true) };
          } else if (!sessionDone) {
            primaryAction = {
              label: t("assessment_gate.session_incomplete"),
              icon: <AlertTriangle className="h-4 w-4" />,
              onClick: () => {
                const firstMissing = ASSESSMENT_SESSION_SECTION_IDS.find((id) => !isSectionCompleteForPhase(id, assessment));
                if (firstMissing) setActiveSection(firstMissing);
                document.getElementById("assessment-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
              },
            };
          } else if (safetyBlocked) {
            primaryAction = {
              label: "Revisão de segurança necessária",
              icon: <AlertTriangle className="h-4 w-4" />,
              onClick: () => setSafetyDialogOpen(true),
            };
          } else {
            // Round 2 — open the zero-AI Pre-Plan Review sheet instead of
            // calling startPhasedPlanDraft directly. The sheet's primary
            // button is the only path that spends AI credits.
            primaryAction = {
              label: t("pre_plan_review.cta"),
              icon: <Sparkles className="h-4 w-4" />,
              onClick: () => setPrePlanReviewOpen(true),
            };
          }
        } else if (briefReadyLocal) {
          primaryAction = { label: "Rever briefing", icon: <ArrowRight className="h-4 w-4" />, onClick: scrollToStages };
        } else if (briefApproved && !blueprintApprovedLocal) {
          primaryAction = { label: "Aprovar plano-mestre", icon: <ArrowRight className="h-4 w-4" />, onClick: () => { setExpandedStage("blueprint"); scrollToStages(); } };
        } else if (blueprintApprovedLocal && !microcycleApprovedLocal) {
          primaryAction = { label: "Aprovar semana-tipo", icon: <ArrowRight className="h-4 w-4" />, onClick: () => { setExpandedStage("microcycle"); scrollToStages(); } };
        } else if (microcycleApprovedLocal && !progressionsApprovedLocal) {
          primaryAction = { label: "Aprovar progressão", icon: <ArrowRight className="h-4 w-4" />, onClick: () => { setExpandedStage("progressions"); scrollToStages(); } };
        } else if (allApprovedLocal && heroPlan) {
          // Trainer surface — editor first, client logbook second.
          primaryAction = {
            label: "Abrir editor",
            icon: <ArrowRight className="h-4 w-4" />,
            href: `/plans/${heroPlan.id}`,
          };
          secondaryAction = {
            label: "Registar treino",
            icon: <ArrowRight className="h-4 w-4" />,
            intent: "log",
            onClick: async () => {
              try {
                const existingToken =
                  (heroPlan as any).share_token &&
                  (!(heroPlan as any).share_token_expires_at || new Date((heroPlan as any).share_token_expires_at).getTime() > Date.now())
                    ? (heroPlan as any).share_token
                    : null;
                const token = existingToken ?? (await ensureShareTokenFn({ data: { plan_id: heroPlan.id } })).share_token;
                setPlans((prev) => prev.map((p) => (p.id === heroPlan.id ? { ...p, share_token: token } : p)));
                navigate({ to: "/log/$token", params: { token } });
              } catch (e: any) {
                toast.error(e?.message ?? "Não foi possível abrir o logbook.");
              }
            },
          };
        } else if (heroPlan) {
          primaryAction = { label: "Abrir plano", icon: <ArrowRight className="h-4 w-4" />, href: `/plans/${heroPlan.id}` };
        } else {
          primaryAction = { label: "Continuar avaliação", icon: <ArrowRight className="h-4 w-4" />, onClick: () => { document.getElementById("assessment-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); } };
        }
        return (
          <>
          {isRequiredComplete({ ...assessment, height_cm: assessment?.height_cm ?? client?.height_cm, weight_kg: assessment?.weight_kg ?? client?.weight_kg }) && (
            <>
              <CapacityMap clientId={clientId} clientName={client?.full_name} />
              <ReassessmentReminders clientId={clientId} />
            </>
          )}
          {(heroPlan || protocolRailOpen) && (
          <section
            aria-label="Protocolo"
            className={[
              "mb-3 overflow-hidden rounded-2xl p-4 sm:p-5",
              heroPlan
                ? "bg-[var(--surface-2)]"
                : "bg-[var(--surface)]",
            ].join(" ")}
          >
            {protocolRailOpen && (
              <ProtocolRail
                bare
                assessmentPct={
                  heroPlanComplete
                    ? 100
                    : briefCoverage && briefCoverage.total > 0
                    ? Math.round((briefCoverage.done / briefCoverage.total) * 100)
                    : null
                }
                lastAssessmentAt={(assessment as any)?.performed_on ?? (assessment as any)?.updated_at ?? null}
                briefApproved={!!inlineBrief?.approved || heroPlanComplete}
                blueprintApproved={blueprintApprovedLocal}
                microcycleApproved={microcycleApprovedLocal}
                progressionsApproved={progressionsApprovedLocal}
                onReassessClick={() => setReassessOpen(true)}
                stage1Expanded={!effectiveCollapsed}
                onStage1Click={() => setAssessmentCollapsedPersist(!effectiveCollapsed)}
                onShowSynthesis={() => setSynthesisOpen((o) => !o)}
              />
            )}
            {heroPlan && !allApprovedLocal && (
              <ThisWeekHero
                bare
                plan={heroPlan}
                defaultWeek={heroDefaultWeek}
                zeroState={zeroState}
                primaryAction={primaryAction}
                secondaryAction={secondaryAction ?? undefined}
                assessmentPdf={
                  assessment
                    ? {
                        onDownload: async () => {
                          const { renderAssessmentPdf } = await import("@/lib/pdf");
                          renderAssessmentPdf({ assessment, client, t: t as any });
                        },
                      }
                    : undefined
                }
              />
            )}
            {allApprovedLocal && heroPlan && (
              <div className="mt-6">
                <PlanWithDeck
                  plan={heroPlan as any}
                  currentWeek={planLatestWeek[heroPlan.id] ?? null}
                  primaryAction={
                    secondaryAction
                      ? {
                          label: secondaryAction.label,
                          onClick: secondaryAction.onClick,
                          busy: secondaryAction.busy,
                        }
                      : undefined
                  }
                  onAssessmentPdf={
                    assessment
                      ? async () => {
                          const { renderAssessmentPdf } = await import("@/lib/pdf");
                          renderAssessmentPdf({ assessment, client, t: t as any });
                        }
                      : undefined
                  }
                />
              </div>
            )}
            <CapacityDeltasCard clientId={clientId} />
            {plans.length > 0 && <ComplianceCard clientId={clientId} />}
          </section>
          )}
          </>
        );
      })()}
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

        {assessment?.id && completedCount >= Math.ceil(sectionStatus.length / 2) && (
          <div className="mb-2 flex flex-nowrap items-center justify-end gap-1.5 overflow-x-auto">
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[11px] font-medium text-foreground/80 transition hover:border-border hover:bg-secondary hover:text-foreground"
              onClick={async () => {
                try {
                  await downloadAssessmentSummary({
                    assessment,
                    client,
                    locale: i18n.language,
                    t: t as any,
                  });
                } catch (e: any) {
                  toast.error(e?.message ?? "Falha a gerar PDF.");
                }
              }}
            >
              <FileText className="h-3 w-3 text-muted-foreground" />
              {t("summary_pdf.cta_short", { defaultValue: "Resumo (PDF)" })}
            </button>
            <span className="h-3 w-px shrink-0 bg-border/60" aria-hidden />
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[11px] font-medium text-foreground/80 transition hover:border-border hover:bg-secondary hover:text-foreground"
              onClick={async () => {
                try {
                  const mod = await import("@/lib/pdf-assessment-session-helper");
                  await mod.generateAssessmentSessionHelperPDF({
                    assessment,
                    client,
                    locale: i18n.language,
                    t: t as any,
                  });
                } catch (e: any) {
                  toast.error(e?.message ?? "Falha a gerar PDF.");
                }
              }}
            >
              <FileText className="h-3 w-3 text-muted-foreground" />
              {t("session_helper.cta_short", { defaultValue: "Guia da sessão (PDF)" })}
            </button>
          </div>
        )}
        <AssessmentSection
          clientId={clientId}
          collapsed={effectiveCollapsed}
          onCollapsedChange={setAssessmentCollapsedPersist}
          hideCollapsedStrip={stripHidden}
          sectionStatus={sectionStatus.map((s) => ({ id: s.id, label: s.label, complete: s.complete }))}
          onActiveChange={(id) => {
            setActiveSection(id);
            // Once the user navigates into a section, dismiss the missing-items
            // panel — they're acting on it. It will be re-built on the next
            // failed Conclude.
            if (missingItems.length > 0) setMissingItems([]);
          }}
          missingPanel={
            missingItems.length > 0 ? (
              <MissingItemsPanel
                items={missingItems}
                onGoTo={(sectionId) => {
                  setActiveSection(sectionId);
                  setMissingItems([]);
                  if (typeof window !== "undefined") {
                    requestAnimationFrame(() => {
                      document
                        .getElementById(`sec-${sectionId}`)
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    });
                  }
                }}
              />
            ) : null
          }
          saveStatus={saveStatus}
          lastSavedAt={lastSavedAt}
          concludeBusy={busy || phasedBusy}
          onConclude={readyPlanForAssessment ? () => {
            // Plano já existe — Concluir leva à síntese (não regenera).
            setSynthesisOpen(true);
            if (typeof window !== "undefined") {
              requestAnimationFrame(() => {
                document
                  .getElementById("sintese-da-avaliacao")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              });
            }
          } : () => {
            // Round B — hard gate. PAR-Q / high-risk safety preserved; if
            // anything is missing, render the canonical report inline near
            // the CTA so the user does not have to open the sidebar.
            if (safetyBlocked) {
              setSafetyDialogOpen(true);
              return;
            }
            const report = buildCompletionReport(assessment, completionCtx);
            if (report.missingAll.length > 0) {
              setMissingItems(report.missingAll);
              const first = report.missingAll[0];
              if (first) setActiveSection(first.sectionId);
              toast.error(
                report.selfIntakeMissing.length > 0
                  ? t("assessment_gate.self_intake_incomplete")
                  : t("assessment_gate.session_incomplete"),
              );
              return;
            }
            setMissingItems([]);
            // Round 2 — never call generation directly from the conclude CTA.
            // Open the Pre-Plan Review sheet (zero AI). Generation only fires
            // when the trainer clicks "Criar briefing inicial" inside it.
            setPrePlanReviewOpen(true);
          }}
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
                {phase === "complete" && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-300 ring-1 ring-emerald-500/30">
                    {t("assessment_complete_chip")} ✓
                  </span>
                )}
              </div>
            </div>
          }
        >

          {/* "Auto-Avaliação do Cliente" header removed — redundant with the
              section title (PAR-Q+ etc.) shown immediately below. */}
          {/* PAR-Q+ */}
          <SectionBlock id="parq" analysing={analysingSections["parq"]} analysis={sectionAnalyses["parq"]} title={t("parq_block.title")} hint={t("parq_block.hint")} complete={isSectionComplete("parq", assessment)} footer={isSectionComplete("parq", assessment) ? <CompletionStrip text={parqFlagCount(assessment.parq) === 0 ? t("parq_block.complete_clear") : t("parq_block.complete_flagged", { count: parqFlagCount(assessment.parq) })} description={t(parqFlagCount(assessment.parq) === 0 ? "parq_block.complete_meaning_clear" : "parq_block.complete_meaning_flagged")} /> : null}>
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
            {isSectionComplete("parq", assessment) && (
              <RxImplications sectionId="parq" assessment={assessment} riskCategory={riskCategory} collapsible />
            )}
          </SectionBlock>
          {/* Risk stratification */}
          <SectionBlock id="risk" analysing={analysingSections["risk"]} analysis={sectionAnalyses["risk"]} title={t("risk_block.title")} hint={t("risk_block.hint")} complete={isSectionComplete("risk", assessment)}>
            <div className="grid gap-2 sm:grid-cols-2">
              <Toggle
                label={t("risk_block.family_cvd_label", { defaultValue: "História familiar precoce" })}
                description={t("risk_block.family_cvd_desc", { defaultValue: "Pai, mãe ou irmão com enfarte ou AVC antes dos 55 (homem) / 65 (mulher)." })}
                icon={<Users className="h-4 w-4" />}
                value={assessment.risk.family_cvd}
                onChange={(v) => setAssessment({ ...assessment, risk: { ...assessment.risk, family_cvd: v } })}
              />
              <div className="space-y-1">
                <LabelWithHelp label={t("risk_block.smoking")} hint={t("risk_block.smoking_hint")} />
                <VisualChipGroup
                  columns={3}
                  size="sm"
                  value={assessment.risk.smoking ?? null}
                  onChange={(v) => setAssessment({ ...assessment, risk: { ...assessment.risk, smoking: v } })}
                  options={[
                    { value: "never", label: t("risk_block.smoking_never"), icon: <IconSmokeNever /> },
                    { value: "former", label: t("risk_block.smoking_former"), icon: <IconSmokeFormer /> },
                    { value: "current", label: t("risk_block.smoking_current"), icon: <IconSmokeCurrent /> },
                  ]}
                />
              </div>
              <div className="space-y-1">
                <LabelWithHelp
                  label={t("risk_block.mvpa_label", { defaultValue: "Quão ativo é o cliente?" })}
                  hint={t("risk_block.mvpa_hint", {
                    defaultValue:
                      "Conta tudo o que põe o cliente ofegante: caminhar rápido, correr, treinar, desporto, jardinagem pesada. ACSM considera sedentário <150 min/semana.",
                  })}
                />
                {(() => {
                   const buckets = [
                     { id: "none", min: 0, label: t("risk_block.mvpa_b_none", { defaultValue: "Quase nada" }), sub: "<30 min/sem" },
                     { id: "light", min: 60, label: t("risk_block.mvpa_b_light", { defaultValue: "Pouco" }), sub: "30–149 min/sem" },
                     { id: "moderate", min: 180, label: t("risk_block.mvpa_b_moderate", { defaultValue: "Moderado" }), sub: "150–239 min/sem" },
                     { id: "high", min: 300, label: t("risk_block.mvpa_b_high", { defaultValue: "Muito ativo" }), sub: "240+ min/sem" },
                   ] as const;
                  const current = (assessment.risk as any).mvpa_min_per_week as number | null | undefined;
                  const activeIdx = current == null
                    ? -1
                    : current < 30
                      ? 0
                      : current < 150
                        ? 1
                        : current < 240
                          ? 2
                          : 3;
                  return (
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {buckets.map((b, i) => {
                        const selected = i === activeIdx;
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() =>
                              setAssessment({
                                ...assessment,
                                risk: {
                                  ...assessment.risk,
                                  mvpa_min_per_week: b.min,
                                  sedentary: b.min < 150,
                                },
                              })
                            }
                            className={
                              "flex flex-col items-start gap-0.5 rounded-md border px-2 py-1.5 text-left text-xs transition-colors " +
                              (selected
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border bg-background/30 text-muted-foreground hover:border-primary/40 hover:text-foreground")
                            }
                          >
                            <span className="font-medium leading-tight">{b.label}</span>
                            <span className="text-[10px] opacity-70">{b.sub}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
              {/* IMC vive na Antropometria — junto da altura/peso que o calculam. */}
              <Toggle
                label={t("risk_block.dyslipidemia")}
                description={t("risk_block.dyslipidemia_desc", { defaultValue: "Colesterol ou triglicéridos alterados — confirmado em análises ou medicado." })}
                icon={<Droplet className="h-4 w-4" />}
                value={assessment.risk.dyslipidemia}
                onChange={(v) => setAssessment({ ...assessment, risk: { ...assessment.risk, dyslipidemia: v } })}
              />
              <Toggle
                label={t("risk_block.prediabetes")}
                description={t("risk_block.prediabetes_desc", { defaultValue: "Glicose em jejum 100–125 mg/dL ou HbA1c 5,7–6,4%." })}
                icon={<Droplets className="h-4 w-4" />}
                value={assessment.risk.prediabetes}
                onChange={(v) => setAssessment({ ...assessment, risk: { ...assessment.risk, prediabetes: v } })}
              />
              <Toggle
                label={t("risk_block.hypertension")}
                description={t("risk_block.hypertension_desc", { defaultValue: "Tensão ≥130/80 mmHg em duas medições ou em terapêutica anti-hipertensora." })}
                icon={<Gauge className="h-4 w-4" />}
                value={assessment.risk.hypertension}
                onChange={(v) => setAssessment({ ...assessment, risk: { ...assessment.risk, hypertension: v } })}
              />
            </div>
            <RxImplications
              sectionId="risk"
              assessment={assessment}
              riskCategory={riskCategory}
              collapsible
              riskChip={{
                level: t(`risk_block.level_${riskCategory}` as const).toUpperCase(),
                tone: riskCategory,
              }}
              extra={
                isSectionComplete("risk", assessment) ? (
                  <CompletionStrip
                    text={t("risk_block.complete", { level: t(`risk_block.level_${riskCategory}` as const).toUpperCase() })}
                    description={t(`risk_block.complete_meaning_${riskCategory}` as const)}
                  />
                ) : null
              }
            />
          </SectionBlock>
          {/* Training setup (existing) */}
          <SectionBlock id="training" analysing={analysingSections["training"]} analysis={sectionAnalyses["training"]} title={t("training_block.title")} hint={t("training_block.hint")} complete={isSectionComplete("training", assessment)} provenance={assessment.provenance?.training} reviewed={client.intake_status === "reviewed"} footer={isSectionComplete("training", assessment) ? <CompletionStrip text={t("training_block.complete", { summary: trainingSummary })} description={t("training_block.complete_meaning")} /> : null}>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <LabelWithHelp label={t("training_block.experience")} hint={t("training_block.experience_hint")} />
                <ChipGroup
                  cols={3}
                  size="sm"
                  value={assessment.experience_level ?? null}
                  onChange={(v) => setAssessment({ ...assessment, experience_level: v })}
                  options={[
                    { value: "beginner", label: t("training_block.beginner") },
                    { value: "intermediate", label: t("training_block.intermediate") },
                    { value: "advanced", label: t("training_block.advanced") },
                  ]}
                />
              </div>
              {/* R-F: days/week as 1–7 chips (replaces free-number input). */}
              <div className="space-y-1">
                <Label className="text-xs">{t("training_block.days_per_week")}</Label>
                <ChipGroup
                  size="sm"
                  value={assessment.training_days_per_week ? Number(assessment.training_days_per_week) : null}
                  onChange={(v) => setAssessment({ ...assessment, training_days_per_week: v })}
                  options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) }))}
                />
              </div>
              {/* R-F: session length as canonical chips + "Outro" → free input fallback. */}
              {(() => {
                const canonical = [30, 45, 60, 75];
                const cur = assessment.session_duration_minutes ? Number(assessment.session_duration_minutes) : null;
                const isOther = cur != null && !canonical.includes(cur);
                return (
                  <div className="space-y-1">
                    <Label className="text-xs">{t("training_block.session_length")}</Label>
                    <ChipGroup
                      size="sm"
                      value={isOther ? "other" : (cur != null ? String(cur) : null)}
                      onChange={(v) => {
                        if (v === "other") {
                          // keep current value if any, else empty for input
                          if (!isOther) setAssessment({ ...assessment, session_duration_minutes: null });
                        } else {
                          setAssessment({ ...assessment, session_duration_minutes: Number(v) });
                        }
                      }}
                      options={[
                        { value: "30", label: "30 min" },
                        { value: "45", label: "45 min" },
                        { value: "60", label: "60 min" },
                        { value: "75", label: "75 min" },
                        { value: "other", label: t("training_block.session_other", { defaultValue: "Outro" }) },
                      ]}
                    />
                    {isOther && (
                      <Input
                        type="number"
                        min={10}
                        max={240}
                        value={String(cur ?? "")}
                        onChange={(e) => setAssessment({ ...assessment, session_duration_minutes: e.target.value ? Number(e.target.value) : null })}
                        className="h-8 w-24 text-xs tabular-nums"
                        placeholder="min"
                      />
                    )}
                  </div>
                );
              })()}
              {(() => {
                // R-X · Lote 2: training_location was free text. Now canonical chips.
                // Legacy non-canonical values are preserved as a "outro" chip.
                const canonical = ["home", "gym", "outdoor", "hybrid"] as const;
                const raw = (Array.isArray(assessment.training_location)
                  ? assessment.training_location[0]
                  : assessment.training_location) as string | null | undefined;
                const isLegacy = !!raw && !canonical.includes(raw as any);
                return (
                  <div className="space-y-1">
                    <Label className="text-xs">{t("training_block.training_location")}</Label>
                    <VisualChipGroup
                      columns={4}
                      size="sm"
                      value={isLegacy ? null : ((raw as any) ?? null)}
                      onChange={(v) => setAssessment({ ...assessment, training_location: v })}
                      options={[
                        { value: "home", label: t("training_block.loc_home", { defaultValue: "Casa" }), icon: <IconHome /> },
                        { value: "gym", label: t("training_block.loc_gym", { defaultValue: "Ginásio" }), icon: <IconGym /> },
                        { value: "outdoor", label: t("training_block.loc_outdoor", { defaultValue: "Ar livre" }), icon: <IconOutdoor /> },
                        { value: "hybrid", label: t("training_block.loc_hybrid", { defaultValue: "Híbrido" }), icon: <IconHybrid /> },
                      ]}
                    />
                    {isLegacy && (
                      <button
                        type="button"
                        onClick={() => setAssessment({ ...assessment, training_location: null })}
                        className="mt-1 inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                        title="Limpar valor antigo"
                      >
                        outro · {String(raw)} ✕
                      </button>
                    )}
                  </div>
                );
              })()}
              <Field label={t("training_block.plan_length")} type="number" value={String(duration)} onChange={(v) => setDuration(Math.max(1, Math.min(16, Number(v) || 4)))} />
            </div>
            <div className="mt-3">
              {(() => {
                const selected: string[] = assessment.available_equipment ?? [];
                const lang = (i18n.language || "pt").startsWith("en") ? "en" : "pt";
                const items = selected
                  .map((en) => EQUIPMENT_CATALOG.find((x) => x.en === en))
                  .filter((x): x is (typeof EQUIPMENT_CATALOG)[number] => !!x);
                const previewCount = 3;
                const preview = items.slice(0, previewCount);
                const extra = items.length - preview.length;
                return (
                  <details className="group rounded-md border border-border bg-background/40 open:bg-background/60">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2">
                      <Label className="text-xs cursor-pointer">{t("training_block.available_equipment")}</Label>
                      <span
                        className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          selected.length > 0
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {selected.length > 0
                          ? t("training_block.equipment_count_n", { n: selected.length, defaultValue: `${selected.length} seleccionados` })
                          : t("training_block.equipment_count_zero", { defaultValue: "Nenhum seleccionado" })}
                      </span>
                      <div className="ml-1 flex min-w-0 flex-1 flex-wrap items-center gap-1 overflow-hidden">
                        {preview.map((it) => {
                          const tone = EQUIPMENT_CAT_TONE[it.category];
                          return (
                            <span
                              key={it.id}
                              className={`truncate rounded-full border px-2 py-0.5 text-[10px] ${tone.on}`}
                            >
                              {lang === "en" ? it.en : it.pt}
                            </span>
                          );
                        })}
                        {extra > 0 && (
                          <span className="text-[10px] text-muted-foreground">+{extra}</span>
                        )}
                      </div>
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="border-t border-border/60 px-3 py-3">
                      <EquipmentPicker
                        value={selected}
                        onChange={(v) => setAssessment({ ...assessment, available_equipment: v })}
                      />
                    </div>
                  </details>
                );
              })()}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {SHOW_DEPRECATED_ASSESSMENT_FIELDS && (
                <TextField label={t("training_block.injuries")} value={assessment.injuries} onChange={(v) => setAssessment({ ...assessment, injuries: v })} />
              )}
              {SHOW_DEPRECATED_ASSESSMENT_FIELDS && (
                <TextField label={t("training_block.medical_conditions")} value={assessment.medical_conditions} onChange={(v) => setAssessment({ ...assessment, medical_conditions: v })} />
              )}
              <TextField label={t("training_block.preferences")} value={assessment.preferences} onChange={(v) => setAssessment({ ...assessment, preferences: v })} className={SHOW_DEPRECATED_ASSESSMENT_FIELDS ? "sm:col-span-2" : "sm:col-span-2"} />
            </div>
            {isSectionComplete("training", assessment) && (
              <RxImplications sectionId="training" assessment={assessment} riskCategory={riskCategory} collapsible />
            )}
          </SectionBlock>
          {/* Injuries & pain — own section (4/15) */}
          <SectionBlock
            id="injuries"
            analysing={analysingSections["injuries"]}
            analysis={sectionAnalyses["injuries"]}
            title={t("injuries_block.title", { defaultValue: "Lesões e dor" })}
            hint={t("injuries_block.hint", { defaultValue: "Marque zonas com dor ou lesão. Se não tiver nenhuma, ative “Sem lesões”." })}
            complete={isSectionComplete("injuries", assessment)}
          >
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border accent-amber-500"
                  checked={assessment.no_injuries === true}
                  onChange={(e) => setAssessment({ ...assessment, no_injuries: e.target.checked })}
                />
                <span>{t("injuries_block.no_injuries_toggle", { defaultValue: "Sem lesões nem dor relevante" })}</span>
              </label>
              {!assessment.no_injuries && (
                <>
                  <InjuriesBodyMapBlock clientId={client!.id} assessmentId={assessment.id ?? null} />
                  <TextField
                    label={t("injuries_block.other_label", { defaultValue: "Outras lesões" })}
                    value={assessment.injuries}
                    onChange={(v) => setAssessment({ ...assessment, injuries: v, no_injuries: v ? false : assessment.no_injuries })}
                  />
                </>
              )}
            </div>
          </SectionBlock>
          {/* Training history */}
          <SectionBlock id="history" analysing={analysingSections["history"]} analysis={sectionAnalyses["history"]} title={t("history_block.title")} hint={t("history_block.hint")} defaultCollapsed complete={isSectionComplete("history", assessment)}>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1.5">
                <LabelWithHelp label={t("history_block.tier_label")} hint={t("history_block.tier_hint")} />
                <TrainingTierChips
                  years={assessment.years_training === "" || assessment.years_training == null ? null : Number(assessment.years_training)}
                  onChange={(years) => setAssessment({ ...assessment, years_training: years == null ? "" : String(years) })}
                />
              </div>
              <Field label={t("history_block.previous")} placeholder={t("history_block.previous_placeholder")} value={assessment.previous_program_style} onChange={(v) => setAssessment({ ...assessment, previous_program_style: v })} />
              <div className="sm:col-span-2 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <Label className="text-xs">{t("history_block.max_lifts")}</Label>
                  <HelpPopover label={t("history_block.max_lifts")} triggerLabel="Como anotar?">
                    <p>{t("history_block.max_lifts_help")}</p>
                  </HelpPopover>
                </div>
                <Input
                  className="h-8 text-sm"
                  value={assessment.max_lifts ?? ""}
                  onChange={(e) => setAssessment({ ...assessment, max_lifts: e.target.value })}
                  placeholder={t("history_block.max_lifts_placeholder")}
                />
              </div>
            </div>
          </SectionBlock>
          {/* SMART goal */}
          <SectionBlock id="goal" analysing={analysingSections["goal"]} analysis={sectionAnalyses["goal"]} title={t("goal_block.title")} hint={t("goal_block.hint")} complete={isSectionComplete("goal", assessment)} provenance={assessment.provenance?.smart_goal} reviewed={client.intake_status === "reviewed"} footer={isSectionComplete("goal", assessment) ? <CompletionStrip text={t("goal_block.complete", { text: String(assessment.smart_specific ?? "").slice(0, 40) })} description={t("goal_block.complete_meaning")} /> : null}>
            <SmartGoalSection
              clientId={clientId}
              value={{
                smart_specific: assessment.smart_specific ?? null,
                smart_measurable: assessment.smart_measurable ?? null,
                smart_deadline: assessment.smart_deadline ?? null,
                primary_goal: assessment.primary_goal ?? null,
              }}
              onChange={(next) => setAssessment({ ...assessment, ...next })}
            />
            {SHOW_DEPRECATED_ASSESSMENT_FIELDS && (
              <div className="mt-3">
                <TextField label={t("goal_block.context")} value={assessment.primary_goal} onChange={(v) => setAssessment({ ...assessment, primary_goal: v })} />
              </div>
            )}
            {isSectionComplete("goal", assessment) && (
              <RxImplications sectionId="goal" assessment={assessment} riskCategory={riskCategory} collapsible />
            )}
          </SectionBlock>
          {/* Medications */}
          <SectionBlock id="meds" analysing={analysingSections["meds"]} analysis={sectionAnalyses["meds"]} title={t("meds_block.title")} hint={t("meds_block.hint")} defaultCollapsed complete={isSectionComplete("meds", assessment)}>
            <label className="mb-3 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border accent-amber-500"
                checked={assessment.no_meds === true}
                onChange={(e) => {
                  const next = e.target.checked;
                  setAssessment({
                    ...assessment,
                    no_meds: next,
                    ...(next ? { med_flags: [], medications: "" } : {}),
                  });
                  if (next) setMedsLocal({ doses: {}, others: [] });
                }}
              />
              <span className="leading-snug">
                <span className="font-medium">{t("no_meds_toggle.label")}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {t("no_meds_toggle.help", { defaultValue: "" })}
                </span>
              </span>
            </label>
            <div className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2", assessment.no_meds === true && "opacity-50 pointer-events-none")}>
              {[
                { id: "beta", canonical: "Beta-blocker", label: t("meds_block.flag_beta"), effect: t("meds_block.effect_beta"), Icon: HeartPulse },
                { id: "statin", canonical: "Statin", label: t("meds_block.flag_statin"), effect: t("meds_block.effect_statin"), Icon: Pill },
                { id: "anticoag", canonical: "Anticoagulant", label: t("meds_block.flag_anticoag"), effect: t("meds_block.effect_anticoag"), Icon: Droplet },
                { id: "antihtn", canonical: "Antihypertensive", label: t("meds_block.flag_antihtn"), effect: t("meds_block.effect_antihtn"), Icon: Activity },
                { id: "diuretic", canonical: "Diuretic", label: t("meds_block.flag_diuretic"), effect: t("meds_block.effect_diuretic"), Icon: Droplets },
                { id: "insulin", canonical: "Insulin/Antidiabetic", label: t("meds_block.flag_insulin"), effect: t("meds_block.effect_insulin"), Icon: Syringe },
                { id: "bronchodilator", canonical: "Bronchodilator", label: t("meds_block.flag_bronchodilator"), effect: t("meds_block.effect_bronchodilator"), Icon: Wind },
                { id: "ssri", canonical: "SSRI", label: t("meds_block.flag_ssri"), effect: t("meds_block.effect_ssri"), Icon: Brain },
                { id: "thyroid", canonical: "Thyroid", label: t("meds_block.flag_thyroid"), effect: t("meds_block.effect_thyroid"), Icon: Shield },
                { id: "nsaid", canonical: "NSAID", label: t("meds_block.flag_nsaid"), effect: t("meds_block.effect_nsaid"), Icon: Tablets },
                { id: "corticosteroid", canonical: "Oral corticosteroid", label: t("meds_block.flag_corticosteroid"), effect: t("meds_block.effect_corticosteroid"), Icon: Pill },
              ].map(({ id, canonical: flag, label, effect, Icon }) => {
                const on = assessment.med_flags.includes(flag);
                const dose = medsLocal.doses[flag] ?? "";
                const otherLabel = t("meds_block.other_label", { defaultValue: "Outro" });
                const commit = (nextFlags: string[], nextDoses: Record<string, string>) => {
                  setMedsLocal((m) => ({ ...m, doses: nextDoses }));
                  setAssessment({
                    ...assessment,
                    med_flags: nextFlags,
                    medications: serializeMeds(nextFlags, nextDoses, medsLocal.others, otherLabel),
                    no_meds: nextFlags.length > 0 ? false : assessment.no_meds,
                  });
                };
                return (
                  <div
                    key={id}
                    className={`rounded-lg border p-2.5 transition ${on ? "border-amber-500/40 bg-amber-500/[0.06] ring-1 ring-inset ring-amber-500/20" : "border-border/60 bg-background/40 hover:border-border hover:bg-muted/30"}`}
                  >
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        const nextFlags = on
                          ? assessment.med_flags.filter((f: string) => f !== flag)
                          : [...assessment.med_flags, flag];
                        const nextDoses = { ...medsLocal.doses };
                        if (on) delete nextDoses[flag];
                        commit(nextFlags, nextDoses);
                      }}
                      className="flex w-full items-start gap-2.5 text-left"
                    >
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${on ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-muted/60 text-muted-foreground"}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[12px] font-medium leading-tight ${on ? "text-amber-700 dark:text-amber-300" : "text-foreground"}`}>{label}</span>
                        <span className="mt-0.5 block text-[10.5px] leading-snug text-muted-foreground">{effect}</span>
                      </span>
                    </button>
                    {on ? (
                      <div className="mt-2 border-t border-amber-500/15 pt-2">
                        <Input
                          value={dose}
                          onChange={(e) => {
                            const nextDoses = { ...medsLocal.doses, [flag]: e.target.value };
                            commit(assessment.med_flags, nextDoses);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          placeholder={t("meds_block.dose_placeholder")}
                          className="h-7 border-amber-500/20 bg-background/60 px-2 text-[11px] tabular-nums focus-visible:ring-amber-500/40"
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {(() => {
              const otherLabel = t("meds_block.other_label", { defaultValue: "Outro" });
              const setOthers = (next: OtherMed[]) => {
                setMedsLocal((m) => ({ ...m, others: next }));
                setAssessment({
                  ...assessment,
                  medications: serializeMeds(assessment.med_flags ?? [], medsLocal.doses, next, otherLabel),
                  no_meds: next.length > 0 ? false : assessment.no_meds,
                });
              };
              return (
                <div className="mt-3 space-y-2">
                  {medsLocal.others.map((o, idx) => (
                    <div
                      key={idx}
                      className="grid items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/[0.06] p-2.5 ring-1 ring-inset ring-amber-500/20 grid-cols-[1fr_auto] sm:grid-cols-[1fr_140px_auto]"
                    >
                      <Input
                        value={o.name}
                        onChange={(e) => {
                          const next = medsLocal.others.slice();
                          next[idx] = { ...next[idx], name: e.target.value };
                          setOthers(next);
                        }}
                        placeholder={t("meds_block.other_name_placeholder")}
                        className="h-8 border-amber-500/20 bg-background/60 text-[12px] sm:col-auto col-span-1 row-start-1"
                      />
                      <Input
                        value={o.dose}
                        onChange={(e) => {
                          const next = medsLocal.others.slice();
                          next[idx] = { ...next[idx], dose: e.target.value };
                          setOthers(next);
                        }}
                        placeholder={t("meds_block.other_dose_placeholder")}
                        className="h-8 border-amber-500/20 bg-background/60 text-[11px] tabular-nums col-span-2 row-start-2 sm:col-auto sm:row-start-1"
                      />
                      <button
                        type="button"
                        aria-label={t("meds_block.other_remove_aria")}
                        onClick={() => {
                          const next = medsLocal.others.slice();
                          next.splice(idx, 1);
                          setOthers(next);
                        }}
                        className="row-start-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setOthers([...medsLocal.others, { name: "", dose: "" }])}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-muted/40 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("meds_block.add_other")}
                  </button>
                </div>
              );
            })()}
          </SectionBlock>
          {/* Readiness */}
          <SectionBlock id="readiness" analysing={analysingSections["readiness"]} analysis={sectionAnalyses["readiness"]} title={t("readiness_block.title")} hint={t("readiness_block.hint")} defaultCollapsed complete={isSectionComplete("readiness", assessment)} provenance={assessment.provenance?.readiness} reviewed={client.intake_status === "reviewed"} footer={isSectionComplete("readiness", assessment) ? <CompletionStrip text={t("readiness_block.complete", { stage: t(`readiness_block.${assessment.readiness_stage}` as const, { defaultValue: assessment.readiness_stage }) })} description={t("readiness_block.complete_meaning")} /> : null}>
            <div className="mb-2 flex justify-end">
              <HelpPopover label={t("readiness_block.help_title")} triggerLabel={t("readiness_block.help_title")}>
                <p>{t("readiness_block.help_body")}</p>
              </HelpPopover>
            </div>
            <ChipGroup
              cols={5}
              size="sm"
              value={assessment.readiness_stage ?? null}
              onChange={(v) => setAssessment({ ...assessment, readiness_stage: v })}
              options={(["precontemplation", "contemplation", "preparation", "action", "maintenance"] as const).map((v) => ({
                value: v,
                label: t(`readiness_block.${v}` as const),
                sub: t(`readiness_block.${v}_sub` as const),
              }))}
            />
            {isSectionComplete("readiness", assessment) && (
              <RxImplications sectionId="readiness" assessment={assessment} riskCategory={riskCategory} collapsible />
            )}
          </SectionBlock>
          {/* Lifestyle (rebuilt) */}
          <SectionBlock id="lifestyle" analysing={analysingSections["lifestyle"]} analysis={sectionAnalyses["lifestyle"]} title={t("lifestyle_block.title")} hint={t("lifestyle_block.hint")} defaultCollapsed complete={isSectionComplete("lifestyle", assessment)} provenance={assessment.provenance?.lifestyle} reviewed={client.intake_status === "reviewed"} footer={isSectionComplete("lifestyle", assessment) ? <CompletionStrip text={t("lifestyle_block.complete", { summary: `sono ${assessment.sleep_quality ?? "—"}h · stress ${assessment.stress_level ?? "—"}/10` })} description={t("lifestyle_block.complete_meaning")} /> : null}>
            <div className="mb-3 grid gap-3 sm:grid-cols-2">
              <AnchoredSlider
                label="Horas de sono médias por noite"
                value={Number(assessment.sleep_quality) || 7}
                onChange={(v) => setAssessment({ ...assessment, sleep_quality: v as any })}
                min={4}
                max={10}
                step={1}
                unit="h"
                trailing={
                  <HelpPopover label="Sono">
                    <p>Média de horas dormidas por noite nas últimas 4 semanas.
                    Menos de 6h prediz pior recuperação e maior risco de lesão.</p>
                  </HelpPopover>
                }
                anchors={[
                  { upTo: 4, label: "≤4h — privação severa, recuperação muito comprometida" },
                  { upTo: 5, label: "5h — défice marcado, ajustar volume em baixa" },
                  { upTo: 6, label: "6h — limite mínimo, recuperação parcial" },
                  { upTo: 7, label: "7h — adequado para a maioria dos adultos" },
                  { upTo: 8, label: "8h — óptimo, boa janela de recuperação" },
                  { upTo: 10, label: "9h+ — descanso amplo" },
                ]}
              />
              <AnchoredSlider
                label="Quão sob pressão se sente no dia-a-dia?"
                value={Number(assessment.stress_level) || 5}
                onChange={(v) => setAssessment({ ...assessment, stress_level: v as any })}
                trailing={
                  <HelpPopover label="Stress percebido">
                    <p>Baseado no PSS-4 (Perceived Stress Scale). Stress crónico alto impacta
                    recuperação, sono e adesão — vamos calibrar volume com isto em conta.</p>
                  </HelpPopover>
                }
                anchors={[
                  { upTo: 2, label: "Muito calmo — controla bem o que aparece" },
                  { upTo: 4, label: "Tranquilo — alguns dias mais cheios que outros" },
                  { upTo: 6, label: "Médio — sente pressão mas gere" },
                  { upTo: 8, label: "Tenso — sobrecarregado várias vezes por semana" },
                  { upTo: 10, label: "Esgotado — em sobrecarga constante" },
                ]}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label={t("lifestyle_block.hours_seated")} type="number" value={assessment.ext_hours_seated} onChange={(v) => setAssessment({ ...assessment, ext_hours_seated: v })} hint={t("lifestyle_block.hours_seated_hint")} />
              <Field label={t("lifestyle_block.daily_steps")} type="number" value={assessment.ext_daily_steps} onChange={(v) => setAssessment({ ...assessment, ext_daily_steps: v })} hint={t("lifestyle_block.daily_steps_hint")} />
              {(() => {
                // R-X · Lote 2: job_type free text → canonical chips. Legacy values preserved.
                const canonical = ["sedentary", "standing", "physical", "mixed"] as const;
                const raw = assessment.ext_job_type as string | null | undefined;
                const isLegacy = !!raw && !canonical.includes(raw as any);
                return (
                  <div className="space-y-1">
                    <Label className="text-xs">{t("lifestyle_block.job_type")}</Label>
                    <VisualChipGroup
                      columns={4}
                      size="sm"
                      value={isLegacy ? null : ((raw as any) ?? null)}
                      onChange={(v) => setAssessment({ ...assessment, ext_job_type: v })}
                      options={[
                        { value: "sedentary", label: t("lifestyle_block.job_sedentary", { defaultValue: "Sentado" }), icon: <IconJobSedentary /> },
                        { value: "standing", label: t("lifestyle_block.job_standing", { defaultValue: "Em pé" }), icon: <IconJobStanding /> },
                        { value: "physical", label: t("lifestyle_block.job_physical", { defaultValue: "Físico" }), icon: <IconJobPhysical /> },
                        { value: "mixed", label: t("lifestyle_block.job_mixed", { defaultValue: "Misto" }), icon: <IconJobMixed /> },
                      ]}
                    />
                    {isLegacy && (
                      <button
                        type="button"
                        onClick={() => setAssessment({ ...assessment, ext_job_type: null })}
                        className="mt-1 inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                        title="Limpar valor antigo"
                      >
                        outro · {String(raw)} ✕
                      </button>
                    )}
                  </div>
                );
              })()}
              {SHOW_DEPRECATED_ASSESSMENT_FIELDS && (
                <>
                  <TextField label={t("lifestyle_block.energy")} value={assessment.energy_levels} onChange={(v) => setAssessment({ ...assessment, energy_levels: v })} />
                  <TextField label={t("lifestyle_block.recovery")} value={assessment.recovery_capacity} onChange={(v) => setAssessment({ ...assessment, recovery_capacity: v })} />
                </>
              )}
            </div>
            {isSectionComplete("lifestyle", assessment) && (
              <RxImplications sectionId="lifestyle" assessment={assessment} riskCategory={riskCategory} collapsible />
            )}
          </SectionBlock>
          {/* Nutrition (rebuilt) */}
          <SectionBlock id="nutrition" analysing={analysingSections["nutrition"]} analysis={sectionAnalyses["nutrition"]} title={t("nutrition_block.title")} hint={t("nutrition_block.hint")} defaultCollapsed complete={isSectionComplete("nutrition", assessment)} provenance={assessment.provenance?.nutrition} reviewed={client.intake_status === "reviewed"} footer={isSectionComplete("nutrition", assessment) ? <CompletionStrip text={t("nutrition_block.complete", { summary: `${assessment.ext_meals_per_day ?? "—"} refeições · álcool ${assessment.ext_alcohol_units_week ?? "—"}u/sem` })} description={t("nutrition_block.complete_meaning")} /> : null}>
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center gap-1">
                  <Label className="text-xs">Quantas refeições faz por dia?</Label>
                  <HelpPopover label="Refeições">
                    <p>Inclui pequeno-almoço, almoço, jantar e snacks que sentem como refeição. Café com leite a meio da manhã não conta.</p>
                  </HelpPopover>
                </div>
                <ChipGroup
                  cols={5}
                  size="sm"
                  value={assessment.ext_meals_per_day || null}
                  onChange={(v) => setAssessment({ ...assessment, ext_meals_per_day: String(v) })}
                  options={[
                    { value: "2", label: "2", sub: "intermitente" },
                    { value: "3", label: "3", sub: "clássico" },
                    { value: "4", label: "4", sub: "+ snack" },
                    { value: "5", label: "5", sub: "fracionado" },
                    { value: "6", label: "6+", sub: "atleta" },
                  ]}
                />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-1">
                  <Label className="text-xs">Bebidas alcoólicas por semana</Label>
                  <HelpPopover label="Álcool">
                    <p>1 bebida ≈ 1 cerveja (33cl), 1 copo de vinho (15cl) ou 1 shot. Baseado no AUDIT-C — &gt;14 unidades/semana é zona de risco para recuperação.</p>
                  </HelpPopover>
                </div>
                <ChipGroup
                  cols={4}
                  size="sm"
                  value={assessment.ext_alcohol_units_week || null}
                  onChange={(v) => setAssessment({ ...assessment, ext_alcohol_units_week: String(v) })}
                  options={[
                    { value: "0", label: "Nada", sub: "abstinente" },
                    { value: "3", label: "Pouco", sub: "1-4/sem" },
                    { value: "8", label: "Moderado", sub: "5-10/sem" },
                    { value: "16", label: "Muito", sub: "11+/sem" },
                  ]}
                />
              </div>
              {SHOW_DEPRECATED_ASSESSMENT_FIELDS && (
                <div>
                  <div className="mb-1 flex items-center gap-1">
                    <Label className="text-xs">Comida processada e fast-food</Label>
                    <HelpPopover label="Processados">
                      <p>Refeições prontas, takeaway, snacks embalados, refrigerantes. Sopa caseira ou pão tradicional não contam.</p>
                    </HelpPopover>
                  </div>
                  <ChipGroup
                    cols={5}
                    size="sm"
                    value={assessment.ext_processed_food_freq || null}
                    onChange={(v) => setAssessment({ ...assessment, ext_processed_food_freq: String(v) })}
                    options={[
                      { value: "1", label: "Raro", sub: "1×/sem" },
                      { value: "2", label: "Pouco", sub: "2-3×/sem" },
                      { value: "3", label: "Médio", sub: "1×/dia" },
                      { value: "4", label: "Muito", sub: "várias/dia" },
                      { value: "5", label: "Quase tudo", sub: "rotina" },
                    ]}
                  />
                </div>
              )}
              {SHOW_DEPRECATED_ASSESSMENT_FIELDS && (
                <div>
                  <div className="mb-1 flex items-center gap-1">
                    <Label className="text-xs">Quantos litros de água bebe por dia?</Label>
                    <HelpPopover label="Hidratação">
                      <p>Inclui água, chá e infusões sem açúcar. Café e bebidas com cafeína contam só metade. ACSM recomenda 30-40 ml/kg/dia.</p>
                    </HelpPopover>
                  </div>
                  <ChipGroup
                    cols={5}
                    size="sm"
                    value={assessment.ext_water_l_per_day || null}
                    onChange={(v) => setAssessment({ ...assessment, ext_water_l_per_day: String(v) })}
                    options={[
                      { value: "0.5", label: "<1 L", sub: "muito pouco" },
                      { value: "1", label: "1 L", sub: "pouco" },
                      { value: "1.5", label: "1.5 L", sub: "razoável" },
                      { value: "2", label: "2 L", sub: "bom" },
                      { value: "3", label: "3+ L", sub: "atleta" },
                    ]}
                  />
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
              {showAdvancedNutrition && (
                <Field label={t("nutrition_block.hydration_legacy")} type="number" value={String(assessment.hydration_glasses_per_day ?? "")} onChange={(v) => setAssessment({ ...assessment, hydration_glasses_per_day: v })} />
              )}
              <TextField label={t("nutrition_block.notes")} value={assessment.nutrition_habits} onChange={(v) => setAssessment({ ...assessment, nutrition_habits: v })} className="sm:col-span-2" />
              </div>
            </div>
            <button type="button" onClick={() => setShowAdvancedNutrition((s) => !s)} className="mt-2 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
              {showAdvancedNutrition ? t("hide_advanced") : t("show_advanced")}
            </button>
            {isSectionComplete("nutrition", assessment) && (
              <RxImplications sectionId="nutrition" assessment={assessment} riskCategory={riskCategory} collapsible />
            )}
          </SectionBlock>
          <AssessmentGroupHeader id="assessment_session" counts={groupCounts.session} />
          {/* Anthropometry */}
          <SectionBlock id="anthro" analysing={analysingSections["anthro"]} analysis={sectionAnalyses["anthro"]} title={t("anthro_block.title")} hint={t("anthro_block.hint")} complete={isSectionComplete("anthro", assessment)} footer={isSectionComplete("anthro", assessment) ? <CompletionStrip text={t("anthro_block.complete", { summary: `WHR ${whr}${assessment.risk?.bmi_category ? ` · IMC ${assessment.risk.bmi_category}` : ""}` })} description={t("anthro_block.complete_meaning")} /> : null}>
            {/* Dados base do cliente — sexo, data de nascimento, altura e peso.
                Vivem em `clients` (não na avaliação) mas pertencem
                conceptualmente à antropometria: alimentam IMC, BMR e
                estimativas de %GC. Posicionados em cima por serem o
                primeiro input clínico que qualquer ficha pede. */}
            <div
              id="anthro-base"
              className={
                "mb-3 rounded-md border bg-muted/20 p-2.5 transition-all duration-500 " +
                (flashAnthroBase
                  ? "border-amber-500/60 ring-2 ring-amber-500/30"
                  : "border-border/60")
              }
            >
              <div className="mb-2 flex items-baseline justify-between gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <span>Dados base</span>
                <span className="text-[9px] normal-case tracking-normal text-muted-foreground/70">
                  usados em IMC, BMR e %GC
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                <label className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">{t("anthro_block.sex_label", { defaultValue: "Sexo biológico" })}</span>
                  <VisualChipGroup
                    size="sm"
                    columns={2}
                    value={(client?.sex as "female" | "male") ?? null}
                    onChange={async (v) => {
                      setClient((prev: any) => ({ ...prev, sex: v }));
                      await supabase.from("clients").update({ sex: v }).eq("id", clientId);
                    }}
                    options={[
                      { value: "female", label: t("anthro_block.sex_female", { defaultValue: "Feminino" }), icon: <FemaleSilhouette /> },
                      { value: "male", label: t("anthro_block.sex_male", { defaultValue: "Masculino" }), icon: <MaleSilhouette /> },
                    ]}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Data de nascimento</span>
                  <input
                    type="date"
                    defaultValue={client?.date_of_birth ?? ""}
                    onBlur={async (e) => {
                      const v = e.target.value || null;
                      if (v === (client?.date_of_birth ?? null)) return;
                      setClient((prev: any) => ({ ...prev, date_of_birth: v }));
                      await supabase.from("clients").update({ date_of_birth: v }).eq("id", clientId);
                    }}
                    className="h-8 w-full rounded-md border border-border bg-background/60 px-2 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Altura (cm)</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={80}
                    max={250}
                    step={1}
                    defaultValue={client?.height_cm ?? ""}
                    placeholder="ex. 175"
                    onBlur={async (e) => {
                      const n = Number(e.target.value);
                      const v = Number.isFinite(n) && n > 0 ? n : null;
                      if (v === (client?.height_cm ?? null)) return;
                      setClient((prev: any) => ({ ...prev, height_cm: v }));
                      await supabase.from("clients").update({ height_cm: v }).eq("id", clientId);
                    }}
                    className="h-8 w-full rounded-md border border-border bg-background/60 px-2 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Peso (kg)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={20}
                    max={400}
                    step={0.1}
                    defaultValue={client?.weight_kg ?? ""}
                    placeholder="ex. 78.4"
                    onBlur={async (e) => {
                      const n = Number(e.target.value);
                      const v = Number.isFinite(n) && n > 0 ? n : null;
                      if (v === (client?.weight_kg ?? null)) return;
                      setClient((prev: any) => ({ ...prev, weight_kg: v }));
                      await supabase.from("clients").update({ weight_kg: v }).eq("id", clientId);
                    }}
                    className="h-8 w-full rounded-md border border-border bg-background/60 px-2 text-sm outline-none focus:border-primary"
                  />
                </label>
              </div>
            </div>
            {/* Categoria IMC — movida do Risco; usa altura/peso de Dados base. */}
            <div className="mb-3 space-y-1">
              <LabelWithHelp label={t("risk_block.bmi_label")} hint={t("risk_block.bmi_hint")} />
              {bmiAuto.value !== null ? (
                (() => {
                  const cat = assessment.risk.bmi_category === "muscular" ? "muscular" : bmiAuto.category;
                  const TONE: Record<string, { dot: string; text: string; bar: string }> = {
                    underweight: { dot: "bg-blue-500", text: "text-blue-600 dark:text-blue-400", bar: "bg-blue-500/70" },
                    normal:      { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500/70" },
                    overweight:  { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500/70" },
                    obese:       { dot: "bg-red-500", text: "text-red-600 dark:text-red-400", bar: "bg-red-500/70" },
                    muscular:    { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500/70" },
                  };
                  const tone = TONE[cat] ?? TONE.normal;
                  const pct = Math.max(0, Math.min(100, ((bmiAuto.value - 16) / (40 - 16)) * 100));
                  return (
                    <div className="rounded-md border border-border bg-background/50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
                          <span className="font-medium text-sm tabular-nums">{bmiAuto.value.toFixed(1)}</span>
                          <span className={`text-sm ${tone.text} truncate`}>
                            {t(`risk_block.bmi_${cat}` as const)}
                          </span>
                        </div>
                        <div
                          role="group"
                          aria-label={t("risk_block.bmi_label")}
                          className="inline-flex shrink-0 rounded-full border border-border/70 bg-background/60 p-0.5 text-[11px] font-medium"
                        >
                          {([
                            { id: "auto", label: t("risk_block.bmi_auto_label") },
                            { id: "athletic", label: t("risk_block.bmi_athletic_label") },
                          ] as const).map((opt) => {
                            const active =
                              opt.id === "athletic"
                                ? assessment.risk.bmi_category === "muscular"
                                : assessment.risk.bmi_category !== "muscular";
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                aria-pressed={active}
                                onClick={() =>
                                  setAssessment({
                                    ...assessment,
                                    risk: {
                                      ...assessment.risk,
                                      bmi_category:
                                        opt.id === "athletic" ? "muscular" : bmiAuto.category,
                                    },
                                  })
                                }
                                className={cn(
                                  "rounded-full px-2.5 py-0.5 transition",
                                  active
                                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="mt-2 relative h-1 rounded-full bg-secondary/60 overflow-visible">
                        {[18.5, 25, 30].map((th) => {
                          const left = ((th - 16) / (40 - 16)) * 100;
                          return (
                            <span
                              key={th}
                              className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-border"
                              style={{ left: `${left}%` }}
                              aria-hidden
                            />
                          );
                        })}
                        <span
                          className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background ${tone.bar}`}
                          style={{ left: `${pct}%` }}
                          aria-hidden
                        />
                      </div>
                      <div className="mt-1 flex justify-between text-[9.5px] text-muted-foreground tabular-nums">
                        <span>16</span>
                        <span>18,5</span>
                        <span>25</span>
                        <span>30</span>
                        <span>40</span>
                      </div>
                      <p className="mt-1.5 text-[10.5px] leading-snug text-muted-foreground">
                        {t(`risk_block.bmi_${cat}_meaning` as const)}
                      </p>
                    </div>
                  );
                })()
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  {t("risk_block.bmi_missing_hw", { defaultValue: "Adicione altura e peso do cliente para calcular o IMC." })}
                </p>
              )}
            </div>
            <div className="mb-2 flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:justify-end">
              <p className="text-[10.5px] text-muted-foreground sm:mr-2">
                {t("anthro_block.bia_helper")}
              </p>
              <Button type="button" size="sm" variant="outline" onClick={() => setTanitaOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t("anthro_block.bia_cta")}
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <MeasureField
                label="Cintura"
                unit="cm"
                value={assessment.waist_cm}
                onChange={(v) => setAssessment({ ...assessment, waist_cm: v })}
                imageNode={<GuideWaist />}
                placeholder="ex. 82"
                helpBody={
                  <>
                    <p>Medida no <b>ponto mais estreito</b> entre as costelas e a anca, normalmente um dedo acima do umbigo.</p>
                    <p className="mt-1">Pessoa em pé, relaxada, a expirar normalmente. Fita justa mas sem comprimir a pele.</p>
                  </>
                }
              />
              <MeasureField
                label="Anca"
                unit="cm"
                value={assessment.hip_cm}
                onChange={(v) => setAssessment({ ...assessment, hip_cm: v })}
                imageNode={<GuideHip />}
                placeholder="ex. 98"
                helpBody={
                  <p>Medida na <b>maior circunferência das nádegas</b>. Pessoa em pé, pés juntos, fita paralela ao chão.</p>
                }
              />
              <div className="space-y-1">
                <Label className="text-xs">{t("anthro_block.whr")}</Label>
                <div className="flex h-8 items-center rounded-md border border-border bg-background/50 px-3 text-sm font-medium">{whr}</div>
              </div>
            </div>
            {/* Avançado — requer equipamento (calipers / BIA / DEXA / BodPod).
                Não faz parte da avaliação default; fica colapsado mas
                acessível e ligado ao mesmo `assessment` state. */}
            <details className="group mt-3 rounded-md border border-dashed border-border/60 bg-muted/10 open:bg-muted/20">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground">
                <span>Avançado · requer equipamento</span>
                <span className="rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-muted-foreground/80 group-open:hidden">
                  {assessment.body_fat_pct ? `%MG ${assessment.body_fat_pct}` : "opcional"}
                </span>
              </summary>
              <div className="grid gap-2 px-2.5 pb-2.5 pt-1 sm:grid-cols-3">
                <MeasureField
                  label="Gordura corporal"
                  unit="%"
                  value={assessment.body_fat_pct}
                  onChange={(v) => setAssessment({ ...assessment, body_fat_pct: v })}
                  placeholder="opcional"
                  helpBody={
                    <>
                      <p>Opcional. Para evolução faz sentido <b>usar sempre o mesmo método</b> (ex. lipocalibrador) — comparar BIA com DEXA dá ruído.</p>
                      <p className="mt-1">Se não tiver medição fiável, deixa em branco e usa só o WHR.</p>
                    </>
                  }
                />
                <div className="space-y-1 sm:col-span-2">
                  <LabelWithHelp label={t("anthro_block.bf_method")} hint={t("anthro_block.bf_method_hint")} />
                  <VisualChipGroup
                    columns={5}
                    size="sm"
                    value={assessment.body_fat_method ?? null}
                    onChange={(v) => setAssessment({ ...assessment, body_fat_method: v })}
                    options={[
                      { value: "calipers", label: t("anthro_block.bf_calipers"), icon: <IconCalipers /> },
                      { value: "bia", label: t("anthro_block.bf_bia"), icon: <IconBIA /> },
                      { value: "dexa", label: t("anthro_block.bf_dexa"), icon: <IconDEXA /> },
                      { value: "bodpod", label: t("anthro_block.bf_bodpod"), icon: <IconBodPod /> },
                      { value: "visual", label: t("anthro_block.bf_visual"), icon: <IconVisualEstimate /> },
                    ]}
                  />
                </div>
              </div>
            </details>
            {isSectionComplete("anthro", assessment) && (
              <RxImplications sectionId="anthro" assessment={assessment} riskCategory={riskCategory} collapsible />
            )}
          </SectionBlock>
          {/* Mobility checklist */}
          <SectionBlock id="mobility" analysing={analysingSections["mobility"]} analysis={sectionAnalyses["mobility"]} title={t("mobility_block.title")} hint={t("mobility_block.hint")}>
            <p className="mb-1 text-[10px] font-medium text-muted-foreground">{t("score_legend")}</p>
            <p className="mb-2 text-[10.5px] leading-snug text-muted-foreground">
              {t("mobility_block.rubric")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ["ext_mob_shoulder", "shoulder"],
                ["ext_mob_hip", "hip"],
                ["ext_mob_ankle", "ankle"],
                ["ext_mob_thoracic", "thoracic"],
                ["ext_mob_wrist", "wrist"],
                ["ext_mob_knee", "knee"],
              ] as const).map(([key, labelKey]) => (
                <ScoreRow
                  key={key}
                  label={t(`mobility_block.${labelKey}` as const)}
                  hint={t(`mobility_block.${labelKey}_hint` as never, { defaultValue: "" }) as string}
                  value={assessment[key]}
                  onChange={(v) => setAssessment({ ...assessment, [key]: v })}
                />
              ))}
            </div>
            <TextField label={t("mobility_block.notes")} value={assessment.mobility_limitations} onChange={(v) => setAssessment({ ...assessment, mobility_limitations: v })} className="mt-2" />
          </SectionBlock>
          {/* Posture */}
          <SectionBlock id="posture" analysing={analysingSections["posture"]} analysis={sectionAnalyses["posture"]} title={t("posture_block.title")} hint={t("posture_block.hint")} defaultCollapsed complete={isSectionComplete("posture", assessment)}>
            <div className="grid gap-2 sm:grid-cols-2">
              {SHOW_DEPRECATED_ASSESSMENT_FIELDS && (
                <TextField
                  label={t("posture_block.standing")}
                  value={assessment.standing_posture_notes}
                  onChange={(v) => setAssessment({ ...assessment, standing_posture_notes: v })}
                  className="sm:col-span-2"
                />
              )}
              {SHOW_DEPRECATED_ASSESSMENT_FIELDS && (
                <TextField label={t("posture_block.imbalances")} value={assessment.known_imbalances} onChange={(v) => setAssessment({ ...assessment, known_imbalances: v })} />
              )}
              <div className="space-y-1">
                <Label className="text-xs">{t("posture_block.dominant")}</Label>
                <ChipGroup
                  cols={3}
                  size="sm"
                  value={assessment.dominant_side ?? null}
                  onChange={(v) => setAssessment({ ...assessment, dominant_side: v })}
                  options={[
                    { value: "right", label: t("posture_block.right") },
                    { value: "left", label: t("posture_block.left") },
                    { value: "ambidextrous", label: t("posture_block.ambi") },
                  ]}
                />
              </div>
            </div>
          </SectionBlock>
          {/* Movement screen */}
          <SectionBlock id="screen" analysing={analysingSections["screen"]} analysis={sectionAnalyses["screen"]} title={t("screen_block.title")} hint={t("screen_block.hint")} defaultCollapsed complete={isSectionComplete("screen", assessment)} footer={isSectionComplete("screen", assessment) ? <CompletionStrip text={t("screen_block.complete", { cleared: PATTERN_IDS.filter((p) => { if (assessment.screen_not_assessed?.[p]) return false; const fc = assessment[`${p}_form_criteria`]; return fc && formScore(fc) >= 3; }).length, total: PATTERN_IDS.length })} description={t("screen_block.complete_meaning")} /> : null}>
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
            {isSectionComplete("screen", assessment) && (
              <RxImplications sectionId="screen" assessment={assessment} riskCategory={riskCategory} collapsible />
            )}
          </SectionBlock>
          {/* Performance */}
          <SectionBlock id="performance" analysing={analysingSections["performance"]} analysis={sectionAnalyses["performance"]} title={t("performance_block.title")} hint={t("performance_block.hint")} defaultCollapsed complete={isSectionComplete("performance", assessment)} footer={isSectionComplete("performance", assessment) ? <CompletionStrip text={t("performance_block.complete", { summary: `FC ${assessment.resting_heart_rate ?? "—"} bpm · ${assessment.ext_cardio_test ?? "sem teste"}` })} description={t("performance_block.complete_meaning")} /> : null}>
            <div className="grid gap-2 sm:grid-cols-2">
              <MeasureField
                label={t("performance_block.rhr")}
                unit="bpm"
                value={assessment.resting_heart_rate ?? ""}
                onChange={(v) => setAssessment({ ...assessment, resting_heart_rate: v })}
                placeholder={t("performance_block.rhr_placeholder", { defaultValue: "ex. 65" })}
                helpBody={<p>{t("performance_block.rhr_help")}</p>}
              />
              <div className="space-y-1">
                <LabelWithHelp label={t("performance_block.cardio_test")} hint={t("performance_block.cardio_test_hint")} />
                <ChipGroup
                  cols={4}
                  size="sm"
                  value={assessment.ext_cardio_test ?? null}
                  onChange={(v) => setAssessment({ ...assessment, ext_cardio_test: v })}
                  options={[
                    { value: "untested", label: t("performance_block.untested") },
                    { value: "cooper", label: t("performance_block.cooper") },
                    { value: "rockport", label: t("performance_block.rockport") },
                    { value: "other", label: t("performance_block.other") },
                  ]}
                />
              </div>
              {assessment.ext_cardio_test === "rockport" ? (
                <RockportWizard
                  weightKg={(assessment.weight_kg ?? client?.weight_kg) ?? null}
                  age={client?.age ?? null}
                  sex={client?.sex ?? null}
                  value={assessment.ext_cardio_value}
                  onChange={(v) => setAssessment({ ...assessment, ext_cardio_value: v })}
                />
              ) : assessment.ext_cardio_test && assessment.ext_cardio_test !== "untested" ? (
                <Field label={t("performance_block.test_result")} value={assessment.ext_cardio_value} onChange={(v) => setAssessment({ ...assessment, ext_cardio_value: v })} className="sm:col-span-2" hint={t("performance_block.test_result_hint")} />
              ) : null}
              {showAdvancedPerformance && (
                <>
                  <div className="sm:col-span-2 flex justify-end">
                    <Button type="button" size="sm" variant="outline" onClick={() => setJamarOpen(true)}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Dinamómetro de preensão
                    </Button>
                  </div>
                  <TextField label={t("performance_block.cardio_legacy")} value={assessment.cardio_capacity} onChange={(v) => setAssessment({ ...assessment, cardio_capacity: v })} className="sm:col-span-2" />
                </>
              )}
            </div>
            <button type="button" onClick={() => setShowAdvancedPerformance((s) => !s)} className="mt-2 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
              {showAdvancedPerformance ? t("hide_advanced") : t("show_advanced")}
            </button>
            {isSectionComplete("performance", assessment) && (
              <RxImplications sectionId="performance" assessment={assessment} riskCategory={riskCategory} collapsible />
            )}
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

          {showGenerateCta && readyPlanForAssessment && (
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
          )}

        </AssessmentSection>
      </div>
      </>
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
              planId={inlineBrief?.planId ?? null}
            />
            )}
              </>
            );
          })()}

          {/* Phased generation: stages stack vertically below the action row.
              Stage 1 (brief) is the only live stage; 2–4 are placeholders.
              R59: when every stage is approved, the lane is redundant with
              the Protocol Rail at the top of the page (it already shows all
              5 ✓ chips + the PDF in the plan header strip). Hide it so the
              client overview reads as a single cockpit card. */}
          {phasedEnabled && inlineBrief && !(
            inlineBrief.approved
            && (inlineBrief.approvedStages ?? []).includes("blueprint")
            && (inlineBrief.approvedStages ?? []).includes("microcycle")
            && (inlineBrief.approvedStages ?? []).includes("progressions")
          ) && (() => {
            // Capture narrowed non-null references so closures (async callbacks)
            // don't lose the type narrowing across function boundaries.
            const ib = inlineBrief;
            const bc = briefCoverage;
            return (
            <div id="protocol-stages-lane" className="space-y-3 scroll-mt-24">
              <FounderAiTelemetryPanel planId={ib.planId} variant="dock" />
              <StageCard
                stageNumber={2}
                title={t("plan:stage.label.2", "Briefing")}
                tone="brief"
                status={ib.approved ? "approved" : "ready"}
                busy={briefStageBusy}
                onApprove={
                  ib.approved
                    ? undefined
                    : async () => {
                        if (briefStageBusy) return;
                        setBriefStageBusy(true);
                        const tId = toast.loading("Approving brief…");
                        try {
                          const res: any = await approveBriefFn({
                            data: {
                              planId: ib.planId,
                              brief: ib.brief,
                              programmingVariables: ib.programmingVariables,
                              redFlagAccommodations: ib.accommodations,
                              assessmentCompletionPct:
                                bc && bc.total > 0
                                  ? Math.round(
                                      (bc.done / bc.total) * 100,
                                    )
                                  : undefined,
                            },
                          });
                          if (!res.ok) {
                            toast.error(res.error || "Approve failed", { id: tId });
                            return;
                          }
                          setInlineBrief({
                            ...ib,
                            approved: true,
                            approvedStages: Array.from(
                              new Set([...(ib.approvedStages ?? []), "brief"])
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
                      // No toast.loading — the StageCard "generating" panel is
                      // the visible source of truth (see R43). Centered white
                      // toasts here just stole attention from the actual card.
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
                          toast.error(`${prefix}: ${friendlyError(msg, `Falha ao gerar ${stage}.`)}`);
                          return;
                        }
                        const prefix = stage[0].toUpperCase() + stage.slice(1);
                        if (res?.usedFallback) {
                          toast.success(
                            `${prefix} pronto (fallback determinístico — IA falhou, edite à vontade)`,
                            { duration: 6000 },
                          );
                        } else {
                          toast.success(`${prefix} pronto`);
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
                        toast.error(`${prefix}: ${friendlyError(msg, `Falha ao gerar ${stage}.`)}`);
                      } finally {
                        setStageBusy(null);
                      }
                    };
                    return (
                      (() => {
                        const allInnerApproved =
                          blueprintApproved && microcycleApproved && progressionsApproved;
                        const Wrapper = ({ children }: { children: ReactNode }) =>
                          allInnerApproved ? (
                            <PipelineStrip
                              blockNumber={(plans[0] as any)?.block_number ?? 1}
                              approvedAt={(plans[0] as any)?.updated_at ?? null}
                            >
                              {children}
                            </PipelineStrip>
                          ) : (
                            <>{children}</>
                          );
                        return (
                          <Wrapper>
                        <StageCard
                          stageNumber={3}
                          title={t("plan:stage.label.3", "Plano-mestre")}
                          status={
                            stageBusy === "blueprint"
                              ? "generating"
                              : blueprintApproved
                              ? "approved"
                              : "ready"
                          }
                          busy={stageBusy === "blueprint"}
                          progressLabel={
                            stageBusy === "blueprint"
                              ? "A redigir Blueprint…"
                              : undefined
                          }
                          loadingSteps={
                            stageBusy === "blueprint"
                              ? (t("detail.stage.loading_steps.blueprint", { returnObjects: true }) as string[])
                              : undefined
                          }
                          loadingEta={t("detail.stage.loading_eta") as string}
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
                            stageBusy === "microcycle"
                              ? "generating"
                              : microcycleApproved
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
                          loadingSteps={
                            stageBusy === "microcycle"
                              ? (t("detail.stage.loading_steps.microcycle", { returnObjects: true }) as string[])
                              : undefined
                          }
                          loadingEta={t("detail.stage.loading_eta") as string}
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
                          title={t("plan:stage.label.5", "Progressões")}
                          status={
                            stageBusy === "progressions"
                              ? "generating"
                              : progressionsApproved
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
                          loadingSteps={
                            stageBusy === "progressions"
                              ? (t("detail.stage.loading_steps.progressions", { returnObjects: true }) as string[])
                              : undefined
                          }
                          loadingEta={t("detail.stage.loading_eta") as string}
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
                          </Wrapper>
                        );
                      })()
                    );
                  })()}
                </>
              )}
              {!inlineBrief.approved && (
                <>
                  <StageCard
                    stageNumber={3}
                    title={t("plan:stage.label.3", "Plano-mestre")}
                    status="placeholder"
                  />
                  <StageCard
                    stageNumber={4}
                    title={t("plan:stage.label.4", "Semana-tipo")}
                    status="placeholder"
                  />
                  <StageCard
                    stageNumber={5}
                    title={t("plan:stage.label.5", "Progressões")}
                    status="placeholder"
                  />
                </>
          )}
          </div>
          );
          })()}

      {/* Hero "Esta semana" — now merged into the Protocolo card above (R53). */}
      {/* "Around the workout" nutrition cue moved to the plan page (view mode) — it belongs next to the workout, not in the client overview. */}

      {plans.length > 1 && (
      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Histórico de planos
          </h2>
          {/* "Gerar próximo bloco (IA)" button removed (R58) — the next block
              should be born from necessity when the client logs the last
              session of the current mesocycle, not from a manual button here. */}
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
                      // default = latest week with any approved_at day; fallback W1 (R40)
                      const defaultWeek = Math.min(totalWeeks, planLatestWeek[p.id] ?? 1);
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

      {/* Compliance & estatísticas — moved into the Protocolo card above (R56). */}
      <PaywallDialog open={paywallOpen} onOpenChange={setPaywallOpen} reason="quota" />
      <CadenceSheet
        clientId={clientId}
        clientName={client?.full_name}
        open={cadenceOpen}
        onOpenChange={setCadenceOpen}
      />
      {LEGACY_REASSESSMENT_SHEET && (
        <ReassessmentSheet
          clientId={clientId}
          open={reassessOpen}
          onOpenChange={setReassessOpen}
        />
      )}
      <DeviceCaptureSheet
        clientId={clientId}
        device={TANITA}
        open={tanitaOpen}
        onOpenChange={setTanitaOpen}
        onSaved={() => setBmvReloadTick((t) => t + 1)}
      />
      <DeviceCaptureSheet
        clientId={clientId}
        device={JAMAR}
        open={jamarOpen}
        onOpenChange={setJamarOpen}
        onSaved={() => setBmvReloadTick((t) => t + 1)}
      />
      <BriefMinimumSheet
        open={bmvOpen}
        onOpenChange={setBmvOpen}
        bmv={computeBmv({ client, assessment, snapshots: bmvSnapshots })}
        busy={phasedBusy}
        onJumpToSection={(sid) => {
          // Identity lives outside the SECTIONS list — scroll to the overview wrapper.
          if (sid === "client-overview") {
            const el = document.querySelector('[data-tour="client-overview"]') as HTMLElement | null;
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          }
          // Otherwise let AssessmentTabs activate + expand the right section, then scroll.
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("assessment:jump", { detail: { sectionId: sid } }));
          }
        }}
        onStartBrief={() => {
          // Round 2 — route through the Pre-Plan Review sheet so opening
          // never spends AI credits. The sheet's primary action calls
          // startPhasedPlanDraft via runPhasedStart().
          setPrePlanReviewOpen(true);
        }}
      />
      <PrePlanReviewSheet
        open={prePlanReviewOpen}
        onOpenChange={setPrePlanReviewOpen}
        assessment={assessment}
        client={client}
        busy={phasedBusy}
        onConfirm={(weeks) => { void runPhasedStart(weeks); }}
      />
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
    <div className="rounded-xl bg-muted/40 p-3">
      <p className="eyebrow text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-light tracking-tight tabular-nums ${toneClass}`}>{value}</p>
      {caption && <p className="body-prose mt-1 text-xs text-muted-foreground">{caption}</p>}
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
  planId,
}: {
  assessment: any;
  sectionAnalyses: Record<string, SectionAnalysis | null>;
  totalSections: number;
  riskCategory: string;
  whr: string;
  redFlagAccommodations: RedFlagAccommodation[] | null;
  planId?: string | null;
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
    <div id="sintese-da-avaliacao" className="scroll-mt-24 space-y-3 rounded-xl bg-muted/30 p-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between animate-in fade-in slide-in-from-bottom-1 duration-500">
        <p className="eyebrow text-muted-foreground">{t("detail.synthesis.title")}</p>
        <span className="body-data text-[10px] text-muted-foreground">{t("detail.synthesis.analysed", { n: analysedCount, total: totalSections })}</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-2 duration-500 [animation-delay:120ms] fill-mode-both">
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
        <div className="rounded-lg bg-muted/40 p-3">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <p className="eyebrow text-muted-foreground">
              {t("detail.synthesis.alerts", { n: flags.length })}
            </p>
          </div>
          <ul className="space-y-1.5">
            {sortedFlags.map((f) => {
              const acc = accMap.get(f);
              return (
                <li key={f} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
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

      {planId && (
        <div className="flex justify-end pt-1 animate-in fade-in slide-in-from-bottom-2 duration-500 [animation-delay:280ms] fill-mode-both">
          <Link
            to="/plans/$planId/microcycle"
            params={{ planId }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] hover:opacity-90 transition"
          >
            <Sparkles className="h-4 w-4" />
            {t("detail.synthesis.go_to_cockpit")}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}

function AssessmentGroupHeader({ id, counts }: { id: "self_intake" | "assessment_session"; counts: { done: number; total: number } }) {
  const { t } = useTranslation("assessment");
  const complete = counts.done >= counts.total;
  return (
    <div className="mt-4 mb-1 flex items-center gap-3 border-t border-border/60 pt-4 first:mt-0 first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-foreground/90">
          {t(id === "self_intake" ? "self_intake.title" : "assessment_session.title")}
        </h3>
        <p className="text-[11px] text-muted-foreground">
          {t(id === "self_intake" ? "self_intake.subtitle" : "assessment_session.subtitle")}
        </p>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] tabular-nums ${complete ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30" : "bg-muted/60 text-muted-foreground"}`}>
        {counts.done}/{counts.total}{complete ? " ✓" : ""}
      </span>
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
  hideCollapsedStrip = false,
  sectionStatus,
  saveStatus,
  lastSavedAt,
  onActiveChange,
  onConclude,
  concludeBusy = false,
  missingPanel = null,
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
  /** When true, render nothing while collapsed (the parent ProtocolRail owns the toggle). */
  hideCollapsedStrip?: boolean;
  /** Per-section completeness, used by mobile stepper jump sheet + Próxima styling. */
  sectionStatus?: Array<{ id: string; label: string; complete: boolean }>;
  saveStatus?: SaveStatus;
  lastSavedAt?: number | null;
  /** Notifies parent when the focused section changes. */
  onActiveChange?: (id: string) => void;
  /** Triggered when the user taps "Concluir" on the last section. */
  onConclude?: () => void;
  concludeBusy?: boolean;
  /** Inline list of missing items rendered above the sticky/desktop footer. */
  missingPanel?: React.ReactNode;
}) {
  const { t } = useTranslation("assessment");
  const isMobile = useIsMobile(1024);
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
  const focusKey = `protocol_assessment_focus_${clientId}`;
  const activeKey = `protocol_assessment_focus_active_${clientId}`;
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

  // Notify parent so the page-level progress strip ("Section N/14 · X%")
  // can reflect the focused section instead of staying stuck on PAR-Q.
  useEffect(() => {
    onActiveChange?.(activeId);
  }, [activeId, onActiveChange]);

  // In focused mode, the active section is always open (never collapsed
  // inside its own card — the toggle exists for "see all" mode only).
  useEffect(() => {
    if (focused) ctx.setOpen(activeId, true);
    // Depend only on the stable setOpen callback, NOT the whole ctx object —
    // ctx is rebuilt every render, which would create an infinite loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, activeId, ctx.setOpen]);

  // External jump requests (e.g. BriefMinimumSheet "Ver →" buttons):
  // activate the section, expand it, then scroll once it has rendered.
  useEffect(() => {
    function onJump(e: Event) {
      const sid = (e as CustomEvent<{ sectionId: string }>).detail?.sectionId;
      if (!sid || !sectionIds.includes(sid)) return;
      setActiveId(sid);
      ctx.setOpen(sid, true);
      // Wait two frames so focus-mode swap + collapse expansion paint first.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.getElementById(`sec-${sid}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
    }
    window.addEventListener("assessment:jump", onJump as EventListener);
    return () => window.removeEventListener("assessment:jump", onJump as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionIds, ctx.setOpen]);

  // Map child SectionBlocks by their `id` prop so we can pick the active one.
  const childArray = Children.toArray(children);
  const sectionChildren = new Map<string, React.ReactNode>();
  const extras: React.ReactNode[] = [];
  for (const child of childArray) {
    if (isValidElement(child) && typeof (child.props as any)?.id === "string" && sectionIds.includes((child.props as any).id)) {
      sectionChildren.set((child.props as any).id, child);
    } else if (isValidElement(child) && (child.type as any) === AssessmentGroupHeader) {
      // Round 1 — Self Intake / Assessment Session group banners. Render
      // inline in non-focused desktop mode (children pass-through). In
      // focused/mobile mode the group context lives in the sticky header,
      // so we drop the banner from `extras` to avoid duplicate visuals.
      continue;
    } else {
      extras.push(child);
    }
  }
  const activeIdx = Math.max(0, sectionIds.indexOf(activeId));
  const goPrev = () => setActiveId(sectionIds[Math.max(0, activeIdx - 1)]);
  const goNext = () => setActiveId(sectionIds[Math.min(sectionIds.length - 1, activeIdx + 1)]);

  // Mobile stepper helpers --------------------------------------------------
  const statusById = useMemo(() => {
    const m = new Map<string, boolean>();
    (sectionStatus ?? []).forEach((s) => m.set(s.id, s.complete));
    return m;
  }, [sectionStatus]);
  const currentComplete = statusById.get(activeId) ?? false;
  const completedCount = (sectionStatus ?? []).filter((s) => s.complete).length;
  const totalCount = sectionIds.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);
  const isLast = activeIdx === sectionIds.length - 1;
  const [jumpOpen, setJumpOpen] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const prevCompleteRef = useRef<boolean>(currentComplete);
  useEffect(() => {
    if (currentComplete && !prevCompleteRef.current) setPulseKey((k) => k + 1);
    prevCompleteRef.current = currentComplete;
  }, [currentComplete]);
  // On mobile/tablet, force focused mode (one section at a time).
  useEffect(() => {
    if (isMobile && !focused) setFocused(true);
  }, [isMobile, focused]);
  // Scroll to top + focus first interactive element on section change (mobile).
  const stepperBodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isMobile) return;
    const node = stepperBodyRef.current;
    if (!node) return;
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "auto" });
    requestAnimationFrame(() => {
      const first = node.querySelector<HTMLElement>(
        "input:not([type=hidden]), textarea, select, [role=tab], button:not([aria-hidden=true])"
      );
      first?.focus({ preventScroll: true });
    });
  }, [activeId, isMobile]);
  // Save status pill (mobile sticky header)
  const saveLabel = (() => {
    if (saveStatus === "saving") return t("save.saving");
    if (saveStatus === "offline") return t("save.offline");
    if (saveStatus === "saved" && lastSavedAt) {
      const diff = Math.max(0, Math.round((Date.now() - lastSavedAt) / 1000));
      if (diff < 10) return t("save.saved_recent");
      if (diff < 60) return t("save.saved", { when: t("rel_time.seconds_ago", { s: diff }) });
      const m = Math.round(diff / 60);
      if (m < 60) return t("save.saved", { when: t("rel_time.minutes_ago", { m }) });
      return t("save.saved", { when: t("rel_time.hours_ago", { h: Math.round(m / 60) }) });
    }
    return null;
  })();

  if (collapsed) {
    if (hideCollapsedStrip) return null;
    const isComplete = (completionPct ?? 0) >= 80;
    // Stage 1 sits in the same approved/draft visual language as Stages 2-5:
    // emerald when complete (matches PipelineStrip + approved StageCard),
    // neutral card when partial. Drops the legacy amber-only treatment.
    const stripClass = isComplete
      ? "rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.05] p-3 transition hover:bg-emerald-500/[0.08]"
      : "rounded-2xl border border-border bg-card p-3";
    const labelClass = isComplete ? "text-emerald-300" : "";
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
              <Check className="h-4 w-4 text-emerald-400" />
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
              className="rounded-md border border-emerald-500/30 px-2 py-1 text-[10px] font-medium uppercase tracking-widest text-emerald-300 hover:bg-emerald-500/10"
            >
              Ver síntese
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className={isMobile ? "rounded-2xl bg-muted/30" : "space-y-4 rounded-2xl bg-muted/30 p-4"}>
      {!isMobile && (
      <div className="flex flex-wrap items-center gap-3">
        {headerProgress}
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="ml-auto eyebrow inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
        >
          <ChevronDown className="h-3 w-3" /> {t("detail.section.collapse")}
        </button>
      </div>
      )}
      {!isMobile && (
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-2">
        <button
          type="button"
          onClick={() => setFocused((f) => !f)}
          className={`eyebrow inline-flex items-center gap-1 rounded-md px-2 py-1 transition ${focused ? "bg-muted/60 text-foreground" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"}`}
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
          className="eyebrow inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
        >
          <ChevronsUpDown className="h-3 w-3" /> {t("detail.section.expand_all")}
        </button>
        <button
          type="button"
          onClick={() => ctx.setAll(false)}
          className="eyebrow inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
        >
          <ChevronsDownUp className="h-3 w-3" /> {t("detail.section.collapse_all")}
        </button>
          </>
        )}
      </div>
      )}
      {!isMobile && focused && (
        <div
          className="flex flex-wrap items-center gap-1 pb-2"
          role="tablist"
          aria-label={t("detail.section.tabs_aria")}
        >
          {SECTIONS.map((s, i) => {
            const isActive = s.id === activeId;
            const isPast = i < activeIdx;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveId(s.id)}
                title={t((s as any).labelKey ?? s.label, { defaultValue: s.label }) as string}
                className={[
                  "group inline-flex items-center gap-1.5 rounded-full transition",
                  isActive
                    ? "bg-amber-500/[0.08] px-2.5 py-1 text-amber-300 ring-1 ring-amber-500/30"
                    : isPast
                      ? "px-2 py-1 text-muted-foreground/80 hover:bg-muted/40 hover:text-foreground"
                      : "px-2 py-1 text-muted-foreground/50 hover:bg-muted/30 hover:text-foreground",
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-flex h-4 w-4 items-center justify-center rounded-full font-mono text-[10px] tabular-nums transition",
                    isActive
                      ? "bg-amber-500/25 text-amber-200"
                      : isPast
                        ? "bg-muted/50 text-foreground/70"
                        : "bg-muted/30 text-muted-foreground/60",
                  ].join(" ")}
                >
                  {i + 1}
                </span>
                <span
                  className={`hidden text-[11px] tracking-tight sm:inline ${isActive ? "font-medium" : ""}`}
                >
                  {t((s as any).labelKey ?? s.label, { defaultValue: s.label })}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <SectionCollapseContext.Provider value={ctx}>
        {focused ? (
          isMobile ? (
            <div className="flex flex-col">
              {/* Sticky header */}
              <div className="sticky top-0 z-30 -mx-px border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div className="h-0.5 w-full bg-muted/30">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500/70 via-primary to-primary transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex items-center gap-2.5 px-3 py-2">
                  <span className="inline-flex shrink-0 items-center rounded-full bg-muted/60 px-2 py-0.5 font-mono text-[10px] font-medium tabular-nums tracking-tight text-muted-foreground">
                    {String(activeIdx + 1).padStart(2, "0")}/{String(totalCount).padStart(2, "0")}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col leading-tight">
                    {(() => {
                      const grp = SECTIONS.find((s) => s.id === activeId)?.group;
                      if (!grp) return null;
                      return (
                        <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                          {t(grp === "self_intake" ? "self_intake.title" : "assessment_session.title")}
                        </span>
                      );
                    })()}
                    <h2 className="t-3 min-w-0 truncate leading-tight">
                      {t(`sections.${activeId}` as const, {
                        defaultValue:
                          (sectionStatus ?? SECTIONS).find((s) => s.id === activeId)?.label ?? activeId,
                      })}
                    </h2>
                  </div>
                  {saveLabel && (
                    <span className="hidden shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground/70 sm:inline">
                      {saveLabel}
                    </span>
                  )}
                  <Sheet open={jumpOpen} onOpenChange={setJumpOpen}>
                    <SheetTrigger asChild>
                      <button
                        type="button"
                        aria-label={t("jump_to")}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/40 text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
                      >
                        <MenuIcon className="h-4 w-4" />
                      </button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[85vw] max-w-sm">
                      <SheetHeader>
                        <SheetTitle>{t("jump_to")}</SheetTitle>
                      </SheetHeader>
                      <div className="mt-3 flex flex-col gap-1 overflow-y-auto pb-6">
                        {SECTIONS.map((s, i) => {
                          const complete = statusById.get(s.id) ?? false;
                          const isActive = s.id === activeId;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => { setActiveId(s.id); setJumpOpen(false); }}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition",
                                isActive ? "bg-muted/60 text-foreground" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                              )}
                            >
                              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted/50 font-mono text-[10px] tabular-nums">
                                {i + 1}
                              </span>
                              <span className="flex-1 truncate">{t((s as any).labelKey ?? s.label, { defaultValue: s.label })}</span>
                              {complete ? (
                                <>
                                  <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                                  <span className="sr-only">{t("section_complete_indicator")}</span>
                                </>
                              ) : (
                                <Circle className="h-3 w-3 text-muted-foreground/40" aria-hidden="true" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>
              {/* Body — uses document scroll on mobile (single vertical scrollbar) */}
              <div ref={stepperBodyRef} className="min-h-[60vh] px-3 py-4">
                <div key={activeId} className="animate-in fade-in slide-in-from-right-2 duration-300">
                  {sectionChildren.get(activeId) ?? (
                    <div className="rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
                      {t("detail.section.unavailable")}
                    </div>
                  )}
                </div>
              </div>
              {/* Missing-items panel (shown when Concluir was blocked). */}
              {missingPanel ? <div className="px-3 pb-2">{missingPanel}</div> : null}
              {/* Sticky footer */}
              <div
                className="sticky bottom-0 z-30 flex items-center justify-between gap-2 border-t border-border/60 bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
                style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goPrev}
                  disabled={activeIdx === 0}
                >
                  <ArrowLeft className="mr-1 h-3.5 w-3.5" /> {t("previous")}
                </Button>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {activeIdx + 1}/{totalCount}
                </span>
                <Button
                  key={pulseKey}
                  size="sm"
                  onClick={isLast ? (onConclude ?? (() => {})) : goNext}
                  disabled={concludeBusy || (isLast && !onConclude)}
                  className={cn(
                    "transition",
                    currentComplete && !isLast
                      ? "bg-amber-500 text-amber-950 hover:bg-amber-500/90"
                      : "",
                    isLast && onConclude
                      ? "bg-amber-500 text-amber-950 hover:bg-amber-500/90"
                      : "",
                    currentComplete ? "animate-pulse-once" : ""
                  )}
                >
                  {concludeBusy ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {isLast ? t("finish") : t("next")} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
              {extras.length > 0 && <div className="space-y-3 px-3 py-4">{extras}</div>}
            </div>
          ) : (
          <>
            <div key={activeId} className="animate-in fade-in slide-in-from-right-2 duration-300">
              {sectionChildren.get(activeId) ?? (
                <div className="rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
                  {t("detail.section.unavailable")}
                </div>
              )}
            </div>
            {missingPanel}
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
                variant={activeIdx === sectionIds.length - 1 && onConclude ? "default" : "outline"}
                size="sm"
                onClick={
                  activeIdx === sectionIds.length - 1 && onConclude
                    ? onConclude
                    : goNext
                }
                disabled={
                  concludeBusy ||
                  (activeIdx === sectionIds.length - 1 && !onConclude)
                }
              >
                {concludeBusy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                {activeIdx === sectionIds.length - 1 ? t("finish") : t("detail.section.next")} <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
            {extras.length > 0 && <div className="space-y-3">{extras}</div>}
          </>
          )
        ) : (
          children
        )}
      </SectionCollapseContext.Provider>
    </section>
  );
}

function useSectionCollapseProvider(clientId: string, sectionIds: string[]): CollapseCtx & { allOpen: boolean; allClosed: boolean } {
  const storageKey = useCallback((id: string) => `protocol_assessment_collapse_${clientId}_${id}`, [clientId]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    const out: Record<string, boolean> = {};
    for (const id of sectionIds) {
      try {
        const v = window.localStorage.getItem(`protocol_assessment_collapse_${clientId}_${id}`);
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
    <div id={`sec-${id}`} className={`scroll-mt-20 rounded-xl bg-muted/40 p-3 ${borderClass}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mb-2 flex w-full items-center gap-1.5 text-left"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        <h3 className={`eyebrow ${analysed ? "text-foreground/70" : "text-foreground"}`}>{title}</h3>
        {analysed && <Check className="h-3 w-3 text-muted-foreground" aria-label="analysed" />}
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
        (() => {
          // Fold CompletionStrip (footer) + AI insight into a single trailing
          // RxImplications card if present — collapses "3 títulos" per section
          // into one (founder feedback May-2026).
          const arr = Children.toArray(children);
          let foldedRx: React.ReactNode | null = null;
          let summary: string | undefined;
          let summaryDescription: string | undefined;
          if (isValidElement(footer) && (footer.type as any) === CompletionStrip) {
            const fp = footer.props as { text: string; description?: string };
            summary = fp.text;
            summaryDescription = fp.description;
          }
          const insightText =
            id !== "risk"
              ? (analysis?.contraindication_notes ?? analysis?.notes_for_next_stage ?? "").trim() || null
              : null;
          const transformed = arr.map((child) => {
            if (
              isValidElement(child) &&
              (child.type as any) === RxImplications
            ) {
              foldedRx = child;
              return cloneElement(child as React.ReactElement<any>, {
                summary,
                summaryDescription,
                insight: insightText,
                insightLoading: id !== "risk" ? !!analysing : false,
              });
            }
            return child;
          });
          return (
            <>
              {transformed}
              {!foldedRx && (summary || insightText || analysing) && (
                <UnifiedSectionFooter
                  summary={summary}
                  summaryDescription={summaryDescription}
                  insight={insightText}
                  insightLoading={id !== "risk" ? !!analysing : false}
                />
              )}
              {/* Fallback: if no summary/insight at all, render whatever footer was passed */}
              {!foldedRx && !summary && !insightText && !analysing && footer}
            </>
          );
        })()
      )}
    </div>
  );
}

function UnifiedSectionFooter({
  summary,
  summaryDescription,
  insight,
  insightLoading,
}: {
  summary?: string;
  summaryDescription?: string;
  insight: string | null;
  insightLoading: boolean;
}) {
  const { t } = useTranslation("assessment");
  const [implicationsOpen, setImplicationsOpen] = useState(false);
  if (!summary && !insight && !insightLoading) return null;
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border/60 bg-background/30 p-3">
      {summary && (
        <div className="flex items-start gap-2.5 rounded-md bg-emerald-500/[0.06] px-2.5 py-2 text-emerald-900/90 dark:text-emerald-100/90">
          <span
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            aria-hidden
          >
            <Check className="h-3 w-3" strokeWidth={2.75} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium leading-tight">{summary.replace(/^\s*✓\s*/, "")}</p>
            {summaryDescription && (
              <p className="mt-0.5 text-[11px] leading-snug text-emerald-900/65 dark:text-emerald-100/65">
                {summaryDescription}
              </p>
            )}
          </div>
        </div>
      )}
      {insightLoading ? (
        <div className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>A analisar…</span>
        </div>
      ) : insight && insight.trim() ? (
        <div className="rounded-md bg-muted/30">
          <button
            type="button"
            onClick={() => setImplicationsOpen((o) => !o)}
            className="flex w-full items-center gap-1.5 px-3 py-2 text-left"
            aria-expanded={implicationsOpen}
          >
            {implicationsOpen ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
            <Sparkles className="h-3 w-3 text-amber-500/80" aria-hidden />
            <span className="eyebrow text-muted-foreground">{t("detail.implications_label")}</span>
          </button>
          {implicationsOpen && (
            <blockquote className="px-3 pb-2 text-[12px] leading-relaxed text-foreground/85">
              {insight}
            </blockquote>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SectionAnalysisCard({ analysing, analysis }: { analysing: boolean; analysis: SectionAnalysis | null }) {
  return null;
}

function _SectionAnalysisCardLegacy({ analysing, analysis }: { analysing: boolean; analysis: SectionAnalysis | null }) {
  // (kept for potential future use; UnifiedSectionFooter is the new path)
  const { t } = useTranslation("assessment");
  if (analysing) {
    return (
      <div className="body-prose mt-3 flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
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
    <figure className="mt-3 animate-fade-in rounded-md bg-muted/30 px-4 py-3">
      <figcaption className="eyebrow mb-1.5 flex items-center gap-1.5 text-muted-foreground">
        <Sparkles className="h-3 w-3 text-amber-500/80" aria-hidden />
        <span>{t("detail.insight_label")}</span>
      </figcaption>
      <blockquote className="body-prose pl-3 text-[13px] leading-relaxed text-foreground/85">
        {insight}
      </blockquote>
    </figure>
  );
}

function TrainingTierChips({
  years,
  onChange,
}: {
  years: number | null;
  onChange: (years: number | null) => void;
}) {
  const { t } = useTranslation("assessment");
  const active = getTierFromYears(years).id;
  return (
    <div className="flex flex-wrap gap-1.5">
      {TRAINING_TIERS.map((tier) => {
        const selected = active === tier.id;
        return (
          <button
            key={tier.id}
            type="button"
            onClick={() => onChange(tierToYears(tier.id as TrainingTier))}
            aria-pressed={selected}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${tier.chipClass} ${
              selected ? `ring-2 ring-offset-1 ring-offset-background ${tier.ringClass}` : "opacity-70 hover:opacity-100"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${tier.dotClass}`} aria-hidden />
            <span>{t(`history_block.tier.${tier.key}`)}</span>
          </button>
        );
      })}
    </div>
  );
}

function LabelWithHelp({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-center gap-1">
      <Label className="text-xs">{label}</Label>
      {hint && (
        <HelpPopover label={label}>
          <p>{hint}</p>
        </HelpPopover>
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

function Toggle({
  label,
  value,
  onChange,
  icon,
  description,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  icon?: React.ReactNode;
  description?: string;
}) {
  const hasMeta = Boolean(icon || description);
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`flex w-full items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-left text-xs transition ${value ? "border-accent bg-accent/10 text-foreground" : "border-border bg-background hover:bg-secondary"}`}
    >
      {icon ? (
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition ${value ? "bg-accent/20 text-accent-foreground" : "bg-secondary/60 text-muted-foreground"}`}
          aria-hidden
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-medium leading-tight ${hasMeta ? "" : "text-xs"}`}>{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[10.5px] leading-snug text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
      <span className={`ml-1 inline-flex h-4 w-7 shrink-0 items-center rounded-full transition ${value ? "bg-accent" : "bg-secondary"}`}>
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

function ScoreRow({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const current = value ?? "";
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
                onClick={() => onChange(active ? "" : String(n))}
                className={`h-6 w-6 rounded border text-[11px] font-medium transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
              >{n}</button>
            );
          })}
        </div>
      </div>
      {hint ? (
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{hint}</p>
      ) : null}
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
    const diff = lastSavedAt ? Math.max(0, Math.round((Date.now() - lastSavedAt) / 1000)) : null;
    const label =
      diff !== null && diff < 10
        ? t("save.saved_recent")
        : t("save.saved", { when: formatRel(lastSavedAt) });
    return (
      <span className={`${base} text-muted-foreground/70`}>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/60" />
        {label}
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

function CompletionStrip({ text, description }: { text: string; description?: string }) {
  // Strip the leading "✓ " (legacy) — the icon now carries that signal.
  const cleaned = text.replace(/^\s*✓\s*/, "");
  if (description) {
    return (
      <div className="mt-3 flex animate-fade-in items-start gap-3 rounded-xl bg-emerald-500/[0.05] px-3 py-2.5 text-emerald-900/90 dark:text-emerald-100/90">
        <span
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          aria-hidden
        >
          <Check className="h-3 w-3" strokeWidth={2.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[15px] leading-tight tracking-tight"
            style={{ fontFamily: "var(--font-display-v2)", fontWeight: 500 }}
          >
            {cleaned}
          </p>
          <p className="mt-1 text-[12px] leading-snug text-emerald-900/65 dark:text-emerald-100/65">
            {description}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-3 flex animate-fade-in items-center gap-2.5 rounded-full bg-emerald-500/[0.05] py-1 pl-1 pr-3 text-[12px] text-emerald-900/85 dark:text-emerald-100/85">
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
        aria-hidden
      >
        <Check className="h-3 w-3" strokeWidth={2.75} />
      </span>
      <span className="body-prose truncate leading-none tracking-[-0.005em]">{cleaned}</span>
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
    <div className="rounded-2xl bg-muted/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="eyebrow text-muted-foreground">
          {t("detail.snapshot.title")}
        </p>
        <p className="body-data text-[10px] text-muted-foreground">{t("detail.snapshot.last", { when: dateLabel })}</p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="eyebrow text-muted-foreground">{t("detail.snapshot.risk_acsm")}</p>
          <p className={`mt-0.5 text-lg font-light tracking-tight ${riskTone}`}>{riskLabel}</p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            {t(`detail.snapshot.risk_acsm_meaning_${riskCategory}`, { defaultValue: t("detail.snapshot.risk_acsm_help") })}
          </p>
        </div>
        <div>
          <p className="eyebrow text-muted-foreground">{t("detail.snapshot.recovery")}</p>
          <p className="mt-0.5 text-lg font-light tracking-tight">{recovery?.label ?? "—"}</p>
        </div>
        <div>
          <p className="eyebrow text-muted-foreground">{t("detail.snapshot.composition")}</p>
          <p className="mt-0.5 text-lg font-light tabular-nums tracking-tight">{bf} · WHR {whr}</p>
        </div>
      </div>
      {flags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {flags.map((f) => (
            <span key={f} className="rounded-full bg-muted/70 px-2 py-0.5 text-[10px] text-muted-foreground">
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

// ----------------------------------------------------------------------------
// RxImplications — deterministic "what this means for the prescription" panel.
// Lives inside multiple assessment sections. Pure derivation from the inputs
// the trainer just filled in. No AI. Each section has its own buildItems_*
// function so the panel surfaces 1–4 actionable programming constraints per
// section. Same visual shell across sections (eyebrow header + tonal cards).
// ----------------------------------------------------------------------------
type RxItem = {
  key: string;
  tone: "danger" | "warn" | "info" | "neutral";
  icon: React.ReactNode;
  title: string;
  body: string;
};

function buildRxItems_risk(a: any, category: string): RxItem[] {
  const risk = a?.risk ?? {};
  const parqFlags = parqFlagCount(a?.parq ?? {});
  const items: RxItem[] = [];
  if (parqFlags > 0 || category === "high") {
    items.push({
      key: "clearance",
      tone: "danger",
      icon: <Shield className="h-3.5 w-3.5" />,
      title: "Clearance médico antes de subir intensidade",
      body:
        parqFlags > 0
          ? `${parqFlags} alerta${parqFlags === 1 ? "" : "s"} no PAR-Q+ — pedir parecer médico antes de prescrever esforço moderado/vigoroso.`
          : "Risco ACSM alto — requer parecer médico antes de progressões vigorosas.",
    });
  }
  if (category === "high") {
    items.push({
      key: "intensity-high",
      tone: "warn",
      icon: <Activity className="h-3.5 w-3.5" />,
      title: "Tecto de intensidade: RPE ≤ 7",
      body: "Manter zona moderada (≈40–60% HRR ou RPE 4–6/10). Evitar 1RM e séries até à falha.",
    });
  } else if (category === "moderate") {
    items.push({
      key: "intensity-mod",
      tone: "info",
      icon: <Activity className="h-3.5 w-3.5" />,
      title: "Tecto de intensidade: RPE ≤ 8",
      body: "Permitido moderado-a-vigoroso (≈40–75% HRR). Subir vigoroso só após 2–4 semanas com tolerância.",
    });
  }
  if (risk.hypertension || risk.family_cvd || risk.dyslipidemia) {
    const drivers = [
      risk.hypertension ? "hipertensão" : null,
      risk.family_cvd ? "história familiar" : null,
      risk.dyslipidemia ? "dislipidemia" : null,
    ].filter(Boolean).join(", ");
    items.push({
      key: "cv-monitor",
      tone: "warn",
      icon: <HeartPulse className="h-3.5 w-3.5" />,
      title: "Monitorização cardiovascular",
      body: `Por ${drivers}: medir TA pré-sessão, evitar Valsalva pesado, parar ao menor sinal de dor torácica, dispneia desproporcional ou tonturas.`,
    });
  }
  if (risk.prediabetes) {
    items.push({
      key: "glyc",
      tone: "info",
      icon: <Droplets className="h-3.5 w-3.5" />,
      title: "Janela glicémica",
      body: "Treinar 1–2h após refeição. Ter HC rápido disponível. Cardio steady-state pós-treino aumenta sensibilidade à insulina.",
    });
  }
  if (risk.bmi_category === "obese") {
    items.push({
      key: "load-obese",
      tone: "info",
      icon: <Gauge className="h-3.5 w-3.5" />,
      title: "Carga axial e impacto",
      body: "Reduzir agachamento/peso morto pesados nas 1ªs 4 semanas. Preferir variantes apoiadas (hack, leg press) e cardio low-impact (bike, elíptica, água).",
    });
  } else if (risk.bmi_category === "underweight") {
    items.push({
      key: "load-under",
      tone: "info",
      icon: <Gauge className="h-3.5 w-3.5" />,
      title: "Disponibilidade energética",
      body: "Volume conservador até resolver défice calórico. Confirmar ingestão proteica ≥1,6 g/kg antes de subir frequência.",
    });
  }
  if (risk.smoking === "current") {
    items.push({
      key: "smoke",
      tone: "info",
      icon: <Wind className="h-3.5 w-3.5" />,
      title: "Capacidade aeróbia reduzida",
      body: "Esperar VO₂máx ~10–15% abaixo do não-fumador. Recuperação inter-séries +30–60s no condicionamento.",
    });
  }
  if (risk.sedentary && category !== "low") {
    items.push({
      key: "sed",
      tone: "neutral",
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      title: "Reactivação progressiva",
      body: "Começar 2×/sem corpo inteiro, 4–6 semanas em RPE 5–6, antes de introduzir intensidade ou volume adicional.",
    });
  }
  if (items.length === 0) {
    items.push({
      key: "clear",
      tone: "neutral",
      icon: <Check className="h-3.5 w-3.5" />,
      title: "Sem condicionantes adicionais",
      body: "Prescrição livre dentro da régua ACSM para risco baixo. Avançar direto para os parâmetros de programação.",
    });
  }
  return items;
}

function buildRxItems_parq(a: any): RxItem[] {
  const parq = a?.parq ?? {};
  const flags = PARQ_KEYS.filter((k) => parq[k] === true);
  if (flags.length === 0) {
    return [{
      key: "clear",
      tone: "neutral",
      icon: <Check className="h-3.5 w-3.5" />,
      title: "Sem bandeiras vermelhas",
      body: "Pode avançar para a estratificação de risco e programação dentro da régua normal.",
    }];
  }
  // Group flagged questions by rationale category for compact rules.
  const cats = new Set(flags.map((k) => PARQ_RATIONALE_KEY[k]));
  const items: RxItem[] = [];
  items.push({
    key: "clearance",
    tone: "danger",
    icon: <Shield className="h-3.5 w-3.5" />,
    title: `${flags.length} alerta${flags.length === 1 ? "" : "s"} — clearance médico antes de progredir`,
    body: "Não prescrever esforço moderado/vigoroso sem parecer médico. O PDF inclui disclaimer de revisão.",
  });
  if (cats.has("cardio")) items.push({
    key: "cardio",
    tone: "warn",
    icon: <HeartPulse className="h-3.5 w-3.5" />,
    title: "Tecto cardiovascular",
    body: "Limitar a RPE ≤ 6 e zona aeróbia (40–60% HRR). Evitar Valsalva, parar ao menor sinal de dor torácica ou dispneia desproporcional.",
  });
  if (cats.has("balance")) items.push({
    key: "balance",
    tone: "warn",
    icon: <Activity className="h-3.5 w-3.5" />,
    title: "Equilíbrio comprometido",
    body: "Sem overhead com pesos livres nem unipodal sem apoio. Preferir máquinas, cabos e variantes assistidas até validação.",
  });
  if (cats.has("msk")) items.push({
    key: "msk",
    tone: "info",
    icon: <Gauge className="h-3.5 w-3.5" />,
    title: "Carga e impacto controlados",
    body: "Excluir saltos, sprint e cargas máximas. Programa mobility-first nas primeiras 2–4 semanas e progressões em micro-incrementos.",
  });
  if (cats.has("manual")) items.push({
    key: "manual",
    tone: "info",
    icon: <Info className="h-3.5 w-3.5" />,
    title: "Anotar contexto em medicação",
    body: "Detalhar a razão do alerta no bloco de medicação para informar a estratificação ACSM e o plano.",
  });
  return items;
}

function buildRxItems_training(a: any): RxItem[] {
  const items: RxItem[] = [];
  const days = Number(a?.training_days_per_week);
  const dur = Number(a?.session_duration_minutes);
  const exp = String(a?.experience_level ?? "");
  const eq: string[] = a?.available_equipment ?? [];
  const cap = Number(a?.current_capacity_vs_pb);

  if (Number.isFinite(days) && days > 0) {
    items.push({
      key: "freq",
      tone: "info",
      icon: <Activity className="h-3.5 w-3.5" />,
      title: `Frequência fixa: ${days}×/sem · ${Number.isFinite(dur) && dur > 0 ? `${dur} min` : "duração livre"}`,
      body: days <= 2
        ? "Dois treinos = corpo inteiro com padrões compostos. Não cabe split — priorizar dose mínima eficaz."
        : days === 3
        ? "Três treinos = full-body alternado ou Upper/Lower/Full. Boa dose para hipertrofia/força gerais."
        : days >= 4
        ? "Quatro ou mais = abre split (Upper/Lower, Push/Pull/Legs ou Bro). Atenção a volume semanal por grupo (10–20 séries efetivas)."
        : "Setup definido — geração respeitará dias e duração.",
    });
  }
  if (exp === "beginner") {
    items.push({
      key: "tier",
      tone: "info",
      icon: <Sparkles className="h-3.5 w-3.5" />,
      title: "Tier iniciante: linear progression",
      body: "Padrões compostos 2–3×/sem, 3 séries × 8–12 reps, +2,5 kg/semana. Sem RPE ainda — só técnica e consistência.",
    });
  } else if (exp === "advanced") {
    items.push({
      key: "tier",
      tone: "info",
      icon: <Sparkles className="h-3.5 w-3.5" />,
      title: "Tier avançado: blocos ondulados",
      body: "Acumulação → intensificação → realização (Bompa). RPE 6–9, deload obrigatório a cada 4 semanas. Especialização possível.",
    });
  }
  if (Number.isFinite(cap) && cap <= 4) {
    items.push({
      key: "rebuild",
      tone: "warn",
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      title: "Modo reconstrução",
      body: "Bem abaixo do pico — arrancar com 60–70% das cargas estimadas, RPE 5–7. Reintroduzir intensidade só após 3–4 semanas com adesão ≥80%.",
    });
  }
  if (eq.length > 0 && eq.length <= 2) {
    items.push({
      key: "eq",
      tone: "info",
      icon: <Gauge className="h-3.5 w-3.5" />,
      title: "Equipamento limitado",
      body: "Pool restrito de exercícios. Vamos compensar com unilaterais, tempo sob tensão e variantes de amplitude. Priorizar transferências para padrões base.",
    });
  }
  if (a?.injuries && String(a.injuries).trim().length > 4) {
    items.push({
      key: "inj",
      tone: "warn",
      icon: <Shield className="h-3.5 w-3.5" />,
      title: "Restrições por lesão",
      body: "Substituições e ROM limitado registados. Verificar compatibilidade ao gerar — qualquer exercício contraindicado deve sair do pool.",
    });
  }
  if (items.length === 0) {
    items.push({
      key: "clear",
      tone: "neutral",
      icon: <Check className="h-3.5 w-3.5" />,
      title: "Setup neutro",
      body: "Sem restrições especiais — geração livre dentro do pool padrão.",
    });
  }
  return items;
}

function buildRxItems_goal(a: any): RxItem[] {
  const goal = String(a?.primary_goal ?? "").toLowerCase();
  const items: RxItem[] = [];
  if (goal.includes("hipertrofia") || goal.includes("massa") || goal.includes("hypertrophy") || goal.includes("muscle")) {
    items.push({
      key: "preset",
      tone: "info",
      icon: <Sparkles className="h-3.5 w-3.5" />,
      title: "Preset: Hypertrophy classic",
      body: "10–20 séries efetivas/grupo, 6–15 reps, RPE 7–9, descansos 60–120s. Volume é o driver — manter superávit calórico leve.",
    });
  } else if (goal.includes("força") || goal.includes("forca") || goal.includes("strength")) {
    items.push({
      key: "preset",
      tone: "info",
      icon: <Sparkles className="h-3.5 w-3.5" />,
      title: "Preset: Strength base",
      body: "Compostos 3–5×/sem, 3–6 reps, 75–90% 1RM, RPE 7–8, descansos 2–4 min. Wave model com deload a cada 4 semanas.",
    });
  } else if (goal.includes("perda") || goal.includes("gordura") || goal.includes("recomp") || goal.includes("loss") || goal.includes("fat")) {
    items.push({
      key: "preset",
      tone: "info",
      icon: <Sparkles className="h-3.5 w-3.5" />,
      title: "Preset: Moderate recomp",
      body: "Manter força (compostos 4–8 reps) + densidade (circuitos/supersets) + cardio NEAT. Défice calórico moderado (10–15%), proteína ≥1,8 g/kg.",
    });
  } else if (goal.includes("saúde") || goal.includes("saude") || goal.includes("health") || goal.includes("bem-estar")) {
    items.push({
      key: "preset",
      tone: "info",
      icon: <Sparkles className="h-3.5 w-3.5" />,
      title: "Preset: Conservative health",
      body: "Full-body 2–3×/sem, RPE 5–7, padrões funcionais + condicionamento aeróbio (zona 2). Sem urgência de hipertrofia ou força máxima.",
    });
  } else if (goal) {
    items.push({
      key: "preset",
      tone: "neutral",
      icon: <Sparkles className="h-3.5 w-3.5" />,
      title: "Driver definido",
      body: "Vamos calibrar volume/intensidade/densidade conforme o objetivo registado. Reveja o preset no Intensity Cockpit antes de finalizar.",
    });
  }
  if (a?.smart_deadline) {
    const d = new Date(a.smart_deadline);
    const weeks = Math.max(1, Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7)));
    // Block-aware horizon: 1 bloco ≈ 6 semanas (NSCA mesocycle convention).
    let title: string;
    let body: string;
    let tone: RxItem["tone"];
    if (weeks <= 6) {
      tone = "warn";
      title = `Horizonte ~${weeks} sem · ≈ 1 bloco`;
      body = "Janela curta — só dá para 1 microcycle + 1 mesocycle. Priorizar 1–2 KPIs e gerir expectativas; ganhos visíveis serão modestos.";
    } else if (weeks <= 10) {
      tone = "info";
      title = `Horizonte ~${weeks} sem · ≈ 2 blocos`;
      body = "Espaço para 2 blocos com deload entre eles. Reavaliar e ajustar foco a meio (~sem 5).";
    } else if (weeks <= 16) {
      tone = "info";
      title = `Horizonte ~${weeks} sem · ≈ 2–3 blocos`;
      body = "Janela típica de programação. 2–3 blocos com checkpoints a cada 4–6 semanas; espaço para uma onda de carga + descarga.";
    } else {
      tone = "info";
      title = `Horizonte ~${weeks} sem · ≈ 3–4 blocos`;
      body = "Horizonte longo. Planear 3–4 blocos com mudança de ênfase entre eles (acumulação → intensificação → realização) e checkpoints mensais.";
    }
    items.push({
      key: "horizon",
      tone,
      icon: <CalendarIcon className="h-3.5 w-3.5" />,
      title,
      body,
    });
  }
  if (items.length === 0) {
    items.push({
      key: "clear",
      tone: "neutral",
      icon: <Info className="h-3.5 w-3.5" />,
      title: "Falta driver primário",
      body: "Sem driver definido o plano sai genérico. Preencha o objetivo SMART para ativar o preset adequado.",
    });
  }
  return items;
}

function buildRxItems_anthro(a: any, riskCategory: string): RxItem[] {
  const items: RxItem[] = [];
  const waist = Number(a?.waist_cm);
  const hip = Number(a?.hip_cm);
  const whr = Number.isFinite(waist) && Number.isFinite(hip) && hip > 0 ? waist / hip : null;
  const cat = a?.risk?.bmi_category;

  if (whr != null && whr >= 0.95) {
    items.push({
      key: "whr",
      tone: "warn",
      icon: <HeartPulse className="h-3.5 w-3.5" />,
      title: `WHR elevado (${whr.toFixed(2)}) — risco abdominal`,
      body: "Adiposidade central correlaciona com risco cardiometabólico. Reforça o caso para cardio steady-state e défice calórico moderado.",
    });
  } else if (whr != null && whr >= 0.85) {
    items.push({
      key: "whr",
      tone: "info",
      icon: <Gauge className="h-3.5 w-3.5" />,
      title: `WHR a vigiar (${whr.toFixed(2)})`,
      body: "Acima do limiar saudável (♂ 0,90 · ♀ 0,85). Incluir cardio Z2 30–45 min × 3/sem para acelerar mobilização visceral.",
    });
  }
  if (cat === "obese") {
    items.push({
      key: "load",
      tone: "info",
      icon: <Gauge className="h-3.5 w-3.5" />,
      title: "Cardio low-impact + carga apoiada",
      body: "Bike, elíptica, remo ou água. Squat/DL pesado entra só após 4 semanas de tolerância. Priorizar máquinas e variantes assistidas.",
    });
  } else if (cat === "underweight") {
    items.push({
      key: "load",
      tone: "info",
      icon: <Gauge className="h-3.5 w-3.5" />,
      title: "Volume conservador",
      body: "Confirmar superávit calórico e proteína ≥1,6 g/kg antes de subir frequência. Foco em compostos pesados, baixa densidade.",
    });
  }
  if (a?.body_fat_pct && Number(a.body_fat_pct) > 0) {
    items.push({
      key: "bf",
      tone: "neutral",
      icon: <Gauge className="h-3.5 w-3.5" />,
      title: "Linha de base de %MG registada",
      body: `Usar o mesmo método (${a.body_fat_method ?? "—"}) ao longo do tempo. Reavaliar a cada 4–6 semanas para validar trajetória.`,
    });
  }
  if (items.length === 0) {
    items.push({
      key: "clear",
      tone: "neutral",
      icon: <Check className="h-3.5 w-3.5" />,
      title: "Antropometria sem alarmes",
      body: "Composição dentro da régua. Programação livre quanto a carga axial e cardio.",
    });
  }
  return items;
}

function buildRxItems_readiness(a: any): RxItem[] {
  const stage = String(a?.readiness_stage ?? "");
  switch (stage) {
    case "precontemplation":
      return [{
        key: "tone",
        tone: "warn",
        icon: <Brain className="h-3.5 w-3.5" />,
        title: "Estágio motivacional, não programático",
        body: "Não prescrever programa estruturado. Foco em educação, entrevista motivacional e identificar barreiras antes de comprometer dias/semana.",
      }];
    case "contemplation":
      return [{
        key: "tone",
        tone: "info",
        icon: <Brain className="h-3.5 w-3.5" />,
        title: "Wins de baixa fricção",
        body: "2 sessões/semana de 30 min, padrões simples, vitórias rápidas. Construir hábito antes de subir volume ou complexidade.",
      }];
    case "preparation":
      return [{
        key: "tone",
        tone: "info",
        icon: <Brain className="h-3.5 w-3.5" />,
        title: "Onboarding estruturado",
        body: "3 sessões/semana, full-body, técnica antes de carga. Primeiras 4 semanas como microciclo de adaptação.",
      }];
    case "action":
      return [{
        key: "tone",
        tone: "info",
        icon: <Activity className="h-3.5 w-3.5" />,
        title: "Reforço de hábito",
        body: "Manter 3–4 sessões consistentes. Checkpoints semanais (adesão, RPE) e progressão linear até 6 meses.",
      }];
    case "maintenance":
      return [{
        key: "tone",
        tone: "neutral",
        icon: <Sparkles className="h-3.5 w-3.5" />,
        title: "Modo progressão",
        body: "Hábito instalado — pode prescrever blocos ondulados, especialização e introduzir variabilidade. Risco de tédio: rotacionar exercícios a cada bloco.",
      }];
    default:
      return [{
        key: "clear",
        tone: "neutral",
        icon: <Info className="h-3.5 w-3.5" />,
        title: "Estágio por definir",
        body: "Sem estágio definido o tom da prescrição fica neutro. Selecione um para calibrar pacing das primeiras semanas.",
      }];
  }
}

function buildRxItems_lifestyle(a: any): RxItem[] {
  const items: RxItem[] = [];
  const sleep = Number(a?.sleep_quality);
  const stress = Number(a?.stress_level);
  const seated = Number(a?.ext_hours_seated);
  const steps = Number(a?.ext_daily_steps);

  if (Number.isFinite(sleep) && sleep <= 4) {
    items.push({
      key: "sleep",
      tone: "warn",
      icon: <Brain className="h-3.5 w-3.5" />,
      title: `Sono mau (${sleep}/10)`,
      body: "Sono <6h prediz pior recuperação e +20% risco lesão. Subir autoreg para strict, baixar volume 10–15% e priorizar sono antes de intensidade.",
    });
  }
  if (Number.isFinite(stress) && stress >= 7) {
    items.push({
      key: "stress",
      tone: "warn",
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      title: `Stress alto (${stress}/10)`,
      body: "Cortisol crónico compromete recuperação e adesão. Capar RPE em 8, deload mais frequente (a cada 3 sem) e incluir cardio Z2 como regulador.",
    });
  }
  if (Number.isFinite(seated) && seated >= 8) {
    items.push({
      key: "seated",
      tone: "info",
      icon: <Activity className="h-3.5 w-3.5" />,
      title: "Trabalho sentado prolongado",
      body: "Adicionar mobilidade de anca/torácica no aquecimento (5 min) e micro-pausas. Cuidado com flexores de anca encurtados em hinges.",
    });
  }
  if (Number.isFinite(steps) && steps < 5000) {
    items.push({
      key: "neat",
      tone: "info",
      icon: <Activity className="h-3.5 w-3.5" />,
      title: "NEAT baixo (<5k passos)",
      body: "Subir gasto não-treino antes de adicionar cardio formal. Meta inicial: +2k passos/dia × 2 sem.",
    });
  }
  if (items.length === 0) {
    items.push({
      key: "clear",
      tone: "neutral",
      icon: <Check className="h-3.5 w-3.5" />,
      title: "Estilo de vida favorável à recuperação",
      body: "Sem flags de sono/stress/sedentarismo. Pode programar com autoreg suggested e deload padrão (4 sem).",
    });
  }
  return items;
}

function buildRxItems_nutrition(a: any): RxItem[] {
  const items: RxItem[] = [];
  const meals = Number(a?.ext_meals_per_day);
  const alcohol = Number(a?.ext_alcohol_units_week);
  const water = Number(a?.ext_water_l_per_day);

  if (Number.isFinite(meals) && meals <= 2) {
    items.push({
      key: "meals",
      tone: "warn",
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      title: "Janela alimentar reduzida",
      body: "Difícil atingir 1,6–2,2 g/kg de proteína em 2 refeições. Sugerir +1 snack proteico ou shake pós-treino antes de subir volume.",
    });
  }
  if (Number.isFinite(alcohol) && alcohol >= 11) {
    items.push({
      key: "alcohol",
      tone: "warn",
      icon: <Droplet className="h-3.5 w-3.5" />,
      title: `Álcool elevado (~${alcohol} u/sem)`,
      body: "Acima de 14 u/sem corta síntese proteica e qualidade do sono. Esperar adaptação 30–40% mais lenta. Conversa de redução antes de prometer resultados.",
    });
  }
  if (Number.isFinite(water) && water > 0 && water < 1.5) {
    items.push({
      key: "water",
      tone: "info",
      icon: <Droplets className="h-3.5 w-3.5" />,
      title: "Hidratação abaixo do mínimo",
      body: "ACSM: 30–40 ml/kg/dia. Desidratação >2% baixa força ~5% e cognição. Meta inicial: 2 L/dia + sal nas sessões longas.",
    });
  }
  if (items.length === 0) {
    items.push({
      key: "clear",
      tone: "neutral",
      icon: <Check className="h-3.5 w-3.5" />,
      title: "Nutrição não bloqueia adaptação",
      body: "Sem flags óbvias de disponibilidade energética. Reavaliar caso resultados estagnem 4+ semanas.",
    });
  }
  return items;
}

function buildRxItems_screen(a: any): RxItem[] {
  const items: RxItem[] = [];
  const weak: string[] = [];
  const skipped: string[] = [];
  PATTERN_IDS.forEach((p) => {
    if (a?.screen_not_assessed?.[p]) { skipped.push(p); return; }
    const fc = a?.[`${p}_form_criteria`];
    const score = fc ? formScore(fc) : 0;
    if (score > 0 && score < 3) weak.push(p);
  });
  if (weak.length > 0) {
    items.push({
      key: "weak",
      tone: "warn",
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      title: `${weak.length} padr${weak.length === 1 ? "ão" : "ões"} a regredir`,
      body: `${weak.join(", ").toUpperCase()}: começar com variantes regredidas (apoiadas, amplitude parcial) e drills de competência. Sem progressão de carga até score ≥3.`,
    });
  }
  if (skipped.length > 0) {
    items.push({
      key: "skipped",
      tone: "info",
      icon: <Info className="h-3.5 w-3.5" />,
      title: `${skipped.length} não avaliad${skipped.length === 1 ? "o" : "os"}`,
      body: "Incluir só com cautela. Avaliar na 1ª sessão antes de progredir carga.",
    });
  }
  if (items.length === 0) {
    items.push({
      key: "clear",
      tone: "neutral",
      icon: <Check className="h-3.5 w-3.5" />,
      title: "Todos os padrões cleared",
      body: "Pode progredir cargas em todos os movimentos compostos sem restrições de competência motora.",
    });
  }
  return items;
}

function buildRxItems_performance(a: any): RxItem[] {
  const items: RxItem[] = [];
  const rhr = Number(a?.resting_heart_rate);
  const test = String(a?.ext_cardio_test ?? "");

  if (Number.isFinite(rhr) && rhr > 80) {
    items.push({
      key: "rhr-high",
      tone: "warn",
      icon: <HeartPulse className="h-3.5 w-3.5" />,
      title: `FC repouso elevada (${rhr} bpm)`,
      body: "Indicador de baixa base aeróbia ou stress acumulado. Tier remedial: 2–3× cardio Z2 (zona 2) por semana antes de progredir intensidade.",
    });
  } else if (Number.isFinite(rhr) && rhr < 55) {
    items.push({
      key: "rhr-low",
      tone: "info",
      icon: <HeartPulse className="h-3.5 w-3.5" />,
      title: `Boa base aeróbia (FC ${rhr} bpm)`,
      body: "Tier advanced: pode prescrever HIIT/intervalados desde a primeira semana. Manter Z2 como recuperação ativa.",
    });
  }
  if (test === "untested" || !test) {
    items.push({
      key: "untested",
      tone: "info",
      icon: <Info className="h-3.5 w-3.5" />,
      title: "Sem teste cardio",
      body: "Estimar zonas pela fórmula 220 − idade ± 10 bpm. Marcar Cooper ou Rockport nas primeiras 2 semanas para zonas reais.",
    });
  } else if (test) {
    items.push({
      key: "test",
      tone: "neutral",
      icon: <Activity className="h-3.5 w-3.5" />,
      title: "Teste cardio registado",
      body: "Zonas-alvo derivadas do resultado. Reavaliar no fim de cada bloco (4–6 sem) para confirmar adaptação.",
    });
  }
  if (items.length === 0) {
    items.push({
      key: "clear",
      tone: "neutral",
      icon: <Check className="h-3.5 w-3.5" />,
      title: "Performance neutra",
      body: "Programação cardio dentro da régua padrão.",
    });
  }
  return items;
}

function RxImplications({
  sectionId,
  assessment,
  riskCategory,
  collapsible = false,
  riskChip,
  extra,
  summary,
  summaryDescription,
  insight,
  insightLoading = false,
}: {
  sectionId: "risk" | "parq" | "training" | "goal" | "anthro" | "readiness" | "lifestyle" | "nutrition" | "screen" | "performance";
  assessment: any;
  riskCategory: string;
  collapsible?: boolean;
  riskChip?: { level: string; tone: string };
  extra?: React.ReactNode;
  /** Section completion summary (was rendered separately as CompletionStrip). */
  summary?: string;
  summaryDescription?: string;
  /** Per-section AI insight (was rendered separately as SectionAnalysisCard). */
  insight?: string | null;
  insightLoading?: boolean;
}) {
  const items: RxItem[] = (() => {
    switch (sectionId) {
      case "risk": return buildRxItems_risk(assessment, riskCategory);
      case "parq": return buildRxItems_parq(assessment);
      case "training": return buildRxItems_training(assessment);
      case "goal": return buildRxItems_goal(assessment);
      case "anthro": return buildRxItems_anthro(assessment, riskCategory);
      case "readiness": return buildRxItems_readiness(assessment);
      case "lifestyle": return buildRxItems_lifestyle(assessment);
      case "nutrition": return buildRxItems_nutrition(assessment);
      case "screen": return buildRxItems_screen(assessment);
      case "performance": return buildRxItems_performance(assessment);
      default: return [];
    }
  })();

  const TONE: Record<RxItem["tone"], { wrap: string; icon: string; title: string }> = {
    danger: {
      wrap: "border-red-500/25 bg-red-500/[0.04]",
      icon: "bg-red-500/15 text-red-700 dark:text-red-300",
      title: "text-red-800 dark:text-red-200",
    },
    warn: {
      wrap: "border-amber-500/25 bg-amber-500/[0.04]",
      icon: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
      title: "text-amber-800 dark:text-amber-200",
    },
    info: {
      wrap: "border-sky-500/20 bg-sky-500/[0.04]",
      icon: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
      title: "text-foreground",
    },
    neutral: {
      wrap: "border-border bg-background/40",
      icon: "bg-muted/60 text-muted-foreground",
      title: "text-foreground",
    },
  };

  const cards = (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {items.map((it) => {
        const tone = TONE[it.tone];
        return (
          <li
            key={it.key}
            className={`flex items-start gap-2.5 rounded-md border px-2.5 py-2 ${tone.wrap}`}
          >
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${tone.icon}`}
              aria-hidden
            >
              {it.icon}
            </span>
            <div className="min-w-0">
              <div className={`text-[12px] font-medium leading-tight ${tone.title}`}>{it.title}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{it.body}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );

  // Top strip (was CompletionStrip) — folded inside the same panel so the
  // section ends with ONE titled card (not 3 stacked).
  const summaryStrip = summary ? (
    <div className="flex items-start gap-2.5 rounded-md bg-emerald-500/[0.06] px-2.5 py-2 text-emerald-900/90 dark:text-emerald-100/90">
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
        aria-hidden
      >
        <Check className="h-3 w-3" strokeWidth={2.75} />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-medium leading-tight">{summary.replace(/^\s*✓\s*/, "")}</p>
        {summaryDescription && (
          <p className="mt-0.5 text-[11px] leading-snug text-emerald-900/65 dark:text-emerald-100/65">
            {summaryDescription}
          </p>
        )}
      </div>
    </div>
  ) : null;

  // Insight (was SectionAnalysisCard) — second in gravity order.
  const insightStrip = insightLoading ? (
    <div className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>A analisar…</span>
    </div>
  ) : insight && insight.trim() ? (
    <figure className="rounded-md bg-muted/30 px-3 py-2">
      <figcaption className="eyebrow mb-1 flex items-center gap-1.5 text-muted-foreground">
        <Sparkles className="h-3 w-3 text-amber-500/80" aria-hidden />
        <span>Insight</span>
      </figcaption>
      <blockquote className="text-[12px] leading-relaxed text-foreground/85">{insight}</blockquote>
    </figure>
  ) : null;

  if (collapsible) {
    const chipTone =
      riskChip?.tone === "high"
        ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
        : riskChip?.tone === "moderate"
          ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    return (
      <details className="group mt-4 rounded-lg border border-border/60 bg-background/30">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
          <h4 className="eyebrow text-foreground/80">Implicações para a prescrição</h4>
          {riskChip && (
            <span className={`rounded-full border px-1.5 py-[1px] text-[10px] font-medium uppercase tracking-wider ${chipTone}`}>
              ACSM: {riskChip.level}
            </span>
          )}
          <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
            {items.length} {items.length === 1 ? "regra" : "regras"}
          </span>
        </summary>
        <div className="space-y-2 px-3 pb-3 pt-1">
          {summaryStrip}
          {insightStrip}
          {cards}
          {extra}
        </div>
      </details>
    );
  }

  return (
    <section className="mt-4 space-y-2">
      <header className="flex items-baseline justify-between">
        <h4 className="eyebrow text-foreground/80">Implicações para a prescrição</h4>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {items.length} {items.length === 1 ? "regra" : "regras"}
        </span>
      </header>
      {summaryStrip}
      {insightStrip}
      {cards}
    </section>
  );
}
