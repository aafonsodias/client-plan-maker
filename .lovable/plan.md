## What's already closed from the walkthrough doc

D + E rounds delivered: CC5 (skip button), CC1 (collapsible Implicações everywhere), CC10 (single name), CC9 partial (per-section analyzer), 14.3 (Rockport wizard), CC2 first pass (amber budget on section header + analysis card).

## What's still pending — sorted by impact/credit ratio

### 🟢 High impact · Low credits (do these next)

| # | Item | Effort | Why high impact |
|---|---|---|---|
| 5.1 | Goal templates: clear "selected vs available" state inside a category | small | P0, founder explicitly called it out; a few CSS classes |
| 9.1 | Sleep: replace 1-10 scale with average hours slider (15-min steps) | small | P1, current scale is meaningless; pure UI swap |
| 14.1 | Rename "Performance" → "Saúde cardiovascular" / "Cardiovascular health" | small | P2, i18n-only, removes the misleading label founder flagged |
| 14.2 | Hide grip strength under "Avançado" / trainer-only | small | P2, removes noise for 95% of clients; one collapsible |
| 14.7 + 7.x | Equipment-agnostic naming sweep ("dinamómetro" not "Jamar", "bioimpedância" not "Tanita") | small | P2, i18n-only, principle-aligned |
| 3.2 + 3.3 | Days/week as 1-7 chips + session duration as time chips (30/45/60/75 + custom) | small | P2, replaces sliders with chips — better mobile, founder asked |

**Estimated total effort**: one focused round. Almost all of it is i18n + small JSX swaps in `src/routes/clients_.$clientId.tsx`. Very low credit cost.

### 🟡 Medium impact · Medium credits (next round candidates)

- **CC8** — Implicações update live on field blur (wire onBlur to `analyzeAssessmentSection` per section). Already 70% wired; needs the blur trigger.
- **13.3** — Replace 1RM with submax + Epley regression (formula already exists in `capacity-gain.ts`).
- **8.2** — Explain what each Prochaska stage changes in the plan (i18n + tooltip).

### 🔴 High impact · High credits (deserve dedicated rounds — don't bundle)

- **CC3 drawings everywhere** — large, needs SVG library + style discipline. Real Round F.
- **CC4 page-per-topic restructure** — foundational; rewires assessment shell.
- **CC6 PDF "livro de bons costumes"** — large, needs PDF templating layer.
- **3.7 body map for injuries** + **11.2 mobility limitations body map** + **12.x posture observation system** — each is large, drawing-heavy.
- **7.1 measurements page redesign** — large.
- **5.5 multi-goal backlog** + **5.7 AI goal suggestion** — foundational, principle decision already taken (D1).

## Recommended next round (this is the actual plan)

**Round F-light — 6 small fixes, one round.** Deliverables:

1. Goal templates: add `aria-pressed` + `ring-2 ring-primary bg-primary/5` for the actively selected template inside a category.
2. Sleep: replace `sleep_quality` (1-10) with `sleep_hours_avg` (slider 4h–10h, 15-min steps). Migration adds nullable column; legacy field stays read-only for old assessments. Pre-stage analyzer reads `hours ?? quality`.
3. i18n rename `performance_block.title` → "Saúde cardiovascular" (PT) / "Cardiovascular health" (EN). Add same key in ES/HI fallback to EN.
4. Grip strength fields move behind existing `showAdvancedPerformance` toggle (already exists at line 3050).
5. i18n sweep: search/replace "Jamar" → "dinamómetro", "Tanita" → "bioimpedância" across `assessment.json` (4 locales).
6. Days/week: replace AnchoredSlider with 7 chips (1–7); session duration: replace input with chips (30/45/60/75 + "Outro" → free input).

### Out of scope for this round (be honest)

- Drawings (Round F proper)
- Page-per-topic restructure (Round F proper)
- Body maps (Round F proper or G)
- PDF synthesis (Round H)
- Live blur on Implicações (next round; it's medium-effort and deserves QA)
- Posture/movement-screen overhaul (Round F proper)
- Multi-goal backlog (Round G+)

### Files touched (estimated)

- `src/routes/clients_.$clientId.tsx` — 6 small JSX edits
- `src/i18n/locales/{en,pt,es,hi}/assessment.json` — copy updates
- One small migration: `clients.sleep_hours_avg numeric null`
- `src/server/phased/pre-stage.functions.ts` — 1 line to read new field with fallback

### Why this is the right pick

You explicitly asked for **highest impact per credit**. These 6 are all P0/P1 small-effort items the founder doc flagged. Each is independently verifiable in one mobile screenshot. No large refactor, no migration risk, no i18n drift, no aesthetic debate. The expensive items (drawings, body maps, page-per-topic, PDF) deserve their own rounds and shouldn't be diluted by sharing a turn with these quick wins.