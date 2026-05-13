// ============================================================================
// Engine ports — stable contracts. The product NEVER imports an adapter
// implementation directly. Feature modules name the port; only the
// engine registry resolves port → adapter.
//
// See src/domain/ports/README.md for the rationale (FORGE study §F).
// Every port carries a `version` so every output can be audited later.
// ============================================================================

export type EngineVersion = `${string}@${number}.${number}.${number}`;

/** Cross-port shared shapes. Kept minimal on purpose — domain only. */
export type RiskBand = "green" | "yellow" | "red";
export type Tier = "remedial" | "conservative" | "advanced";
export type Appetite = "conservador" | "padrao" | "agressivo";
export type MovementPattern =
  | "squat"
  | "hinge"
  | "horizontal_push"
  | "horizontal_pull"
  | "vertical_push"
  | "vertical_pull"
  | "lunge"
  | "carry"
  | "rotation"
  | "anti_rotation"
  | "gait";

export interface RpeFloors {
  main: number;
  accessory: number;
  carry: number;
}

// ----------------------------------------------------------------------------
// AiProvider — any LLM that can return structured JSON.
// ----------------------------------------------------------------------------

export interface AiCallOptions<TOutput> {
  /** Stable identifier of the prompt template + version, e.g. "stage3@1.7.2". */
  promptId: string;
  systemPrompt: string;
  userPrompt: string;
  /** Zod schema for output validation; adapter handles retry-with-repair. */
  outputSchema: { parse: (input: unknown) => TOutput };
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AiResult<TOutput> {
  output: TOutput;
  /** Unique model build that produced this output, e.g. "claude-sonnet-4-5@2025-09-01". */
  modelVersion: string;
  costUsd: number;
  latencyMs: number;
  retries: number;
}

export interface AiProvider {
  readonly version: EngineVersion;
  generate<TOutput>(opts: AiCallOptions<TOutput>): Promise<AiResult<TOutput>>;
}

// ----------------------------------------------------------------------------
// ScreeningEvaluator — PAR-Q+ / ePARmed-X+ / future protocols.
// ----------------------------------------------------------------------------

export interface ScreeningInput {
  assessment: Record<string, unknown>;
  signs?: Record<string, boolean | undefined> | null;
  desiredIntensity?: "light" | "moderate" | "vigorous" | "unknown";
}

export interface ScreeningResult {
  riskBand: RiskBand;
  clearanceRequired: boolean;
  clearanceReason: string;
  /** Structured reasons drive UI chips and downstream gates. */
  structuredReasons: string[];
  /** Hard ceiling that the PlanGenerator must respect or log an override for. */
  intensityCeiling: "light" | "moderate" | "vigorous";
  rawDetail: Record<string, unknown>;
}

export interface ScreeningEvaluator {
  readonly version: EngineVersion;
  evaluate(input: ScreeningInput): ScreeningResult;
}

// ----------------------------------------------------------------------------
// PlanGenerator — drafts a periodised plan from assessment + brief.
// ----------------------------------------------------------------------------

export interface PlanInput {
  trainerId: string;
  clientId: string | null;
  assessmentSnapshot: Record<string, unknown>;
  brief: Record<string, unknown>;
  /** Resolved screening result — generator MUST honour ceiling unless override. */
  screening: ScreeningResult;
  durationWeeks: number;
  blockNumber: number;
  /** Override allowed when trainer has logged a justification. */
  intensityOverride?: { reason: string; trainerId: string } | null;
}

export interface PlanDraft {
  /** Persisted plan id once written; null while in flight. */
  planId: string | null;
  weeks: Array<{ weekNumber: number; days: unknown[] }>;
  rationale: RationaleBundle;
  engineVersions: Record<string, EngineVersion>;
}

export interface RationaleBundle {
  /** One chip per major decision: load floor, volume tier, exercise swap. */
  chips: Array<{
    id: string;
    summary: string;
    detail: string;
    refs?: string[];
  }>;
}

export interface PlanGenerator {
  readonly version: EngineVersion;
  generate(input: PlanInput): Promise<PlanDraft>;
  explain(draft: PlanDraft): RationaleBundle;
}

// ----------------------------------------------------------------------------
// ProgressionEngine — week-to-week loads from a logged week.
// Current adapter: src/server/phased/program-next-week.functions.ts
// ----------------------------------------------------------------------------

export interface ProgressionInput {
  planId: string;
  loggedWeek: number;
}

export interface ProgressionOutput {
  nextWeekNumber: number;
  /** True when the engine actually wrote week N+1; false when it bailed (e.g. adherence < 80%). */
  applied: boolean;
  reason?: string;
  loadAdjustments: Array<{
    exerciseSlug: string;
    deltaPct: number;
    reason: string;
  }>;
}

export interface ProgressionEngine {
  readonly version: EngineVersion;
  nextWeek(input: ProgressionInput): Promise<ProgressionOutput>;
}

// ----------------------------------------------------------------------------
// AdaptationEngine — block-to-block proposal from logged data.
// **No adapter yet.** This is the existential MVP build (FORGE §N module 5).
// ----------------------------------------------------------------------------

export interface AdaptationInput {
  trainerId: string;
  clientId: string;
  priorPlanId: string;
}

export interface MovementMetric {
  pattern: MovementPattern;
  e1rmDeltaPct: number;
  rpeDriftPoints: number;
  setsCompletedVsPrescribed: number;
}

export interface NextBlockProposal {
  /** Diff against the prior block, exercise by exercise. */
  prescriptionDiff: Array<{
    exerciseSlug: string;
    loadDeltaPct: number;
    setsDelta: number;
    rpeTarget: number;
    reasonChip: string;
  }>;
  /** Aggregate signals that drove the proposal. */
  metrics: MovementMetric[];
  adherencePct: number;
  painFlagsCount: number;
  recommendDeload: boolean;
  deloadReason?: string;
  /** Free-form summary for client-facing transition copy (AI-written, not engine). */
  transitionPrompt: string;
}

export interface AdaptationEngine {
  readonly version: EngineVersion;
  proposeNextBlock(input: AdaptationInput): Promise<NextBlockProposal>;
}

// ----------------------------------------------------------------------------
// PdfExporter — pure view-model in, bytes out.
// ----------------------------------------------------------------------------

export interface PdfExportInput {
  templateId: string;
  templateVersion: EngineVersion;
  viewModel: unknown;
  locale: "en" | "pt-PT" | "es" | "hi";
}

export interface PdfExportOutput {
  bytes: Uint8Array;
  contentType: "application/pdf";
  templateVersion: EngineVersion;
  hash: string;
}

export interface PdfExporter {
  readonly version: EngineVersion;
  export(input: PdfExportInput): Promise<PdfExportOutput>;
}

// ----------------------------------------------------------------------------
// MediaProvider — resolves opaque media references to playable URLs.
// ----------------------------------------------------------------------------

export interface MediaRef {
  provider: string;
  externalId: string;
}

export interface MediaResolution {
  url: string;
  expiresAt: Date | null;
  mimeType: string;
}

export interface MediaProvider {
  readonly version: EngineVersion;
  resolve(ref: MediaRef): Promise<MediaResolution>;
}

// ----------------------------------------------------------------------------
// PaymentProvider — checkout, webhooks, subscription state.
// Today: Stripe. Port keeps Stripe primitives out of feature modules.
// ----------------------------------------------------------------------------

export interface CheckoutSessionInput {
  workspaceId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionOutput {
  url: string;
  sessionId: string;
}

export interface SubscriptionState {
  active: boolean;
  currentPeriodEnd: Date | null;
  priceId: string | null;
  status: "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "none";
}

export interface PaymentProvider {
  readonly version: EngineVersion;
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionOutput>;
  getSubscriptionState(workspaceId: string): Promise<SubscriptionState>;
}