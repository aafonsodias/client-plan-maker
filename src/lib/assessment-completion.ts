/**
 * Round A — Single source of truth for "what's missing before Conclude".
 *
 * Wraps `isSectionCompleteForPhase()` and emits human-readable missing
 * items with i18n keys + scroll anchors. Both the sidebar and the
 * Conclude CTA must read from this — no separate truth.
 */

import {
  ASSESSMENT_SESSION_SECTION_IDS,
  SELF_INTAKE_SECTION_IDS,
  isSectionCompleteForPhase,
  type AssessmentPhase,
  type AssessmentSectionId,
  type CompletionContext,
} from "@/lib/assessment-phase";

export type MissingItem = {
  sectionId: AssessmentSectionId;
  /** i18n key under `assessment` namespace, e.g. "injuries_block.title". */
  sectionLabelKey: string;
  /** i18n key under `assessment.completion.reasons.*`. */
  reasonKey: string;
  /** DOM id to scroll to (matches the `id` prop on `<SectionBlock />`). */
  scrollAnchor: string;
};

const SECTION_LABEL_KEY: Record<AssessmentSectionId, string> = {
  parq: "parq_block.title",
  risk: "risk_block.title",
  training: "training_block.title",
  injuries: "injuries_block.title",
  history: "history_block.title",
  goal: "goal_block.title",
  meds: "meds_block.title",
  readiness: "readiness_block.title",
  lifestyle: "lifestyle_block.title",
  nutrition: "nutrition_block.title",
  anthro: "anthro_block.title",
  mobility: "mobility_block.title",
  posture: "posture_block.title",
  screen: "screen_block.title",
  performance: "performance_block.title",
};

/** Single-line reason key per section — kept short so the missing
 *  panel is scannable on a 375px viewport. */
const REASON_KEY: Record<AssessmentSectionId, string> = {
  parq: "completion.reasons.parq",
  risk: "completion.reasons.risk",
  training: "completion.reasons.training",
  injuries: "completion.reasons.injuries",
  history: "completion.reasons.history",
  goal: "completion.reasons.goal",
  meds: "completion.reasons.meds",
  readiness: "completion.reasons.readiness",
  lifestyle: "completion.reasons.lifestyle",
  nutrition: "completion.reasons.nutrition",
  anthro: "completion.reasons.anthro",
  mobility: "completion.reasons.mobility",
  posture: "completion.reasons.posture",
  screen: "completion.reasons.screen",
  performance: "completion.reasons.performance",
};

function buildItem(id: AssessmentSectionId): MissingItem {
  return {
    sectionId: id,
    sectionLabelKey: SECTION_LABEL_KEY[id],
    reasonKey: REASON_KEY[id],
    scrollAnchor: id,
  };
}

export type CompletionReport = {
  overall: AssessmentPhase;
  perSection: Record<AssessmentSectionId, boolean>;
  selfIntakeMissing: MissingItem[];
  sessionMissing: MissingItem[];
  /** Convenience: union of both, in the order they appear in the page. */
  missingAll: MissingItem[];
};

export function buildCompletionReport(a: any, ctx: CompletionContext = {}): CompletionReport {
  const perSection: Record<string, boolean> = {};
  for (const id of [...SELF_INTAKE_SECTION_IDS, ...ASSESSMENT_SESSION_SECTION_IDS]) {
    perSection[id] = isSectionCompleteForPhase(id, a, ctx);
  }
  const selfIntakeMissing = SELF_INTAKE_SECTION_IDS.filter((id) => !perSection[id]).map(buildItem);
  const sessionMissing = ASSESSMENT_SESSION_SECTION_IDS.filter((id) => !perSection[id]).map(buildItem);
  const overall: AssessmentPhase = selfIntakeMissing.length > 0
    ? "self_intake_pending"
    : sessionMissing.length > 0
      ? "session_pending"
      : "complete";
  return {
    overall,
    perSection: perSection as Record<AssessmentSectionId, boolean>,
    selfIntakeMissing,
    sessionMissing,
    missingAll: [...selfIntakeMissing, ...sessionMissing],
  };
}