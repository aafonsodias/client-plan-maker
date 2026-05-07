# R76 — Health & Readiness Overlay (audit)

Read-only thinking round. No code, schema, prompt, i18n, taxonomy, or engine changes. Output is this single document, intended as the master brief for future implementation rounds.

---

## 1. Executive summary

The user's seeds (neck training, McGill, hydration, inflammation, joint health) are not a feature. They are pressure on a single missing layer: **why this plan, and is the body ready for it?** Today Protocol does the *what* (assessment → brief → microcycle → adaptation) honestly, but the *why* and the *should-we?* live mostly in the trainer's head and in `generation_meta` no one reads.

Recommendation: name the layer **Readiness & Reasoning Overlay**. It has four pillars:

1. **Screening guardrails** — extend the existing ACSM 12e preparticipation algorithm with explicit referral / caution / "technique only" outputs.
2. **Readiness modifiers** — short, daily, badge-based context (sleep, soreness, pain, energy). No score. No HRV. No wearable dependency in MVP.
3. **Rationale chips** — trainer-facing "why selected / why avoided / why regressed" surfaced from data Stage 3 already records.
4. **Education notes** — short, calm, source-tagged copy that lives in PDF and Manual, never invented at runtime.

Neck training is one sub-area of pillar 4, gated behind pillars 1–3. McGill is one expert source among ACSM/NSCA/Bompa, not a brand badge.

The cheapest, safest, highest-leverage next slice is **Slice J — trainer-facing "why selected / why avoided" rationale chips** on existing plan surfaces. It uses data already in `generation_meta`, ships in pure presentation code, and forces the rationale vocabulary every later slice will reuse. Estimated 4–6 credits in a future round.

Everything client-facing about hydration, inflammation, sleep, nutrition, McGill, and cervical work stays gated behind `needs_evidence` until source ingestion (Slice A) is run as its own round.

---

## 2. Correct abstraction and naming

**Chosen name:** *Readiness & Reasoning Overlay.*

Why not the alternatives:

| Candidate | Rejected because |
|---|---|
| Spine & Joint Health Overlay | Locks the abstraction to anatomy. The missing layer is also screening + rationale + education. |
| Tissue Readiness Overlay | "Tissue" implies physiological precision the app cannot defend. |
| Recovery & Readiness Overlay | Too close to wellness-app vocabulary; invites HRV/sleep-tracker scope creep. |
| Education Overlay | Buries the safety half (referral, caution flags). |
| Health Overlay | Medicalises Protocol. We are decision-support, not a clinic. |

**Inside the overlay:** screening outputs, caution flags, readiness badges, rationale chips, "why omitted" explanations, source-tagged education notes for PDF/Manual, evidence chips, `needs_evidence` markers, referral prompts.

**Outside the overlay:** diagnosis, treatment, medical sleep/nutrition prescription, HRV interpretation, automated loaded cervical work for general clients, any client-facing scientific claim that has not passed the evidence-source ethics check.

The overlay is a *lens* over the existing assessment → brief → plan → adaptation arc. It does not introduce a parallel medical surface and does not justify a new top-level route.

---

## 3. Current repo fit

| Surface | Touch in R77+? | Future role | Risk if integrated too early | Phase |
|---|---|---|---|---|
| Intake (`intake.$token.tsx`, `intake.functions.ts`) | No | Source for readiness inputs (sleep, recent illness, pain regions) | Bloated intake → drop-off | Later |
| PAR-Q+ / ACSM screening (`screening/preparticipation.server.ts`) | Read-only consumer in Slice J | Already authoritative; must stay deterministic | Re-implementing screening in AI | MVP-ready |
| Brief (`BriefEditor`, `stage1-brief.functions.ts`) | Display-only chips | Surfaces caution flags + rationale summary | AI inventing caution claims | Slice J target |
| Intensity Cockpit | No | Future: readiness can lower `rpe_ceiling` for the week | False precision if auto-driven | Later |
| Blueprint (`stage2-blueprint`) | No | Pattern selection is already deterministic | None — leave alone | Locked |
| Microcycle (`stage3-microcycle`) | Read `generation_meta` only | Source of "why selected" data | Re-introducing AI into stage 4/5 | MVP-ready |
| Progressions (`stage4-progressions`) | No | Deterministic Bompa wave + NSCA increments | Any AI re-entry breaks the contract | Locked |
| `programNextWeek` | No | Already consumes RPE drift; future readiness modifier hook | Coupling lifestyle inputs to load math | Later |
| Logbook (`log.$token.tsx`) | No | Future: 1-tap readiness check (sleep/soreness/pain) | Survey fatigue → adherence drop | Later |
| PDF export (`pdf.ts`) | No | Future home for short education notes | Medical leaflet bloat | Later |
| Knowledge page (`knowledge.tsx`) | No | Future home for source cards (ACSM/NSCA/Bompa entries) | Wall of text nobody reads | Later |
| Manual page (`manual.tsx`) | No | Trainer deep dives, McGill explainers, referral playbook | Becoming a textbook | Later |
| Exercise taxonomy (`exercise-taxonomy.ts`) | No | Future: `caution_flags`, `red_flag_contraindications` per `ExerciseKey` | Premature schema | Parked |
| Session taxonomy (`session-taxonomy.ts`) | No | Stable; no overlay impact | None | Locked |
| Exercise media architecture | No | Provider-agnostic; orthogonal | None | Locked (R75) |
| Client dashboard (`clients_.$clientId.tsx`) | No | Future: readiness badge per client | Anxiety dashboard | Later |
| YearView | No | Possible adherence × readiness overlay later | Visual noise | Parked |
| AskForge / Concierge | No | Future: rationale Q&A using `generation_meta` | Hallucinated medical claims | Parked |

---

## 4. Source availability audit

Files present at `.lovable/`:

- `acsm-12e-source.txt` — ACSM Guidelines 12e. Present. Already wired in `screening/preparticipation.server.ts` and FITT-VP derivation.
- `bompa-buzzichelli-6e-source.txt` — Periodization 6e. Present. Drives Stage 4 wave model.
- `nsca-essentials-3e-source.txt` — NSCA Essentials 3e. Present. Drives load increments.
- **McGill source — ABSENT.** No `mcgill-*source.txt`. No prior ingestion. Code references to "mcgill" are zero (ripgrep clean across `src/`).

Implication: any McGill-derived claim in R77+ requires a separate source-ingestion round (Slice A). Until then, McGill stays out of every user-facing surface, including trainer chips. We can mention "spine endurance / bracing / hip-spine dissociation" as ACSM-compatible general principles without invoking the McGill name.

---

## 5. Evidence gaps

Claims the seed list implies but the repo cannot currently defend:

| Claim | Status | What's missing |
|---|---|---|
| "Hydration reduces joint pain" | Forbidden as worded | No source supports the direct causal claim. May reframe as "perceived effort and thermoregulation" with ACSM cite. |
| "Inflammation is bad and should be avoided" | Forbidden | Inflammation is part of normal adaptation. Evidence-gated reframing required. |
| "Sleep deprivation increases injury risk" | Plausible, needs cite | Watson 2017 (athletes, n=112) often cited; needs full ethics-check fields before display. |
| "Loaded neck work prevents concussion" | Forbidden | Collins 2014 is sport-specific (collegiate athletes); does not generalise to general PT clients. |
| "McGill Big 3 prevents low back pain" | Needs cite + scope | Evidence supports reduced symptoms in some LBP populations; not a primary prevention claim for asymptomatic general public. |
| "Daily mobility improves joint health" | Vague | "Joint health" is not a measurable outcome; reframe as ROM maintenance / movement confidence. |
| "Protein supports connective tissue" | Plausible, scope-limited | Shaw 2017 (gelatin + vitamin C) is small and specific; do not generalise to all protein. |

Default posture: every above claim ships behind a `needs_evidence` chip until a source-ingestion round produces full citation + n + effect + COI fields per `mem/principles/evidence-source-ethics.md`.

---

## 6. Safety and referral model

Future structured outputs from a `screeningOutcome` object (no schema yet — read from existing assessment fields and the preparticipation algorithm):

- **Refer (medical clearance required before loading)** — already handled by `runPreparticipationAlgorithm.clearance_required`. Cardiac-rehab BP gate (≥180/110) already enforced.
- **Refer-now (do not prescribe today)** — proposed flags: chest pain at rest, new neurological symptoms (dizziness, syncope, focal weakness), radiating limb pain with weakness, recent unexplained weight loss, fever > 38°C, post-trauma within 48h with unassessed injury.
- **Caution (load reduced, trainer review)** — recent illness <72h, acute sleep deprivation (<5h, single night), localised joint pain ≤3/10 at rest, ≥10 BPM resting HR elevation vs baseline, BP 160–179 / 100–109.
- **Technique only (no progressive load)** — symptom flare in target region, post-injury return-to-train phase, novel movement with pain >3/10 on testing.
- **Region-out (do not load this region today)** — pain >5/10 in region during ADL, swelling, recent corticosteroid injection in region <7 days.
- **Region-out-permanent until cleared** — diagnosed disc herniation with neurological signs, recent spinal surgery without clearance, undiagnosed radicular symptoms.

Hard rules:
- Do not diagnose. Outputs are *prescription guardrails*, not labels for the client.
- Do not name the suspected pathology. Say "refer" not "possible disc".
- The trainer always sees and approves before plan generation. Algorithm outputs cannot bypass the brief-approval gate.
- Loaded neck work, spinal flexion under load, and ballistic spinal movements are auto-excluded from any client with active spine flags. Exclusion is silent to the client; visible to the trainer with rationale chip.

---

## 7. Readiness model

**Decision: badges, not score.** A single 0–100 number invites trainers to over-trust it and creates legal exposure if a client gets hurt on a "82" day. Badges admit uncertainty.

MVP-eligible inputs (already collectable or 1-tap):

- Sleep last night (slept-well / slept-poorly / no answer)
- Soreness from last session (none / mild / moderate / severe — already implicit in logbook)
- Pain anywhere new (yes / no + region picker)
- Energy / motivation (low / normal / high)
- Adherence trailing 7 days (auto from `workout_sessions`)
- RPE drift trailing 2 weeks (auto from logged sets)

Later inputs (post-MVP, only if logbook completion stays ≥70%):

- Stress 1–5
- Hydration perception (yes / no — not a quantitative claim)
- Last meal timing
- Resting HR (manual entry)

Parked / wearable-dependent:

- HRV
- Sleep-tracker integration
- Continuous glucose

Too medical for the overlay:

- Medication side-effect tracking
- Period / cycle phase prescription (parked, separate research round; never auto-prescribed)
- Mental-health screeners

**Output badges** (pillar 2 of the overlay):

| Badge | Meaning | Effect on plan |
|---|---|---|
| Ready | Inputs nominal | No change |
| Caution | One soft flag | Surface chip; trainer decides |
| Reduce load | Two soft flags or one moderate | Suggested −5–10% top-set load (trainer applies, not auto) |
| Technique only | Pain in region or sleep <5h | Drop loaded work in affected pattern; substitute with mobility/positional |
| Refer | Hard flag from §6 | Block plan generation; show referral copy |
| Needs trainer judgement | Conflicting signals | No automation; trainer must review |
| Needs evidence | Claim asserted but source missing | Render `needs_evidence` chip; do not show client |

No badge is auto-applied to load math in MVP. Effect is *display only* until adherence to the badges proves trainers actually use them.

---

## 8. Spine model

| Sub-area | App may eventually support | App must not claim | Evidence required | Best home |
|---|---|---|---|---|
| General spine hygiene | Posture awareness notes; movement variety | "Posture causes pain" | Lederman 2011 (postural-structural-biomechanical critique) | Manual |
| Lumbar / low back | Hip-hinge teaching, endurance work, graded exposure | "Avoid spinal flexion forever" | NSCA Ch. on lumbar; ACSM symptom rules | Brief chip + Manual |
| Thoracic mobility | T-spine extension/rotation drills | "Restores natural curve" | Generic ROM evidence; weak | Plan rationale chip |
| Cervical spine | See §10 | See §10 | See §10 | See §10 |
| Posture education | "Best posture is the next posture" | Static posture prescriptions | Slater 2019 | PDF education note (later) |
| Bracing | Coaching cues for braced spine under load | "Always brace 100% on every lift" | NSCA technique chapters | Plan rationale chip |
| Breathing | Diaphragm cues; valsalva guidance | Treating breathing-pattern dysfunction | NSCA; ACSM | Manual |
| Endurance (Big 3 family) | Side bridge, bird-dog, dead-bug variants as accessories | "Cures back pain" | McGill 2002 (LBP populations only) — needs ingestion | Manual + plan rationale (post-Slice A) |
| Hip-spine interaction | Hinge vs squat selection rationale | "Disassociates the spine" as universal need | Bompa 6e | Plan rationale chip |
| Load tolerance | Graded exposure programming | Specific tissue-tolerance numbers | Insufficient | Trainer note only |
| Pain response | "Stop and reassess if pain >3/10" | Pain-mechanism explanations | NICE LBP guideline 2016 | Logbook prompt (later) |
| Red flags | Refer per §6 | Diagnosis | ACSM 12e Box 2.1 | Screening |

---

## 9. Joint health model

Same shape applied per region. Not implementing exercise lists; just defining what surfaces may say.

| Region | Mobility | Control / isometrics | Load tolerance | Symptom rule | Education note | Referral trigger |
|---|---|---|---|---|---|---|
| Shoulder | ROM screen reuse | Scap control cues | Graded press / pull progression | "Pinching at top of press → regress depth" | Later | Night pain, no overhead reach |
| Hip | Hip flexion/IR/ER | Glute med isometrics | Hinge → squat progression | "Pinching front of hip → reduce depth" | Later | Groin pain on weight-bearing |
| Knee | Heel-to-glute / squat depth | Quad isometrics | Tempo squats before plyo | "Sharp pain → stop; ache → continue cautiously" | Later | Locking, giving way, effusion |
| Ankle / foot | Dorsiflexion screen | Calf raise isometrics | Bilateral → unilateral | "Plantar pain at first steps → trainer review" | Later | Persistent night pain |
| Wrist / elbow | Flexion/extension screen | Grip isometrics | Push variant selection | "Tendinous pain → reduce volume" | Later | Numbness, tingling |
| Spine | §8 | §8 | §8 | §8 | §8 | §8 |
| Cervical | §10 | §10 | §10 | §10 | §10 | §10 |

No taxonomy mutation needed in MVP. All this lives as trainer-facing rationale chips in Slice J's vocabulary.

---

## 10. Neck and cervical preparation model

Cervical ladder. **Only levels 1–3 are MVP-eligible** and only as trainer-pickable, never auto-generated for general clients.

| Level | Item | Suits | Does not suit | Prereq | Progression criterion | Regression | Pain rule | Evidence | Auto-gen risk | Phase |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Education / awareness (head position, screen ergonomics) | All | None | None | Client repeats key cues | n/a | Symptom-free | Coaching consensus | Low | MVP |
| 2 | Active range (chin tucks, gentle rotation, side-bend) | Asymptomatic, mild stiffness | Acute pain, recent trauma | §6 clearance | Pain-free full ROM | Reduce ROM | Stop if >2/10 | Coaching consensus | Low | MVP |
| 3 | Breathing + jaw/neck tension awareness | Stress-related tension | Suspected TMJ pathology | None | Self-reported reduced tension | n/a | Stop if symptom-provocative | Weak | Low | MVP |
| 4 | Low-level isometrics (hand resistance, 5–10s holds) | Cleared, asymptomatic | Recent symptoms | Levels 1–3 | Tolerated 3 sessions | Drop holds | Stop if >2/10 | Mansell 2005 (athletes) | Medium | Later |
| 5 | Positional endurance (prone/quadruped holds) | Athletic context | General fitness | Level 4 | 30s holds pain-free | Drop hold time | Stop if symptoms | Coaching | Medium | Later |
| 6 | Manual resistance (partner) | Sport-specific prep | General clients | Level 5 + trainer skill | n/a | Drop intensity | Stop immediately | Sport-specific | High | Parked |
| 7 | Band resistance | Sport-specific | General | Level 6 | n/a | Drop band tension | Stop immediately | Limited | High | Parked |
| 8 | Loaded harness | Contact-sport athletes only | General | Sport context + clearance | n/a | Drop load | Stop immediately | Collins 2014 (collegiate, sport-specific) | Very high | Parked |
| 9 | Sport-specific contact prep | Contact athletes | General | Levels 1–8 + sport coach | n/a | n/a | n/a | Sport-specific | Out of scope | Out of scope |

**Hard rule:** levels 4–9 never enter Stage 3 prompt for general PT clients. If a future trainer-facing picker exposes them, the picker requires explicit "athletic / contact-sport context" + screening clearance before the option is enabled.

---

## 11. McGill integration model

- McGill source: **absent in repo** (§4). Cannot be cited until ingested.
- Relevant concepts (general spine, *if* ingested): spine-sparing strategies, hip-hinge dominance, abdominal bracing under load, Big 3 endurance battery (curl-up / side-bridge / bird-dog), graded movement exposure.
- Cautious transfer: yes for general lumbar coaching of asymptomatic clients with hinge tasks. No for symptomatic populations without trainer-of-record clinical context.
- Forbidden transfer: cervical training. McGill's published work does not authorise neck-specific load prescription. Do not cite McGill on neck claims.
- Surface placement: trainer-facing only. PDF education note allowed only after Slice A ingestion produces an evidence-source ethics-compliant entry.
- Branding: do not chip "McGill-approved", "McGill method", or use his name as authority. Cite the work; do not invoke the personality.
- `needs_evidence` until ingested. Park separately.

---

## 12. Lifestyle and recovery education layer

Calm, short, source-tagged. Never invented at runtime. Stored as static notes keyed by topic; surfaced in PDF + Manual.

| Topic | May safely say | Must not say | Evidence required | Home | Phase |
|---|---|---|---|---|---|
| Sleep | "Adults generally feel and recover better with 7–9h. One bad night is fine; a pattern matters." | "Less sleep means injury." Diagnostic claims. | Hirshkowitz 2015 NSF; Watson 2017 | PDF + Manual | Later |
| Hydration | "Drink to thirst across the day. Notice urine colour as a rough cue." | "Hydration lubricates joints / reduces pain." | ACSM hydration position | PDF | Later |
| Nutrition adequacy | "Enough protein and total energy supports adaptation." | Specific gram targets per kg unless trainer-set. Diet prescriptions. | ISSN protein position 2017; ACSM position | Manual | Later |
| Protein / energy availability | "Under-eating during a training block blunts results." | RED-S diagnosis; calorie prescriptions. | Mountjoy 2018 (athletes only) | Manual | Later |
| Inflammation | "Some inflammation after training is normal and part of adaptation. Persistent or systemic inflammation is different — see a clinician." | "Reduce inflammation with X." Anti-inflammatory food claims. | Peake 2017 review | Manual | Later |
| Stress and pain sensitivity | "Stress can amplify perceived effort and pain. A lighter day is reasonable." | Pain-neuroscience prescriptions. | Hannibal 2014 review | Manual | Later |
| Graded exposure | "Increase gradually. The body adapts to what it sees regularly." | Specific load progression numbers (those live in Stage 4). | Bompa 6e | Plan rationale chip | MVP-friendly |
| Soreness vs pain | "Sore is normal and fades. Sharp, persistent, or worsening is pain — pause and reassess." | Pain-mechanism diagnosis. | Coaching consensus | Logbook (later) | Later |
| Consistency | "Three honest sessions a week beats two perfect ones every other week." | Prescriptive lifestyle commands. | Coaching consensus | Manual | MVP-friendly |
| Movement variability | "Vary positions and patterns over a block." | Tissue-specific claims. | Bompa 6e | Plan rationale chip | MVP-friendly |
| Joint-friendly modifications | "Substitute when a movement causes sharp pain. Tell your trainer." | "Knees-over-toes is bad", "deep squats damage knees", etc. | NSCA technique chapters | Plan rationale chip | MVP-friendly |

---

## 13. Trainer learning surfaces

| Surface | Where | Teaches | Data needed | Evidence needed | Risk if bad | Phase |
|---|---|---|---|---|---|---|
| Evidence chip ("ACSM 12e §X") | Brief, plan rationale | Source authority | Static map | Source ingested | Citation theatre | After Slice A |
| Source popover | Plan + Knowledge | Full citation, COI | Static map | Source ingested | Wall of text | After Slice A |
| Confidence badge (guideline / consensus / expert / heuristic / hypothesis) | Anywhere a claim shows | Epistemic humility | Static tags per claim | Per-claim review | False precision | After Slice A |
| `needs_evidence` chip | Anywhere | Honesty about gaps | Static tag | None to display, blocks claim | Trainer ignores it | MVP-friendly |
| `coach judgement required` chip | Brief, plan | Trainer is in the loop | None | None | Used as escape hatch | MVP-friendly |
| Why selected | `MovementPatternCard`, `ProgressionExerciseCard` | Pattern → exercise reasoning | `generation_meta` (already written) | None at MVP | Hand-wavy text | **Slice J — MVP** |
| Why avoided | Brief sidebar | Equipment / contraindication / preference filtering | `generation_meta` exclusion log | None at MVP | Looks accusatory if worded badly | Slice J |
| Why regressed / progressed | Plan header + `programNextWeek` summary | Adaptation transparency | Already in `block_transition_summary` | None | n/a | Quick win after Slice J |
| Why omitted | Brief | Region/pattern explicitly skipped | Need explicit field in `generation_meta` | None | Trainer asks "where is X?" | Later |
| Readiness badge | Client card, plan header | §7 | Future readiness inputs | None for badge itself | Anxiety | Later |
| Caution badge | Brief, plan | §6 outputs | Existing screening + new flags | ACSM 12e | Over-restriction | Later |
| PDF education note | PDF | §12 topics | Static notes | Per-note review | Medical leaflet | Later |
| Manual deep dive link | Plan rationale | "Read more" without bloating chip | Manual sections | Per-section review | Manual rot | After Slice A |
| Knowledge source card | Knowledge page | Trainer self-study | Source map | Per-source review | Wall of text | Later |
| Logbook reflection prompt | Logbook | Sleep / soreness / pain capture | New field, optional | None | Survey fatigue | Later |
| AskForge explanation | Concierge | Q&A on rationale | `generation_meta` + sources | Per-claim review | Hallucination | Parked |

---

## 14. Engine boundary rules

AI **may eventually**, in scoped slices:

- Summarise rationale text from existing `generation_meta` for trainer-facing chips.
- Classify caution flags only when a source-tagged rule fires (deterministic match → AI writes display copy only).
- Explain why an exercise was avoided, drawing only from logged exclusion reasons.
- Generate first-draft education copy for trainer approval, never auto-published.
- Suggest follow-up assessment questions based on missing fields.
- Explain readiness badge changes in plain language.
- Explain `programNextWeek` decisions (already deterministic; AI narrates only).

AI **must not**, ever:

- Diagnose or name pathology.
- Treat or prescribe around red flags.
- Invent or hallucinate citations. Citations come only from the static source map.
- Generate loaded neck work for general clients, full stop.
- Bypass the trainer brief-approval gate.
- Turn lifestyle inputs into medical claims.
- Re-enter Stage 4 or Stage 5. Period.
- Modify Bompa wave or NSCA increment contracts.
- Overrule PAR-Q+ / ACSM screening outputs.
- Imply Protocol replaces a clinician.
- Generate cervical, lumbar, or joint-specific health claims that lack a source-map entry.

Stage 4 and Stage 5 remain deterministic forever. This is non-negotiable and matches the existing `mem://index.md` core rule.

---

## 15. Data architecture proposal

No schema changes proposed for MVP. Options for later, ranked by leverage / risk:

| Option | Enables | Risks | Migration? | RLS impact | PDF impact | Stage scope | Phase |
|---|---|---|---|---|---|---|---|
| A. No-schema MVP via existing `generation_meta` | Slice J rationale chips | None | No | None | None | Stage 3 read | **MVP** |
| B. Readiness badges in `programming_variables` (JSONB) | Persist badge state per plan | None — JSONB is loose | No | None | None | None | After Slice J |
| C. Caution flags in assessment synthesis (JSONB) | Persist screening guardrails | None | No | None | None | Stage 1 read | After Slice J |
| D. `evidence_claims` table | Source-of-truth for all chips | Migration; needs admin UI | Yes | Yes (read-all-authenticated) | Yes (citation render) | None | After Slice A |
| E. `readiness_checks` table | Daily readiness inputs | Survey-fatigue UX risk | Yes | Yes (client-scoped) | None | Optional Stage 3 input | Later |
| F. `education_notes` static JSON | PDF + Manual content | Risk of rotting copy | No (file) | None | Yes | None | After Slice A |
| G. `exercise_caution_flags` per `ExerciseKey` | Auto-exclude from generation | Over-restriction | No (file) | None | None | Stage 3 input | Parked until Slice J vocabulary stabilises |
| H. Taxonomy extensions (`contraindications`, `red_flags`) | Static guardrails | Locks decisions in code | No (file) | None | None | Stage 3 | Parked |
| I. Logbook symptom fields | Symptom trend → readiness badge | Privacy + survey fatigue | Yes | Yes (client-scoped, sensitive) | None | None | Later |

MVP path: **A → C (display only) → B → D → F → E → I → G → H.**

---

## 16. MVP slice ranking

| Rank | Slice | Score | Why |
|---|---|---|---|
| 1 | **J. "Why selected / why avoided" rationale chips** | 9 | Pure presentation, uses existing `generation_meta`, defines the rationale vocabulary every later slice reuses, immediately visible value to trainer, no schema, no Stage 4/5 touch, low credit cost. |
| 2 | A. Source ingestion + evidence map | 8 | Unblocks chips D, F, every claim. But heavier (needs review pass per source). Better as its own round after Slice J. |
| 3 | I. `needs_evidence` chip system | 7 | Trivial component; needs claim inventory. Pairs naturally with Slice J. |
| 4 | C. Caution badge system in Brief | 7 | Reuses existing screening outputs. Display-only. Useful if Slice J ships first. |
| 5 | B. R76 audit | done | This document. |
| 6 | D. PDF education notes architecture | 6 | High value but only after Slice A produces the notes. |
| 7 | F. Joint/spine caution flags in taxonomy | 5 | Risk of premature lock-in. Wait for Slice J vocabulary. |
| 8 | E. Logbook readiness questions | 4 | Survey-fatigue risk; defer until logbook completion is proven sticky. |
| 9 | G. Neck/cervical taxonomy draft | 3 | Low value vs risk. Do nothing until levels 1–3 prove demand. |
| 10 | H. McGill spine knowledge page | 2 | Source absent (§4). Park. |

---

## 17. Recommended next slice

**Slice J — Trainer-facing "why selected / why avoided" rationale chips.**

Scope (for the future R77+ implementation round, not this round):

- Surface in `MovementPatternCard` and `ProgressionExerciseCard`.
- Read from `generation_meta` fields already written by Stage 3 (`prior_exercise_pool`, picked exercise, equipment filter, contraindication filter).
- New `<RationaleChip kind="selected|avoided|regressed|progressed" />` component, presentational only.
- i18n keys under `plan.rationale.*` in EN + PT-PT (ES/HI fall back).
- Vocabulary defined here:
  - `selected:pattern_match` — "Cobre o padrão prescrito"
  - `selected:equipment_fit` — "Compatível com o equipamento disponível"
  - `selected:rotation` — "Roda em relação ao bloco anterior"
  - `avoided:equipment_missing` — "Equipamento indisponível"
  - `avoided:contraindication` — "Excluído por restrição clínica"
  - `avoided:rotation_block` — "Repetiria exercício do bloco anterior"
  - `regressed:rpe_drift` — "RPE acima do prescrito nas últimas sessões"
  - `progressed:wave_increment` — "Incremento determinístico (Bompa)"
- No schema. No Stage 4/5 change. No new server function. Pure read of existing JSONB.
- Estimated cost: 4–6 credits.

Acceptance for Slice J (when it ships): every exercise card on `/plans/$id` shows ≥1 rationale chip; chips render in PT and EN; PDF unchanged; mobile 375px clean; no new AI call; no new dependencies.

---

## 18. Risks

- **Trainer overload.** If chips multiply, the plan view becomes noise. Cap: max 2 chips per exercise card, 3 in expanded view.
- **False authority creep.** Trainers may treat "why avoided" as medical reasoning. Tooltip must say "Decision-support — not medical advice."
- **Citation theatre.** Adding source labels without real sources behind them. Mitigation: `needs_evidence` chip is mandatory until Slice A ingests sources.
- **Schema drift.** Trying to "just add a JSONB field" before Slice J vocabulary stabilises. Hold the line on no-schema MVP.
- **Stage 4/5 contamination.** Any future slice that wants AI to "explain progressions" must read-only on the deterministic output. Never write back.
- **Cervical scope creep.** A "neck training feature" is the seductive misread. Reject in code review if anyone tries.

---

## 19. Parked items

- McGill source ingestion (§11) — separate round, low priority.
- Loaded cervical work (levels 4–9 of §10) — parked indefinitely for general clients.
- HRV / wearable integration — parked, post-MVP.
- `exercise_caution_flags` schema (§15 G/H) — parked until Slice J vocabulary proves stable.
- AskForge medical Q&A — parked.
- Anxiety / mental-health screeners — out of scope.
- Cycle-phase prescription — parked, requires its own evidence round.
- Knowledge page redesign — parked.

---

## 20. `needs_evidence` list

Every claim below ships only as `needs_evidence` until source ingestion (Slice A) produces a full ethics-compliant entry:

- Hydration ↔ joint pain.
- Hydration ↔ injury risk.
- Sleep ↔ injury risk (Watson 2017 candidate).
- Sleep ↔ adaptation magnitude.
- Inflammation ↔ training response (Peake 2017 candidate).
- Protein timing ↔ hypertrophy.
- Protein dose per kg ↔ outcomes.
- Gelatin / vitamin C ↔ tendon collagen (Shaw 2017).
- McGill Big 3 ↔ low back symptoms.
- McGill spine-sparing ↔ general population.
- Cervical isometrics ↔ concussion risk reduction.
- Loaded neck work ↔ general health benefit.
- Stress ↔ pain sensitivity.
- Posture ↔ back pain.
- Foam rolling ↔ recovery.
- Static stretching ↔ injury prevention.
- "Knees over toes" ↔ knee health.
- Squat depth ↔ knee damage.
- Spinal flexion under load ↔ disc injury.
- Bracing intensity ↔ performance vs injury trade-off.

---

## 21. Future smoke checklist

When any overlay slice ships, the smoke pass must verify:

- [ ] No new client-facing scientific claim renders without a source chip OR `needs_evidence`.
- [ ] PT and EN copy present; ES/HI fall back without crash.
- [ ] PDF unchanged unless slice explicitly touches PDF.
- [ ] Stage 4 and Stage 5 outputs byte-identical for a fixed seed.
- [ ] No new AI call introduced unless slice explicitly authorises it.
- [ ] Mobile 375px Safari renders chips without overflow.
- [ ] Any caution flag links to a referral copy block; copy says "see a clinician", not a diagnosis.
- [ ] Brief-approval gate still required before plan generation; no auto-bypass.
- [ ] `generation_log` written for every AI call (existing non-negotiable).
- [ ] No new RLS policy regressions (run linter).

---

## 22. Do-not-do list

- Do not build a "neck training" feature.
- Do not auto-generate loaded cervical work for general clients.
- Do not add medical advice anywhere in the app.
- Do not diagnose pain.
- Do not frame all inflammation as harmful.
- Do not claim hydration reduces joint pain.
- Do not chip "McGill-approved" or "McGill method".
- Do not transfer lumbar evidence to cervical claims.
- Do not add a wellness dashboard.
- Do not introduce a numeric readiness score in MVP.
- Do not add client-facing science copy before evidence review.
- Do not touch the phased engine.
- Do not touch Stage 4 or Stage 5.
- Do not bypass trainer brief approval.
- Do not edit DB schema in R77 (Slice J is presentation-only).
- Do not edit `exercise-taxonomy.ts` or `session-taxonomy.ts` in R77.
- Do not introduce HRV / wearable inputs.
- Do not invent citations.
- Do not present a single-paper finding as consensus.

---

## 23. Acceptance criteria for the next round (R77)

R77 ships Slice J only. It passes if:

- New `<RationaleChip />` component exists in `src/components/ux/` (alongside `RationaleChip.tsx` if already present — extend, do not duplicate).
- Chips render in `MovementPatternCard` and `ProgressionExerciseCard` for every exercise that has data in `generation_meta`.
- Vocabulary matches §17 list. New i18n keys added under `plan.rationale.*` in EN + PT-PT.
- No schema migration.
- No change to `stage3-microcycle`, `stage4-progressions`, `stage5-bulkfill`, `program-next-week`, `programming-tier`.
- No change to PDF.
- No new AI call. No new server function.
- 375px Mobile Safari smoke clean.
- Tooltip on every chip reads "Decision-support — not medical advice." (or PT equivalent under existing voice).
- `mem://index.md` gets one Memories line referencing this audit (deferred to R77 since R76 is read-only).
- `.lovable/backlog.md` Phase D gets a "Slice J shipped" marker.
- Credit budget for R77: ≤6 credits. If forecast exceeds, halve scope (only `MovementPatternCard`, defer `ProgressionExerciseCard`).

R76 is closed.
