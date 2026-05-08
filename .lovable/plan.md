# Journey Map — Client onboarding → Plan generation

End-to-end map of every step the client (and the trainer behind the scenes) goes through, from "trainer creates the client" to "PDF plan ready". For each step: **what happens**, **where it lives in code**, **who acts**, **what state it writes**, and **friction points** to fix.

---

## Phase A — Trainer creates the client (server-side, ~5 sec)

**A1. Trainer hits "New client" on `/dashboard` or `/clients`.**
- Two entry shapes:
  - **Manual** (no link sent): `createManualClient` → `clients` row, `intake_status = "not_sent"`. Trainer plans to fill the assessment themselves.
  - **Invite** (link generated): `createInviteClient` → `clients` row with `full_name = "Convite pendente"`, `intake_token` (UUID, 14-day TTL), `intake_status = "sent"`.
- Code: `src/server/intake.functions.ts` (lines 40–105).
- A separate path `generateIntakeToken` rotates a token for an existing client.

**A2. Trainer copies the link from `IntakeLinkPanel` and sends it manually (WhatsApp/email).**
- Component: `src/components/IntakeLinkPanel.tsx`.
- Friction: there is **no automated email/SMS delivery** — trainer must copy/paste. Status starts at `sent` even before the client opens it.

---

## Phase B — Client opens the intake link (`/intake/$token`)

**B1. Client visits `/intake/$token` (no auth required).**
- `loadIntake({ token })` runs server-side (`intake.functions.ts:129`).
- Validates: token exists, not expired (14 days), not already submitted.
- Side effect: first open flips `intake_status` from `sent` → `opened` (one-time).
- Returns: `{ status, client, trainer (white-label: logo, business_name, primary_color, tagline), assessment }`.
- Renders white-labelled header with the trainer's brand.

**B2. The page itself — wizard with ~19 slides** (`src/routes/intake.$token.tsx`, `buildSlides`):

| # | Slide | Required? | Notes |
|---|-------|-----------|-------|
| 1 | Welcome | — | Hi {name}, ~10 min, autosave |
| 1a | Coaching mode (`self_log` vs `coached`) | yes | drives downstream UX |
| 1b | Identity (name, email, phone, DOB) | yes (name+email) | overwrites placeholder |
| 1c | Profile photo | optional | uploads to private `client-photos` bucket via `uploadIntakePhoto` |
| 2 | SMART goal — what | yes | chip suggestions |
| 3 | SMART goal — measure + deadline | optional | calls `interpretGoal` (Lovable AI) for confirmation chip |
| 4 | Readiness (Prochaska stages) | — | |
| 5 | Experience level | — | |
| 6 | Days/week + session duration | — | |
| 7 | Training location (home/gym/outdoor) | — | |
| 8 | Equipment (multi-select) | — | catalog from `equipment-catalog.ts` |
| 9 | Injuries (free text) | optional | |
| 10 | **PAR-Q+ (7 questions)** | yes | feeds `parq_passed` + ACSM risk |
| 11 | Medications + flags | optional | beta-blockers, BP meds, etc. |
| 12 | Sleep quality (1–10) | — | |
| 13 | Stress (1–10) | — | |
| 14 | Lifestyle (sit hours, steps, job type) | optional | |
| 15 | Nutrition (meals, water, processed, alcohol) | optional | |
| 15a | Reference photos (front/side/back) | optional | private bucket |
| 16 | Review + submit | — | fires `saveIntake({ submit: true })` |

**B3. Autosave.** Every slide change debounces a `saveIntake` call (no `submit`) with `sections` array → marks `extended.provenance[section] = "client"` so trainer-edits don't get overwritten later. Per-field Zod validation in `saveIntake` (lines 273–397).

**B4. Submit.** `intake_status → submitted`, `intake_submitted_at = now()`, face photo signed-URL mirrored to `clients.photo_url` so the trainer roster shows a real face immediately.

**B5. Post-submit — account creation gate.**
- "Create your account" CTA (Google OAuth via `lovable.auth.signInWithOAuth` or email+password via Supabase).
- After signup, `linkClientAccount({ token })` writes `clients.user_id = auth.uid()`, enabling `/me` self-view + `/log/$token`.

### Friction points in Phase B
1. **No "save link to come back" affordance** beyond raw URL — clients on mobile lose the tab.
2. **Identity slide is slide 3** — if the client bails before, the trainer never gets a name.
3. **Goal AI confirmation** is silent on errors; if Lovable AI rate-limits, the chip just disappears.
4. **PAR-Q "yes" answers don't block submission** — trainer must catch high-risk red flags manually.
5. **Photo uploads have no progress indicator** beyond `Loader2`.
6. **Account-creation gate** is post-submit, so a client who closes the tab still counts as "submitted" but never connects to `/me`.

---

## Phase C — Trainer reviews on `/clients/$id`

**C1. Trainer opens `/clients/$id`.**
- Realtime subscribe on the `clients` row → instant flip from "Aguarda submissão" to "Submitted".
- Inline `IntakeLinkPanel` collapses once `intake_status ∈ {opened, submitted, reviewed}`.

**C2. Assessment synthesis (pre-stage).**
- `analyzeAssessmentSection` (per section: parq, smart_goal, training, lifestyle, nutrition) → writes coverage % + gap list to `assessment_section_analyses`.
- Surfaces as a green "Avaliação completa · X%" chip + per-section status dots.
- Code: `src/server/phased/pre-stage.functions.ts`.

**C3. Trainer marks reviewed (or just keeps going).**
- `markIntakeReviewed` flips `intake_status → reviewed`.

### Friction in Phase C
- **No diff view** showing what the client wrote vs what the trainer edits (provenance is tracked but not visualised).
- **Section analysis runs on demand**, not eagerly — first open is slow.

---

## Phase D — Plan generation pipeline (5 stages, all inline on `/clients/$id`)

All 5 stages render via `<StageCard expandedBody={...}/>` on the same page — never via navigation. Approval auto-collapses current stage and auto-expands next.

**D0. `startPhasedPlanDraft`** — creates `workout_plans` row in `draft` status, links to client, runs quota check (`checkPlanQuota` → `quota_exceeded` if free tier already used). Code: `stage1-brief.functions.ts:458`.

**D1. Stage 1 — Brief** (`synthesizeBrief` → `approveBrief`)
- Reads `assessments` + `assessment_section_analyses`.
- LLM compresses into a structured brief: goal, constraints, training capacity, red flags, programming intent.
- Trainer edits inline in `<BriefEditor/>` (Intensity Cockpit lives here: 5 knobs + 6 presets).
- Approval writes `workout_plans.programming_variables` + flips `generation_state.approved_stages += "brief"`.

**D2. Stage 2 — Blueprint** (`generateBlueprint` → `approveBlueprint`)
- LLM proposes a mesocycle structure: number of weeks (default 4), sessions/week, archetype rotation (Push/Pull/Legs, Full Body, etc.), deload frequency.
- Trainer edits via `<BlueprintEditorPanel/>`. Can override programming tier (advanced/conservative/remedial).
- Discuss-loop: `discussBlueprint` for AI Q&A.

**D3. Stage 3 — Microcycle** (`generateMicrocycleDays` → `approveMicrocycle`)
- Generates **Week 1 only** (hard rule: AI never generates >1 microcycle).
- One day at a time via `generateDay`, returns exercises with sets×reps×load×RPE×rest.
- Trainer edits in `<MicrocyclePanel/>` (`<DayCardEditable/>` per day).
- Multi-block awareness: if `block_number > 1`, prompt receives `prior_exercise_pool` and enforces ≥60% accessory rotation.

**D4. Stage 4 — Progressions** (`proposeProgressions` → `approveProgressions`)
- **Deterministic, no AI.** Bompa wave model + NSCA category increments, modulated by `intensity_cockpit` knobs (wave_model, rpe_ceiling, deload_frequency).
- Per-exercise: shows projected load curve across remaining weeks.
- Trainer adjusts curves in `<ProgressionsPanel/>`.

**D5. Stage 5 — Bulk-fill + PDF** (`bulkFillRemainingWeeks`)
- Applies progression curves to materialise weeks 2..N as `workout_days` rows.
- Generates the PDF via `src/lib/pdf.ts` (FORGE design spec, amber #D4A574, independent of app theme).
- Sets `workout_plans.status = "ready"` (emerald chip).
- Trainer hands PDF + `/log/$token` link to client.

### Friction in Phase D
- **Stage 1 LLM cost is highest** — full assessment in context. No caching when trainer re-runs.
- **Stage 3 day-by-day** can take 30–60s for 5 days; UI shows per-day spinners but no parallel option.
- **No "regenerate just this exercise"** — trainer must edit manually or rerun the whole day.
- **Approve buttons are scattered** across 5 different panels with slightly different label conventions.
- **Quota gate fires at D0 only** — trainer sees the error after picking a client, not before.

---

## Where to focus fixes (high-leverage)

| Area | Pain | Fix idea |
|---|---|---|
| Phase A | Trainer copy/pastes link manually | Built-in WhatsApp/email send (deeplink + template) |
| Phase B | Identity slide is #3, drop-offs lose name | Move to slide #1 (after welcome) |
| Phase B | PAR-Q red flags pass silently | Hard gate + "ask for medical clearance" CTA |
| Phase B | No drop-off telemetry | Log slide index per autosave to spot abandon points |
| Phase B | Account creation post-submit | Offer "magic link by email" so client doesn't need to be back in the same tab |
| Phase C | Provenance not visualised | Diff badge: "client wrote X · you edited to Y" |
| Phase D | Stage 1 cost + latency | Cache last brief synthesis; only re-run on assessment delta |
| Phase D | Stage 3 latency | Parallel day generation behind a feature flag |
| Phase D | Approve UX scattered | Single "Approve & continue" pattern + keyboard shortcut |
| Phase D | Quota error late | Pre-flight quota chip on `/clients/$id` header |

---

## Code map (one-liner per surface)

- `src/server/intake.functions.ts` — token lifecycle, load/save/submit, identity patch.
- `src/server/intake-photos.functions.ts` — private bucket uploads.
- `src/server/intake-ai.functions.ts` — `interpretGoal` (Lovable AI Gemini).
- `src/routes/intake.$token.tsx` — 19-slide wizard, autosave, account gate.
- `src/components/IntakeLinkPanel.tsx` — trainer-side link panel + status chip.
- `src/server/phased/pre-stage.functions.ts` — section coverage analysis.
- `src/server/phased/stage1-brief.functions.ts` — brief synth + plan draft + quota.
- `src/server/phased/stage2-blueprint.functions.ts` — mesocycle proposal.
- `src/server/phased/stage3-microcycle.functions.ts` — Week 1 day generation.
- `src/server/phased/stage4-progressions.functions.ts` — deterministic Bompa+NSCA.
- `src/server/phased/stage5-bulkfill.functions.ts` — materialise + PDF.
- `src/routes/clients_.$clientId.tsx` — single page that hosts all 5 stages inline.

Tell me which phase you want to attack first and I'll plan the concrete edits.
