## Round 33 — Inline-only journey, honest collapse, distinct stage styling

### Problems observed (your screenshot + feedback)

1. **Collapse hides everything.** Today the post-assessment synthesis, the green "Avaliação completa · X%" pill AND all the stage cards (Brief → Blueprint → Microcycle → Progressions) are rendered *inside* `<AssessmentSection>` (clients_.$clientId.tsx lines 1539→2542). So collapsing the assessment collapses brief + blueprint + microcycle + progressions too — exactly what the screenshot shows: green pill, and the Plans block jumps right under it.
2. **"Approved" stage chips look identical to the Brief chip.** Both use the same amber/accent treatment from `StageCard`'s collapsed-approved branch — visually monotonous and dishonest about what stage you're in.
3. **Plans list opens the old standalone microcycle/blueprint windows.** `linkProps` in the Plans section sends users to `/plans/$planId/<stage>`, which violates the new "every stage stays inline on `/clients/$id`" principle.

### What changes

**1. Restructure the page so assessment collapse only hides assessment content (P0)**

In `src/routes/clients_.$clientId.tsx`:

- Move the green "Avaliação completa · X%" / amber "Avaliação parcial" chip (lines 2144–2185) and the entire `phasedEnabled && inlineBrief` stages block (2187–2541) *out* of `<AssessmentSection>`. They become siblings under the same parent grid cell.
- `<AssessmentSection>` keeps only: `headerProgress`, the section sidebar, and the questionnaire `SectionBlock`s (PAR-Q+, Risk strat, Anthropometry, …, Performance) plus the synthesis dashboard.
- Result: clicking the green pill (`setExpandedStage(null)` → also calls a new `setAssessmentCollapsed(true)`) now only collapses the questionnaire + section index. The Brief / Blueprint / Microcycle / Progressions cards remain visible directly below the green pill — exactly the layout you described ("green button followed by the next steps").
- The section index sidebar (`<aside class="hidden lg:block">`) is moved *inside* `<AssessmentSection>` so it collapses together with the questionnaire (matches your earlier request "section index too should go golden and collapse").

**2. Distinct visual identity for Brief vs Approved stages (P1)**

In `src/components/StageCard.tsx`:

- Add a `tone` prop (`"brief" | "stage"`, default `"stage"`).
- The collapsed-approved strip currently uses `border-accent/40 bg-accent/5` (amber). Repaint:
  - Brief approved → amber (current look) — keeps the warm "this is the source of truth" feel.
  - Other stages approved → emerald (`border-emerald-500/30 bg-emerald-500/5 text-emerald-500`), with a subtle dot prefix instead of the Check icon, and the label in lowercase tracking ("blueprint · approved", "microcycle · approved", "progressions · approved"). This matches the existing emerald "Avaliação completa" pill, gives the page a real progression: amber pill (assessment) → amber pill (brief) → emerald pills (the AI-built stages).
- Wire `tone="brief"` only on the Stage 1 card; Stage 2/3/4 stay default.

**3. Plans list never opens a separate stage window (P0)**

In the Plans `<section>` (lines 2545–2665):

- Replace the `linkProps` branch that points to `/plans/$planId/<stage>` with logic that, when the plan is a phased draft, **stays on the current route** and just expands the matching stage:
  - `onClick={() => { setInlineBrief(briefForPlan(p.id)); setExpandedStage(stageOf(p)); window.scrollTo(...top of stages...); }}`
  - For finalized (non-phased / `complete`) plans, keep the link to `/plans/$planId` (that's the read-only logbook view, which is fine).
- The Plans card stops being a `<Link>` for phased drafts; it becomes a `<button>` row with the same visual.
- `src/routes/plans.$planId.brief.tsx`, `.blueprint.tsx`, `.microcycle.tsx`, `.progressions.tsx` get a tiny `useEffect` redirect → `navigate({ to: "/clients/$clientId", params, replace: true })` using the plan's `client_id` (one server fetch). Back-compat for anyone with a bookmarked URL; no new dead pages.

**4. Backlog + memory hygiene (P2)**

- `.lovable/backlog.md` — append "Closed Round 33" with the three items above; add a new "Em aberto" entry referencing the FITT-VP work (#45) which is still the next P0 motor item, plus the Special-population overlays (#47).
- New memory `mem/principles/inline-only-journey.md`: "Every stage from Assessment → Brief → Blueprint → Microcycle → Progressions → PDF lives on `/clients/$id`. Plans-list rows expand inline. Standalone `/plans/$planId/<stage>` routes are redirects only."
- Update `mem/index.md` Core line for "no-stage-redirects" to also cover Plans-list clicks.

### Files touched

- `src/routes/clients_.$clientId.tsx` — restructure (move chip + stages out of AssessmentSection; rewrite Plans-list click handler).
- `src/components/StageCard.tsx` — `tone` prop + emerald approved style for non-brief stages.
- `src/routes/plans.$planId.brief.tsx`, `…blueprint.tsx`, `…microcycle.tsx`, `…progressions.tsx` — replace body with a redirect to `/clients/$clientId`.
- `.lovable/backlog.md`, `mem/index.md` — entries.
- New: `mem/principles/inline-only-journey.md`.

### Out of scope (deferred to R34)

- Microcycle generation speed beyond what R32 already delivered (Gemini 2.5 Flash + skip-FITT-VP-on-first + concurrency 7). If you still see hangs after this round, R34 will add per-day streaming.
- The corner-icon Documents/Intake refactor was already done in R32 — no further change.
- FITT-VP backbone (#45) is still the next motor P0 but stays in its own round to keep this one focused on UX.

### What stays the same

- Auto-save, section analysis, accommodations, paywall, all server functions — untouched.
- `MicrocyclePanel` continues to be the single component for microcycle, used by the inline path (and now by no other page).