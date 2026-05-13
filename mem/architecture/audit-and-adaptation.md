---
name: Audit log + adaptation engine v1
description: audit_events append-only table, screening_evaluations immutable history, logAuditEvent helper, and the deterministic adaptation engine scaffold (propose-next-block).
type: feature
---
## Tables

- `public.audit_events` — append-only domain log. Columns: `trainer_id`,
  `actor_id`, `event_type`, `entity_type`, `entity_id`, `payload jsonb`,
  `engine_versions jsonb`, `upstream_hash`, `created_at`. RLS: trainers read
  their own. UPDATE/DELETE blocked at trigger level (`audit_events_immutable`).
- `public.screening_evaluations` — immutable PAR-Q+/ePARmed-X+ history.
  Columns: `trainer_id`, `client_id`, `assessment_id`, `protocol`,
  `protocol_version`, `answers jsonb`, `risk_band` (green/yellow/red),
  `intensity_ceiling` (light/moderate/vigorous), `clearance_required`,
  `clearance_reason`, `structured_reasons jsonb`, `raw_detail jsonb`,
  `evaluator_id`. RLS: trainers manage own; clients read own.

## Helpers

- `logAuditEvent` (`src/server/audit/log-event.server.ts`) — single
  entry point for all audit writes. Uses `supabaseAdmin`. Never throws —
  audit failures are observability bugs, not domain failures.
- `AuditEventType` union: `plan_generated | plan_approved | plan_archived |
  screening_completed | session_logged | block_advanced |
  engine_overridden | risk_band_changed | next_block_proposed`.

## Adaptation engine v1 (`src/server/adaptation/`)

- `propose-next-block.server.ts` — implements `AdaptationEngine` port.
  Reads prior plan + workout_sessions, computes adherence, per-pattern
  e1RM delta (Epley over first-vs-last quartile), RPE drift, builds a
  `NextBlockProposal` with deterministic `prescriptionDiff` chips and
  triggers `next_block_proposed` audit event. **No AI calls** — only the
  `transitionPrompt` is meant to be reworded by AI later.
- `propose-next-block.functions.ts` — `proposeNextBlock` server fn,
  trainer-auth gated.
- Engine version: `adaptation-next-block@0.1.0`.

## What's still TODO before this becomes the closed loop

1. `session_set_logs` table for per-set load/RPE/pain. Today the engine
   reads aggregate `workout_sessions.entries` jsonb; pain flag count is
   stubbed to 0.
2. Wire `archivePlanAndStartNextBlock` to call `proposeNextBlock` and pipe
   the proposal into Stage 3 of the new block as input — instead of
   regenerating from scratch.
3. Movement-pattern field on each exercise (today inferred from name
   regex). Replace `inferPattern` once exercises carry canonical patterns.
4. Volume vs MEV/MAV/MRV per muscle group, integrated into the diff.
5. Trainer UI: review-and-approve the proposal before committing.

## Why the table is append-only at trigger level

`audit_events_immutable()` raises on UPDATE/DELETE so even a future
server-fn bug or a stray admin client cannot rewrite history. The table
is the legal record of "what the system decided and when" — ALWAYS treat
it as such.