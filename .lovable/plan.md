# R76 — Health & Readiness Overlay (audit round)

## Credit-aware scope

Budget left: ~55.4 credits to MVP. R76 brief explicitly forbids code, schema, prompt, or i18n changes. Deliverable is **one markdown audit**. That keeps spend to ~3–5 credits and preserves runway for the remaining MVP closers in `.lovable/backlog.md` (logbook quick-mark, MEV/MAV/MRV personalisation, landing revamp, FAQ/manual, synthesis enrichment, speed pass).

I will **not** open Phase C work in this round. R76 is a *thinking* round; its job is to make the next 3–4 implementation rounds cheap and safe by ranking what actually moves the needle vs. what is wellness fluff.

## What I will produce

A single file: `.lovable/r76-health-readiness-overlay.md`

Structure exactly as the brief demands (sections 1–23). No code, no schema, no prompt edits, no i18n, no taxonomy mutation.

## Method (read-only, ~6–8 file reads, batched)

1. Re-read what already exists so the audit is grounded, not invented:
  - `src/lib/exercise-taxonomy.ts`, `src/lib/session-taxonomy.ts`
  - `src/lib/movement-criteria.ts`, `src/lib/assessment-missions.ts`
  - `src/server/screening/preparticipation.server.ts` (already in context)
  - `src/lib/blood-pressure.ts` (in context), `src/lib/missions.ts` (in context)
  - `src/server/phased/stage1-brief.functions.ts`, `src/server/phased/programming-tier.server.ts`
  - `src/lib/pdf.ts` headers only (size check)
  - `mem/principles/evidence-source-ethics.md` (in context)
  - `.lovable/backlog.md`, `.lovable/r74-*`, `.lovable/r75-*`
2. Grep for: `parq`, `red_flag`, `referral`, `pain`, `cervical`, `mcgill`, `sleep`, `hydration`, `inflammation`, `readiness`. One ripgrep pass.
3. Check `.lovable/*source.txt` filenames for McGill availability (no parse — just `ls`).

Total: one parallel batch of reads + one ripgrep + one ls. Cheap.

## Key positions the audit will commit to

These are the load-bearing decisions; everything else in the doc is supporting analysis.

- **Name**: *Readiness & Reasoning Overlay*. Broader than spine/joint, narrower than "wellness". Frames the overlay as decision-support over the existing assessment → brief → plan → adaptation arc, not a parallel medical surface.
- **Abstraction boundary**: overlay = (a) screening guardrails, (b) readiness modifiers, (c) rationale chips, (d) education notes. Out of scope: diagnosis, medical sleep/nutrition prescription, automated loaded cervical work, "hydration fixes joints" claims.
- **Badges over scores**: a numeric readiness score creates false precision. MVP path is 5 badges (Ready / Caution / Reduce load / Technique only / Refer). No HRV, no wearable dependency in MVP.
- **McGill**: treat as one expert model, not a brand. Check `.lovable/*source.txt` — if absent, ingestion is a separate parked round; if present, only general lumbar endurance / bracing / hip-spine concepts may inform trainer-facing rationale, never auto-generated cervical work.
- **Cervical ladder**: 9 levels documented (education → loaded harness → contact prep), but **only levels 1–3 are MVP-eligible** and only as trainer-pickable, never auto-generated for general clients. Levels 6–9 stay parked behind explicit clinical context.
- **Engine boundaries**: AI may summarise rationale and explain Stage 3 picks. AI may **never** re-enter Stage 4/5, never overrule PAR-Q+/ACSM, never generate citations.
- **Lifestyle layer**: sleep/hydration/nutrition/inflammation each get a "what we may say / must not say / evidence required" triplet. Most claims start as `needs_evidence`. No client-facing science copy ships in MVP.

## Recommended next slice (the audit will rank 10, pick 1)

**Slice J — Trainer-facing "why selected / why avoided" rationale chips** on existing `MovementPatternCard` / `ProgressionExerciseCard`.

Why this wins on the credit budget:

- Uses data already in `generation_meta` (Stage 3 already records picks). No schema, no migration, no Stage 4/5 touch.
- Pure presentation layer (R75-discipline: UI, not engine).
- Immediately makes the app feel like decision-support, which is the R76 thesis.
- Forces us to define the rationale vocabulary that every later slice (caution badges, education notes, McGill chips) reuses.
- Estimated cost: 4–6 credits in a future round. Leaves ~45 credits for Phase C MVP closers.

Slices A (source ingestion) and I (`needs_evidence` chips) rank #2 and #3 — both bigger, both better deferred until rationale chips are in place.

## What this round explicitly does NOT do

- No code edits, no schema, no migration, no prompt change, no i18n key, no taxonomy entry, no exercise added to generation, no PDF copy change, no claim shown to clients.
- Does not start Slice J — only recommends it. Implementation waits for your green light in R77.
- Does not ingest McGill source even if absent — flags it as a parked decision.

## Acceptance check before I close the round

- File exists at `.lovable/r76-health-readiness-overlay.md` with all 23 sections.
- `mem/index.md` Memories list gets one new line pointing to the audit (single-line index update, no Core rule added — overlay is not yet a project rule).
- `.lovable/plan.md` gets a 2-line R76 entry.
- No other file touched.

If you approve, I implement this exact deliverable and then stop.  
  
Approved, with one correction.

Keep R76 strictly read-only and audit-only.

Create only:

.lovable/[r76-health-readiness-overlay.md](http://r76-health-readiness-overlay.md)

Do not update mem/[index.md](http://index.md).

Do not update .lovable/[plan.md](http://plan.md).

Do not touch code, schema, prompts, i18n, taxonomy, or engine.

Reason: this round is a thinking round and the brief explicitly says one audit document only. Preserve discipline and credits.

After R76 closes, we will run a separate MVP launch-safety round focused on:

- free plan abuse protection

- payment gating

- assessment link sending

- WhatsApp workflow

- Google Calendar / scheduling path

- publish-readiness

Proceed with R76 exactly as scoped, then stop.