# assessment-protocol-v1

## Status

Draft v1 distilled from Protocol Core Stack output 1. This is not final clinical guidance. It is a product-domain manual for a practical personal-trainer decision-support system.

## Core principle

Protocol must collect the minimum information needed to prescribe exercise safely, practically, and defensibly. The assessment should work in low-equipment settings, but it should clearly mark missing data and reduce confidence when important information is unavailable.

Assessment exists to change decisions. If a field does not affect safety, exercise selection, progression, adherence, or trainer workflow, it does not belong in the MVP.

## Required minimum assessment fields - MVP

### Consent and scope

Collect informed consent before testing or prescription.

Client must understand that Protocol supports trainer decision-making and does not provide diagnosis, treatment, or medical clearance.

### Identity and basic profile

Collect name, age, sex, contact details, and preferred communication language.

Sex/pregnancy status may change screening flow and exercise prescription. Handle pregnancy/postpartum as a special branch later if not covered safely in MVP.

### Current physical activity status

Collect recent activity over approximately the last 3 months: frequency, intensity, duration, type, and consistency.

This affects starting dose, risk screening, progression speed, and whether the person is treated as inactive, returning, or currently active.

### Current signs and symptoms

Ask about signs/symptoms that may require medical referral before exercise, especially chest pain or discomfort, unexplained dizziness/syncope, unusual shortness of breath, palpitations, or symptoms outside normal exertion.

These are safety gates, not training-preference questions.

### Known medical conditions

Ask about known cardiovascular, metabolic, renal, respiratory, neurological, or other relevant diagnosed conditions.

The trainer does not diagnose. The system records known conditions and flags when medical clearance or caution may be needed.

### Medications relevant to exercise response

Ask about medications that may affect heart rate, blood pressure, fatigue, balance, glucose response, pain perception, or thermoregulation.

Medication data should be treated as risk-relevant. The trainer does not interpret medication medically; Protocol flags that prescription may require caution or clinician input.

### Injury, pain, and limitation history

Collect current pain, previous injuries, surgeries, physical limitations, movement restrictions, and activities that aggravate symptoms.

Do not ask the trainer to diagnose tissues or pathologies. Record location, severity, irritability, behavior, aggravating/easing factors, and whether the issue is current or historical.

### Primary goal

Collect the client’s main goal and secondary goals: health, fat loss, hypertrophy, strength, mobility, pain-aware return to training, endurance, sport performance, or general fitness.

Goals affect prescription priorities, but safety and scope override goals.

### Availability and logistics

Collect training days per week, session duration, location, equipment access, schedule constraints, and preferred training format.

This affects feasibility and adherence.

## Strongly recommended fields - MVP

### Resting blood pressure and resting heart rate

Resting BP and HR should be measured before prescription whenever possible.

BP is strongly recommended because it improves screening quality and may affect intensity decisions.

If BP is unavailable, Protocol should mark BP as missing and reduce screening confidence. It should not pretend the assessment is complete.

BP belongs mainly to baseline screening and selected flagged-client pre-session checks. It should not be routinely measured mid-workout in normal personal-training sessions.

### Movement quality appraisal

Use a simple framework-agnostic movement appraisal: squat, hinge, lunge/split stance, push, pull, single-leg balance or stance, and basic trunk control where relevant.

This is not a diagnosis. It is a trainer observation used to choose exercise regressions, progressions, and coaching priorities.

Protocol must not require FMS or any proprietary screen. Movement screens are optional tools, not mandatory architecture.

### Baseline capacity markers

Collect simple baselines when feasible: walking capacity, estimated aerobic tolerance, basic strength endurance, balance, mobility, and perceived exertion response.

No-equipment alternatives should exist.

### Sleep, stress, recovery, and adherence barriers

Collect basic recovery and behavior constraints: sleep quality, stress level, motivation, perceived barriers, previous adherence problems, and training confidence.

These influence progression speed, session complexity, and coaching strategy.

## Optional advanced fields - later

Detailed anthropometrics: waist circumference, body composition, skinfolds, bioimpedance.

Advanced performance testing: 1RM/3RM/5RM estimates, vertical jump, power tests, aerobic tests, velocity data.

Laboratory or medical data if provided by the client: lipids, HbA1c, glucose profile, clinical reports.

Daily readiness markers: morning HR, HRV, sleep duration, mood, soreness, fatigue, pain trend.

Photos and posture images: useful later, but not mandatory for MVP.

## No-equipment fallback version

Protocol must work even if the trainer has no BP device, no tape measure, no body composition tool, no gym equipment, no photos, and no movement-screening kit.

Minimum no-equipment assessment:

- consent and scope acknowledgement
- health history and symptoms
- known conditions
- medications
- current activity level
- current pain/injury/limitations
- goals
- schedule and equipment availability
- simple bodyweight movement appraisal
- talk-test-based intensity guidance
- walking tolerance or simple field capacity question

Missing objective data should create confidence warnings, not paralysis.

## Fields that change safety/risk decisions

Current symptoms override training goals.

Known cardiovascular, metabolic, renal, respiratory, neurological, or complex medical history may require caution, intensity limitation, or medical clearance.

Resting BP, when available, affects screening confidence and intensity decisions.

Medication status affects interpretation of HR, fatigue, blood pressure response, glucose risk, and perceived exertion.

Current pain, recent surgery, unresolved injury, neurological symptoms, or unexplained symptoms may require modification or referral.

Pregnancy/postpartum status should branch to a specific safe protocol later; do not improvise advanced logic in MVP if not fully supported.

## Fields that change exercise selection

Pain location and triggers influence which exercises are avoided, modified, regressed, or delayed.

Movement quality influences starting variation, range of motion, load, stability demand, and coaching focus.

Equipment access determines exercise options and substitution paths.

Training experience determines complexity, technical demand, and progression aggressiveness.

Goal determines movement priority but does not override safety.

## Fields that change progression

Session RPE, adherence, pain response, soreness duration, performance trend, technique quality, sleep/recovery, and motivation affect progression.

Progression should not be based only on completed workouts.

Progression should be slowed, held, or regressed when pain increases, technique degrades, adherence fails, fatigue accumulates, or confidence is low.

AI may suggest progression, but trainer approval should be required.

## Fields that should be versioned historically

- health history
- symptoms
- medication changes
- injury and pain history
- BP/HR measurements
- movement appraisal results
- performance/capacity baselines
- goals
- equipment access
- schedule availability
- trainer notes
- risk flags
- referral/clearance status

Historical versioning matters because future decisions depend on change over time, not only current state.

## Fields that should remain trainer judgment

- interpretation of vague symptoms within scope
- movement-quality observation
- choice of regression/progression
- decision to simplify or stop an exercise
- readiness to progress
- client motivation and ambivalence
- coaching tone and communication
- referral decision when uncertainty exceeds trainer scope

AI can summarize and suggest, but should not replace trainer judgment.

## Things Protocol should not ask in MVP

Do not ask trainers to diagnose specific tissues, pathologies, or medical conditions.

Do not ask for complex lab data as required input.

Do not require FMS, SFMA, force plates, VO2 testing, skinfolds, bioimpedance, HRV, or posture photos.

Do not include detailed nutrition, eating-disorder, psychiatric, or medical questionnaires beyond basic referral/scope flags unless handled by qualified professionals.

Do not turn clinical exercise-testing rules into normal gym-session rules.

Do not make any single method, framework, or school the center of Protocol.

## Decision authority

Deterministic: consent required, missing-data warnings, symptom flags, scope warnings, referral prompts.

Trainer approval required: exercise selection, progression, regression, modification, plan approval, referral follow-up.

AI-assisted: summaries, pattern detection, suggested risk flags, suggested exercise modifications, suggested progression options.

Never automated: diagnosis, treatment, medical clearance, clinical interpretation, final responsibility for trainer decisions.

## Open issues for later validation

PAR-Q+ licensing/copyright implications must be checked before reproducing wording directly.

BP thresholds must be context-specific and aligned with current guideline interpretation.

Pregnancy/postpartum branch needs dedicated source support before implementation.

Pain rules need a dedicated manual before being used in plan generation.

Movement appraisal scoring must remain framework-agnostic unless the trainer explicitly selects a named protocol.

