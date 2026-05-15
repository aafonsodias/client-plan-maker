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

1. ✅ `session_set_logs` table created (RLS: trainer manage, client read).
   Engine prefers set logs when present, falls back to `entries` jsonb.
   ✅ Writer wired in `saveClientSession` (finalize path): mirrors v2 `sets[]`
   into `session_set_logs` (slug + inferred pattern + prescribed/actual
   load/reps/RPE + pain_flag derived from `felt==='hard' && rpe>=9.5`).
   Idempotent on re-finalize via DELETE-by-session_id.
2. ✅ `archivePlanAndStartNextBlock` calls `proposeNextBlock` and stamps
   the proposal onto `workout_plans.generation_meta.next_block_proposal` +
   `adaptation_engine_version`. ✅ Stage 3 do bloco N+1 lê
   `generation_meta.next_block_proposal` e injecta um bloco "ADAPTATION
   ENGINE — TREAT AS HARD INPUT" no system prompt (per-pattern load/sets/RPE
   nudges + flag de deload). Threaded em `runDay()` e propagado em ambas as
   call sites (`generateMicrocycleDay` + `generateMicrocycleDays` incl. retry
   anti-stale).
3. Movement-pattern field on each exercise (today inferred from name
   regex or read from set log column). Replace `inferPattern` once
   exercises carry canonical patterns.
4. Volume vs MEV/MAV/MRV per muscle group, integrated into the diff.
5. Trainer UI: review-and-approve the proposal before committing.

## R-D restraint refactor (2026-05-14) — implemented

- New tables: `adaptation_proposals` (status pending/decided/expired),
  `adaptation_decisions` (append-only, `rationale` required at DB level),
  `progress_markers` (with `inputs_hash` for reproducibility).
- `archivePlanAndStartNextBlock` no longer generates the next block. It
  archives the prior plan, calls `proposeAndPersist()`, and returns
  `{ proposalId }`. The trainer must call `decideAdaptation` to advance.
- `proposeAndPersist()` in `propose-next-block.server.ts` is the single
  entry point: computes proposal, hashes inputs (sha256 over set-log IDs +
  session dates + engine version), writes the pending proposal row, writes
  per-pattern markers (e1RMDeltaPct, rpeDriftPoints, adherencePct,
  painFlagCount).
- `decideAdaptation` server fn (in `blocks.functions.ts`) accepts kinds:
  `continueAsIs | adjustCurrentSession | adjustUpcoming | defer | accept`.
  Only `accept` and `adjustUpcoming` trigger Block N+1 generation
  (`runDemoPlay` + lineage stamping). All decisions write `block_advanced`
  audit event.

## Still TODO from R-D (queued for next round)

- Reshape Phase 4.1 PDF as `ReportSnapshot` consumer (5 separated buckets:
  facts / client-reported / trainer decisions / engine evidence / uncertainty).
- i18n lint sweep against `mem://principles/restraint-copy.md` forbidden
  phrases ("recomendamos", "carga sugerida", "score de risco", etc.).
- Surface a "Decisões pendentes" list on the trainer dashboard so pending
  `adaptation_proposals` don't get orphaned.

## R-D round-2 (2026-05-15) — landed

- Loader server fn `loadProposal` (`src/server/adaptation/proposal.functions.ts`)
  returns proposal + client + prior plan + per-pattern markers + last decision.
- Trainer review screen at `/clients/$clientId/adaptation/$proposalId`
  (`src/routes/clients_.$clientId.adaptation.$proposalId.tsx`):
  three panels (evidence neutral / engine proposal amber / decision white),
  required rationale, redirects to `/plans/$planId` when accept/adjustUpcoming
  triggers Block N+1 generation.
- Copy contract locked at `mem://principles/restraint-copy.md`.
- Landing PT/EN `landing_v2.value.client.items` last bullet now ends with
  "com a sua aprovação" / "with your approval".

## Why the table is append-only at trigger level

`audit_events_immutable()` raises on UPDATE/DELETE so even a future
server-fn bug or a stray admin client cannot rewrite history. The table
is the legal record of "what the system decided and when" — ALWAYS treat
it as such.