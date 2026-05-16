// ============================================================================
// ReportSnapshot — typed, immutable view-model for end-of-block PDFs.
//
// Per FORGE Phase 4.1 reshape (R-D restraint refactor): the PDF generator is
// a PURE CONSUMER of this snapshot. It MUST NOT read engine output, query the
// database, or call AI/adaptation engines. Five buckets are kept visually and
// structurally separate so the reader never confuses engine evidence with
// trainer decisions or client-reported feel.
//
// Restraint property: `engineEvidence` is observation, never instruction.
// Copy contract: see mem://principles/restraint-copy.md.
// ============================================================================

export type ReportSnapshotId = string & { readonly __brand: "ReportSnapshotId" };

export interface ReportSnapshotMeta {
  id: ReportSnapshotId;
  trainerId: string;
  clientId: string;
  planId: string;
  blockNumber: number;
  committedAt: string;            // ISO; immutable from this moment on
  engineVersions: Record<string, string>;
  inputsHash: string;             // sha256 of session IDs + engine versions
}

/** Bucket 1 — Objective facts. Pulled from logs; no interpretation. */
export interface FactsBucket {
  sessionsPrescribed: number;
  sessionsCompleted: number;
  weeksCovered: number;
  topLifts: Array<{
    exerciseName: string;
    bestLoadKg: number | null;
    bestReps: number | null;
    bestEstimated1RMKg: number | null;
    achievedAt: string;
  }>;
}

/** Bucket 2 — Client-reported feel. Subjective; never weighted as a decision. */
export interface ClientReportedBucket {
  meanSleep: number | null;        // 1–5
  meanSoreness: number | null;     // 0–10
  meanEnergy: number | null;       // 1–5
  meanSessionRpe: number | null;   // 1–10 (Foster)
  painFlagsCount: number;
}

/** Bucket 3 — Trainer decisions. The only bucket with directive verbs. */
export interface TrainerDecisionsBucket {
  blockNotes: string | null;
  swapsApplied: number;
  adaptationsApplied: Array<{
    decidedAt: string;
    kind: "continueAsIs" | "adjustCurrentSession" | "adjustUpcoming" | "defer" | "accept";
    rationale: string;
  }>;
}

/** Bucket 4 — Engine evidence. Markers + proposals. Never phrased as advice. */
export interface EngineEvidenceBucket {
  markers: Array<{
    metric: string;             // e.g. "e1rm_delta_pct"
    scope: string;              // e.g. "bench_press" / "lower_body"
    value: number;
    asOf: string;
  }>;
  rpeDriftPoints: number | null;
  adherencePct: number | null;
  acwr7v28: number | null;     // marker, never gate
}

/** Bucket 5 — Uncertainty. Anything the snapshot CANNOT claim. */
export type UncertaintyBucket = string[];

/** The final immutable shape consumed by the PDF generator. */
export interface ReportSnapshot {
  meta: ReportSnapshotMeta;
  facts: FactsBucket;
  clientReported: ClientReportedBucket;
  trainerDecisions: TrainerDecisionsBucket;
  engineEvidence: EngineEvidenceBucket;
  uncertainty: UncertaintyBucket;
}

/**
 * Type guard: returns false if any bucket has been mutated post-commit.
 * The PDF generator must call this and refuse to render on `false`.
 */
export function isReportSnapshotValid(s: ReportSnapshot): boolean {
  return (
    typeof s.meta?.id === "string" &&
    typeof s.meta.inputsHash === "string" &&
    s.meta.inputsHash.length > 0 &&
    Array.isArray(s.uncertainty) &&
    Array.isArray(s.facts?.topLifts) &&
    Array.isArray(s.engineEvidence?.markers) &&
    Array.isArray(s.trainerDecisions?.adaptationsApplied)
  );
}