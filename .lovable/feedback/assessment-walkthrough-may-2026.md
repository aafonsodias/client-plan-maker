# Assessment walkthrough — May 2026

Source: founder, after end-to-end run of the assessment as a fake client. Captured verbatim where useful, organized by category for action prioritization. Original message preserved at bottom of file for reference.

## How to read this document

This is feedback inventory, not a roadmap. Each item is tagged by:

- **Type**: bug · aesthetic · educational · architectural · principle-conflict · parking-lot
- **Section**: which assessment section (or "cross-cutting")
- **Effort estimate**: small · medium · large · foundational
- **Priority hint**: P0 (blocks usage) · P1 (visible inconsistency) · P2 (nice-to-have) · P3 (future vision)

The Implementation roadmap section at the end groups items into proposed mini-rounds. Each mini-round has ONE objective and is verifiable independently.

---

## Cross-cutting findings (apply to every section)

### CC1 — "Implicações para a prescrição" should be at end of every section, collapsed by default
- **Type**: aesthetic + architectural
- **Effort**: medium
- **Priority**: P1
- **Detail**: Currently inconsistent. Some sections show analysis at top, some have legacy "Análise" alongside new "Implicações", some don't have it at all. Standardize: every section ends with one collapsed "Implicações para a prescrição" block. Removes redundancy with old "Análise" block. Prevents the entire pre-stage analysis from running only at the end (performance concern noted).

### CC2 — Aesthetic inconsistency across assessment sections
- **Type**: aesthetic
- **Effort**: medium
- **Priority**: P1
- **Detail**: Visual hierarchy unclear in many sections. Doesn't follow the established 7-principles aesthetic system consistently. Need a sweep applying `.t-*`, `.eyebrow`, `.body-prose`, `.label-caps`, tonal separation, amber budget per section.

### CC3 — Need illustrations/drawings throughout
- **Type**: educational + aesthetic
- **Effort**: large
- **Priority**: P1
- **Detail**: User specifically requests drawings/illustrations across multiple sections (mobility, posture, measurements, exercise screens, equipment, hydration). Each needs SVG line art consistent with the existing aesthetic (warm neutrals, no characters with sex features, theme-adaptive via currentColor). Must respect 3 themes.

### CC4 — Page-per-topic pattern (slider per concern)
- **Type**: architectural
- **Effort**: foundational
- **Priority**: P1
- **Detail**: User wants each concern to be its own bite-sized page (slider/step), not crammed into one section. Examples: hydration deserves own page with educational content, nutrition own page, mobility limitations own page after mobility ratings, equipment own page, preferences own page, etc. Reframes assessment from "14 dense sections" to "many bite-sized cards".

### CC5 — Skip button + warning, never block completion
- **Type**: bug + architectural
- **Effort**: small
- **Priority**: P0
- **Detail**: "Concluir" button is currently disabled when assessment incomplete. Should be enabled with warning that quality is reduced and missing parts can be filled by trainer in person later. Never block.

### CC6 — Educational content delivery in PDF synthesis
- **Type**: educational + foundational
- **Effort**: large
- **Priority**: P2
- **Detail**: At end of assessment, generate a PDF synthesis with the "livro de bons costumes": nutrition guidance based on profile, hydration recommendations with personal water target, sleep importance, posture awareness, exercise lifestyle support. Profile-aware educational content. Substantial work.

### CC7 — Faixas (martial-arts-color metaphor for years training)
- **Type**: architectural + aesthetic
- **Effort**: medium
- **Priority**: P2
- **Detail**: Replace numeric "anos a treinar" with color tiers (white → blue → purple → coral → red). Reflects in client card and profile subtly. Important note: NEVER reference jiu-jitsu in code, copy, or commits — only the founder knows the inspiration.

### CC8 — Live update of "Implicações" as user types
- **Type**: bug
- **Effort**: medium
- **Priority**: P1
- **Detail**: Implicações block currently shows stale "no data" text even after fields filled. Should re-run pre-stage analyzer reactively or at minimum on field blur per section.

### CC9 — Move pre-stage analysis from end to per-section (performance)
- **Type**: architectural
- **Effort**: medium
- **Priority**: P1
- **Detail**: Currently analysis happens at end of assessment. Moving to per-section analysis avoids slow pre-stage at the end. Also enables the per-section "Implicações" block to be live.

### CC10 — Single name for the analysis section
- **Type**: aesthetic
- **Effort**: small
- **Priority**: P2
- **Detail**: Currently "Análise" and "Implicações para a prescrição" coexist redundantly. Pick one name. User suggests "Implicações" but open to better name.

---

## Section-by-section findings

### §1 PARQ
(Currently at position 1 after reorder — confirm)
- No specific complaints surfaced in this walkthrough.

### §2 Risk stratification
- No specific complaints surfaced.

### §3 Training setup (formerly §7, moved by Round A)
- **3.1 Experience level too subjective** — Type: architectural · Effort: medium · Priority: P1
  - User can't decide subjectively. Need to elaborate experience determination — possibly use `years_training` (faixas) + recent training pattern + recent metrics rather than ask "are you beginner/intermediate/advanced".
- **3.2 Days per week as 1-7 chips** — Type: aesthetic · Effort: small · Priority: P2
  - Better than slider. Auto-pre-select based on experience level. User can override; override is logged. Show explanation for why this number recommended (minimum stimulus, body adapts, can increase later).
- **3.3 Session duration as time chips (30/45/60/75 + custom)** — Type: aesthetic · Effort: small · Priority: P2
  - Replace slider/input with chips. Few people train 15 min or >75 min. Convenient.
- **3.4 Plan duration "gamified" with educational cards** — Type: educational · Effort: medium · Priority: P2
  - Plan duration shouldn't be left to user guess. Pre-select based on experience + assessment data. Show explanation cards (ACSM percentages by age?). Teach the user the rationale.
- **3.5 All technical decisions auto-decided, user adjusts** — Type: architectural · Effort: foundational · Priority: P1
  - Principle: Protocol auto-decides technical choices; user adjusts. Need to identify which assessment data feeds which technical decision.
- **3.6 Equipment as own page with drawings** — Type: aesthetic + architectural · Effort: medium · Priority: P2
  - Move equipment to own page. Add SVG drawings per equipment type. Be more complete.
- **3.7 Injuries: visual body map for pointing pain location** — Type: educational + architectural · Effort: large · Priority: P1
  - User wants interactive body map (front/back, rotatable). Tap location → register zone. App suggests common injuries for that zone or user notes "don't know what it is". Allow multiple injuries. Allow undo. CTA: "request medical documents relevant to exercise" — future tracking, logging, graphic display, info fusion.
  - Own page (slider).
- **3.8 Preferences: own page with drawings** — Type: aesthetic + architectural · Effort: medium · Priority: P2
  - Suggest training types: circuits, supersets, single sets, paired training (2 people), rep challenges, time-based challenges, etc. Drawings for each. Own page.

### §4 Training history (formerly §13, moved by Round A)
- **4.1 Years training as faixas (color tiers)** — see CC7
- **4.2 Maxes as separate optional section** — Type: architectural · Effort: medium · Priority: P2
  - Many clients don't know maxes; some used to but don't now. Move to optional advanced section.
  - User skeptical about asking 1RM directly. Use submax + Epley regression.
- **4.3 Previous program style with figure drawings** — Type: aesthetic · Effort: medium · Priority: P2
  - Common splits as drawings (push-pull-legs, upper-lower, full body, bro split, etc.). Own page.

### §5 SMART goal (current §5)
- **5.1 Selected vs available state visually unclear** — Type: bug · Effort: small · Priority: P0
  - Even after Round C affordance fix. Within selected category (e.g. Força), can't tell which template is currently selected. Need clearer visual state.
- **5.2 Implicações not collapsed by default** — see CC1
- **5.3 Aesthetic broken on this section per user** — Type: aesthetic · Effort: medium · Priority: P1
  - Doesn't yet feel coherent. Templates feel "dry/seco". Letters seem misaligned (verify).
- **5.4 Each goal needs a small drawing** — Type: aesthetic · Effort: medium · Priority: P2
  - Goal templates currently text-only lines. Add small SVG illustration per goal/category.
- **5.5 Multiple goals (2-3) with backlog system** — Type: architectural · Effort: foundational · Priority: P1
  - Allow 2-3 goals per client. Some go to backlog, attacked first by capacity. MVP-relevant.
- **5.6 Goals editable like mesocycle duration** — Type: architectural · Effort: medium · Priority: P2
  - Each goal has variables (specific/measurable/deadline). Tap a variable → context-aware option chips + manual input. Reduces friction.
- **5.7 AI pre-selects favorite goal with explanation** — Type: architectural + principle-conflict · Effort: large · Priority: P2
  - AI uses assessment data to pre-select suggested goal with rationale. User can override.
  - **PRINCIPLE CHECK**: User previously rejected AI in goal section in Round C ("não deixes a IA estragar nada"). This is conflict — needs decision.
- **5.8 Deadline auto-recommended with rationale** — Type: architectural · Effort: medium · Priority: P2
  - Auto-recommend based on goal + experience + age. Explain reasoning. Allow override.
- **5.9 "Janela de trabalho" needs collapse** — see CC1
- **5.10 Each variable click → context-aware chips + manual** — covered in 5.6

### §6 Medications (formerly §4, moved by Round A)
- **6.1 Medication doses (low/medium/high categorization)** — Type: educational + architectural · Effort: large · Priority: P2
  - Per medication, know what's low/medium/high dose and prescription implications. Easy entry: "what does the client take, when, how much".
- **6.2 Implicações missing on medication section** — see CC1, CC8

### §7 Anthropometry (formerly §3, moved by Round A)
- **7.1 Dedicated measurements page with proper drawings** — Type: aesthetic · Effort: large · Priority: P1
  - Current SVG bonecos are inferior to previous version. Redesign: human silhouette without sex features, clear tape placement per measurement, theme-adaptive (3 themes), no children-style art.
- **7.2 Default = waist + hip; optional = others** — Type: aesthetic · Effort: small · Priority: P2
  - Optional measurements show in muted color; become vivid when filled. Encourages completion without forcing.
- **7.3 WHR comparative interpretation vs population** — Type: educational · Effort: medium · Priority: P2
  - Show WHR with population-comparison context. Educational.

### §8 Readiness / Prochaska (formerly §6)
- **8.1 Question framing seems silly to active user** — Type: principle-conflict · Effort: small · Priority: P2
  - "Already started" auto-implies action. Question feels redundant. But distinguishes habit-installed vs <6 months.
- **8.2 Explanation needed for what selection changes** — Type: educational · Effort: small · Priority: P2
  - Explain to user what selecting each stage actually changes in plan.
- **8.3 Sober drawings** — Type: aesthetic · Effort: medium · Priority: P3
- **8.4 Implicações collapse** — see CC1

### §9 Lifestyle
- **9.1 Sleep scale broken (1-10 doesn't capture nuance)** — Type: architectural · Effort: small · Priority: P1
  - "5/10" interprets as "<6 hours" but reality is more nuanced (late sleeper, naps, weekend catch-up).
  - Solution: ask average hours instead, slider with 15-min increments.
- **9.2 Stress subjectivity needed** — kept subjective per user, OK.
- **9.3 Job type as drawings** — already done, user happy.
- **9.4 Implicações collapse** — see CC1

### §10 Nutrition & Hydration
- **10.1 Split into separate pages** — Type: architectural · Effort: medium · Priority: P1
  - Nutrition own page; Hydration own page.
- **10.2 Hydration: water tracking with drawings** — Type: educational + architectural · Effort: large · Priority: P1
  - Calculate ideal water from weight/sex/activity (ACSM). Display as 1.5L bottles visualization, with one bottle partially filled to exact target. Educational content about hydration importance (joints, appetite regulation, inflammation). Track water consumption with optional reminders. Urine color subjective input as alternative to "glasses count".
- **10.3 Nutrition: hand-portion guide (thumb/fist/palm)** — Type: educational · Effort: medium · Priority: P2
  - Hand portion reference for fats/veggies/carbs/protein. Visual.
- **10.4 Educational PDF in synthesis** — see CC6
- **10.5 Meals/day with drawings** — Type: aesthetic · Effort: small · Priority: P3
- **10.6 Drawings for allergies/dietary patterns** — Type: aesthetic · Effort: medium · Priority: P2
  - Common patterns/allergies as visual chips.
- **10.7 Implicações collapse + actually populated** — see CC1, CC8

### §11 Mobility
- **11.1 Test instructions with drawings (profile/lateral views)** — Type: educational · Effort: large · Priority: P0
  - Currently 1-5 scale with no instructions. User can't fill correctly. Need bite-sized instructions per joint with drawings.
- **11.2 Mobility limitations as visual body map** — Type: educational + architectural · Effort: large · Priority: P1
  - Separate slider after mobility ratings. Visual chips with body parts. Note per limitation.
- **11.3 Implicações missing** — see CC1, CC8

### §12 Posture & alignment
- **12.1 Currently insufficient (only "dominant side")** — Type: bug · Effort: large · Priority: P1
  - Need: teach posture observation with drawings per body part. User compares with image, selects findings. App can be handed to companion to read instructions and observe.
- **12.2 Adams test with body map for elevation point** — Type: educational + architectural · Effort: large · Priority: P2
  - Family member helps. Drawing-based input for where elevation is.
- **12.3 Photo capture (front/side/back) for trainer review later** — Type: architectural · Effort: medium · Priority: P3
  - Future: collect photos, trainer interprets later.
- **12.4 Dynamic posture (push/pull/single-leg-squat/overhead-squat)** — Type: educational · Effort: large · Priority: P1
  - Each test with drawings showing correct alignment + observation criteria. Currently advanced section.

### §13 Movement screen
- **13.1 Each move = own page (sliders)** — Type: architectural · Effort: medium · Priority: P1
  - Current: 5 moves crammed in one page. Each needs own bite-sized page with images informing each text observation.
- **13.2 Per-criterion images** — Type: educational · Effort: large · Priority: P0
  - Each text criterion (e.g. "knees aligned with feet") needs visual to show correct vs incorrect.
- **13.3 1RM too aggressive — use submax + Epley regression** — Type: architectural · Effort: small · Priority: P1
  - Replace 1RM with submax (e.g. 10RM) + auto-calc 1RM via Epley.
- **13.4 KB swing test conflicts with population (e.g. scoliosis)** — Type: architectural · Effort: medium · Priority: P1
  - Need alternative tests per movement screen for special populations. Default screening assumes minimum equipment but breaks for clients with conditions.
- **13.5 "Análise" not updating live** — see CC8
- **13.6 Skip button with warning** — see CC5
- **13.7 Implicações missing** — see CC1

### §14 Performance (the cool-down)
- **14.1 Rename — "Performance" misleading, this is health markers** — Type: aesthetic · Effort: small · Priority: P2
  - Suggest: "Saúde cardiovascular" or similar. RHR + VO2max + grip = health markers, not performance.
- **14.2 Hide grip strength (Jamar) under advanced/trainer-only** — Type: architectural · Effort: small · Priority: P2
  - Most clients don't have it. Trainer may add later.
- **14.3 Rockport test broken — needs full step-by-step + multiple inputs** — Type: bug · Effort: medium · Priority: P0
  - Test requires multiple data points (weight, age, time, RHR after walk). Currently asks for time:seconds only. Needs proper test wizard.
- **14.4 RHR education + measurement guide drawings** — Type: educational · Effort: medium · Priority: P1
  - Most people don't know RHR. Teach measurement (radial/carotid) with drawings. Recommend 5 minutes resting before measure. Recommend pharmacy if no monitor.
- **14.5 BP measurement guidance** — Type: educational · Effort: medium · Priority: P1
  - Same as 14.4 for blood pressure. Cuff placement diagrams. Recommend pharmacy.
- **14.6 Balance test missing** — Type: architectural · Effort: medium · Priority: P2
  - Important for elderly. Need single-leg stance, etc.
- **14.7 Equipment-agnostic naming** — Type: principle · Effort: small · Priority: P2
  - Use generic terms ("dynamometer" not "Jamar"; "bioimpedance" not "Tanita"). Exception: when actually integrating specific brand software.

### Conclude assessment
- **C1 — Concluir button always enabled** — see CC5
- **C2 — Save partial assessment data, allow returning client + complete with PT** — Type: architectural · Effort: medium · Priority: P1

---

## Principle-conflict items (require founder decision before implementation)

1. **5.7 — AI pre-selecting favorite goal**: Conflicts with Round C decision "no AI in goal selector". Founder must decide: relax the rule, or skip this feature.
2. **CC2 — Massive aesthetic sweep**: Already promised in Round D scope. This walkthrough confirms necessity.
3. **3.5 — All technical decisions auto-decided**: Major architectural shift. Means assessment becomes the input pipeline; nearly everything else is computation. Aligns with vision "PT is central cell" — but execution is large.

---

## Parking lot (P3 future work, capture for later)

- Custom exercise library by body part / function (autorizadas per client)
- Live cockpit view in desktop with all controls + table editing
- Color picker tool to copy/paste settings between exercises
- Logbook view with graphics, info fusion, metrics display
- Mobile-friendly logbook
- Print microcycle PDF with locked controls (commit to plan)
- Photo capture and trainer-interpretation workflow
- Reassessment system (2nd, 3rd assessments — what repeats vs not)

---

## Implementation roadmap proposal

The walkthrough surfaces ~50 distinct items. Trying to do them all at once would burn 100+ credits and produce inconsistency. Proposal: 5 mini-rounds + parking lot.

### Round D — Critical bugs + skip button (P0 only)
- CC5 (Concluir always enabled with warning)
- 5.1 (template selected affordance within category)
- 11.1 (mobility test instructions — minimum viable)
- 13.2 (movement screen per-criterion images — minimum viable)
- 13.5/CC8 (live update of Implicações)
- 14.3 (Rockport test wizard)
- C2 (save partial state)

Estimated: 15-25 credits.

### Round E — Cross-cutting aesthetic + Implicações standardization
- CC1 (Implicações at end of every section, collapsed by default)
- CC2 (aesthetic sweep across remaining sections)
- CC9 (move pre-stage analysis to per-section)
- CC10 (single name for analysis)

Estimated: 15-25 credits.

### Round F — Page-per-topic restructure (architectural)
- CC4 (own page for hydration, nutrition, equipment, preferences, mobility limitations, body map)
- 7.1 (proper measurement drawings)
- 7.2 (default vs optional measurements)
- 9.1 (sleep slider revision)
- 10.1/10.2 (split nutrition + hydration, hydration page with bottles + tracking)
- 10.3 (hand portion guide)
- 11.2 (mobility limitations body map)
- 12.1/12.2/12.4 (posture pages with drawings)
- 13.1 (one move per page)

Estimated: 30-50 credits. **Largest round; could be split.**

### Round G — Architectural decisions + smart defaults
- 3.1 (experience level inference instead of subjective ask)
- 3.4 (plan duration auto + cards)
- 3.5 (auto-decide technical choices)
- 3.7 (interactive body map for injuries)
- 4.1/CC7 (faixas color tiers)
- 5.5 (multiple goals + backlog)
- 5.6 (goal variables editable as chips)
- 5.8 (deadline auto + rationale)
- 6.1 (medication dose categorization)
- 13.3 (submax + Epley)
- 13.4 (alt tests per population)
- 14.6 (balance test)

Estimated: 40-60 credits. **Foundational. May split.**

### Round H — Educational content + PDF synthesis
- CC6 (PDF synthesis with educational content)
- 14.4/14.5 (RHR + BP education + drawings)
- 7.3 (WHR population comparison)
- 8.2 (Prochaska selection explanation)
- 10.4 (nutrition educational PDF)
- 10.6 (allergies/patterns drawings)

Estimated: 30-50 credits.

### Round I (P3, parking lot)
Items in "Parking lot" section.

---

## Decisions needed from founder before any work proceeds

1. **5.7 AI in goal selector — relax rule or skip?**
2. **3.5 Auto-decide architectural shift — proceed or scope down?**
3. **Round F split or single big round?**
4. **CC3/CC6 SVG drawings — produced by Lovable inline or commissioned externally?** (Quality vs cost)

---

## Verbatim source

> _Pending: paste the founder's full walkthrough message here, line-by-line, preserving original formatting. Not included in this commit because the raw transcript was not attached to the round brief; add as a follow-up edit before acting on any item._
