
# Round 30 — Inline Microcycle Workbench + Brief Auto-Collapse

Big picture: every stage (Brief → Blueprint → Microcycle → Progressions → PDF) lives inline on `/clients/$id` and behaves the same way — when you approve, it goes golden, collapses, and the next stage opens below it. No more bouncing to dedicated pages mid-flow. The Microcycle becomes a real weekly workbench (5 days at a glance, edit/reorder/superset, AI comments your changes), not a Day-1 stub.

This round closes 5 P0 items. The full backlog (FITT-VP, special populations, NSCA, Bompa, schedule polish, etc.) stays parked in `.lovable/backlog.md` — nothing gets deleted, just deferred honestly.

---

## 1. Fix "No archetype for day 1" (P0 hotfix, ~15 min)

In the screenshot the Microcycle page shows `Day 1 failed — No archetype for day 1`. The deterministic Blueprint fallback writes `week_to_session_map["1"]` correctly, but `archetypeForDay()` in `src/server/phased/stage3-microcycle.functions.ts` returns `null` if `sessions_per_week` mismatches the actual `week_to_session_map["1"]` array length, or if a blueprint was approved while the matrix was empty.

Fix in `archetypeForDay()`:
- If `week_to_session_map["1"]` exists but is shorter than `dayIndex`, fall back to `session_archetypes[(dayIndex - 1) % archetypes.length]` instead of returning `null`.
- If both are empty, synthesize a generic full-body archetype on the fly (`{ id: "full_body", focus: "Full body", primary_movements: ["squat","hinge","push","pull"] }`) so Stage 3 always has something to work with.
- Log the recovery to `generation_log` as `stage3:archetype_recovered` so we know when it kicks in.

Add a defensive validator in `generateMicrocycleDays`: if `bpP.data.sessions_per_week !== Object.values(week_to_session_map["1"]).length`, repair the blueprint in-memory before launching workers.

---

## 2. Brief approval → golden + collapsed + section index folds (P0, ~20 min)

Mirror the Blueprint pattern. In `src/routes/clients_.$clientId.tsx`:
- After `approveBriefFn` succeeds, set `setExpandedStage("blueprint")` and ensure the Stage-1 (Brief) card switches to `status="approved"` styling (amber → emerald gradient strip + lock icon).
- Collapse the BriefEditor body (currently stays open) and collapse the BriefContextRail / section index that lives next to it.
- Same for Assessment: when intake completes (already detected via `intake_completed_at`), collapse the assessment section into a slim "✓ Avaliação completa" pill.

Add a small `useStageAutoFlow()` helper so each approval step auto-collapses the previous and auto-expands the next — single source of truth across stages 1→4.

---

## 3. Microcycle becomes a weekly workbench (inline on client page) (P0, ~3-4 h)

Replace the dedicated `/plans/$planId/microcycle` redirect with a `MicrocyclePanel` component (mirrors `BlueprintEditorPanel`) embedded as Stage 3's `expandedBody`.

Layout (compact, all 5 days visible on a 1280px screen, stacked on mobile):

```text
┌─ MICROCYCLE — Week 1 ────────────────────────────────────┐
│ [Day 1] [Day 2] [Day 3] [Day 4] [Day 5]   ← lane tabs    │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Warmup ▾ (color: blue)        + add / search        │ │
│ │ Activation ▾ (color: violet)                         │ │
│ │ Dynamic stretch ▾ (color: cyan)                      │ │
│ │ Main work ▾ (color: amber)                           │ │
│ │   ⋮⋮ A1  Back Squat  4x6 @RPE8     [edit] [×]       │ │
│ │   ⋮⋮ A2  RDL         4x8 @RPE7     [edit] [×]       │ │
│ │   ⋮⋮ B   Pull-up     3x AMRAP                        │ │
│ │ Conditioning ▾ (color: red)                          │ │
│ │ Cooldown / passive ▾ (color: green)                  │ │
│ └──────────────────────────────────────────────────────┘ │
│ AI says: "Swap A1 for Front Squat — better for knee…"    │
│         [accept] [dismiss]                               │
│ [⟲ Regenerate this day]    [✓ Approve Day 1]             │
└──────────────────────────────────────────────────────────┘
[✓ Approve full week → Stage 4]   ← single CTA at bottom
```

Capabilities:
- **Lane switcher**: Day 1..N tabs at the top, fast keyboard arrows, no page navigation.
- **Searchable add-exercise**: reuse `AddExerciseDialog`, extend with filter by muscle / pattern / equipment. Same picker for warmups, activations, stretches (filtered by `section`).
- **Color-coded sections**: a single source of truth in `src/lib/section-tone.ts` (mirrors `status-tone.ts`). Each section has `bg/border/text/dot` tokens. Same colour everywhere (workbench, PDF, exercise card).
- **Reorder + superset**: drag handle (44×44, same `delay:150` pattern as `BlueprintArchetypesList`); two adjacent items can be locked into a superset (A1/A2 prefix) via a "link" button. Lock icon when locked.
- **AI comment on edits**: after each user edit, debounce 1.5s and call a new `commentMicrocycleEdit` server fn (cheap `gemini-2.5-flash-lite`) that returns 1–2 sentence Forge feedback. Render under the day as an amber-bordered note with accept/dismiss.
- **Per-day Approve + global Approve**: per-day chip flips to green; global "Approve full week" only enabled when all days are green.
- **Stage 5 (PDF)** opens automatically when week is approved (no separate trigger).

Files involved:
- new `src/components/MicrocyclePanel.tsx`
- new `src/components/MicrocycleDayLane.tsx`
- new `src/components/MicrocycleExerciseRow.tsx` (drag + superset link)
- new `src/lib/section-tone.ts`
- new `src/server/phased/microcycle-comment.functions.ts` (1 createServerFn, gemini-2.5-flash-lite)
- extend `src/components/AddExerciseDialog.tsx` with `section` filter + warmup/stretch catalog support
- `src/routes/clients_.$clientId.tsx` — Stage 3 card uses `expandedBody={<MicrocyclePanel/>}` instead of navigating away
- `src/routes/plans.$planId.microcycle.tsx` — keep as fallback deep-link, render the same `MicrocyclePanel`

Out of scope this round: live multi-week edit (we still only edit Week 1; later weeks inherit until Stage 4). Superset 3+ exercises (only 2-item links for now). Drag across days.

---

## 4. Backlog hygiene (P1, ~10 min)

Update `.lovable/backlog.md`:
- Move items 40 (Schedule v1), 14 (NextBlockCard) etc. into "Concluído" if done.
- Add Round 30 entries:
  - R30 P0 Bug: archetypeForDay null-safe + blueprint repair before microcycle generation
  - R30 P0 UX: Brief approval auto-collapse + section index fold + useStageAutoFlow helper
  - R30 P0 Workbench: MicrocyclePanel inline (5-lane workbench, color-coded sections, drag/superset, AI comment-on-edit)
  - R30 P1 Lib: section-tone tokens + AddExerciseDialog extended with section filter
- Re-affirm parked: FITT-VP backbone (R2), Bompa overlay (R2.5), special-population overlays (R3), NSCA (R3.5), behaviour change (R4).

Also save a memory rule under `mem://principles/inline-stage-flow.md`:
> All 5 stages (Brief → Blueprint → Microcycle → Progressions → PDF) live inline on `/clients/$id`. Approval makes the stage golden, collapses it, and auto-expands the next. Dedicated `/plans/$planId/...` routes remain as deep-links but never as the primary flow.

---

## Risks & non-goals

- The microcycle panel touches the largest file (`clients_.$clientId.tsx`, 3705 lines). Keep changes additive — pass `expandedBody` only, no major refactor of Stage 3 logic.
- `commentMicrocycleEdit` is a new AI call → costs money. Debounce hard (1.5s), max 1 comment per day per session, opt-out toggle in founder telemetry.
- Searchable warmup/stretch catalog — we don't have a curated list yet; for now use `AddExerciseDialog`'s existing exercise table filtered by `section in ('warmup','activation','dynamic_stretch','cooldown')`. A real curated catalog ships in a future round.
- Not touched: PDF, schedule, knowledge roadmap (ACSM/Bompa/NSCA), demo lab — all stay parked.

## Suggested order
1 (hotfix) → 2 (brief collapse) → 3 (workbench) → 4 (backlog + memory).
