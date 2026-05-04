## Round 35 — Golden journey, single Assessment button, weekly-cycle table, intuitive stage names

### A. Visual: golden everything (looks first)

**A1. StageCard `tone="stage"` → amber/golden, not emerald.**
- Collapsed-approved strip becomes amber-on-dark with a small golden chevron (matches Stage 1 brief tone).
- Open-card chevrons + approve-button inherit the amber/gold gradient already used on the brief approve CTA.
- Emerald reserved ONLY for Stage 5 (Plano final / PDF) — the true end of the journey.
- Status dot: amber for "approved & collapsed", emerald only for "fully shipped".

**A2. Microcycle day tabs: green → golden when approved.**
- In `MicrocyclePanel`, swap the `done` tone from `emerald-*` to `amber-*` so each approved day column lights up golden (matches the rename: "approved = golden").
- Generating stays amber-dim; error stays red; queued stays muted.
- When all days are approved → panel auto-collapses, parent calls `onApproved` → Stage 3 chip becomes the golden "approved" strip.

**A3. Spacing pass on `/clients/$id` stages lane.**
- Increase vertical rhythm between StageCards from `space-y-3` → `space-y-2.5` with a subtle `border-l-2 border-amber-500/15` rail on the left so the eye reads the journey as one column.
- Tighten the assessment chip → stage-cards gap so it visually anchors the column.

### B. One "Assessment" button (merge the two)

Currently we render two stacked controls: `Assessment · 14 secções · 43%` (form coverage) and `Avaliação completa · 86%` (synthesis quality once brief approved).

**B1. Merge into a single composite button:**
```
[chevron] Assessment · 86% completo · 14 secções
```
- Single click toggles the assessment form (the 14-section editor).
- A small "Ver síntese" sub-link on the right opens `AssessmentSynthesisDashboard` in-place (replaces the second pill).
- Color: amber when approved & ≥80%; muted otherwise.

**B2. Expose the completion % as a "richness factor".**
- Persist `assessment_completion_pct` on the plan when the brief is approved (column on `workout_plans`, write inside `approveBrief`).
- Surface it as a small chip wherever brief data is shown: brief sheet header, plan PDF cover footer (`Riqueza dos dados: 86%`), and as a `Factor` field on the plans list row (tiny muted `· dados 86%`).
- Use it later (R36+) to weight AI prompts (low richness → more conservative defaults).

### C. Stage 3 bug: approval not sticking + Stage 4 stays locked

Root cause: `MicrocyclePanel.approve()` updates `generation_state.approved_stages` server-side, but the parent route's `inlineBrief.approvedStages` snapshot is never refreshed, so `microcycleApproved` stays `false` and Stage 4 stays placeholder.

**C1. After approve, refetch the brief snapshot.**
- In `clients_.$clientId.tsx`, change Microcycle `onApproved` to: `await openPhasedDraft(planId, "progressions")` (already re-reads `approved_stages`) instead of just `setExpandedStage(...)`.
- Same fix for Blueprint and Progressions onApproved.

**C2. Persist per-day approval.**
- Add `workout_plan_days.approved_at timestamptz` column.
- New server fn `approveDay({ planId, dayIndex })` sets `approved_at = now()`.
- `MicrocyclePanel` reads `approved_at`; an approved day cannot regenerate without an "Unlock day" confirm step. Fixes the "I had to regenerate after coming back" bug.

**C3. Auto-collapse + advance.**
- When every day in 1..sessions_per_week has `approved_at`, fire `approveMicrocycle` automatically, then `onApproved` (which now refetches), then auto-expand Stage 4.

### D. Stage 3 redesigned: weekly-cycle table (golden columns)

Replace the current "tabs + single day detail" layout with a **week matrix**:

```text
                    DAY 1 (golden)  DAY 2          DAY 3          ...
  Bodyweight Squat  4×12 RPE 8      —              —
  Romanian DL       —               4×8  RPE 7.5   —
  Plank             3×30s           —              3×45s
  ...
                    [✓ Approve d1]  [✓ Approve d2] [...]
```

**D1. New component `WeekMatrix.tsx`** (desktop-first, mobile falls back to current swipe tabs).
- Columns = days, rows = unique exercise names across the week, cells = `sets×reps @ RPE` (or `—`).
- Click a cell → side sheet opens that exercise's prescription (sets/reps/RPE/rest/notes) with inline edit.
- Column header turns **golden** (amber gradient + ✓) once that day is approved.
- Bottom of each column: per-day Approve button (amber gradient).

**D2. Drag-and-drop.**
- Drag a row within a column to reorder exercises in that day.
- Drag a row across columns to copy/move that exercise to another day (Cmd/Ctrl = copy).
- Use `@dnd-kit/core` + `@dnd-kit/sortable` (already in deps; otherwise add). Persist via existing `microcycle-edit.functions.ts` (extend with `reorderDayExercises`, `moveExerciseAcrossDays`).

**D3. Inline auto-feedback.**
- After each edit, run `WeekVolumePanel` (already scaffolded R34) live: per-pattern volume re-totals and the row of MEV/MAV/MRV dots above the matrix updates immediately.
- A small toast at the corner: "Push volume +6 sets — agora MAV ✓" or "Pull caiu para MEV — considera adicionar 1 set" (re-uses `lib/prescribe-volume.ts`).

### E. Stage names + numbering

Renumber so Assessment is Stage 1 (matches user's mental model):

| New # | Name (PT)            | Name (EN)        | Old name      |
| ----- | -------------------- | ---------------- | ------------- |
| 1     | Avaliação            | Assessment       | (chip only)   |
| 2     | Briefing             | Brief            | Stage 1 Brief |
| 3     | Plano-mestre         | Master plan      | Blueprint     |
| 4     | Semana-tipo          | Weekly cycle     | Microcycle    |
| 5     | Progressões 12 sem.  | 12-week roadmap  | Progressions  |

- All copy via `i18n` (`plan.json` → `stage.label.{1..5}`, `stage.short.{1..5}`).
- Internal keys (`brief`/`blueprint`/`microcycle`/`progressions`) stay unchanged in the DB & server fns to avoid a migration; only display labels change.
- Update: StageCard title prop, MicrocyclePanel header, `plan-status.ts` chip labels, plan PDF section headings, plans-list "STAGE: MICROCYCLE" chip (becomes "ETAPA: SEMANA-TIPO").

### F. Founder / verified badge

The amber Founder pill IS rendering — but `Founder` text is hidden below `2xl` breakpoint, so on the user's 1270px viewport only the sparkle icon shows (easy to miss).

**F1. Show the label from `lg:` upwards** (drop `2xl:inline` → `lg:inline`).
**F2. Add a separate "Verified trainer" badge** for any account with: avatar set + display name + at least 1 active client (criteria configurable). Small blue-check icon next to the trainer name in `/clients/$id` header and on shared pages. Founder badge stays distinct.

### Files touched

- `src/components/StageCard.tsx` — golden tone, spacing
- `src/components/MicrocyclePanel.tsx` — golden day tabs, auto-collapse, day approval
- `src/components/WeekMatrix.tsx` — NEW (desktop matrix)
- `src/components/volume/WeekVolumePanel.tsx` — wire live recompute on edits
- `src/server/phased/microcycle-edit.functions.ts` — reorder/move + approveDay
- `src/server/phased/stage3-microcycle.functions.ts` — auto-approveMicrocycle when all days done
- `src/routes/clients_.$clientId.tsx` — merged Assessment button, onApproved refetch, stage rename, spacing rail
- `src/components/AppShell.tsx` — Founder label visible from `lg:`
- `src/components/VerifiedBadge.tsx` — NEW
- `src/i18n/locales/{pt,en}/plan.json` — new stage labels + microcycle copy
- `src/lib/plan-status.ts` — new chip labels
- `src/lib/pdf.ts` — section headings + dados-richness footer
- DB migration: `workout_plans.assessment_completion_pct int`, `workout_plan_days.approved_at timestamptz`

### Out of scope (R36)

- AI-suggested alternatives in the side-sheet
- Cross-week duplication (week 2/3 generation from approved week 1)
- Founder/verified badge on public share pages
