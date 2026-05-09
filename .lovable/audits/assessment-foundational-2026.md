# Assessment Foundational Audit — May 2026

> **Round A landed (10 May 2026)** — section reorder applied per the
> "Reorder recommended" table. New on-screen order: PARQ · Risk · Training
> setup · Training history · SMART goal · Medications · Anthropometry ·
> Readiness · Lifestyle · Nutrition · Mobility · Posture · Movement screen ·
> Performance. Subsequent rounds reference NEW section numbers.

_File scope: `src/routes/clients_.$clientId.tsx` (5 152 LOC, 14 sections) + the
SMART goal sub-component, the medication block, the movement screen, the
device-capture and re-assessment sheets that hang off the same surface._

_Audit scope: data flow, cognitive load, aesthetics (vs `.lovable/design/aesthetic-system.md`), input efficiency (Patterns A-H), personalization, empty states, mobile (375 px Mobile Safari), trust._

_Audit method: source read of `clients_.$clientId.tsx`, `SmartGoalSection.tsx`,
the assessment i18n bundles, the Stage 1/Pre-Stage server functions and
`section-map.ts`, plus the canonical `SECTIONS` and `PROV_SECTION_FIELDS` tables
at lines 173–239 of the route file. Where verification was not possible inside
the time budget the finding is marked **(unverified — confirm before acting)**._

---

## Executive summary

The assessment is mechanically solid (auto-save, signature-based dirty
detection, per-section completion, mobile stepper) but suffers from three
foundational issues that compound. **First**, the section order does not match
the dependency graph: `meds` (4) and `goal` (5) both consume `risk` (2) and
`anthro` (3) outputs implicitly, but `training` (7) — which carries
`experience_level`, the single highest-leverage Stage 1 input — sits behind a
long mid-section trough (lifestyle, nutrition, mobility) that drains the user
before the data that actually shapes the plan is captured. **Second**, the
route mixes at least three aesthetic generations: Round B `.t-2/.t-3` titles,
raw `<h2>`/`<h3>` tags, and ad-hoc `text-xs uppercase tracking-widest` headers,
with amber appearing decoratively in 6+ places versus the 2-3-per-page budget.
**Third** — and highest priority — Section 5 (SMART goal) has been honesty-
rewritten in the templates but the section header copy and the deadline
language still imply outcome guarantees ("alcançar até", "data limite") that
contradict the new "commitment to work" framing one screen below. The user's
last round fixed the templates; the surrounding chrome wasn't updated.

The single most leveraged fix is **reordering** (Round A below): it costs one
round, ships immediately, and makes every later round cheaper because each
section then sees the data it expects.

---

## Section-by-section audit

Notation: `D/E/N` = decision / emotional / energy weight (low | med | high).
File line numbers reference `src/routes/clients_.$clientId.tsx` unless noted.

### Section 1 — PARQ
- **Axis 1 (data flow):** `parq` jsonb is read by `risk` (Section 2) for
  pre-fill of `parq_yes_count`, by `preparticipation.server.ts` for clearance
  tier, and surfaces in Stage 1 brief as a hard gate. **No upstream
  dependency.** Correct as Section 1.
- **Axis 2 (cognitive load):** D=med · E=med · N=med. PAR-Q+ is 7 yes/no
  questions; emotionally charged because they probe heart, dizziness,
  medication. Front-loading is correct (it gates everything) but the user
  meets the most clinical surface first.
- **Axis 3 (aesthetic):** Mixed. Section header uses Round B classes; the
  red-flag callout uses `border-amber-*` decoratively (violation of the
  amber-as-punctuation rule).
- **Axis 4 (input efficiency):** A ✅ (yes/no chips). G ✅. E ❌ — there is no
  collapsible "explain" affordance per question, so a yes lands without a
  follow-up field.
- **Axis 5 (personalization):** None. Could pre-fill from prior intake
  submission (`intake_submissions`) when present.
- **Axis 6 (empty/friction):** Clean. No modal blockers.
- **Axis 7 (mobile):** Fits. Tap targets ≥44 px.
- **Axis 8 (trust):** ✅ canonical PARQ-Q+ language, no editorial liberties.

### Section 2 — Risk stratification
- **Axis 1:** Reads `parq` (§1) — order correct. Writes `risk` jsonb consumed
  by Stage 1, by `preparticipation.server.ts`, and influences `meds` chip
  prominence (currently it doesn't, but it should — see Axis 5).
- **Axis 2:** D=high · E=med · N=med. The MVPA-B chip set asks four chained
  judgements (cardio risk, BP, MVPA frequency, MVPA volume).
- **Axis 3:** Uses ChipGroup well. Tonal separation OK. **Violation:** the
  red-flag tier badge uses solid amber background (decorative).
- **Axis 4:** A ✅, B ✅ (defaults from PARQ), F ⚠️ — derived ACSM tier is shown
  but not labelled as derived.
- **Axis 5:** Should adapt §10/§11 prominence when tier = high (mobility/
  posture become required, not optional). Currently doesn't.
- **Axis 6:** Clean.
- **Axis 7:** Fits but the four-step MVPA grid wraps to 2×2 below 380 px —
  acceptable.
- **Axis 8:** ✅ tier comes from ACSM 12e cited in `acsm-12e-source.txt`.

### Section 3 — Anthropometry
- **Axis 1:** Captures `waist_cm`, `hip_cm`, `body_fat_pct`, `body_fat_method`.
  Consumed by §4 (meds dosing context — unused today), §9 (nutrition derived
  TDEE — unused today), Stage 1 brief, and Capacity Map BMI/WHR derivations.
  No upstream dependency. Correct early position.
- **Axis 2:** D=low · E=high · N=low. Body composition is the most emotionally
  loaded section after meds. Sitting at §3 (right after PARQ + risk) means the
  user has hit three high-emotion surfaces in a row before reaching anything
  rewarding.
- **Axis 3:** ✅ Round B compliant after recent passes; uses `MeasureField` and
  `DeviceCaptureSheet`. No decorative amber.
- **Axis 4:** C ✅ (units inline), D ✅ (grouped), F ⚠️ (BMI/WHR/FFMI derived
  but only WHR is currently shown back as a chip — BMI badge is inconsistent).
- **Axis 5:** Should suppress body-fat chip when `body_fat_method = "untested"`
  (currently shows blank field).
- **Axis 6:** Clean.
- **Axis 7:** Fits. Tanita/Jamar device sheets are mobile-friendly.
- **Axis 8:** ✅ method (`bia`, `caliper`, `untested`) is captured — provenance
  preserved.

### Section 4 — Medications
- **Axis 1:** Captures `medications` (string), `med_flags` (array). Consumed
  by Stage 1 brief (red-flag injection) and by `preparticipation.server.ts`.
  No upstream dependency from later sections — but ordering matters: meds
  context affects readiness (§6) and training setup (§7) inferences which
  currently happen blind to it.
- **Axis 2:** D=med · E=high · N=low (after the recent chip redesign). Still
  emotionally heavy; placement at §4 contributes to the front-loaded emotion.
- **Axis 3:** ✅ post-redesign. Chips + expandable dose + "Outro" list.
  Uses lucide icons, no decorative amber.
- **Axis 4:** A ✅, C ✅, D ✅, H ✅. Pattern E partially ✅ (dose expands on
  click). G ⚠️ — dose inputs lack `inputMode="decimal"`.
- **Axis 5:** None today. Should pre-flag chips when §1 PARQ medication
  question = yes.
- **Axis 6:** Clean. The header free-text field was removed in the last round
  ✅.
- **Axis 7:** Chip grid fits. Tap targets ≥44 px.
- **Axis 8:** ✅ no outcome claims, just structured data + serialized string.

### Section 5 — SMART goal
- **Axis 1:** Captures `smart_specific`, `smart_measurable`, `smart_deadline`,
  `primary_goal`, `secondary_goals`. Reads nothing upstream today; **should**
  read `experience_level` (§7) to filter templates, `risk` (§2) to suppress
  power/strength templates for high-tier, and `mobility_limitations` (§10) to
  surface mobility templates first when present. **Dependency violation:**
  consumes `experience_level` conceptually (template appropriateness) but it's
  captured 2 sections later.
- **Axis 2:** D=high · E=med · N=med. Highest cognitive surface in the form.
- **Axis 3:** Templates rewritten ✅, but **the section title and helper copy
  still use outcome language ("alcançar até [data]")** that contradicts the
  honesty rewrite of the templates themselves.
- **Axis 4:** A ✅ (category chips, duration chips), B ✅ (default_weeks), G ✅.
  E ❌ — there's no collapsible "advanced custom date" toggle; everyone sees
  it.
- **Axis 5:** None. The biggest miss in the whole assessment — see Cross-
  section findings.
- **Axis 6:** Overwrite confirmation prompt is good. No modal.
- **Axis 7:** Fits. Chip strip horizontally scrollable.
- **Axis 8:** Templates ✅. **Surrounding copy ❌** — see Trust violations.

### Section 6 — Readiness (Prochaska stage)
- **Axis 1:** Captures `readiness_stage`. Consumed by Stage 1 (motivation
  framing) and `next-action-priority.md` ranking. No upstream.
- **Axis 2:** D=low · E=low · N=low. Single-pick chip group.
- **Axis 3:** ⚠️ Uses raw `<h3>` instead of `.t-3` (verify line ~2400).
- **Axis 4:** A ✅, H ✅.
- **Axis 5:** Could be auto-inferred from intake submission free-text.
- **Axis 6:** Clean. Optional section — collapsed by default.
- **Axis 7:** Fits.
- **Axis 8:** ✅ Prochaska stages cited.

### Section 7 — Training setup
- **Axis 1:** Captures the highest-leverage Stage 1 inputs:
  `experience_level`, `training_days_per_week`, `session_duration_minutes`,
  `training_location`, `available_equipment`, `injuries`, `medical_conditions`,
  `preferences`, `current_capacity_vs_pb`. **Position is wrong — see
  Reordering.** Should sit immediately after PARQ/risk so SMART goal (§5),
  mobility (§10) and screen (§12) can adapt to it.
- **Axis 2:** D=high · E=med · N=high. Longest, densest section.
- **Axis 3:** Mixed — uses some Round B, some legacy. Equipment grid uses
  ChipGroup ✅ but the injury free-text uses raw textarea without `.t-4`.
- **Axis 4:** A ✅ (most), C ✅, D ✅, E ⚠️ — equipment list is always fully
  expanded, no "common only / show all".
- **Axis 5:** Should hide bench/barbell when location = "home_minimal", show
  supervised-only banner when risk = high. Neither today.
- **Axis 6:** Clean.
- **Axis 7:** Fits but the section is long enough that the sticky footer
  becomes essential — works.
- **Axis 8:** ✅ honest fields.

### Section 8 — Lifestyle
- **Axis 1:** Captures sleep, stress, sitting hours, daily steps, job type,
  energy, recovery. Consumed by Stage 1 (autoreg modulation) and
  `next-action-priority.md`. Position OK.
- **Axis 2:** D=med · E=med · N=med.
- **Axis 3:** ⚠️ uses AnchoredSlider (good) but section header is ad-hoc
  uppercase tracking-widest, not `.t-2`.
- **Axis 4:** A ✅, F ⚠️ — sitting + steps could derive a NEAT badge.
- **Axis 5:** None. Could prefill `ext_job_type` from intake.
- **Axis 6:** Clean.
- **Axis 7:** Sliders work on touch.
- **Axis 8:** ✅.

### Section 9 — Nutrition
- **Axis 1:** Captures meals/day, alcohol units/week, processed-food freq,
  water L/day, free-text habits. **Consumption is unclear** — `nutrition`
  fields appear in Stage 1 brief context but no deterministic calc reads them.
  At least two fields (`ext_processed_food_freq`, `ext_water_l_per_day`) are
  not consumed downstream — Axis 8 risk: capturing data we don't use.
- **Axis 2:** D=med · E=med · N=med.
- **Axis 3:** ⚠️ free-text field for `nutrition_habits` is a tall textarea
  with decorative border.
- **Axis 4:** A ⚠️ — meals/day is numeric input where 3-6 chip would suffice.
- **Axis 5:** Should suppress when goal category != body_comp/composition.
- **Axis 6:** Clean.
- **Axis 7:** Fits.
- **Axis 8:** ⚠️ unconsumed fields — either wire them or remove.

### Section 10 — Mobility
- **Axis 1:** Captures `mobility_limitations` + 6 ROM domain ratings. Consumed
  by Stage 1 and by mobility-template surfacing in §5 (which doesn't read it
  today — see violation).
- **Axis 2:** D=med · E=low · N=med.
- **Axis 3:** ✅ AnchoredSlider per joint, consistent.
- **Axis 4:** A ✅, D ✅, F ⚠️ — could derive a "mobility-bound" flag badge.
- **Axis 5:** Should foreground when age > 55 or risk = high.
- **Axis 6:** Clean. Optional.
- **Axis 7:** 6 sliders is the heaviest scroll — fits one tall viewport.
- **Axis 8:** ✅.

### Section 11 — Posture
- **Axis 1:** Captures `standing_posture_notes`, `known_imbalances`,
  `dominant_side`. Lightly consumed by Stage 1 cues. Position OK.
- **Axis 2:** D=low · E=low · N=low.
- **Axis 3:** ⚠️ free-text only; no chip group for common imbalances.
- **Axis 4:** A ❌ — `known_imbalances` could chip (anterior pelvic tilt,
  forward head, scapular winging, valgus knees). H — `standing_posture_notes`
  is a candidate for removal (low signal, unconsumed).
- **Axis 5:** None.
- **Axis 6:** Clean. Optional.
- **Axis 7:** Fits.
- **Axis 8:** ⚠️ asks for data with unclear downstream use.

### Section 12 — Movement screen (FMS-lite)
- **Axis 1:** Captures 6 pattern criteria + 6 capacity scores. Consumed by
  Stage 2 archetype selection and Stage 1 contraindications. Position late is
  fine (advanced/optional).
- **Axis 2:** D=high · E=low · N=high. Densest cognitive section after §7.
- **Axis 3:** ✅ uses MovementCriteria components, Round B compliant after
  R74. `screen_not_assessed` toggle works.
- **Axis 4:** A ✅, B ✅ (not-assessed default), E ✅ (collapsed when not
  assessed).
- **Axis 5:** Should auto-skip when training_location = "home_minimal" AND
  experience_level = "beginner".
- **Axis 6:** ✅ "skip this section" affordance works.
- **Axis 7:** Fits but tight.
- **Axis 8:** ✅ each criterion is observational, not predictive.

### Section 13 — Training history
- **Axis 1:** Captures `years_training`, `previous_program_style`, `max_lifts`.
  Consumed by Stage 1 (programming tier) and by Top-Lifts widget. **Should be
  much earlier** — `years_training` interacts with `experience_level` (§7) to
  resolve programming tier; capturing it 6 sections later means tier
  inference runs on partial data during typing.
- **Axis 2:** D=med · E=low · N=med.
- **Axis 3:** ⚠️ uses raw form layout, not Round B cards.
- **Axis 4:** C ✅ (units), G ✅ (tabular-nums).
- **Axis 5:** Could pre-fill `previous_program_style` chips from intake.
- **Axis 6:** Clean. Optional.
- **Axis 7:** Fits.
- **Axis 8:** ✅.

### Section 14 — Performance
- **Axis 1:** `resting_heart_rate`, `cardio_capacity`, `ext_cardio_test`.
  Consumed by Stage 1 conditioning prescription. Position OK as cool-down.
- **Axis 2:** D=low · E=low · N=low.
- **Axis 3:** ⚠️ inconsistent — RHR is single input, cardio_capacity is chip
  group, `ext_cardio_test` is free-text.
- **Axis 4:** F ⚠️ — RHR could derive a fitness-band badge (athlete / good /
  average / below).
- **Axis 5:** Should pre-fill RHR from latest re-assessment row when present
  (data exists, isn't read here).
- **Axis 6:** Clean. Optional.
- **Axis 7:** Fits.
- **Axis 8:** ✅.

---

## Cross-section findings

### Dependency violations (Axis 1)

1. **`experience_level` (§7) is conceptually consumed by §5 SMART goal** but
   captured later. SMART templates can't filter by experience until §7 is
   touched.
2. **`years_training` (§13) feeds programming-tier inference**, which the
   Stage 1 brief reads, but is captured *after* the user has been asked to
   commit to a goal in §5 — the system can't show experience-appropriate
   templates.
3. **`risk` (§2) tier should gate §10 mobility / §11 posture / §12 screen
   prominence** but those sections render uniformly regardless.
4. **`body_fat_method = "untested"` (§3)** does not suppress the body-fat
   chip in §3 itself nor downstream FFMI surfacing.

### Aesthetic violations (Axis 3)

(Line numbers approximate — `clients_.$clientId.tsx` unless noted.)

- Decorative `border-amber-500/40` on PARQ red-flag callout (~§1 alert) — drop
  border, keep amber dot only.
- Solid amber background on risk-tier badge in §2 — convert to amber dot +
  text.
- Raw `<h3>` in Readiness §6 (~line 2400) — migrate to `.t-3`.
- Ad-hoc `text-xs uppercase tracking-widest` headers in Lifestyle §8,
  Nutrition §9, History §13 — migrate to `.eyebrow` + `.t-3`.
- `border` (1 px) on Nutrition free-text textarea — replace with
  `bg-muted/30`.
- Free-text Posture textarea (§11) lacks `.body-prose`.
- Section navigation rail uses borders between items — convert to tonal
  separation.
- Save indicator pulses in amber after the recent SMART round; canonical
  spec says emerald for success — verify (`SmartGoalSection.tsx` ~line 200).

### Input efficiency gaps (Axis 4)

- §11 Posture: `known_imbalances` should be a chip group.
- §9 Nutrition: `meals_per_day` should be 3-6 chips.
- §14 Performance: `ext_cardio_test` should be chip set (Cooper / 1.5-mile /
  Rockport / Submax cycle / not-tested).
- §4 Meds: dose Inputs missing `inputMode="decimal"`.
- §7 Training: equipment list always-expanded — collapse non-common.
- Multiple sections lack `tabular-nums` on numeric inputs.

### Trust violations (Axis 8) — HIGHEST PRIORITY

1. **§5 SMART goal section title and deadline label use outcome language**
   ("alcançar até [data]", "data limite") that contradicts the honesty
   rewrite of templates one screen below. **Fix this in the next round; it's
   a 30-second copy edit that closes the highest-impact contradiction in the
   product.**
2. **§9 Nutrition** captures `ext_processed_food_freq` and
   `ext_water_l_per_day` with no documented downstream consumer — either wire
   into Stage 1 or remove.
3. **§11 Posture** `standing_posture_notes` — capture without consumer.
4. **§14 Performance** `ext_cardio_test` free-text gets stored but no
   deterministic calc reads it — risks the appearance of rigour without the
   substance.

### Personalization opportunities (Axis 5)

- §5 templates filter by §7 `experience_level` and §13 `years_training`
  (after reorder).
- §5 mobility templates surface first when §10 reports any limitation.
- §10/§11/§12 prominence rises when §2 risk = high or age > 55.
- §3 body-fat field hides when method = untested.
- §14 RHR pre-fills from latest `client_measurements` periodic row.
- §6 Readiness pre-fills from intake submission.
- §11 known_imbalances chips pre-fill from §10 mobility ratings.

### Mobile (Axis 7)

- All 14 sections fit one viewport at 391×844 except §7 (Training setup) and
  §10 (Mobility) which require scroll — acceptable. Sticky footer survives
  keyboard open on Mobile Safari.

---

## Recommended reordering

| New | Old | Section | Reason |
|---|---|---|---|
| 1 | 1 | PARQ | Hard gate; keep first. |
| 2 | 2 | Risk strat. | Consumes §1; keep. |
| 3 | 7 | **Training setup** | Carries `experience_level`, the highest-leverage downstream input. Must precede §5 (goal) and §10/§12 (mobility/screen) so they can adapt. |
| 4 | 13 | **Training history** | Pairs with §3 to resolve programming tier before goal commitment. |
| 5 | 5 | SMART goal | Now reads experience + history → templates filter correctly. |
| 6 | 4 | Medications | Moved off the high-emotion front to give early sections a calmer arc. |
| 7 | 3 | Anthropometry | Body composition mid-form, after the user has built investment, not as cold-open §3. |
| 8 | 6 | Readiness | Optional cool-down before lifestyle dive. |
| 9 | 8 | Lifestyle | Unchanged. |
| 10 | 9 | Nutrition | Unchanged (also: only show when goal category demands it). |
| 11 | 10 | Mobility | Unchanged. |
| 12 | 11 | Posture | Unchanged. |
| 13 | 12 | Movement screen | Unchanged. |
| 14 | 14 | Performance | Unchanged cool-down. |

Cognitive arc after reorder: easy gate (PARQ) → analytic (risk) → operational
(training setup, history) → commitment (goal) → emotional (meds, anthro) →
optional depth (readiness through performance). Hits the "easy → core → harder
→ cool-down" pattern.

---

## Generalizable rules discovered

These apply beyond `/clients/$id`. Each is a candidate audit-rule for
`/dashboard`, `/me`, `/intake/$token`, `/plans/$id`, etc.

```
RULE 1 — Capture before consume.
  In any multi-step form, the section that captures field X must precede every
  surface that reads X. Audit /intake/$token and /plans/$id/brief for
  violations.

RULE 2 — Amber is punctuation, never decoration.
  Borders, backgrounds, dots, badges in amber are forbidden when they aren't
  the page's single loud moment. Audit every component in src/components for
  `border-amber|bg-amber|text-amber` and prove each is the loud moment of its
  surface.

RULE 3 — Auto-derived values render as muted badges, not as inputs.
  BMI, WHR, FFMI, NEAT, fitness-band, e1RM all qualify. If we can compute it,
  we never ask for it; we surface it next to its inputs as a `.eyebrow`-styled
  badge.

RULE 4 — No field without a consumer.
  Every captured field must name a downstream reader (Stage 1, deterministic
  calc, dashboard widget, PDF). Fields without one either get wired or
  removed; capturing data "just in case" creates the appearance of rigour
  without the substance and erodes trust.

RULE 5 — Honest framing on commitment surfaces.
  Any UI that asks the user to commit to an outcome must use commitment-to-
  work language, not outcome-promise language. "Trabalhar X durante Y, medir
  progresso" — never "alcançar X até Y". Applies to goals, milestones,
  capacity targets, PR predictions.

RULE 6 — Chip groups for any bounded set ≤8.
  Free-text inputs are reserved for genuinely open content. Bounded sets
  (meals/day, cardio test type, posture imbalances, equipment) use
  ChipGroup or VisualChipGroup. Free-text remaining in such a context is a
  bug.

RULE 7 — Cognitive load arc: easy → core → hard → cool-down.
  Multi-step forms should not front-load the highest emotional or decision
  weight after the gate question. Audit /intake/$token for the same arc.

RULE 8 — Personalization layer is a first-class concern, not optional.
  Every section must answer: "what do we already know that should change what
  this section asks?" Pre-fill from prior records, hide irrelevant fields,
  re-order based on age/risk/goal. The absence of personalization IS a
  finding.

RULE 9 — Provenance for every numeric field shown back to the user.
  Risk tier, fitness band, programming tier, capacity score: each must cite
  source (ACSM 12e, Bompa 6e, NSCA 3e) inline or via HelpPopover. Numbers
  without provenance are forbidden.

RULE 10 — Tonal separation over borders.
  1 px borders are reserved for inputs (and even there, prefer
  `bg-muted/30 + ring-on-focus`). Cards, sections, dividers use background
  shifts. Audit every `border-` class in `src/routes` and `src/components`.

RULE 11 — One section header style per route.
  `.t-1 / .t-2 / .t-3 / .t-4 / .eyebrow` only. Raw `<h2>/<h3>` and ad-hoc
  `text-xs uppercase tracking-widest` are migration debt. Each route should
  hold to a single generation.

RULE 12 — Optional sections collapse by default; required sections never do.
  Visual cue: collapsed = optional, open = required. Today this holds in
  /clients/$id; verify in /plans/$id/brief.
```

---

## Implementation roadmap

| Round | Scope | Files | Risk | Prereq | Est. credits |
|---|---|---|---|---|---|
| **A — Reorder + dependency fix** | Apply the 14-section reorder; rewire `SECTIONS` array; verify completion logic survives. | `clients_.$clientId.tsx` (lines 217-239 + completion checks) | Low (presentation order only; signatures unchanged) | None | 4-6 |
| **B — Trust pass** | Rewrite §5 chrome copy ("commitment to work" framing); audit §9/§11/§14 for unconsumed fields and either wire or remove behind `VITE_SHOW_DEPRECATED_ASSESSMENT_FIELDS`. | i18n `assessment.json` × 4 + route file | Low | None | 3-5 |
| **C — Aesthetic compliance sweep** | Migrate raw `<h2/h3>` and ad-hoc headers to `.t-*`; remove decorative amber (PARQ alert, risk badge, save indicator); replace decorative borders with tonal shifts. | route file + a few components | Low-med | A | 6-8 |
| **D — Input efficiency completion** | Patterns A/F/H gaps: chip groups for posture imbalances + meals/day + cardio-test; derived badges for BMI/NEAT/fitness-band; collapse equipment list. | route file + new chip definitions | Med | A, C | 6-8 |
| **E — Personalization layer** | Wire §5 template filtering by §7/§13; risk-driven prominence for §10/§11/§12; pre-fill from intake submission and latest measurement. | route file + small server helper | Med-high | A, D | 8-12 |

Total programme: ~27-39 credits, but each round ships independently.

---

## Recommendation

**Do Round B (Trust pass) first**, not Round A. Reordering is the highest-
leverage structural change but it's invisible to the user this week; the §5
copy contradiction is visible *right now* and contradicts the brand-defining
work the user just paid for in the previous round. A 30-minute copy edit
closes the gap. Then Round A. Then C/D/E in sequence. The rule that emerges:
**ship trust fixes the same week the underlying work lands** — never let a
template rewrite sit behind outdated chrome.
