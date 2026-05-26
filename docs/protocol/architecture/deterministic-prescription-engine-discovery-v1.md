# Deterministic Prescription Engine Discovery v1

## 1. Executive Summary

Protocol should become deterministic-first because most high-quality training prescription is rule-governed, auditable, and repeatable. Exercise selection, volume accounting, readiness gates, progression, deloads, cardio zones, and session-log calculations should be implemented as explicit code and source-of-truth tables, not left to generative model behavior.

AI should be minimized because prescription errors are safety-relevant and expensive to debug. Deterministic logic can be tested, versioned, audited, explained, and overridden by trainers. AI should assist only where formulas are insufficient: interpreting free text, summarizing notes, detecting qualitative patterns, explaining rationale, and proposing missing-data hypotheses for trainer review.

Trainer spreadsheets are useful operational evidence, not final truth. They show how an advanced trainer actually encodes planning, volume tracking, lookup tables, workout logs, readiness notes, cardio, and progression heuristics under real workflow pressure. They should inform engine design without becoming the product design or a direct data source.

Protocol can become a better, safer, auditable version of advanced trainer spreadsheets by turning spreadsheet patterns into typed entities, pure TypeScript engines, test fixtures, audit events, and trainer-editable source-of-truth tables. The product should keep the trainer's judgment visible while making repeated calculations deterministic.

Privacy note: this report used local spreadsheet structure only. It does not quote private cell values, names beyond filenames, notes, dates of birth, contacts, comments, or identifiable client data.

## 2. Reference File Inventory

| Filename | Workbook/sheet structure | Type of workbook | Apparent purpose | Privacy risk level | Usable for structure extraction? |
| --- | --- | --- | --- | --- | --- |
| `João v3.xlsx` | 5 sheets. One large prescription/log-like sheet around 975 rows x 35 columns; one compact tracking sheet around 45 rows x 10 columns; one formula-heavy summary/muscle-volume-like sheet around 985 rows x 17 columns; one text-heavy lookup/reference sheet around 539 rows x 10 columns; one compact cardio/body-summary-like sheet around 35 rows x 15 columns. No macros detected. | Client-specific programming workbook with prescription, lookup, tracking, and summary surfaces. | Operational example of session prescription, exercise/muscle lookup, cardio/body tracking, volume summaries, and formula-driven calculations. | High, because it appears client-specific. | Yes, for structure, sheet shapes, formula patterns, and category inference only. |
| `Macrociclo 1 - João Francês.xlsx` | 8 sheets. One macrocycle overview-like sheet around 1006 rows x 43 columns; one assessment/body tracking-like sheet around 949 rows x 18 columns; two very wide session prescription/log sheets around 973-980 rows x 179 columns; two lookup/summary sheets around 1002 rows x 24-33 columns; one text-heavy rules/reference sheet around 1004 rows x 24 columns; one sparse lookup sheet around 979 rows x 66 columns. No macros detected. | Larger macrocycle workbook with planning, session logs, lookup tables, and summaries. | Operational example of mesocycle/macrocycle planning, session prescription, RPE/RIR tracking, performed logs, VLOOKUP-driven summaries, and reference rules. | High, because it appears client-specific and longitudinal. | Yes, for structure, formula families, repeated table shapes, and rule candidates only. |

Extraction method: local read-only workbook XML inspection using Python standard library modules. No spreadsheet packages were installed. Sheet names and private cell values were not retained in this report.

## 3. Spreadsheet Pattern Map

Recurring workbook patterns:

- Exercise libraries: both workbooks contain exercise/reference-like regions with repeated exercise lookup behavior and structured table areas.
- Muscle databases: repeated muscle/reference categories and formula-driven muscle summary areas appear, especially in lookup and summary sheets.
- Session prescription tables: wide, repeated weekly/day/session layouts appear, with fields consistent with exercises, sets, reps, load, rest, RPE/RIR, and notes.
- Performed set logs: wide session sheets appear to support planned-vs-performed tracking and repeated logged set blocks.
- RPE/RIR tracking: the larger macrocycle workbook has strong RPE/RIR signal across wide prescription/log sheets.
- Hard-set counting: formula patterns suggest conditional counting, weighted aggregation, and weekly summary calculations.
- Weekly volume summaries: both workbooks include summary-style formula regions using aggregation functions.
- Mesocycle progression: macrocycle-sized sheets and week-index formulas suggest progression decisions across blocks.
- Readiness/diary metrics: recurring readiness, recovery, fatigue, sleep/stress/DOMS-like categories appear in compact and rules/reference sheets.
- Cardio zones: both workbooks show cardio/zone-like surfaces and summary formulas.
- Bodyweight/perimeter tracking: compact tracking sheets and formula areas indicate body metrics and longitudinal monitoring.
- Feedback fields: notes/feedback/observation-like regions recur, especially near session and readiness areas.
- Notes/override areas: manual adjustment and override-like categories appear; these should become first-class trainer overrides.
- Progression formulas: formulas include lookup, conditional, text parsing, and aggregation functions.
- Deload logic: deload/recovery terms appear sparsely; enough to justify a deterministic deload module, not enough to define defaults without external evidence.

Observed formula families:

- Lookup: `VLOOKUP`, `XLOOKUP`.
- Conditional gates: `IF`, `IFERROR`, `SWITCH`, `OR`.
- Aggregation: `SUM`, `SUMIFS`, `SUMPRODUCT`, `AVERAGE`, `COUNT`, `COUNTA`.
- Text normalization/parsing: `TRIM`, `SUBSTITUTE`, `SEARCH`, `REGEXMATCH`, `REGEXREPLACE`, `SPLIT`, `UPPER`.
- Date/time: `DATE`, `WEEKNUM`, `DATEDIF`, `TODAY`.
- Numeric formatting: `ROUND`, `INT`, `VALUE`.

Interpretation: the spreadsheets are already functioning as deterministic engines. Protocol should preserve the deterministic nature while replacing fragile formulas with typed tables, pure functions, tests, and audit trails.

## 4. Deterministic Rule Candidates

| Rule area | Inputs | Deterministic logic candidate | Output | Confidence | Trainer editable? | AI needed? | Evidence needed before production default | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Exercise lookup | Exercise id/name, equipment, pattern, goal, contraindications | Normalize exercise identity and resolve to `exercise_template` with tags. | Canonical exercise metadata. | High | Yes | No | Exercise taxonomy quality audit. | Replace spreadsheet text lookup with typed IDs. |
| Muscle involvement mapping | Exercise id, muscle map, involvement role | Map exercise to muscles with role weights. | Muscle contribution rows. | High | Yes | No | Exercise taxonomy review and trainer validation. | Needed for hard-set weighting. |
| Prime mover/synergist/stabilizer volume weighting | Performed or prescribed sets, muscle roles | Weight sets by involvement role, e.g. prime > synergist > stabilizer. | Weighted set volume by muscle. | Medium | Yes | No | Hypertrophy volume evidence and trainer policy. | Exact weights are a human policy decision. |
| Weekly volume by muscle | Planned/performed sets, week, muscle map | Sum weighted sets per muscle per week. | Weekly muscle volume audit. | High | Yes, thresholds | No | Volume dose-response references. | Core deterministic module. |
| Weekly volume by movement pattern | Exercise pattern tags, sets, week | Sum sets by squat/hinge/push/pull/lunge/carry/rotation/etc. | Weekly movement-pattern volume. | High | Yes | No | Pattern taxonomy. | Useful for balance and fatigue audits. |
| MEV/MRV thresholds | Goal, training age, muscle, phase, recovery | Compare weekly volume against editable MEV/MAV/MRV bands. | Under/target/over-volume flags. | Medium | Yes | No | Hypertrophy dose-response and trainer defaults. | Defaults must be defensible but editable. |
| Session prescription | Goal, assessment, availability, equipment, volume targets, constraints | Allocate exercises, sets, reps, intensity, rest, and order from deterministic templates. | `exercise_prescription` rows. | Medium | Yes | Limited | NSCA/ACSM progression and trainer policy. | AI should not choose core dosage unsupervised. |
| Performed set normalization | Logged load/reps/RPE/RIR/completion | Normalize units, completion, hard-set eligibility, estimated intensity. | Normalized `performed_set`. | High | No, except correction | No | Unit and logging conventions. | Must be deterministic for audit. |
| RPE/RIR prescription | Goal, exercise class, rep range, phase, week | Assign target RPE/RIR bands by phase and exercise risk. | RPE/RIR prescription. | Medium | Yes | No | RPE/RIR autoregulation evidence. | Trainer can override by client. |
| Load progression | Prior performance, target reps/RIR, form flag, readiness | Increase/hold/decrease load based on achieved reps and RIR. | Progression decision. | High | Yes | No | NSCA progression and trainer rules. | Avoid opaque AI decisions. |
| Rep progression | Prior performance, rep range, target RIR | Add reps inside range before load increase. | Next target reps/load. | High | Yes | No | Double progression policy. | Source of truth should define scheme. |
| Deload trigger | Performance trend, volume, readiness, soreness, missed sessions | Trigger deload when thresholds cross defined gates. | Deload/hold/continue decision. | Medium | Yes | No | Deload and fatigue-management evidence. | Evidence needed for default sensitivity. |
| Readiness adjustment | Sleep, stress, soreness, fatigue, motivation, pain flags | Apply readiness score/gates to volume and intensity modifiers. | Session adjustment recommendation. | Medium | Yes | Maybe for free text | ACSM safety and autoregulation evidence. | Numeric fields deterministic; free text may use AI. |
| DOMS/recovery handling | DOMS by region, pain/soreness, previous session load | Gate same-muscle volume and intensity; suggest substitutions. | Recovery warning and adjustment. | Medium | Yes | Maybe for notes | Recovery and injury-risk evidence. | Need distinguish soreness vs pain. |
| Cardio zones | Resting HR, max HR method, age, test data | Compute HRR/Karvonen or configured zone table. | Cardio zone targets. | High | Yes | No | ACSM/FITT-VP/Karvonen. | Deterministic and testable. |
| Cardio weekly load | Cardio sessions, zone, duration, modality | Sum minutes/load by zone and modality. | Weekly cardio load. | High | Yes | No | ACSM FITT-VP. | Needed for concurrent training. |
| Concurrent training conflict rules | Strength plan, cardio load/timing/modality, priority | Flag interference risk by proximity, modality, intensity, and goal. | Conflict warning and scheduling suggestion. | Medium | Yes | No | Concurrent training interference evidence. | AI can explain but not decide silently. |
| Exercise substitution | Exercise id, constraints, equipment, muscle/pattern target | Find substitutes matching pattern, muscles, skill, loading, contraindications. | Ranked substitution list. | Medium | Yes | Maybe for rationale | Taxonomy and contraindication mapping. | Ranking should be deterministic first. |
| Trainer override/audit | Proposed decision, trainer edit, reason | Record override reason and compare against deterministic recommendation. | `trainer_override` and `audit_event`. | High | Yes | No | Product policy. | Critical for trust and learning. |

## 5. AI Minimization Map

### A. Must Be Deterministic

- Exercise lookup and canonicalization.
- Muscle involvement and pattern mapping.
- Set, rep, load, RPE/RIR, and rest prescription defaults.
- Performed set normalization.
- Weekly volume by muscle and movement pattern.
- MEV/MRV band comparison.
- Progression and regression decisions.
- Deload gates.
- Readiness score from structured inputs.
- DOMS/recovery gates from structured inputs.
- Cardio zone calculation.
- Cardio weekly load.
- Concurrent training conflict flags.
- Exercise substitution candidate filtering.
- Audit logs and trainer override tracking.

### B. Trainer Judgment Required

- Target training philosophy and default aggressiveness.
- Exact volume band defaults by goal, muscle, and training age.
- Whether a client should prioritize hypertrophy, strength, skill, health, or adherence when rules conflict.
- Risk tolerance for pain, high fatigue, or low readiness.
- Whether to override substitution, deload, or progression recommendations.
- Which metrics should be visible to clients vs trainer-only.

### C. AI May Assist

| AI use case | Why rules alone are insufficient |
| --- | --- |
| Interpret intake free text | Client goals, fears, constraints, and preferences are unstructured and may be ambiguous. |
| Summarize trainer/client notes | Notes can be long, inconsistent, and qualitative; deterministic extraction would be brittle. |
| Detect qualitative adherence patterns | Patterns like avoidance, confidence loss, or unclear pain descriptions often require language interpretation. |
| Explain rationale in natural language | Rules can produce the decision; AI can turn it into a readable explanation. |
| Missing-data hypotheses | AI can propose what might be missing, but a trainer or deterministic gate must confirm. |
| Override review assistance | AI can summarize why overrides are accumulating, but deterministic audit rules should flag the pattern first. |

AI should not be the source of dosage truth. It should explain, summarize, and help interpret ambiguous language around deterministic decisions.

## 6. Proposed Deterministic Engine Architecture

| Module | Inputs | Outputs | Pure functions | Required tests | Source-of-truth tables/entities |
| --- | --- | --- | --- | --- | --- |
| `exerciseTaxonomyEngine` | Exercise templates, tags, equipment, contraindications | Canonical exercise metadata | `normalizeExerciseId`, `getExerciseTags`, `getContraindicationFlags` | Identity resolution, duplicate aliases, contraindication matches | `exercise_template`, taxonomy tables |
| `volumeEngine` | Prescriptions, performed sets, muscle map, pattern tags | Weekly volume summaries and flags | `computeMuscleVolume`, `computePatternVolume`, `compareVolumeBands` | Role weighting, week grouping, partial set handling | `exercise_muscle_map`, `performed_set`, `volume_audit` |
| `prescriptionEngine` | Assessment, goal, schedule, equipment, volume targets | Planned workout days and exercise prescriptions | `allocateWeeklyVolume`, `buildSessionTemplate`, `assignRepLoadTargets` | Schedule constraints, goal templates, contraindication filtering | `assessment`, `workout_plan`, `workout_plan_day`, `exercise_prescription` |
| `progressionEngine` | Prior prescription, performed sets, readiness, scheme | Next load/reps/sets decision | `decideLoadProgression`, `decideRepProgression`, `decideSetAdjustment` | Double progression, missed targets, high/low RIR | `progression_decision`, `performed_set` |
| `readinessEngine` | Readiness log, DOMS, pain flags, sleep/stress/fatigue | Readiness score, gates, modifiers | `computeReadinessScore`, `gateSession`, `adjustVolumeIntensity` | Missing fields, severe flags, low readiness | `readiness_log`, `session_feedback` |
| `cardioEngine` | Resting HR, max HR method, cardio sessions, goals | Zone table, weekly cardio load | `computeKarvonenZones`, `classifyCardioSession`, `sumCardioLoad` | Zone boundaries, missing HR, modality aggregation | `cardio_session`, assessment cardio fields |
| `substitutionEngine` | Exercise template, constraints, target muscle/pattern, equipment | Ranked substitute list | `findSubstitutes`, `scoreSubstitution`, `explainSubstitutionRules` | Equipment mismatch, contraindications, pattern matching | `exercise_template`, `exercise_muscle_map` |
| `concurrentTrainingEngine` | Strength plan, cardio load, timing, modality, priority | Conflict warnings and scheduling suggestions | `detectInterferenceRisk`, `recommendSeparation`, `prioritizeConflict` | High-intensity lower-body conflicts, same-day timing | `workout_plan_day`, `cardio_session` |
| `auditEngine` | Engine decisions, overrides, missing data, safety flags | Audit events and review queues | `auditPrescription`, `auditProgression`, `auditOverride`, `auditMissingData` | Safety flags, excessive volume, override accumulation | `audit_event`, `trainer_override`, `volume_audit` |

Architecture rule: every module should be pure where possible. Server functions should orchestrate persistence and auth; engines should accept typed inputs and return typed decisions plus audit metadata.

## 7. Data Model Implications

| Spreadsheet concept | Protocol entity |
| --- | --- |
| Client identity and high-level profile | `client` |
| Assessment responses, goals, constraints, health readiness | `assessment` |
| Exercise library rows | `exercise_template` |
| Muscle involvement and role weights | `exercise_muscle_map` |
| Macrocycle/mesocycle/week plan | `workout_plan` |
| Training day/session table | `workout_plan_day` |
| Prescribed exercise, sets, reps, load, rest, RPE/RIR | `exercise_prescription` |
| Logged set rows | `performed_set` |
| Session notes, difficulty, soreness, compliance | `session_feedback` |
| Diary/readiness metrics | `readiness_log` |
| Cardio session and zone work | `cardio_session` |
| Weekly volume summaries and flags | `volume_audit` |
| Load/reps/sets next-step decision | `progression_decision` |
| Manual trainer changes | `trainer_override` |
| Safety, audit, and traceability events | `audit_event` |

## 8. Evidence And Reference Needs

Evidence needed to make deterministic rules defensible:

- ACSM / FITT-VP / safety: health screening, cardio dosage, zone work, progression safety, readiness gates.
- NSCA / resistance training progression: load progression, rep ranges, rest periods, exercise ordering, strength/hypertrophy defaults.
- Hypertrophy volume dose-response: MEV/MAV/MRV ranges, muscle-specific volume bands, set weighting.
- RPE/RIR/autoregulation: target RIR by phase, load progression gates, readiness adjustments.
- Concurrent training interference/separation: modality, timing, intensity, and goal-priority conflict rules.
- Heart-rate reserve / Karvonen cardio zones: deterministic cardio zone calculation.
- Trainer spreadsheet examples: operational structure, repeated workflow patterns, formulas, and audit surfaces.

Do not request broad book dumps. Pull focused references only when a specific default, threshold, or gate needs defense.

## 9. Implementation Roadmap

1. PR 1 - docs-only deterministic engine discovery.
2. PR 2 - schema/source-of-truth gap audit.
3. PR 3 - exercise taxonomy import plan.
4. PR 4 - pure volume engine.
5. PR 5 - performed set/session-log normalization.
6. PR 6 - progression engine.
7. PR 7 - cardio/readiness engine.
8. PR 8 - AI-minimization pass.

## 10. Human-Only Decisions Needed

- Target training philosophy for default plans.
- Default volume ranges and aggressiveness by goal/training age.
- Risk tolerance for fatigue, pain, readiness, and progression speed.
- Which spreadsheet patterns are trustworthy enough to inspire defaults.
- Which metrics should be visible to trainers, clients, or both.
- Which deterministic rules require trainer override before applying.
- Whether muscle role weights should be fixed globally or editable by trainer/team.
- Whether cardio and strength conflicts should prioritize hypertrophy, strength, health, or adherence.
- Which audit warnings should block saving vs merely warn.

No manual extraction work is assigned to humans. Human input is needed for policy, philosophy, and risk decisions only.
