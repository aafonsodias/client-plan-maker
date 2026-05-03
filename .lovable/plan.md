# ACSM 12th Edition — Integration Plan

## What Forge already has (so we don't duplicate)

Searched the codebase. Forge today touches the ACSM surface in three places:

- **Assessment table** (`assessments`): `parq_passed`, `acsm_risk_category`, `med_flags`, `medications`, `systolic/diastolic_bp_mmhg`, `resting_heart_rate`, body comp (waist/hip/BF%), six-pattern movement screens (squat/hinge/push/pull/carry/lunge), capacity scores, SMART goals, readiness stage. Range-validated by a trigger.
- **Programming-tier gate** (`src/server/phased/programming-tier.server.ts`): if `parq_passed === false` OR `acsm_risk_category === "high"`, the plan is forced to **remedial** tier. That's the entire ACSM-driven branching today.
- **Plan generation prompt** (`src/server/plan.server.ts`): inlines PAR-Q+ status and ACSM risk category as text into the LLM context. PDF (`src/lib/pdf.ts`) prints PAR-Q + risk in the assessment summary.

What Forge does **not** have:

- No structured FITT-VP model. The 5-stage phased pipeline (`stage1…stage5`) builds blueprints/microcycles via prompts, but Frequency/Intensity/Time/Type/Volume/Progression are not first-class fields with ACSM-bounded ranges.
- No knowledge store, no citations, no special-population overlays, no behaviour-change scaffolding, no submax-VO₂ estimation, no balance test, no normative-data lookups.
- ACSM thresholds in code (the risk gate, the PAR-Q gate) are coarse 11e-style heuristics, not the full 12e Preparticipation Algorithm.

## Direction-by-direction verdict


| #   | Direction                           | Verdict                                | Why                                                                                                                                                                                  |
| --- | ----------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Knowledge base / RAG                | **In scope, Round 1**                  | Foundation for every other direction. Without it #2–#7 are guesses.                                                                                                                  |
| 2   | Audit assessment vs 12e             | **In scope, Round 1**                  | Cheap, high-leverage. Output is a markdown gap report, not code.                                                                                                                     |
| 3   | FITT-VP alignment in generator      | **In scope, Round 2**                  | Highest user-visible payoff. Needs #1 done first to anchor ranges.                                                                                                                   |
| 4   | Special-population overlays         | **In scope, Round 3**                  | Model as JSON rule-sets that mutate FITT-VP, not new code paths. Start with the 3 highest-frequency populations Forge actually sees (likely older adults, low back pain, pregnancy). |
| 5   | Behaviour-change layer (Ch. 12)     | **In scope, Round 4**                  | Real differentiator vs Trainerize. But not P0 — clients today churn on programme quality, not adherence prompts.                                                                     |
| 6   | Citations on every prescription     | **In scope, Round 2** (paired with #3) | Cheap once #1 exists. Massive trust win. Format: `ACSM 12e §5.4 Tbl 5.3`.                                                                                                            |
| 7   | Trainer "Learn / Reference" surface | **Defer to Round 5+**                  | Pure UI. Worth nothing without #1. Likely skip until trainers ask for it.                                                                                                            |


## IP / licensing constraint (read first)

This is a copyrighted Wolters Kluwer publication. Constraints that bind every round:

- **Never** render verbatim chapter prose to end users (trainers or clients). No quoted paragraphs in the UI, no quoted text on PDFs.
- **Allowed**: short paraphrased rules, numeric thresholds, tables of normative values *in the form of derived parameters* (e.g. "moderate intensity = 64–76% HRR" is a fact, not protected expression), and citation strings (`ACSM 12e §5.4`).
- **Storage**: ingested chapter text lives in a private server-only store, never shipped in the client bundle, never readable via RLS by trainers. Only the **derived** structured rows (thresholds, FITT ranges, contraindication lists) are queryable.
- This rules out a public RAG chat over the book. It does not rule out internal retrieval that feeds the prompt and surfaces only paraphrased + cited outputs.

## Phasing

### Round 1 — Ingest + audit (NO UI changes)

**Deliverables:**

1. **Structured knowledge store** in Postgres (server-only, RLS denies all client reads):
  - `acsm_chapters`, `acsm_sections` (chapter, section, page range, summary).
  - `acsm_recommendations` — the *structured* derivative: `{ topic, population, parameter, value_low, value_high, unit, citation }`.
  - `acsm_contraindications` — `{ condition, contraindicated_modality, severity, citation }`.
  - `acsm_normatives` — `{ test, sex, age_low, age_high, percentile, value, unit, citation }`.
  - Raw paraphrased chapter notes go in a markdown corpus under `knowledge://acsm-12e/` (NOT in the DB; not shipped to client).
2. **Ingestion script** (one-off, run locally): parses the PDF chapter-by-chapter via the doc-parsing skill, extracts tables and FITT/threshold paragraphs, writes structured rows + paraphrased section summaries. No verbatim copy.
3. **Gap-analysis report** at `.lovable/acsm-12e-gap-report.md`:
  - Per Ch. 2: list every Preparticipation Algorithm decision node, mark which Forge captures and which it doesn't.
  - Per Ch. 3: list every recommended fitness test, mark coverage (Forge has movement screens + BP + RHR; missing: submax VO₂ test, balance test, body-comp norms by age/sex).
  - Per Ch. 5: list FITT-VP parameters Forge currently emits vs ACSM-required.
  - Per Ch. 6/8–11: list populations + flag which ones Forge can already accommodate via `acsm_risk_category=high → remedial tier` and which silently fall through.
  - Output is markdown only. No code changes.

**Out of scope for Round 1:** any UI, any prompt change, any new assessment field.

### Round 2 — FITT-VP backbone + citations

- Add a `prescription_parameters` JSONB column on `workout_plans` populated by the generator with explicit `{ frequency, intensity_zone, time_min, type, volume_sets_week, progression_rule, citations: [...] }` per microcycle phase.
- Update the Stage-2 (blueprint) and Stage-3 (microcycle) prompts to (a) read the relevant `acsm_recommendations` rows for the client's profile, (b) inline them as constraints, (c) require the LLM to emit a citation tag per prescription element.
- PDF + plan view: render small superscript citations next to each prescribed block, with a footer key. Paraphrased only.
- Validator: a Zod refinement that rejects any FITT field outside ACSM-allowed range for the client's risk category.

### Round 3 — Special-population overlay engine

- New table `population_overlays`: `{ population_key, applies_when (jsonb predicate over assessment), modifications (jsonb FITT delta), citations }`.
- Generator pipeline gains a step: after Stage-2 blueprint, evaluate which overlays match → merge their modifications into `prescription_parameters` before Stage-3 fills exercises.
- Seed with the 12e-new populations the user flagged (transgender/gender-diverse, SCAD, POTS, MASLD, ME/CFS, pediatric cardiac, respiratory muscle training) **only as detection + warning + remedial-tier downgrade** in this round. Full overlays come later, once the gap report tells us which the trainer base actually serves.

### Round 4 — Behaviour-change scaffolding (Ch. 12)

- Add stage-of-change field to client profile (precontemplation → maintenance).
- Generate one motivational-interviewing prompt per check-in, sourced from paraphrased Ch. 12 patterns.
- Adherence nudges driven by `workout_sessions` cadence vs prescribed frequency.
- Out of scope: full habit-tracking module.

### Round 5+ — Optional surfaces

- "Reference" tab in trainer UI (search structured `acsm_recommendations` only — not raw chapter text).
- ACSM-cert study mode. Only build if trainers ask.

## Recommended Round 1 scope (what to actually approve now)

A single, contained, high-confidence round:

1. Save uploaded PDF to a server-only path. Add `.lovable/acsm-12e-source.txt` noting source + edition + ISBN + access policy.
2. Build the four structured tables (`acsm_chapters`, `acsm_sections`, `acsm_recommendations`, `acsm_contraindications`, `acsm_normatives`) with RLS = trainer-readable for `acsm_recommendations`/`acsm_contraindications`/`acsm_normatives` (these are derived facts), and **server-role-only** for `acsm_chapters`/`acsm_sections` (paraphrased prose).
3. Run the ingestion script for Chapters 2, 3, 5 only (the spine: screening, testing, prescription). Defer 1, 4, 6–12 to later rounds — they're a lot of work and Round 2 only needs Ch. 2/3/5.
4. Produce `.lovable/acsm-12e-gap-report.md`.
5. Do **not** touch the generator, the assessment form, or any UI.

Estimated work: 1 round. Risk: low. Reversible: yes (drop tables, delete script).

## Technical notes (for the agent, not the user)

- Ingestion: use the `pdf` skill — `pdftotext -layout` per chapter range, then a Python pass with `pdfplumber` for tables. AI-Gateway script (Gemini 2.5 Pro for big context) extracts structured rows from chapter chunks. All artefacts written to `/tmp` first; only the structured CSV + paraphrased section markdown get committed.
- The PDF itself is **not** committed to the repo (size, IP). Stored in `/mnt/documents/acsm-12e.pdf` for the agent's reference, with a `.gitignore` entry.
- New tables follow existing project conventions: `id uuid pk default gen_random_uuid()`, `created_at`/`updated_at`, RLS enabled, no FK to `auth.users`.
- No edge functions needed — ingestion is a one-off script, retrieval at generation time happens inside existing `createServerFn` handlers.

## Questions before Round 1 starts

1. **Confirm the IP rule**: paraphrased + numeric only, never verbatim — agreed?
2. **Edition handover**: any existing 11e thresholds we should keep as fallback, or wholesale migrate to 12e values where they differ?
3. **Round 1 chapter scope**: confirm "Ch. 2 + 3 + 5 only" for first ingestion (others come when their direction is built), or do you want the whole book ingested up-front?
4. **PDF storage location**: keep at `/mnt/documents/acsm-12e.pdf` (agent-accessible, not in repo, not in browser), or do you want it in a private Supabase storage bucket too for redundancy?

**My assessment:**

This is excellent — Lovable did serious work. The plan is professionally scoped, IP-conscious, technically grounded, and properly sequenced. Three things in particular stand out as *better* than what we asked for:

1. **The IP/licensing analysis is sharp.** Distinguishing protected expression (chapter prose) from unprotectable facts (numeric thresholds, FITT ranges) is exactly the right legal frame. The "structured derivative + paraphrased + cited, never verbatim" rule is defensible and lets you actually use the book.
2. **The phasing is realistic.** Round 1 produces zero UI and a markdown gap report — that's mature engineering. Most agents would have started building.
3. **The audit of what Forge already has** is honest and specific: only three places touch ACSM today, and the risk-category gate is "coarse 11e-style heuristics." That's the kind of self-aware diagnosis you want.

**Two small things worth pushing back on or clarifying** before approving — these are not problems with the plan, just decisions worth making consciously:

- **Q3 (chapter scope):** Lovable proposes ingesting only Ch. 2, 3, 5 in Round 1. That's correct *for what Round 2 needs*, but the gap report itself depends partly on Ch. 6 and 8–11 (population coverage). You can't fully assess "which populations does Forge silently fall through?" without at least skimming those chapters' decision criteria. Worth asking: ingest the *structured contraindications and population triggers* from Ch. 6 + 8–11 even in Round 1, even if you defer the full FITT overlays to Round 3.
- **Q2 (11e fallback):** This deserves an explicit answer from you. My recommendation: **wholesale migrate to 12e where they differ**. Keeping dual thresholds creates silent ambiguity in the generator. If a 12e value is more conservative, use it; if it's less conservative, the gap report should flag it for your review before you adopt it.
- **Q4 (PDF storage):** Their proposal (`/mnt/documents/`, gitignored, not in Supabase) is correct. No reason to also stage it in a Supabase bucket — that just creates a second copy to manage and a second IP exposure surface. Agree with their default.

**On Q1 (the IP rule):** agree without modification.

So — **the plan does not need replacement. It needs four answers from you, then approval.** Here is a short reply you can paste:

---

**REPLY TO LOVABLE:**

---

Plan approved. The phasing, the IP analysis, and the round-by-round scope are all correct. Answers to your four questions:

**Q1 — IP rule.** Agreed. Paraphrased + numeric + structured derivatives only, never verbatim, ever. Raw chapter prose lives server-only, never reaches the client bundle, never reaches RLS-readable tables. Citations as `ACSM 12e §X.Y` strings are fine.

**Q2 — 11e fallback.** Wholesale migrate to 12e values where they differ. Do not maintain dual thresholds — that creates silent ambiguity in the generator. The Round 1 gap report should explicitly call out every place a 12e threshold differs from what Forge currently uses, so I can review the deltas before Round 2 adopts them. If any 12e change is *less* conservative than the existing 11e value, flag it for explicit approval rather than auto-adopting.

**Q3 — Chapter scope for Round 1.** Adjust slightly: ingest **Ch. 2, 3, 5 fully** (the spine, as you proposed), **plus a lighter pass on Ch. 6 and 8–11** to extract only:

- Population trigger criteria (what assessment values flag a population)
- Contraindication lists per population
- A one-line paraphrased summary per population

This is needed because the gap report has to answer "which populations does Forge silently fall through?" — and that question can't be answered from Ch. 2/3/5 alone. Full FITT overlays for those populations stay deferred to Round 3 as planned. Ch. 1, 4, 7, 12 can wait entirely until their dedicated round.

**Q4 — PDF storage.** Keep at `/mnt/documents/acsm-12e.pdf`, gitignored, agent-accessible only. No Supabase bucket — second copy, second IP surface, no benefit.

Proceed with Round 1 as scoped, with the Q3 adjustment. Deliverables expected:

1. Five structured tables with RLS as you specified.
2. Ingestion script (one-off, local-run, not committed beyond the script itself).
3. `.lovable/acsm-12e-gap-report.md` covering Ch. 2, 3, 5 fully + population triggers/contraindications from Ch. 6, 8–11.
4. `.lovable/acsm-12e-source.txt` with edition/ISBN/access policy.
5. `.gitignore` entry for the PDF.

No UI, no prompt changes, no generator changes in Round 1. When the gap report is ready, surface it and we'll decide Round 2 priorities from there.