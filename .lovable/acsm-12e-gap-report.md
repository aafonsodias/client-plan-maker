# ACSM 12e — Forge Gap Report (Round 1, pre-ingestion skeleton)

Status: **skeleton — full ingestion pending**. The PDF was not attached to this turn.
The schema and policy doc are in place; the structured rows in
`acsm_recommendations` / `acsm_contraindications` / `acsm_normatives` will be
populated once the PDF is re-uploaded to `/mnt/documents/acsm-12e.pdf` and the
ingestion script is run.

What follows is the **code-side audit** (no PDF needed) — what Forge already
touches that ACSM 12e governs, and where the gaps are. Numeric deltas vs 12e
thresholds will be filled in after ingestion.

---

## 1. Where Forge currently touches ACSM

| Surface | File | What it does |
|---|---|---|
| Assessment intake form | `src/routes/intake.$token.tsx`, `src/components/PlanAssessmentSheet.tsx` | Collects PAR-Q+ pass/fail, ACSM risk category (text), med flags, BP, RHR, body comp, six-pattern movement screen, capacity, SMART goals, readiness stage. |
| Programming-tier gate | `src/server/phased/programming-tier.server.ts` | If `parq_passed === false` OR `acsm_risk_category === "high"` → forces plan to **remedial** tier. Currently the *only* ACSM-driven branching. |
| Plan generation prompt | `src/server/plan.server.ts` | Inlines PAR-Q+ status + risk category as plain text into the LLM context. No FITT-VP constraints, no citations. |
| PDF export | `src/lib/pdf.ts` | Prints PAR-Q + ACSM risk in the assessment summary block. |

Stages 1–5 in `src/server/phased/*` build brief → blueprint → microcycle →
progressions via prompts that do **not** receive structured FITT-VP guidance.

## 2. Ch. 2 — Preparticipation Screening Algorithm

The 12e algorithm asks decision-tree questions that map to: current activity
status, known CV/metabolic/renal disease, signs/symptoms, desired exercise
intensity. Forge today collapses all of this into a single trainer-graded
enum (`acsm_risk_category` ∈ low/moderate/high) plus a binary `parq_passed`.

| 12e algorithm node | Captured in Forge? | Gap |
|---|---|---|
| Currently active (≥30 min mod-int ≥3×/wk for ≥3 mo) | No explicit field | Inferable from `training_days_per_week` + `years_training`, but not stored as the algorithm's binary input. |
| Known CV / metabolic / renal disease | Partial — `medical_conditions` (free text) + `med_flags[]` | No structured disease list; `med_flags` content is undefined in schema. **Gap**: enumerate the 12e disease list. |
| Signs/symptoms suggestive of CV/metabolic/renal disease | No | **Missing field.** 12e signs list (chest discomfort, unaccustomed dyspnea, dizziness/syncope, orthopnea/PND, ankle oedema, palpitations/tachycardia, intermittent claudication, known heart murmur, unusual fatigue with usual activity). |
| Desired exercise intensity (light / mod / vig) | Implied | Not captured as a separate decision input. The algorithm requires it. |
| Medical clearance recommendation output | Implicit — `risk = high` → remedial tier | **Gap**: 12e has 3 outcomes (no clearance / clearance recommended / clearance recommended at vigorous only). Forge collapses to 2. |

**Round-2 implication:** the 12e algorithm should be a derived function over
structured inputs, not a trainer-graded enum. Likely deliverable: replace
`acsm_risk_category` with a computed view that runs the algorithm.

## 3. Ch. 3 — Health-Related Fitness Testing

| 12e test battery | Forge today | Gap |
|---|---|---|
| Resting HR | `resting_heart_rate` | OK. Norms by age/sex pending → `acsm_normatives`. |
| Resting BP | `systolic_bp_mmhg` / `diastolic_bp_mmhg` + `bp_measured_at` | OK. 12e classification thresholds pending. |
| Body composition: BMI | Derivable from `weight_kg` / `height_cm` | Computed ad-hoc; no stored classification. |
| Body composition: waist circumference + waist-to-hip | `waist_cm`, `hip_cm` | OK; 12e cardiometabolic-risk thresholds pending. |
| Body composition: body-fat % | `body_fat_pct`, `body_fat_method` | OK; norm tables pending. |
| Cardiorespiratory: VO₂max (lab) | No | **Missing.** Out of scope for most trainers. |
| Cardiorespiratory: submax estimation (YMCA cycle, Astrand-Rhyming, 1-mile walk, 1.5-mile run, Cooper, step tests) | No | **Missing — material gap.** This is the trainer-feasible bit. |
| Muscular strength: 1RM / estimated 1RM | Implicit in `max_lifts` text + `current_capacity_vs_pb` | **Gap**: no structured 1RM per pattern, no Brzycki/Epley toggle. (Forge already uses Epley in `src/lib/capacity-gain.ts`.) |
| Muscular endurance: push-up / curl-up / YMCA bench-press tests | No | **Missing.** |
| Muscular power | Implicit in capacity scores | **Gap.** |
| Flexibility: sit-and-reach | No | **Missing.** |
| Balance: single-leg stance | `single_leg_balance_score` (1–5) | Stored as subjective tier, not the 12e timed protocol. **Gap**: capture seconds. |
| Movement screen (6 patterns) | Full (`*_form_criteria`, `*_capacity`) | This is **Forge-original**, not from ACSM. Keep — it complements rather than overlaps. |

**Round-2 priority:** add submax-VO₂ estimation (highest-leverage single
gap) and timed single-leg balance. Defer the full muscular endurance battery
unless trainers ask.

## 4. Ch. 5 — FITT-VP framework

Forge today emits exercise plans (sets/reps/load/rest/tempo on each
exercise) but **does not emit explicit FITT-VP parameters per modality per
phase**. The Stage-2 blueprint and Stage-3 microcycle prompts do not receive
ACSM range constraints.

| FITT-VP element | Forge today | Required for Round 2 |
|---|---|---|
| Frequency (sessions/wk per modality) | Implicit from session schedule | Make explicit per modality (aerobic / resistance / flexibility / neuromotor) per phase. |
| Intensity (HRR%, VO₂R%, RPE, %1RM) | %1RM-style only on resistance lifts | Add aerobic intensity zone; tag with method (HRR, VO₂R, RPE). |
| Time (min/session) | `session_duration_minutes` (intake only) | Make per-modality and per-phase. |
| Type | Exercise list | Tag exercise modality per ACSM categorisation. |
| Volume (sets/wk, MET-min/wk) | Sets/reps per exercise; weekly volume computed downstream | Add MET-min/wk for aerobic; sets/wk per muscle group already derivable. |
| Progression rule | Implicit in multi-block lineage (`generation_meta.prior_exercise_pool`, +4%/block load multiplier in demo) | Make rule explicit per modality. |

The 12e resistance-training section was significantly expanded vs 11e
(rest-period prescription, autoregulation, velocity-based options, eccentric
emphasis, training-to-failure guidance). Specific deltas pending ingestion.

## 5. Ch. 6 + 8–11 — Population coverage

Forge has **no special-population branching today** beyond the binary
remedial-tier downgrade. Every population in 12e silently falls through to
the same generator.

Populations Forge will silently mis-prescribe for until Round 3 ships:

- Children/adolescents (Ch. 6)
- Pregnant clients (Ch. 6) — `med_flags` could carry this but doesn't drive logic
- Low-back-pain history (Ch. 6) — `injuries` free-text only
- Older adults (Ch. 6) — `age` is captured but doesn't modify FITT
- Transgender / gender-diverse (Ch. 6, **new in 12e**)
- CHD / post-cardiac-event / cardiac-rehab phase (Ch. 8)
- SCAD (**new in 12e**)
- POTS (**new in 12e**)
- Pulmonary disease + respiratory muscle training (Ch. 8, **expanded in 12e**)
- Metabolic syndrome / MASLD (**new in 12e**) / diabetes / obesity (Ch. 9)
- Cancer / arthritis / osteoporosis / pediatric cardiac (**new**) / ME-CFS (**new**) (Ch. 10)
- Neurological: stroke / Parkinson's / MS / SCI / TBI (Ch. 11)

**Round-1 ingestion will populate** `acsm_contraindications` rows and a
population-trigger table sketch so the Round-3 overlay engine has data to
match against.

## 6. Ch. 12 — Behaviour change

No coverage in Forge today. No stage-of-change field on clients, no
motivational-interviewing prompts, no adherence-vs-prescription delta
surfaced. Defer to Round 4 as planned.

## 7. 11e → 12e threshold deltas

**Pending ingestion.** Will be enumerated as a table here after the PDF is
re-uploaded and parsed. Any 12e value that is *less conservative* than the
current Forge threshold will be flagged for explicit approval before
adoption.

---

## Round-1 status checklist

- [x] Schema (`acsm_chapters`, `acsm_sections`, `acsm_recommendations`, `acsm_contraindications`, `acsm_normatives`) with RLS as specified.
- [x] `.lovable/acsm-12e-source.txt` (source + IP policy).
- [x] PDF storage location: `/mnt/documents/acsm-12e.pdf` (outside the repo by design — `/mnt/documents/` is not in the project tree, so no `.gitignore` entry is required).
- [x] Code-side gap report (this file, the parts that don't need the PDF).
- [ ] **Blocked: PDF re-upload.** The Round-1 brief expected the ACSM 12e PDF to be attached to the chat turn. It wasn't. Once you re-upload it, the ingestion script will populate the structured rows and complete the threshold-delta section.

## Next step (you)

Re-attach the ACSM 12e PDF to the chat. The agent will then run the
ingestion against Ch. 2/3/5 fully + a lighter pass on Ch. 6/8–11 for
population triggers + contraindications, and finalise this report.
