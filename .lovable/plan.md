---

**Polish & restructure pass — client/assessment page**

13 items, executed in order. Typecheck after each. **STOP after item 6 for visual review.**

GitHub: https://github.com/aafonsodias/client-plan-maker

---

**Item 1 — Fix Expand/Collapse All**

In `src/routes/clients_.$clientId.tsx`, `useSectionCollapseProvider` already calls `setAll(true|false)` and writes every section to localStorage. The bug is the `disabled={ctx.allOpen}` / `disabled={ctx.allClosed}` guards on the buttons — when state is mixed, `allOpen` is true if every section currently lacks an explicit override (sections default to open), so clicking does nothing visible. Remove the disabled guards, and force `setAll` to write overrides for every section regardless of current state. Result: clicking always forces all open / all closed.

---

**Item 2 — Restructure Synthesis Dashboard placement**

- Extract the existing `AssessmentSynthesisDashboard` (currently rendered around line 1170, before assessment sections) into `src/components/AssessmentSynthesisCard.tsx`.
- Client page top: render a compact "client snapshot card" above the assessment, using the most recent assessment (date, ACSM risk, recovery, body comp, top 3 red flags). Always visible; no sections-analyzed gate.
- Assessment area: move the full synthesis to **below the last section**, just above the brief card.
- Add the radar chart: new `MovementCompetencyRadar` inline-SVG component (no new dep). 6 axes: squat, hinge, push, pull, carry, lunge. Score sources: `assessment.squat_depth_score`, `hip_hinge_score`, `overhead_reach_score` (push proxy), plus the new pull/carry scores from item 11 (until item 11 ships, dashed). Un-assessed axes render as dashed grey lines + grey dot at center.
- Sort red flags: order by severity using `red_flag_accommodations` strategy lookup: AVOID → MODIFY → MONITOR → ACCOMMODATE → unmapped (alpha last).

---

**Item 3 — Eliminate duplicate alerts inside sections**

Today every `SectionBlock` renders `analysis.red_flags` from its own pre-stage analysis, but the synthesis fuses them — and because the AI sometimes echoes upstream flags, sections look duplicated. Fix:

- Tighten the pre-stage prompt in `src/server/phased/pre-stage.functions.ts`: append "Only emit red_flags derived directly from THIS section's payload. Do not restate flags inferable from other sections."
- In `SectionAnalysisCard` (around line 2175), drop the `red_flags` list rendering entirely. Section cards show only `contraindication_notes` / next-stage notes / movement summary fragments. Cross-section flag aggregation lives only in the synthesis dashboard.

---

**Item 4 — Constructive section messaging**

Rewrite `SectionAnalysisCard`:

- If `contraindication_notes` or `notes_for_next_stage` exist → render the most useful one as a single line, no "Para o plano:" prefix.
- If neither exists → render nothing (card hidden), instead of "Sem sinais de alerta".
- For sections with simple deterministic insights (Goal, Anthropometry), compute a local one-liner client-side and render it even before AI analysis returns. **Use only this fixed rule set — do not invent additional rules:**
  - WHR > 0.95 (M) or > 0.85 (F) → "Risco cardiometabólico elevado — priorizar perímetro abdominal"
  - BF% > 25 (M) / > 32 (F) → "Composição corporal acima do ideal — considerar défice calórico moderado"
  - Goal section with target weight/measurement loss → "Objetivo realista em ~X semanas a défice moderado" (compute X from baseline; cap at 1% body weight/week)
  - All others: no client-side one-liner; wait for AI.

---

**Item 5 — pt-pt formal pass**

- Add `locale` arg to `analyzeAssessmentSection` and `synthesizeBrief` server functions, default `pt-pt`. System prompts get: "Output in European Portuguese, formal address (você / o seu / a sua). Never use tu/teu/tua. Use European Portuguese spelling (não use formas brasileiras)."
- Add an `en-GB` branch in the same prompt so trainer locale flows through.
- Caller passes `i18n.language` from the client.
- Sweep hard-coded English strings in `clients_.$clientId.tsx`: "Expand all" / "Collapse all" / "Brief preview" / "No logged sessions yet" → use `t()` keys added to `src/i18n/locales/{pt,en}/{common,assessment}.json`.
- Re-run pre-stage analysis for previously-analyzed sections when locale differs from cached output (cheap: store locale alongside hash in `sections_analysed_at`).

---

**Item 6 — Compact design pass**

Tighten `clients_.$clientId.tsx`:

- `SectionBlock` body padding: `p-5` → `p-3 md:p-4`; `space-y-4` → `space-y-3`; body text `leading-relaxed` → `leading-snug`.
- Risk stratification block: rewrite to a 2-col grid — left column is wrapping pill toggles for FH-DCV / sedentarismo / dislipidemia / HTA / tabagismo / IMC; right column is single ACSM result chip + one-line interpretation. Remove the duplicate "Risco ACSM: BAIXO" badge.
- Anthropometry: one `grid-cols-3` row for waist/hip/BF, method dropdown full-width below.
- Medication: wrap insight text in a `<details>` with summary "Ver análise →".
- Goal section: drop the duplicate "Objetivo registado: …" line below the SMART card.
- Brief card: subsection gap from `space-y-8` → `space-y-4`; inner field padding tightened to match.
- Pass over the page: any `space-y-{≥6}` → `space-y-4`; `gap-{≥6}` between cards → `gap-4`.

**STOP. Confirm before continuing:**

- (a) Risk stratification fits one row at desktop width
- (b) "Sem sinais de alerta" strings are gone everywhere
- (c) Brief card spacing visibly tighter than before
- (d) No vertical whitespace gaps > 24px except between major card blocks
- (e) Mobile (< 640px) still readable, no horizontal overflow

Show me a screenshot of the assessment page top-to-bottom before starting item 7.

---

**Item 7 — "Como avaliar" guidance**

New `src/components/HowToAssess.tsx`: an inline `<details>` triggered by a "Como avaliar →" button next to the section title. Content table keyed by section id with concise evidence-based protocols:

- Mobility / Anatómica: shoulder, hip, ankle 1–5 rubric.
- Posture & Alignment: plumbline landmarks + common deviations (forward head, kyphosis, anterior pelvic tilt).
- Movement Screen: overhead squat / hip hinge / single-leg balance / inverted row / carry — pass criteria.
- Anthropometry: waist (narrowest, end-exhalation), hip (greater trochanter), BF (method-dependent SOPs).

Strings live in `assessment.json` so they translate.

---

**Item 8 — "Ver sugestões" on red flag accommodations**

In `BriefEditor.tsx`, per-flag accommodation row gets a "Ver sugestões" button. New server function `suggestAccommodation` in `src/server/phased/accommodation-suggestions.functions.ts` calling Claude Haiku with the flag text + strategy + locale.

System prompt:

```
You suggest evidence-based exercise modifications for a flagged condition.
Return: { modifications: string[] (1-3 specific exercise/setup changes), reference?: string }

CITATION RULES (strict):
- Only cite well-known guidelines/papers you can recall with full confidence: ACSM guidelines, NSCA Essentials, Cools et al. 2014 (scapular kinematics), Reiman & Manske 2014 (functional testing), McGill spine work.
- If you cannot recall a specific study with confidence (authors, year, journal), output "Research suggests..." instead of inventing.
- Never fabricate authors, years, or journal names.
- When in doubt, omit the reference field entirely. A useful modification with no citation beats a modification with a fake one.

```

Returns `{ modifications: string[], reference?: string }`. Render inline below the flag.

---

**Item 9 — Founder bypass**

- `.env`: add `FORGE_FOUNDER_EMAILS=aafonsodias@gmail.com` (comma-separated allowlist, server-readable). Also expose to client via `VITE_FORGE_FOUNDER_EMAILS` for UI gating.
- New helper `src/lib/founder.ts`: `isFounderEmail(email)` parsing the env var.
- `AppShell.tsx`: skip the trial banner if `isFounderEmail(user.email)`. Show small "Founder" pill in the user menu.
- `billing.tsx`: skip the access-wall redirect / show a "Founder account — billing disabled" panel when applicable.

---

**Item 10 — Posture photo upload (Phase 1, capture only)**

- Migration: create storage bucket `posture-photos` with RLS — trainers can read/write only paths starting with `${trainer_id}/`.
- Migration: `assessments.posture_photos jsonb default '{}'::jsonb` storing `{ front, side, back: { path, uploaded_at } }`.
- New `src/components/PostureCapture.tsx` rendered below the Posture & Alignment section: 3 upload slots (Frente / Lado / Trás), each shows current thumbnail, replace button, lightbox on click.
- Upload path: `posture-photos/${trainerId}/${clientId}/${assessmentId}/${view}.jpg`. Store path in `assessments.posture_photos`.
- "Comparar com avaliação anterior" button: queries the previous `assessments` row for the same client (by `created_at`), opens a modal with side-by-side thumbnails for each view. Disabled if no previous assessment with photos.
- No skeleton overlay, no AI — Phase 2 work deferred.

---

**Item 11 — Pull + Carry in Movement Screen**

- Migration: `assessments.pull_pattern_score int`, `pull_pattern_note text`, `carry_pattern_score int`, `carry_pattern_note text`. Validation trigger: scores 1–5.
- Update `validate_assessment_ranges()` accordingly.
- Movement Screen section in `clients_.$clientId.tsx`: add the two new score+note fields.
- `pickSectionPayload` in `section-map.ts`: include pull/carry fields for the screen section so the brief AI sees them.
- Update `MovementCompetencyRadar` (item 2) to read these directly — no more "not assessed" hallucinations.

---

**Item 12 — Reassessment infrastructure**

- Migration: 
  ```sql
  alter table assessments  add column is_reassessment boolean not null default false,  add column previous_assessment_id uuid references assessments(id) on delete set null;

  ```
- Client page: "Nova avaliação" button next to the existing assessment. Click opens dialog: "Reavaliação" / "Nova avaliação completa".
- Reassessment path: insert a new `assessments` row with `is_reassessment=true`, `previous_assessment_id` set, copies forward stable fields (PAR-Q+, equipment, history, goals). Trainer is then dropped into the new assessment with only volatile sections expanded by default (anthropometry, mobility, posture, screen, performance markers).
- Full UI flow for diff/comparison is out of scope this round — schema + entry button only.

---

**Item 13 — Landing page teaser visuals**

In `src/routes/index.tsx`, below the existing features grid, add a 4-tile preview row using inline SVG/CSS mockups (no real screenshots needed):

- Client snapshot card mock (avatar + 3 stat chips).
- Movement competency radar (reuse `MovementCompetencyRadar` with sample data).
- Red flags banner snippet (3 chips with severity colors).
- Brief generation flow (3-step pill row: Avaliação → Brief → Plano).

Add i18n keys under `plan:landing.preview.*`. Mobile: stack to 2x2.

---

**Technical notes**

- No new heavy deps. Radar chart is hand-rolled SVG (~80 lines). Photo upload uses the existing supabase storage client.
- All AI calls go through `callAnthropicWithSchema` with the new `locale` field threaded through system prompts.
- Migrations land before code that uses the new columns/buckets.
- Phased flag (`profiles.phased_generation_enabled`) continues to gate every AI call — no behavior change for trainers without it.
- Mobile: every new layout uses `md:` breakpoints; client snapshot card and radar reflow to single column under 640px.
- Locale-aware: every AI call must respect `i18n.language` (pt-pt default, en-GB fallback). Hard-coded English strings are bugs.

---

&nbsp;