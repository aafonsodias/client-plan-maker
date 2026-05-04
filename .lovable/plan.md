## Round 44 — Honest stages, single gates, friendlier names

Address everything you flagged on the client page, plus quietly close the easiest backlog items along the way.

### 1. Stage 1 = Assessment (color-aligned with the rest)

Today the assessment uses its own neutral/amber treatment so it reads as "special." Treat it as Stage 1.

- Rename collapsed strip from "Assessment · X% completo" → "**Stage 1 — Avaliação · X% completo**" (PT) / "**Stage 1 — Assessment · X% complete**" (EN). Same for expanded header.
- Restyle the collapsed-complete strip with the **same emerald palette** the other approved stages use (`PipelineStrip` / approved `StageCard`) — drop the amber-only treatment so Stages 1–5 share one visual language.
- Keep the "Ver síntese" right-side action.

### 2. One gate per stage (no per-day gate at the wrong level)

The "Approve → Day 1" button in the Blueprint editor is misleading — it implies day-level approval, but the actual gate is **Stage 3 (Master plan) approval**. Fix:

- Rename `actions.approve_blueprint` → "**Aprovar Plano-mestre →**" (PT) / "**Approve Master plan →**" (EN). Sticky bottom CTA + header CTA in `BlueprintEditorPanel`.
- Each StageCard keeps exactly one approve gate at its bottom (already true for Stages 4 and 5; this brings Stage 3 in line).

### 3. Session archetype names that humans read

Keep the canonical id (lowercase snake) for the engine, but show only the human focus by default.

- In `BlueprintArchetypesList`, demote the id to a small mono chip on hover/focus; the focus field becomes the primary input. The id becomes editable via a small "id" toggle to keep power users happy.
- Add suggested **friendly labels** when the engine emits the canonical 5-template ids (`lower_quad_bias` → "Inferior · Quadríceps", `upper_push_core` → "Superior · Empurrar + core", etc.). Pure cosmetic mapping in `src/lib/archetype-labels.ts`; canonical id unchanged in DB.

### 4. Week × Day matrix — make it actually work

The matrix renders but feels broken because (a) it lives below the archetypes list with the same heading style, so users miss it, and (b) when archetype ids change the matrix shows red "(em falta)" without offering a fix.

- Visually elevate: amber ring + small caption "Distribui os archetypes pelos dias da semana".
- For each day cell, when the referenced id is missing, show a one-click "Substituir por: [first valid archetype]" affordance instead of just red text.
- Default empty days to the first archetype on load (so a fresh blueprint is never half-blank).

### 5. Stage 4 — approve-day chip lives where the approved tab is

Today the per-day "Approve day N" CTA lives at the bottom of the day detail. Move it to the top, anchored next to the day tab strip, and **auto-advance** to the next un-approved day on success.

- Add a top-right "Approve day N" / "Day N approved · Unlock" chip aligned with the day tabs in `MicrocyclePanel` (right side of the swipe row).
- After `approveDayLocal(idx)` succeeds, `setActiveDay(nextUnapprovedDay)` so the next day appears in front of the trainer (matches the "press to show next" feel you described).
- Keep the bottom approve-button as a fallback for keyboard / scroll users, but remove the duplicate chip from the bottom row.

### 6. Honest loaders — real work, real speed, real autosave

The current rotating copy is honest in shape but lies in two places: it advertises "Applying deload to the last week…" on Stage 5 (which is true but reads odd for first block), and `Computing RPE and rests` on Stage 4 fires even when no real work is happening yet. Fix:

- **Stage 5 (Progressions) loader copy** — drop "Applying deload to the last week…" and replace with neutral lines ("A modelar W2 vs W1…", "A escolher onde subir reps vs carga…", "A redigir racional curto por exercício…"). The deload line was misleading on first block.
- **Stage 4 (Microcycle) loader copy** — derive lines from real day completion: "Day 1 ready · generating Day 2…" / "Day 3 ready · generating Day 4…" using the already-tracked `doneCount` and `etaSec`. Real percentage drives a real bar (we already have `pct`); replace the rotating fake copy with this.
- **Autosave on each completed day**: `workout_plan_days` rows are already inserted per-day by `generateMicrocycleDays`, so the work is already persisted — the missing piece is **resume**: when the user re-opens Stage 4 mid-generation, surface "Resuming · 2/5 days done" with a "Retry remaining" button instead of restarting the whole batch.
- **Stage 5 speed**: switch `FORGE_MODEL_STAGE_4` default from `openai/gpt-5-mini` to `google/gemini-3-flash-preview` (same swap that fixed Stage 2 in R29). Document in code comment. Override env var still respected.
- **Stage 5 timeout handling**: wrap the `proposeFn` call in `ProgressionsPanel` with a 90s soft warning ("A IA está lenta — a tentar de novo em 5s") and one automatic retry on `upstream request timeout`, so the toast you saw becomes a recoverable event instead of a dead end.

### 7. Remove "Sem plano ativo" duplication

The empty-state hero card and the "Plano" / "Histórico de planos" section currently render the same two CTAs and the same client title row.

- When `plans.length > 0` AND the most recent plan is **not** `complete` (i.e., still drafting), **hide the `ThisWeekHero` zero-state** entirely — the in-progress draft surface above it already tells that story.
- Show `ThisWeekHero` only when there's a `complete` plan; otherwise fall through to the "Plano / Histórico" list.
- In the "Plano / Histórico" list, hide the duplicate "New plan (manual) / Gerar próximo bloco (IA)" row when the hero already shows them (they only need to appear once on the page).

### 8. PT/EN consistency in microcycle

Spotted "Day 1 · Lower Body - Quads & Calves Heavy / Day 2…" tab labels in PT context. Mirror with PT day labels:

- Day tab label uses the locale-aware `t("plan:day_label", { n: idx })` → "Dia 1" (PT) / "Day 1" (EN). Same for "Week 1" subheader inside `DayCardEditable`.
- Translate the two leftover hardcoded EN strings in `MicrocyclePanel` ("Approve day N", "Day N approved", "regenerate") to use `plan.json` keys with PT fallbacks.

### Backlog items closed in this round

From `.lovable/backlog.md` "Open Round 32" / "Round 33 (next)":

- ✅ Round 33 P2: **Stage 4 Progressions inlined** — already done in R38, mark closed.
- ✅ R32 P2: hide IntakeLinkPanel when intake is reviewed/submitted — already true; verify and mark closed.
- ✅ Pick up R36 deferred **Stage 1 i18n label** — relabel "Assessment" → use `plan:stage.label.1` everywhere (item 1 above already does this).

Items explicitly **not** in this round (parked, real work):
- Drag-to-reorder days + supersets in MicrocyclePanel
- Per-exercise inline AI comments on edit
- Searchable warmup catalog
- WeekMatrix desktop view (needs a design pass)

### Files touched

- `src/routes/clients_.$clientId.tsx` — AssessmentSection title/tone, hide-hero logic, hide duplicate CTA row, Stage 5 timeout handling.
- `src/components/StageCard.tsx` — emerald collapsed-strip variant for Stage 1 parity (no logic change).
- `src/components/BlueprintEditorPanel.tsx` — approve-button rename, Week×Day matrix elevation + auto-fix.
- `src/components/BlueprintArchetypesList.tsx` — id-as-secondary, friendly label resolver.
- `src/lib/archetype-labels.ts` (new) — canonical id → friendly label.
- `src/components/MicrocyclePanel.tsx` — top-aligned approve chip, auto-advance to next day, real progress copy, resume hint, PT day labels.
- `src/components/ProgressionsPanel.tsx` — 90s soft warning + 1 retry on timeout.
- `src/server/phased/stage4-progressions.functions.ts` — model default swap (with comment).
- `src/i18n/locales/{pt,en}/{plan,assessment}.json` — Stage 1 label, approve-master-plan, microcycle day strings, new loader copy for Stage 5.
- `.lovable/backlog.md` — close R32/R33 items, log R44.

### Out of scope explicitly

- No schema migrations.
- No new server functions.
- No changes to the actual generation prompts beyond the model swap.
- No changes to PDF rendering.
