// ============================================================================
// Audit logger — single entry point for writing to audit_events.
//
// All domain-level events (plan_generated, plan_approved, screening_completed,
// session_logged, block_advanced, engine_overridden, risk_band_changed) MUST
// flow through here so the append-only invariant and engine_versions stamp
// stay consistent.
//
// Server-only. Uses supabaseAdmin so the call works from contexts where the
// user's RLS role would otherwise block the insert (e.g. trigger-style flows
// that run after a transactional write completes).
// ============================================================================
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { EngineVersion } from "@/domain/ports";

export type AuditEventType =
  | "plan_generated"
  | "plan_approved"
  | "plan_archived"
  | "screening_completed"
  | "session_logged"
  | "block_advanced"
  | "engine_overridden"
  | "risk_band_changed"
  | "next_block_proposed";

export type AuditEntityType =
  | "plan"
  | "client"
  | "assessment"
  | "screening"
  | "session"
  | "block";

export interface AuditEventInput {
  trainerId: string;
  actorId?: string | null;
  eventType: AuditEventType;
  entityType: AuditEntityType;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  engineVersions?: Record<string, EngineVersion | string>;
  upstreamHash?: string | null;
}

/**
 * Write a single audit event. Never throws to the caller — audit failures
 * are observability bugs, not domain failures, so we log and swallow.
 * The append-only trigger guarantees nobody can rewrite history later.
 */
export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    const row = {
      trainer_id: input.trainerId,
      actor_id: input.actorId ?? null,
      event_type: input.eventType,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      payload: (input.payload ?? {}) as Record<string, unknown>,
      engine_versions: (input.engineVersions ?? {}) as Record<string, unknown>,
      upstream_hash: input.upstreamHash ?? null,
    };
    const { error } = await supabaseAdmin.from("audit_events").insert(row as never);
    if (error) {
      console.error("[audit] insert failed", {
        eventType: input.eventType,
        entityType: input.entityType,
        entityId: input.entityId,
        error: error.message,
      });
    }
  } catch (err) {
    console.error("[audit] unexpected throw", err);
  }
}