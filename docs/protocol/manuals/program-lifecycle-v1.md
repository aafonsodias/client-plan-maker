# program-lifecycle-v1

## Status

Draft v1 distilled from Protocol Core Stack output 6. This is a product-domain manual for how Protocol manages clients, assessments, training blocks, and sessions over time.

This manual defines states, transitions, decision gates, historical records, and approval logic. It does not generate workouts.

## Core principle

Protocol must be a longitudinal decision-support system.

A client is not a plan. A plan is not a session. A session is not an assessment.

Protocol must separate:

- client lifecycle
- assessment lifecycle
- training block lifecycle
- session lifecycle

Each lifecycle has different states, triggers, approvals, and historical records.

## Source hierarchy

When sources conflict, Protocol prioritizes:

1. safety and scope of practice
2. practical personal-trainer usability
3. adherence and feasibility
4. exercise science
5. periodization/progression theory
6. pain-informed communication
7. movement frameworks
8. product/software workflow

## Lifecycle 1 - Client lifecycle

### Purpose

Represents the trainer-client relationship and participation status over time.

### MVP states

- inquiry
- invited
- intake started
- screening incomplete
- provisional
- active
- active with restrictions
- referred / awaiting clearance
- paused
- dormant
- archived

### Transitions

Inquiry to invited: trainer creates or imports client.

Invited to intake started: client opens or begins intake.

Intake started to screening incomplete: client submits partial or insufficient data.

Screening incomplete to provisional: trainer allows conservative participation while key data is missing.

Provisional to active: screening and trainer review are sufficient.

Active to active with restrictions: risk, pain, adherence, equipment, or clinician instruction limits the plan.

Any active state to referred: symptoms, red flags, medical uncertainty, or scope breach.

Active to paused: illness, injury, travel, life interruption, or trainer decision.

Paused to active: trainer reviews relevant updates and restarts appropriately.

Active/paused to dormant: no current training relationship or long inactivity.

Dormant to active: reassessment required before normal progression.

### Required inputs

- consent status
- basic identity
- health/screening data
- goal
- contact/status
- trainer ownership
- current participation status

### Generated outputs

- participation status
- risk/restriction status
- active plan eligibility
- required next action
- referral/clearance status if applicable

### Progression triggers

Client can move toward active status when screening, assessment, and trainer review are sufficient for the intended training intensity.

### Regression/escalation triggers

- new symptoms
- unresolved pain
- missing critical screening data
- injury or surgery
- clinician restriction
- repeated adherence failure
- long gap since last assessment

### Missing-data states

Missing data should create a provisional or review-required state, not fake certainty.

### What persists historically

- consent events
- screening state
- risk flags
- referral/clearance state
- health history versions
- major status transitions
- trainer decisions
- pause/dormant reasons

### Trainer approval required

- accepting active participation
- moving from provisional to active
- restarting after pause/dormancy
- overriding AI suggestions
- applying restrictions

### AI may suggest

- missing data summary
- risk flag summary
- next action
- conservative restart recommendation

### Never automated

- final acceptance of client risk
- medical clearance
- diagnosis
- decision to ignore referral-level concern

## Lifecycle 2 - Assessment lifecycle

### Purpose

Represents the process of collecting, reviewing, updating, and using assessment data.

### MVP states

- not started
- in progress
- submitted
- incomplete
- needs trainer review
- reviewed
- valid for prescription
- expired / stale
- reassessment due

### Transitions

Not started to in progress: intake link or trainer assessment begins.

In progress to submitted: client or trainer submits data.

Submitted to incomplete: required or risk-relevant data is missing.

Submitted to needs trainer review: data is present but requires interpretation.

Needs trainer review to reviewed: trainer confirms findings.

Reviewed to valid for prescription: assessment can safely inform plan creation.

Valid to expired/stale: time passes, status changes, pain changes, or block ends.

Any state to reassessment due: new symptoms, pain, plateau, poor adherence, or major goal/context change.

### Required inputs

- assessment protocol version
- raw answers
- measurement context
- movement appraisal if used
- BP/HR if available
- pain/injury status
- equipment and logistics
- goal and activity history

### Generated outputs

- assessment summary
- missing-data warnings
- risk/safety flags
- prescription constraints
- exercise-selection constraints
- progression constraints
- confidence level

### Progression triggers

Assessment supports progression when relevant baseline data is current, symptoms are stable, and session logs support increased training stress.

### Regression triggers

- worsening pain
- movement quality deterioration
- new risk flag
- large adherence drop
- fatigue trend
- stale or contradictory assessment data

### Reassessment triggers

- end of training block
- major goal change
- new pain/injury
- medical status change
- long absence
- plateau despite adherence
- unexpected performance drop
- trainer uncertainty

### Missing-data states

Data can be:

- missing
- self-reported only
- measured by trainer
- externally measured
- clinician-provided
- outdated
- contradictory

Protocol should store confidence level and source.

### What persists historically

- raw answers
- assessment version
- measurement values
- confidence level
- trainer review
- AI summary if used
- constraints generated
- reassessment reason

### Trainer approval required

- marking assessment valid for prescription
- accepting incomplete assessment for provisional training
- interpreting movement quality
- resolving contradictions

### AI may suggest

- summary
- missing fields
- contradictions
- likely constraints
- reassessment needs

### Never automated

- clinical interpretation
- diagnosis
- clearance
- final assessment approval

## Lifecycle 3 - Training block lifecycle

### Purpose

Represents a time-bounded intervention designed to produce a training adaptation while respecting safety, adherence, and recovery.

### MVP states

- draft
- trainer review
- approved
- active
- modified
- deload / unload
- paused
- completed
- failed / needs redesign
- archived
- next block planned

### Transitions

Draft to trainer review: Protocol generates or trainer builds a candidate plan.

Trainer review to approved: trainer accepts plan and constraints.

Approved to active: first session begins or plan is delivered.

Active to modified: pain, equipment, adherence, fatigue, or trainer preference changes the plan.

Active to deload/unload: fatigue, recovery issue, pain response, or planned reduction.

Active to paused: illness, injury, travel, referral, or major interruption.

Active to completed: block reaches planned endpoint and review is performed.

Completed to next block planned: trainer reviews outcomes and starts next intervention.

Active/completed to failed/needs redesign: goals were not met, plan was not adhered to, or assumptions were wrong.

### Required inputs

- valid assessment or provisional constraints
- goal
- risk/screening constraints
- pain/limitation constraints
- prescription parameters
- exercise taxonomy constraints
- schedule/frequency
- equipment
- trainer approval

### Generated outputs

- block summary
- weekly/session structure
- progression rules
- deload/reduction rules
- exercise prescriptions
- constraints
- success criteria
- review criteria

### Progression triggers

- adherence sufficient
- sessions completed as intended
- RPE/RIR within target
- pain stable or absent
- technique acceptable
- recovery acceptable
- performance improves or remains appropriate

### Regression triggers

- pain increase
- technique breakdown
- excessive RPE drift
- poor recovery
- missed sessions
- plateau with fatigue
- new restriction or risk flag
- client confidence drop

### Reassessment triggers

- block end
- unexpected failure
- repeated modifications
- persistent pain
- major adherence failure
- goal change
- new medical/pain flag

### Missing-data states

If assessment/log data is incomplete, Protocol should avoid aggressive progression and require trainer review.

### How a block ends

A block ends by:

- planned completion
- early stop for safety/referral
- pause due to interruption
- redesign because assumptions failed
- trainer decision

### How next block starts

Next block must consider:

- previous block outcome
- adherence
- pain response
- progression success/failure
- updated goals
- updated assessment if needed
- exercise pool history
- trainer override history

### Avoiding endless plan drift

Protocol should require a block review before continuing indefinitely.

If too many changes occur inside a block, Protocol should suggest redesign rather than endless patching.

### What persists historically

- block version
- prescription parameters
- exercise prescriptions
- constraints
- progression rules
- modifications
- deloads/unloads
- trainer approvals
- AI suggestions accepted/rejected
- outcome review
- reason for next block

### Trainer approval required

- approving the block
- changing core parameters
- progressing/regressing after issues
- ending/redesigning a block
- starting next block

### AI may suggest

- block summary
- modification options
- deload need
- next-block considerations
- exercise rotation
- progression/regression candidates

### Never automated

- final block approval
- ignoring risk/pain constraints
- overriding trainer scope
- medical decisions

## Lifecycle 4 - Session lifecycle

### Purpose

Represents execution of one training event and the immediate feedback loop into future prescription.

### MVP states

- scheduled
- ready check
- warm-up/preparation
- active training
- modified session
- stopped exercise
- stopped session
- completed
- logged
- trainer reviewed

### Transitions

Scheduled to ready check: session begins.

Ready check to warm-up: no major concern.

Ready check to modified session: fatigue, pain, symptoms, or logistics require adjustment.

Warm-up to active training: client appears ready and safe to continue.

Active training to stopped exercise: exercise-specific pain, technique failure, or impracticality.

Active training to stopped session: systemic symptoms, red flags, severe pain, or trainer decision.

Completed to logged: session data recorded.

Logged to trainer reviewed: trainer confirms implications for future plan.

### Required inputs

- planned session
- readiness status
- pain/symptom update
- exercises prescribed
- sets/reps/load/duration
- RPE/session RPE
- modifications
- adherence status

### Generated outputs

- completed work
- missed work
- substitutions
- RPE/fatigue signal
- pain/symptom notes
- technique notes
- progression/regression signal
- next-session recommendation

### Progression triggers

- target work completed
- RPE within target
- technique acceptable
- no concerning pain
- recovery adequate
- adherence stable

### Regression triggers

- pain provocation
- unexpected high RPE
- technique breakdown
- missed work
- poor readiness
- symptoms
- client confidence issue

### Safety stop/escalation states

- stopped exercise
- stopped session
- referral flag
- incident logged
- medical/emergency guidance suggested where appropriate

### What persists historically

- planned vs completed work
- loads/reps/sets/duration
- RPE/session RPE
- substitutions
- pain notes
- readiness notes
- trainer modifications
- stop reasons
- progression/regression suggestion

### Trainer approval required

- continuing after pain appears
- meaningful session modification
- stopping session
- applying progression next time after unusual response

### AI may suggest

- log summary
- next-session adjustment
- recurring issue detection
- adherence trend
- pain trend

### Never automated

- real-time technique correction
- emergency decision
- diagnosis
- final decision to continue after concerning symptoms

## How assessment changes prescription

Assessment produces constraints and priorities.

Examples of outputs:

- risk status
- missing-data status
- allowed intensity range
- pain constraints
- equipment constraints
- movement-quality concerns
- training-level estimate
- adherence constraints

Prescription must reference these constraints explicitly.

## How session logs change future prescription

Session logs update:

- progression readiness
- fatigue trend
- pain trend
- adherence trend
- exercise suitability
- load tolerance
- recovery needs

Protocol should not progress from plan intent alone. It should compare planned work with actual logged response.

## How pain/risk/adherence override progression

Safety and scope override performance goals.

Pain response can hold, regress, or stop progression.

Risk flags can limit intensity, testing, or modality.

Adherence failures can reduce complexity, frequency, volume, or session duration.

Recovery/fatigue can trigger deload or hold.

## MVP now

MVP needs:

- separate status for client, assessment, block, and session
- provisional state for missing data
- assessment validity state
- block approval state
- session log state
- modification/reason logging
- progression/regression signals
- trainer approval gates
- audit trail for major transitions

## Advanced later

Later versions may add:

- automatic block outcome scoring
- adaptive periodization suggestions
- readiness trends
- multi-block planning
- clinician instruction integration
- formal reassessment scheduling
- learning center/study mode for trainers
- cohort analytics
- product learning from anonymized patterns if legally and ethically appropriate

## Learning/study layer note

A trainer education area can be added later, but it should not block the operating system MVP.

For MVP, Protocol should teach through the workflow: explain why a field matters, why a warning appears, why a progression is suggested, and why trainer approval is required.

A full study module can become a later product layer after the core workflow is stable.

## Open issues for validation

Avoid overusing Shape Up terms such as betting/appetite in the trainer-facing product unless they are translated into normal training language.

Avoid hardcoding 6-week blocks universally.

Avoid hardcoding 3:1 loading universally.

Avoid treating movement screens as injury predictors.

Avoid treating one pain event as automatic medical referral without context.

Do not let AI silently advance lifecycle states without trainer approval.