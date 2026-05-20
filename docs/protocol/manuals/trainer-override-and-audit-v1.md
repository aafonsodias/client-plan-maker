# trainer-override-and-audit-v1

## Status

Draft v1 distilled from Protocol Core Stack output 7. This is a product-domain manual for audit, versioning, trainer overrides, AI suggestions, and historical accountability.

This manual does not define a punitive surveillance system. It defines a professional decision-support memory for safety, explainability, trainer control, and product learning.

## Core principle

Protocol must preserve the reasoning behind important decisions.

The system should make clear:

- what was suggested
- what was approved
- what was rejected
- what changed
- who changed it
- why it changed
- what rule/source/constraint influenced it
- what happened after

AI must never silently change the live prescription.

Trainer approval is the default gate for meaningful prescription, safety, pain, progression, and override decisions.

## Source hierarchy

When sources conflict, Protocol prioritizes:

1. safety and scope of practice
2. practical personal-trainer usability
3. adherence and feasibility
4. exercise science
5. pain-informed communication
6. product/software workflow

## Audit model

Protocol should use an append-only event model for important historical decisions.

Events that happened should not be deleted. Mistakes should be corrected with a later correction event.

Future plans can be edited. Historical events should be preserved.

## Audit item 1 - Trainer overrides

### Why it matters

Trainer overrides preserve professional judgment and explain why the trainer deviated from a system suggestion, default rule, or prior plan.

### Store

- override_id
- trainer_id
- client_id
- affected object: assessment, risk flag, prescription, exercise, session, block
- previous value
- new value
- reason
- timestamp
- related AI suggestion if any
- related safety/risk/pain/adherence flag if any

### Decision owner

Trainer.

### Impact

Safety, legal caution, training quality, adherence, trust.

### MVP

Yes.

### Rule

Any meaningful override must require a reason.

## Audit item 2 - AI suggestions

### Why it matters

AI suggestions must be transparent and reviewable. The system must avoid black-box prescription.

### Store

- suggestion_id
- model/source if available
- input summary or input reference
- suggested change
- affected parameter
- confidence/uncertainty if available
- timestamp
- acceptance status: pending, accepted, modified, rejected

### Decision owner

AI suggests. Trainer decides.

### Impact

Explainability, product learning, training quality.

### MVP

Basic logging for AI-generated plans and suggestions. Rich suggestion analytics later.

## Audit item 3 - Rejected AI suggestions

### Why it matters

Rejected suggestions reveal where automation fails, where trainer judgment is superior, and where prompts/rules need improvement.

### Store

- suggestion
- rejection reason
- trainer note
- alternative chosen
- timestamp
- category: unsafe, impractical, wrong goal, wrong equipment, pain conflict, adherence issue, preference issue, other

### Decision owner

Trainer.

### Impact

Product learning, safety, training quality.

### MVP

Yes for rejected plan-level or prescription-level suggestions. Fine-grained analytics later.

## Audit item 4 - Risk flags

### Why it matters

Risk flags shape what Protocol allows, warns about, or requires trainer review for.

### Store

- flag type
- source: client report, trainer observation, measurement, clinician document, system inference
- date detected
- related data
- severity/context
- status: active, resolved, outdated, invalidated
- trainer review status

### Decision owner

System may create flag. Trainer reviews. Medical scope remains medical.

### Impact

Safety, legal caution.

### MVP

Yes.

### Rule

Risk flags must be versioned and historically traceable.

## Audit item 5 - Screening decisions

### Why it matters

Screening determines whether a client is active, provisional, restricted, referred, or awaiting clearance.

### Store

- screening version
- raw answers
- missing data
- generated flags
- trainer review
- final status
- clearance/referral status
- timestamp

### Decision owner

System can suggest status. Trainer approves within scope. Clinician provides clearance where needed.

### Impact

Safety, legal caution, training eligibility.

### MVP

Yes.

## Audit item 6 - Missing-data warnings

### Why it matters

Missing data affects confidence. It explains why intensity, testing, or progression may be limited.

### Store

- missing field
- importance level
- affected decision
- current workaround
- trainer acknowledgement
- resolved date if later provided

### Decision owner

System flags. Trainer decides how to proceed within scope.

### Impact

Safety, explainability, product quality.

### MVP

Yes.

## Audit item 7 - Prescription parameter changes

### Why it matters

Prescription is the dose. Dose changes must be traceable.

### Store

- parameter changed
- previous value
- new value
- reason
- trigger: assessment, session log, pain, risk, adherence, trainer preference, AI suggestion
- trainer approval
- timestamp

### Decision owner

Trainer approves. AI may suggest.

### Impact

Training quality, safety, adaptation, adherence.

### MVP

Yes.

## Audit item 8 - Exercise substitutions

### Why it matters

Substitutions preserve or alter the training intent. They also reveal equipment, pain, adherence, and skill constraints.

### Store

- original exercise
- substituted exercise
- reason
- preserved intent: same pattern, same muscle, same equipment class, lower skill, lower pain trigger, other
- trainer approval
- client response if available

### Decision owner

Trainer. AI may suggest.

### Impact

Training quality, adherence, safety.

### MVP

Yes.

## Audit item 9 - Pain-related modifications

### Why it matters

Pain decisions must show that the trainer did not ignore pain or overstep into diagnosis/treatment.

### Store

- pain report
- location
- severity
- exercise/context
- modification attempted
- response to modification
- decision: continue, regress, stop exercise, stop session, refer
- trainer note
- timestamp

### Decision owner

Trainer.

### Impact

Safety, legal caution, scope protection, training quality.

### MVP

Yes.

## Audit item 10 - Session changes

### Why it matters

The plan is not the reality. Session changes explain adaptation and adherence.

### Store

- planned session
- completed session
- changes made
- reason
- RPE/session RPE
- pain/symptom notes
- adherence status
- trainer note

### Decision owner

Trainer/client execution; trainer reviews.

### Impact

Training quality, adherence, product learning.

### MVP

Yes.

## Audit item 11 - Reassessments

### Why it matters

Reassessment validates whether the current plan is working and whether constraints changed.

### Store

- reassessment reason
- previous baseline
- new result
- method/protocol version
- confidence level
- trainer interpretation
- resulting plan change if any

### Decision owner

Trainer.

### Impact

Validated learning, training quality, safety.

### MVP

Yes.

## Audit item 12 - Referrals / medical clearance status

### Why it matters

Referral and clearance define scope boundaries.

### Store

- referral reason
- date
- status: recommended, pending, completed, clearance uploaded, restrictions provided, declined/unknown
- document reference if uploaded
- trainer action
- restrictions extracted if appropriate

### Decision owner

Trainer recommends referral. Clinician provides medical clearance/restrictions. Client chooses whether to provide documents.

### Impact

Safety, legal caution, scope protection.

### MVP

Yes.

### Rule

Do not delete referral history. If entered in error, invalidate with correction event.

## Audit item 13 - Client feedback

### Why it matters

Client feedback affects adherence, readiness, tolerability, and future prescription.

### Store

- feedback type: RPE, pain, fatigue, mood, confidence, barrier, preference, symptom, note
- timestamp
- linked session/block if relevant
- trainer response if any

### Decision owner

Client reports. Trainer interprets. AI may summarize.

### Impact

Adherence, training quality, safety.

### MVP

Yes.

## Audit item 14 - Progression/regression decisions

### Why it matters

Progression is a high-impact decision. Regression is not failure; it is adaptation to evidence.

### Store

- previous dose
- new dose
- progression/regression type: load, reps, sets, range, complexity, duration, intensity, frequency
- trigger
- supporting evidence: log, RPE, pain, adherence, assessment, trainer judgment
- trainer approval

### Decision owner

Trainer. AI may suggest.

### Impact

Training quality, safety, adaptation.

### MVP

Yes.

## Audit item 15 - Block completion / failure / rebuild decisions

### Why it matters

Prevents endless plan drift and makes block transitions explicit.

### Store

- block status: completed, paused, stopped, failed, rebuilt, continued
- reason
- outcome summary
- adherence summary
- pain/risk summary
- progression result
- next-block decision
- trainer approval

### Decision owner

Trainer.

### Impact

Product learning, training quality, adherence.

### MVP

Yes.

## Immutability rules

Immutable events:

- consent signed
- assessment submitted
- risk flag generated
- pain reported
- session completed
- referral recommended
- clearance uploaded
- AI suggestion generated
- trainer override made
- block completed/stopped

Editable future objects:

- future sessions
- draft plans
- draft block goals
- draft prescriptions
- coaching notes not yet committed

Edits requiring reason:

- risk flag status change
- referral/clearance change
- prescription parameter change after approval
- pain-related decision change
- deletion/invalidation of important records
- trainer override

## Mistaken entry handling

Do not hard-delete important historical events.

Use a correction event:

- original event ID
- correction reason
- corrected value if applicable
- corrected by
- timestamp

The UI can hide invalidated entries by default while preserving audit history.

## Avoiding silent AI changes

AI output must have one of these statuses:

- suggested
- accepted
- modified
- rejected
- expired

AI must not directly change:

- risk status
- clearance status
- approved prescription
- active block core parameters
- pain/referral decisions
- progression after concerning data

without trainer approval.

## Audit without surveillance

Audit exists to support:

- safety
- continuity
- explainability
- professional accountability
- client progress review
- product learning

Audit should not be designed primarily to punish trainers, rank staff, or optimize utilization at the expense of client care.

If analytics are used later, they should be transparent, ethically scoped, privacy-aware, and preferably aggregated.

## MVP now

MVP audit requires:

- trainer overrides
- AI suggestions for plan/prescription
- accepted/rejected AI suggestion status
- risk flags
- screening decisions
- missing-data warnings
- prescription changes
- exercise substitutions
- pain modifications
- session changes
- reassessment events
- referral/clearance status
- progression/regression decisions
- block completion/rebuild decisions

## Advanced later

Later versions may add:

- richer AI suggestion analytics
- anonymized product learning dashboards
- model-performance tracking
- cohort-level training outcomes
- clinician collaboration logs
- document extraction from clearance notes
- privacy-preserving analytics
- organization/team audit views

## Decision authority

Deterministic:

- create audit events for important decisions
- mark missing data
- preserve immutable history
- require reason for risky edits

Trainer approval required:

- overrides
- prescription changes
- progression/regression
- pain-related modifications
- referral-related decisions within trainer scope
- accepting/modifying/rejecting AI suggestions

AI-assisted:

- summarize histories
- suggest changes
- detect patterns
- flag contradictions
- suggest audit reason drafts

Never automated:

- diagnosis
- treatment
- medical clearance
- emergency decisions
- silent prescription changes
- hiding clinically or professionally relevant history

## Open issues for validation

Legal/privacy requirements must be reviewed for the target market.

Audit retention policy must be defined.

Client access to audit/history must be designed carefully.

AI suggestion logs may contain sensitive data and require privacy-aware storage.

Medical clearance uploads require secure handling.

The product must avoid turning safety audit into punitive surveillance.

